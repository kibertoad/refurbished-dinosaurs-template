using System.Buffers.Binary;
using System.Text;

namespace Restoration.Resources;

public static class SourceKinds
{
    public const string Directory = "directory";
    public const string Iso9660 = "iso9660";
    public const string CueBin = "cue-bin";

    public static bool IsSupported(string value) => value is Directory or Iso9660 or CueBin;
}

public sealed record SourceEntry(string Path, long Size);

/// <summary>Read-only, bounded access to a directory or supported original-media image.</summary>
public abstract class OriginalContentSource : IDisposable
{
    public abstract string Kind { get; }
    public abstract string? Label { get; }
    public abstract IReadOnlyList<SourceEntry> Files { get; }
    public virtual CueSheet? Cue { get; protected init; }
    public abstract bool TryGetFile(string relativePath, out SourceEntry? entry);
    public abstract Stream OpenRead(string relativePath);
    public abstract void Dispose();

    public static OriginalContentSource Open(string path, string kind) => kind switch
    {
        SourceKinds.Directory => new DirectoryContentSource(path),
        SourceKinds.Iso9660 => Iso9660ContentSource.OpenCooked(path),
        SourceKinds.CueBin => Iso9660ContentSource.OpenCueBin(path),
        _ => throw new InvalidDataException($"Unsupported source kind '{kind}'.")
    };
}

internal sealed class DirectoryContentSource : OriginalContentSource
{
    private const int MaximumEntries = 100_000;
    private readonly Dictionary<string, (SourceEntry Entry, string FullPath)> files =
        new(StringComparer.OrdinalIgnoreCase);

    public DirectoryContentSource(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            throw new DirectoryNotFoundException($"Source directory not found: {path}");
        var root = Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var options = new EnumerationOptions
        {
            RecurseSubdirectories = true,
            IgnoreInaccessible = false,
            AttributesToSkip = FileAttributes.ReparsePoint
        };
        foreach (var fullPath in Directory.EnumerateFiles(root, "*", options))
        {
            var relative = SourceManifest.Normalize(Path.GetRelativePath(root, fullPath));
            var entry = new SourceEntry(relative, new FileInfo(fullPath).Length);
            if (!files.TryAdd(relative, (entry, fullPath)))
                throw new InvalidDataException($"Source contains duplicate path '{relative}'.");
            if (files.Count > MaximumEntries)
                throw new InvalidDataException("Source entry count exceeds the safety limit.");
        }
        Files = files.Values.Select(value => value.Entry)
            .OrderBy(entry => entry.Path, StringComparer.OrdinalIgnoreCase).ToArray();
    }

    public override string Kind => SourceKinds.Directory;
    public override string? Label => null;
    public override IReadOnlyList<SourceEntry> Files { get; }

    public override bool TryGetFile(string relativePath, out SourceEntry? entry)
    {
        if (files.TryGetValue(SourceManifest.Normalize(relativePath), out var value))
        {
            entry = value.Entry;
            return true;
        }
        entry = null;
        return false;
    }

    public override Stream OpenRead(string relativePath)
    {
        if (!files.TryGetValue(SourceManifest.Normalize(relativePath), out var value))
            throw new FileNotFoundException("Source file was not found.", relativePath);
        return new FileStream(value.FullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
    }

    public override void Dispose() { }
}

internal sealed class Iso9660ContentSource : OriginalContentSource
{
    private const int LogicalSectorSize = 2048;
    private const int MaximumDescriptors = 240;
    private const int MaximumDirectoryDepth = 32;
    private const int MaximumEntries = 100_000;
    private const uint MaximumDirectoryBytes = 64 * 1024 * 1024;
    private readonly Func<Stream> openLogicalStream;
    private readonly long imageLength;
    private readonly string kind;
    private readonly Dictionary<string, IsoEntry> files = new(StringComparer.OrdinalIgnoreCase);

    private Iso9660ContentSource(Func<Stream> openLogicalStream, long imageLength, string kind)
    {
        this.openLogicalStream = openLogicalStream;
        this.imageLength = imageLength;
        this.kind = kind;
        using var stream = openLogicalStream();
        if (imageLength < 18L * LogicalSectorSize)
            throw new InvalidDataException("Source is too small to be an ISO-9660 image.");
        var descriptor = FindPrimaryVolumeDescriptor(stream);
        Label = DecodeIdentifier(descriptor.AsSpan(40, 32));
        var volumeSectors = ReadBothEndianUInt32(descriptor, 80, "volume size");
        if (checked((long)volumeSectors * LogicalSectorSize) > imageLength)
            throw new InvalidDataException("ISO-9660 volume extends outside the image.");
        var logicalSize = ReadBothEndianUInt16(descriptor, 128, "logical block size");
        if (logicalSize != LogicalSectorSize)
            throw new InvalidDataException($"Unsupported ISO-9660 logical block size: {logicalSize}.");
        var root = ParseDirectoryRecord(descriptor, 156, descriptor[156]);
        if (!root.IsDirectory) throw new InvalidDataException("ISO-9660 root record is not a directory.");
        ReadDirectory(stream, root, string.Empty, 0, []);
        Files = files.Values.Select(value => value.Entry)
            .OrderBy(entry => entry.Path, StringComparer.OrdinalIgnoreCase).ToArray();
    }

    public static Iso9660ContentSource OpenCooked(string path)
    {
        var fullPath = RequireFile(path, "ISO image");
        var length = new FileInfo(fullPath).Length;
        if (length == 0 || length % LogicalSectorSize != 0)
            throw new InvalidDataException("ISO image length must be a positive multiple of 2048 bytes.");
        return new(() => new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read),
            length, SourceKinds.Iso9660);
    }

    public static Iso9660ContentSource OpenCueBin(string input)
    {
        var (cuePath, binPath, cue) = ResolveCueBin(input);
        cue.ValidateBin(binPath);
        var sectors = new FileInfo(binPath).Length / CueSheet.RawSectorSize;
        var dataSectors = cue.DataTrackSectors ?? sectors;
        if (dataSectors <= 16 || dataSectors > sectors)
            throw new InvalidDataException("CUE data-track boundary is outside the BIN image.");
        return new(() => new RawMode1UserDataStream(
                new FileStream(binPath, FileMode.Open, FileAccess.Read, FileShare.Read), dataSectors),
            checked(dataSectors * LogicalSectorSize), SourceKinds.CueBin)
        { CuePath = cuePath, BinPath = binPath, Cue = cue };
    }

    public override string Kind => kind;
    public override string? Label { get; }
    public override IReadOnlyList<SourceEntry> Files { get; }
    public string? CuePath { get; private init; }
    public string? BinPath { get; private init; }
    public override CueSheet? Cue { get; protected init; }

    public override bool TryGetFile(string relativePath, out SourceEntry? entry)
    {
        if (files.TryGetValue(SourceManifest.Normalize(relativePath), out var value))
        {
            entry = value.Entry;
            return true;
        }
        entry = null;
        return false;
    }

    public override Stream OpenRead(string relativePath)
    {
        if (!files.TryGetValue(SourceManifest.Normalize(relativePath), out var value))
            throw new FileNotFoundException("Source file was not found in the ISO-9660 image.", relativePath);
        return new ExtentReadStream(openLogicalStream(),
            checked((long)value.Extent * LogicalSectorSize), value.Entry.Size);
    }

    public override void Dispose() { }

    private static (string CuePath, string BinPath, CueSheet Cue) ResolveCueBin(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) throw new ArgumentException("Source path is required.", nameof(input));
        var fullInput = Path.GetFullPath(input);
        var directory = Directory.Exists(fullInput) ? fullInput : Path.GetDirectoryName(fullInput);
        if (directory is null || !Directory.Exists(directory))
            throw new DirectoryNotFoundException($"CUE/BIN source path not found: {fullInput}");

        string? cuePath = null;
        string? binPath = null;
        if (File.Exists(fullInput))
        {
            var extension = Path.GetExtension(fullInput);
            if (extension.Equals(".cue", StringComparison.OrdinalIgnoreCase)) cuePath = fullInput;
            else if (extension.Equals(".bin", StringComparison.OrdinalIgnoreCase)) binPath = fullInput;
            else throw new InvalidDataException("CUE/BIN source must be a directory or a .cue/.bin file.");
        }

        var cues = Enumerate(directory, ".cue");
        var bins = Enumerate(directory, ".bin");
        cuePath ??= MatchStem(binPath, cues) ?? Single(cues, "CUE sheet");
        var cue = CueSheet.Load(cuePath);
        binPath ??= ResolveReference(directory, cue.ReferencedFile)
                    ?? MatchStem(cuePath, bins) ?? Single(bins, "BIN image");
        return (cuePath, binPath, cue);
    }

    private static string[] Enumerate(string directory, string extension) =>
        Directory.EnumerateFiles(directory, "*", SearchOption.TopDirectoryOnly)
            .Where(path => Path.GetExtension(path).Equals(extension, StringComparison.OrdinalIgnoreCase))
            .Order(StringComparer.OrdinalIgnoreCase).ToArray();

    private static string? MatchStem(string? source, IReadOnlyList<string> candidates)
    {
        if (source is null) return null;
        var stem = Path.GetFileNameWithoutExtension(source);
        return candidates.FirstOrDefault(path =>
            Path.GetFileNameWithoutExtension(path).Equals(stem, StringComparison.OrdinalIgnoreCase));
    }

    private static string Single(IReadOnlyList<string> paths, string label) => paths.Count == 1
        ? paths[0] : throw new InvalidDataException($"Could not select exactly one {label}.");

    private static string? ResolveReference(string directory, string reference)
    {
        var root = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var path = Path.GetFullPath(Path.Combine(directory,
            reference.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(root, OperatingSystem.IsWindows()
                ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
            throw new InvalidDataException("CUE FILE escapes the source directory.");
        return File.Exists(path) ? path : null;
    }

    private static string RequireFile(string path, string label)
    {
        if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException($"{label} path is required.", nameof(path));
        var fullPath = Path.GetFullPath(path);
        if (!File.Exists(fullPath)) throw new FileNotFoundException($"{label} not found.", fullPath);
        return fullPath;
    }

    private static byte[] FindPrimaryVolumeDescriptor(Stream stream)
    {
        var buffer = new byte[LogicalSectorSize];
        for (var index = 16; index < 16 + MaximumDescriptors; index++)
        {
            stream.Position = checked((long)index * LogicalSectorSize);
            stream.ReadExactly(buffer);
            if (!buffer.AsSpan(1, 5).SequenceEqual("CD001"u8) || buffer[6] != 1)
                throw new InvalidDataException($"Invalid ISO-9660 volume descriptor at sector {index}.");
            if (buffer[0] == 1) return buffer.ToArray();
            if (buffer[0] == 255) break;
        }
        throw new InvalidDataException("ISO-9660 primary volume descriptor was not found.");
    }

    private void ReadDirectory(Stream stream, DirectoryRecord directory, string parent, int depth,
        HashSet<(uint Extent, uint Length)> visited)
    {
        if (depth > MaximumDirectoryDepth)
            throw new InvalidDataException("ISO-9660 directory depth exceeds the safety limit.");
        if (directory.DataLength > MaximumDirectoryBytes)
            throw new InvalidDataException("ISO-9660 directory exceeds the safety limit.");
        ValidateExtent(directory.Extent, directory.DataLength);
        if (!visited.Add((directory.Extent, directory.DataLength))) return;

        var data = new byte[checked((int)directory.DataLength)];
        stream.Position = checked((long)directory.Extent * LogicalSectorSize);
        stream.ReadExactly(data);
        var offset = 0;
        while (offset < data.Length)
        {
            var recordLength = data[offset];
            if (recordLength == 0)
            {
                offset = Math.Min(data.Length, checked(((offset / LogicalSectorSize) + 1) * LogicalSectorSize));
                continue;
            }
            var record = ParseDirectoryRecord(data, offset, recordLength);
            offset += recordLength;
            if (record.Identifier is "\0" or "\u0001") continue;
            if (record.IsMultiExtent)
                throw new InvalidDataException($"Multi-extent ISO-9660 entry is unsupported: '{record.Identifier}'.");
            var name = NormalizeIsoName(record.Identifier);
            var relative = string.IsNullOrEmpty(parent) ? name : $"{parent}/{name}";
            ValidateExtent(record.Extent, record.DataLength);
            if (record.IsDirectory) ReadDirectory(stream, record, relative, depth + 1, visited);
            else
            {
                var entry = new SourceEntry(relative, record.DataLength);
                if (!files.TryAdd(relative, new(entry, record.Extent)))
                    throw new InvalidDataException($"ISO-9660 image contains duplicate path '{relative}'.");
                if (files.Count > MaximumEntries)
                    throw new InvalidDataException("ISO-9660 entry count exceeds the safety limit.");
            }
        }
    }

    private void ValidateExtent(uint extent, uint length)
    {
        var start = checked((long)extent * LogicalSectorSize);
        var end = checked(start + length);
        if (end > imageLength) throw new InvalidDataException("ISO-9660 extent lies outside the image.");
    }

    private static DirectoryRecord ParseDirectoryRecord(byte[] data, int offset, int recordLength)
    {
        if (recordLength < 34 || offset < 0 || offset + recordLength > data.Length)
            throw new InvalidDataException("ISO-9660 directory record is truncated.");
        var identifierLength = data[offset + 32];
        if (33 + identifierLength > recordLength)
            throw new InvalidDataException("ISO-9660 directory identifier is truncated.");
        return new(ReadBothEndianUInt32(data, offset + 2, "extent"),
            ReadBothEndianUInt32(data, offset + 10, "data length"),
            Encoding.ASCII.GetString(data, offset + 33, identifierLength),
            (data[offset + 25] & 0x02) != 0, (data[offset + 25] & 0x80) != 0);
    }

    private static uint ReadBothEndianUInt32(byte[] data, int offset, string field)
    {
        var little = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(offset, 4));
        var big = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(offset + 4, 4));
        if (little != big) throw new InvalidDataException($"ISO-9660 {field} byte orders disagree.");
        return little;
    }

    private static ushort ReadBothEndianUInt16(byte[] data, int offset, string field)
    {
        var little = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset, 2));
        var big = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset + 2, 2));
        if (little != big) throw new InvalidDataException($"ISO-9660 {field} byte orders disagree.");
        return little;
    }

    private static string NormalizeIsoName(string identifier)
    {
        var separator = identifier.LastIndexOf(';');
        var name = (separator >= 0 ? identifier[..separator] : identifier).TrimEnd('.');
        if (string.IsNullOrWhiteSpace(name) || name.Contains('/') || name.Contains('\\') ||
            name.Contains(':') || name.Any(char.IsControl))
            throw new InvalidDataException($"Invalid ISO-9660 identifier '{identifier}'.");
        return name;
    }

    private static string? DecodeIdentifier(ReadOnlySpan<byte> bytes)
    {
        var value = Encoding.ASCII.GetString(bytes).TrimEnd(' ', '\0');
        return value.Length == 0 ? null : value;
    }

    private sealed record IsoEntry(SourceEntry Entry, uint Extent);
    private sealed record DirectoryRecord(uint Extent, uint DataLength, string Identifier,
        bool IsDirectory, bool IsMultiExtent);
}

internal sealed class RawMode1UserDataStream(Stream source, long sectorCount) : Stream
{
    private const int UserDataOffset = 16;
    private const int LogicalSectorSize = 2048;
    private long position;
    public override bool CanRead => true;
    public override bool CanSeek => true;
    public override bool CanWrite => false;
    public override long Length => checked(sectorCount * LogicalSectorSize);
    public override long Position { get => position; set => position = ValidatePosition(value); }
    public override int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));
    public override int Read(Span<byte> buffer)
    {
        var remaining = (int)Math.Min(buffer.Length, Length - position);
        var total = remaining;
        while (remaining > 0)
        {
            var sector = position / LogicalSectorSize;
            var within = (int)(position % LogicalSectorSize);
            var count = Math.Min(remaining, LogicalSectorSize - within);
            source.Position = checked(sector * CueSheet.RawSectorSize + UserDataOffset + within);
            source.ReadExactly(buffer.Slice(total - remaining, count));
            position += count;
            remaining -= count;
        }
        return total;
    }
    public override long Seek(long offset, SeekOrigin origin) => Position = origin switch
    {
        SeekOrigin.Begin => offset,
        SeekOrigin.Current => checked(position + offset),
        SeekOrigin.End => checked(Length + offset),
        _ => throw new ArgumentOutOfRangeException(nameof(origin))
    };
    private long ValidatePosition(long value) => value is >= 0 && value <= Length
        ? value : throw new IOException("Seek lies outside the raw data track.");
    public override void Flush() { }
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    protected override void Dispose(bool disposing) { if (disposing) source.Dispose(); base.Dispose(disposing); }
}

internal sealed class ExtentReadStream(Stream stream, long start, long length) : Stream
{
    private long position;
    public override bool CanRead => true;
    public override bool CanSeek => true;
    public override bool CanWrite => false;
    public override long Length => length;
    public override long Position { get => position; set => Seek(value, SeekOrigin.Begin); }
    public override int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));
    public override int Read(Span<byte> buffer)
    {
        var bounded = (int)Math.Min(buffer.Length, length - position);
        if (bounded <= 0) return 0;
        stream.Position = checked(start + position);
        var read = stream.Read(buffer[..bounded]);
        position += read;
        return read;
    }
    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var bounded = (int)Math.Min(buffer.Length, length - position);
        if (bounded <= 0) return 0;
        stream.Position = checked(start + position);
        var read = await stream.ReadAsync(buffer[..bounded], cancellationToken);
        position += read;
        return read;
    }
    public override long Seek(long offset, SeekOrigin origin)
    {
        var next = origin switch
        {
            SeekOrigin.Begin => offset,
            SeekOrigin.Current => checked(position + offset),
            SeekOrigin.End => checked(length + offset),
            _ => throw new ArgumentOutOfRangeException(nameof(origin))
        };
        if (next < 0 || next > length) throw new IOException("Seek lies outside the ISO-9660 extent.");
        return position = next;
    }
    public override void Flush() { }
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    protected override void Dispose(bool disposing) { if (disposing) stream.Dispose(); base.Dispose(disposing); }
    public override async ValueTask DisposeAsync() { await stream.DisposeAsync(); GC.SuppressFinalize(this); }
}
