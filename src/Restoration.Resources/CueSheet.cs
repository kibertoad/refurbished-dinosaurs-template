using System.Text.RegularExpressions;

namespace Restoration.Resources;

public sealed record CueTrack(int Number, string Type, IReadOnlyDictionary<int, int> Indices);

/// <summary>Bounded parser for a single-file MODE1/2352 CUE/BIN image.</summary>
public sealed record CueSheet(string ReferencedFile, IReadOnlyList<CueTrack> Tracks)
{
    public const int RawSectorSize = 2352;
    private const int MaximumCueBytes = 1024 * 1024;
    private static readonly Regex FilePattern = new(
        "^\\s*FILE\\s+(?:\"(?<quoted>[^\"]+)\"|(?<plain>\\S+))\\s+\\S+\\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex TrackPattern = new(
        "^\\s*TRACK\\s+(?<number>\\d+)\\s+(?<type>\\S+)\\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex IndexPattern = new(
        "^\\s*INDEX\\s+(?<number>\\d+)\\s+(?<minute>\\d+):(?<second>\\d+):(?<frame>\\d+)\\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public long? DataTrackSectors => Tracks.Count > 1 ? Tracks[1].Indices[1] : null;

    public static CueSheet Load(string path)
    {
        var info = new FileInfo(path);
        if (!info.Exists) throw new FileNotFoundException("CUE sheet not found.", path);
        if (info.Length > MaximumCueBytes) throw new InvalidDataException("CUE sheet is too large.");
        return Parse(File.ReadAllText(path));
    }

    public static CueSheet Parse(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        if (text.Length > MaximumCueBytes) throw new InvalidDataException("CUE sheet is too large.");

        string? referencedFile = null;
        var tracks = new List<MutableTrack>();
        MutableTrack? current = null;
        foreach (var line in text.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n'))
        {
            var file = FilePattern.Match(line);
            if (file.Success)
            {
                if (referencedFile is not null)
                    throw new InvalidDataException("Multi-file CUE sheets are not supported.");
                referencedFile = file.Groups["quoted"].Success
                    ? file.Groups["quoted"].Value : file.Groups["plain"].Value;
                continue;
            }

            var track = TrackPattern.Match(line);
            if (track.Success)
            {
                if (!int.TryParse(track.Groups["number"].Value, out var number))
                    throw new InvalidDataException("CUE track number is invalid.");
                current = new(number, track.Groups["type"].Value.ToUpperInvariant());
                tracks.Add(current);
                continue;
            }

            var index = IndexPattern.Match(line);
            if (!index.Success) continue;
            if (current is null) throw new InvalidDataException("CUE INDEX appears before TRACK.");
            if (!int.TryParse(index.Groups["number"].Value, out var indexNumber) ||
                !int.TryParse(index.Groups["minute"].Value, out var minute) ||
                !int.TryParse(index.Groups["second"].Value, out var second) ||
                !int.TryParse(index.Groups["frame"].Value, out var frame))
                throw new InvalidDataException("CUE timestamp is invalid.");
            if (second >= 60 || frame >= 75)
                throw new InvalidDataException("CUE timestamp is outside the MM:SS:FF range.");
            int sector;
            try { sector = checked(minute * 60 * 75 + second * 75 + frame); }
            catch (OverflowException exception) { throw new InvalidDataException("CUE timestamp is too large.", exception); }
            if (!current.Indices.TryAdd(indexNumber, sector))
                throw new InvalidDataException($"Duplicate INDEX {indexNumber:D2} in track {current.Number:D2}.");
        }

        if (string.IsNullOrWhiteSpace(referencedFile))
            throw new InvalidDataException("CUE sheet has no FILE entry.");
        ValidateReference(referencedFile);
        if (tracks.Count is 0 or > 99)
            throw new InvalidDataException("CUE sheet must contain between 1 and 99 tracks.");
        if (tracks[0].Type != "MODE1/2352")
            throw new InvalidDataException("First CUE track must be MODE1/2352.");

        var previous = -1;
        for (var offset = 0; offset < tracks.Count; offset++)
        {
            var track = tracks[offset];
            if (track.Number != offset + 1)
                throw new InvalidDataException("CUE track numbers must be consecutive and start at 1.");
            if (!track.Indices.TryGetValue(1, out var start))
                throw new InvalidDataException($"Track {track.Number:D2} has no INDEX 01.");
            if (start < previous) throw new InvalidDataException("CUE track indices are not monotonic.");
            if (offset > 0 && track.Type != "AUDIO")
                throw new InvalidDataException($"Unsupported non-audio track {track.Number:D2}: {track.Type}.");
            previous = start;
        }

        return new(referencedFile, tracks.Select(track =>
            new CueTrack(track.Number, track.Type, track.Indices)).ToArray());
    }

    public void ValidateBin(string path)
    {
        var info = new FileInfo(path);
        if (!info.Exists) throw new FileNotFoundException("BIN image not found.", path);
        if (info.Length == 0 || info.Length % RawSectorSize != 0)
            throw new InvalidDataException($"BIN length must be a positive multiple of {RawSectorSize} bytes.");
        var sectors = info.Length / RawSectorSize;
        foreach (var track in Tracks)
            if (track.Indices[1] >= sectors)
                throw new InvalidDataException($"Track {track.Number:D2} starts outside the BIN image.");
    }

    private static void ValidateReference(string value)
    {
        var normalized = value.Replace('\\', '/');
        if (Path.IsPathFullyQualified(value) || normalized.Split('/').Any(part => part is "" or "." or ".."))
            throw new InvalidDataException("CUE FILE must be a safe relative path.");
    }

    private sealed record MutableTrack(int Number, string Type)
    {
        public Dictionary<int, int> Indices { get; } = [];
    }
}
