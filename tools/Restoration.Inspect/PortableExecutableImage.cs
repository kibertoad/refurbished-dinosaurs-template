using System.Buffers.Binary;

namespace Restoration.Inspect;

/// <summary>Section layout of a 32-bit PE executable, read without loading it.</summary>
public sealed class PortableExecutableImage
{
    private const uint CodeContent = 0x0000_0020;
    private const uint MemoryExecute = 0x2000_0000;

    private PortableExecutableImage(uint imageBase, uint sizeOfImage, uint sizeOfHeaders,
        IReadOnlyList<PortableExecutableSection> sections)
    {
        ImageBase = imageBase;
        SizeOfImage = sizeOfImage;
        SizeOfHeaders = sizeOfHeaders;
        Sections = sections;
    }

    public uint ImageBase { get; }

    public uint SizeOfImage { get; }

    public uint SizeOfHeaders { get; }

    public IReadOnlyList<PortableExecutableSection> Sections { get; }

    public static PortableExecutableImage Read(ReadOnlySpan<byte> file)
    {
        if (file.Length < 0x40 || file[0] != (byte)'M' || file[1] != (byte)'Z')
        {
            throw new InvalidDataException("Not an MZ executable.");
        }
        var header = BinaryPrimitives.ReadInt32LittleEndian(file[0x3C..]);
        if (header <= 0 || header > file.Length - 24)
        {
            throw new InvalidDataException("The MZ header has no valid new-executable offset.");
        }
        var signature = file.Slice(header, 2);
        if (signature[0] != (byte)'P' || signature[1] != (byte)'E' || file[header + 2] != 0 || file[header + 3] != 0)
        {
            var found = char.IsAsciiLetterUpper((char)signature[0]) && char.IsAsciiLetterUpper((char)signature[1])
                ? $"{(char)signature[0]}{(char)signature[1]}"
                : "no known signature";
            throw new InvalidDataException(
                $"Not a PE executable ({found}). NE and LE/LX executables use segmented or object-relative " +
                "addresses, which this check does not read; see docs/GHIDRA.md.");
        }

        var sectionCount = BinaryPrimitives.ReadUInt16LittleEndian(file[(header + 6)..]);
        var optionalSize = BinaryPrimitives.ReadUInt16LittleEndian(file[(header + 20)..]);
        var optional = header + 24;
        if (optionalSize < 64 || optional + optionalSize > file.Length)
        {
            throw new InvalidDataException("The PE optional header is truncated.");
        }
        var magic = BinaryPrimitives.ReadUInt16LittleEndian(file[optional..]);
        if (magic != 0x10B)
        {
            throw new InvalidDataException($"Only PE32 images are supported (optional header magic 0x{magic:X4}).");
        }
        var imageBase = BinaryPrimitives.ReadUInt32LittleEndian(file[(optional + 28)..]);
        var sizeOfImage = BinaryPrimitives.ReadUInt32LittleEndian(file[(optional + 56)..]);
        var sizeOfHeaders = BinaryPrimitives.ReadUInt32LittleEndian(file[(optional + 60)..]);

        var table = optional + optionalSize;
        if (table + sectionCount * 40L > file.Length)
        {
            throw new InvalidDataException("The PE section table is truncated.");
        }
        var sections = new List<PortableExecutableSection>(sectionCount);
        for (var index = 0; index < sectionCount; index++)
        {
            var entry = file.Slice(table + index * 40, 40);
            var name = System.Text.Encoding.ASCII.GetString(entry[..8]).TrimEnd('\0');
            var virtualSize = BinaryPrimitives.ReadUInt32LittleEndian(entry[8..]);
            var virtualAddress = BinaryPrimitives.ReadUInt32LittleEndian(entry[12..]);
            var rawSize = BinaryPrimitives.ReadUInt32LittleEndian(entry[16..]);
            var characteristics = BinaryPrimitives.ReadUInt32LittleEndian(entry[36..]);
            // Old linkers leave VirtualSize at zero; the loader then maps the raw size.
            var mappedSize = Math.Max(virtualSize, rawSize);
            sections.Add(new PortableExecutableSection(name, imageBase + virtualAddress, mappedSize, rawSize,
                (characteristics & (CodeContent | MemoryExecute)) != 0));
        }
        return new PortableExecutableImage(imageBase, sizeOfImage, sizeOfHeaders, sections);
    }

    public PortableExecutableSection? SectionAt(uint address) =>
        Sections.FirstOrDefault(section => section.Contains(address));

    public bool IsHeader(uint address) =>
        address >= ImageBase && address - ImageBase < SizeOfHeaders;
}

public sealed record PortableExecutableSection(string Name, uint Start, uint MappedSize, uint RawSize, bool IsCode)
{
    public bool Contains(uint address) => address >= Start && address - Start < MappedSize;

    /// <summary>True when the address lies past the bytes stored in the file (zero-filled at load).</summary>
    public bool IsUninitialized(uint address) => address - Start >= RawSize;
}
