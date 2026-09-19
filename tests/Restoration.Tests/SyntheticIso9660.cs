using System.Buffers.Binary;
using System.Text;

namespace Restoration.Tests;

internal static class SyntheticIso9660
{
    public const int CookedSectorSize = 2048;
    public const int RawSectorSize = 2352;
    private const int UserDataOffset = 16;

    public static byte[] Build(int sectorSize, string path, byte[] content)
    {
        if (sectorSize is not (CookedSectorSize or RawSectorSize))
            throw new ArgumentOutOfRangeException(nameof(sectorSize));
        var parts = path.Split('/');
        if (parts.Length != 2) throw new ArgumentException("Fixture path must contain one directory.", nameof(path));
        const int rootSector = 20;
        const int directorySector = 21;
        const int payloadSector = 22;
        var image = new byte[23 * sectorSize];

        var pvd = Sector(image, sectorSize, 16);
        pvd[0] = 1;
        "CD001"u8.CopyTo(pvd[1..]);
        pvd[6] = 1;
        WritePaddedAscii(pvd[40..72], "SYNTHETIC");
        WriteBothEndian32(pvd, 80, 23);
        WriteBothEndian16(pvd, 128, CookedSectorSize);
        WriteDirectoryRecord(pvd, 156, rootSector, CookedSectorSize, true, [0]);

        var terminator = Sector(image, sectorSize, 17);
        terminator[0] = 255;
        "CD001"u8.CopyTo(terminator[1..]);
        terminator[6] = 1;

        var root = Sector(image, sectorSize, rootSector);
        var offset = WriteDirectoryRecord(root, 0, rootSector, CookedSectorSize, true, [0]);
        offset += WriteDirectoryRecord(root, offset, rootSector, CookedSectorSize, true, [1]);
        WriteDirectoryRecord(root, offset, directorySector, CookedSectorSize, true,
            Encoding.ASCII.GetBytes(parts[0]));

        var directory = Sector(image, sectorSize, directorySector);
        offset = WriteDirectoryRecord(directory, 0, directorySector, CookedSectorSize, true, [0]);
        offset += WriteDirectoryRecord(directory, offset, rootSector, CookedSectorSize, true, [1]);
        WriteDirectoryRecord(directory, offset, payloadSector, content.Length, false,
            Encoding.ASCII.GetBytes(parts[1] + ";1"));
        content.CopyTo(Sector(image, sectorSize, payloadSector));
        if (sectorSize == RawSectorSize)
            for (var sector = 0; sector < image.Length / RawSectorSize; sector++)
                WriteRawSectorHeader(image.AsSpan(sector * RawSectorSize, RawSectorSize), sector);
        return image;
    }

    /// <summary>
    /// Replaces the identifier of the single leaf file record, so a test can present a name the
    /// reader is expected to reject. The replacement must fit the record the fixture already wrote.
    /// </summary>
    public static void OverwriteLeafIdentifier(byte[] image, int sectorSize, string identifier)
    {
        var directory = Sector(image, sectorSize, 21);
        var offset = LeafOffset(directory);
        var bytes = Encoding.ASCII.GetBytes(identifier + ";1");
        var recordLength = 33 + bytes.Length + (bytes.Length % 2 == 0 ? 1 : 0);
        if (offset + recordLength > directory.Length)
            throw new ArgumentException("Replacement identifier does not fit.", nameof(identifier));
        // The leaf is the last record in the sector, so it is free to grow into the trailing zeroes
        // a reader treats as "no further records here".
        var record = directory.Slice(offset, recordLength);
        record[0] = checked((byte)recordLength);
        record[32] = checked((byte)bytes.Length);
        record[33..].Clear();
        bytes.CopyTo(record[33..]);
    }

    /// <summary>Rewrites the declared data length of the single leaf file record.</summary>
    public static void OverwriteLeafDataLength(byte[] image, int sectorSize, uint length) =>
        WriteBothEndian32(LeafRecord(image, sectorSize), 10, length);

    private static Span<byte> LeafRecord(byte[] image, int sectorSize)
    {
        var directory = Sector(image, sectorSize, 21);
        var offset = LeafOffset(directory);
        return directory.Slice(offset, directory[offset]);
    }

    /// <summary>The fixture lays the directory sector out as ".", "..", then the one file.</summary>
    private static int LeafOffset(Span<byte> directory) => directory[0] + directory[directory[0]];

    /// <summary>Writes the 16-byte MODE1/2352 header the raw reader validates before each payload.</summary>
    private static void WriteRawSectorHeader(Span<byte> sector, int lba)
    {
        sector[0] = 0x00;
        sector[1..11].Fill(0xFF);
        sector[11] = 0x00;
        var total = lba + 150;
        sector[12] = Bcd(total / (60 * 75));
        sector[13] = Bcd(total / 75 % 60);
        sector[14] = Bcd(total % 75);
        sector[15] = 1;
    }

    private static byte Bcd(int value) => checked((byte)(((value / 10) << 4) | (value % 10)));

    private static Span<byte> Sector(byte[] image, int sectorSize, int sector) =>
        image.AsSpan(sector * sectorSize + (sectorSize == RawSectorSize ? UserDataOffset : 0), CookedSectorSize);

    private static int WriteDirectoryRecord(Span<byte> destination, int offset, uint extent, int length,
        bool directory, ReadOnlySpan<byte> identifier)
    {
        var recordLength = 33 + identifier.Length + (identifier.Length % 2 == 0 ? 1 : 0);
        var record = destination.Slice(offset, recordLength);
        record[0] = checked((byte)recordLength);
        WriteBothEndian32(record, 2, extent);
        WriteBothEndian32(record, 10, checked((uint)length));
        record[25] = directory ? (byte)2 : (byte)0;
        WriteBothEndian16(record, 28, 1);
        record[32] = checked((byte)identifier.Length);
        identifier.CopyTo(record[33..]);
        return recordLength;
    }

    private static void WriteBothEndian32(Span<byte> destination, int offset, uint value)
    {
        BinaryPrimitives.WriteUInt32LittleEndian(destination[offset..], value);
        BinaryPrimitives.WriteUInt32BigEndian(destination[(offset + 4)..], value);
    }

    private static void WriteBothEndian16(Span<byte> destination, int offset, ushort value)
    {
        BinaryPrimitives.WriteUInt16LittleEndian(destination[offset..], value);
        BinaryPrimitives.WriteUInt16BigEndian(destination[(offset + 2)..], value);
    }

    private static void WritePaddedAscii(Span<byte> destination, string value)
    {
        destination.Fill((byte)' ');
        Encoding.ASCII.GetBytes(value).CopyTo(destination);
    }
}
