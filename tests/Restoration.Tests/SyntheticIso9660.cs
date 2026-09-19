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
        return image;
    }

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
