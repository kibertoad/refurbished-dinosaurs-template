using System.Buffers.Binary;
using Restoration.Inspect;
using Xunit;

namespace Restoration.Tests;

public sealed class AddressCitationTests
{
    // Synthetic layout: headers at 0x00400000, .text 0x00401000..0x00401100 (code),
    // .data 0x00402000..0x00402200 with only 0x80 bytes stored in the file.
    private static readonly byte[] Executable = SyntheticPe();

    [Fact]
    public void ReadsSectionLayout()
    {
        var image = PortableExecutableImage.Read(Executable);

        Assert.Equal(0x0040_0000u, image.ImageBase);
        Assert.Collection(image.Sections,
            text => Assert.Equal((".text", 0x0040_1000u, true), (text.Name, text.Start, text.IsCode)),
            data => Assert.Equal((".data", 0x0040_2000u, false), (data.Name, data.Start, data.IsCode)));
    }

    [Fact]
    public void RejectsExecutablesThatAreNotPe32()
    {
        var segmented = (byte[])Executable.Clone();
        segmented[0x80] = (byte)'L';
        segmented[0x81] = (byte)'E';

        var error = Assert.Throws<InvalidDataException>(() => PortableExecutableImage.Read(segmented));
        Assert.Contains("(LE)", error.Message);
    }

    [Fact]
    public void ClassifiesCitedAddresses()
    {
        var results = CheckDocs(new()
        {
            ["findings/FND-AI-001.md"] =
                "location: 0x00401010..0x00401100\n" +
                "Reads g_00402010 and the zero-filled table at 0x00402100.\n" +
                "The loop in fn_00401040 exits at 0x00401080.\n",
            ["notes.md"] = "Field unk_2A sits at file offset 0x0000002A. Mask 0xFFFFFFFF. Typo at 0x00409000.\n"
        });

        Assert.Equal(
        [
            "0x00401010 code", "0x00401040 code", "0x00401080 code", "..0x00401100 code",
            "0x00402010 data", "0x00402100 uninitialized", "0x00409000 outside-sections"
        ], results.Select(Describe));
        Assert.Equal([0x0040_9000u], results.Where(result => result.Failed).Select(result => result.Address));
        var typo = Assert.Single(results[^1].Citations);
        Assert.Equal(("notes.md", 1), (typo.File, typo.Line));
    }

    [Fact]
    public void SkipsFilesThatNameOtherBuilds()
    {
        var docs = new Dictionary<string, string>
        {
            ["retail.md"] = "---\nbuild: BLD-RETAIL-1.0\n---\nSee 0x00409000.\n",
            ["gog.md"] = "---\nbuilds: [BLD-GOG-1.1, BLD-RETAIL-1.0]\n---\nSee 0x00401000.\n",
            ["shared.md"] = "See 0x00402000.\n"
        };

        Assert.Equal(["0x00401000 code", "0x00402000 data"],
            CheckDocs(docs, build: "BLD-GOG-1.1").Select(Describe));
        Assert.Contains("0x00409000 outside-sections", CheckDocs(docs).Select(Describe));
    }

    [Fact]
    public void UsesGhidraInstructionBoundaries()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var inventory = Path.Combine(root, "gog.instructions.tsv");
            File.WriteAllText(inventory,
                "# schema=restoration-ghidra-analysis-v1\n# executable_sha256=ABC\n" +
                "function\taddress\tbytes\tmnemonic\toperands\tflow\tsemantic\n" +
                "00401040\t00401040\t55\tPUSH\tEBP\tFALL_THROUGH\tx\n" +
                "00401040\t00401041\t8bec\tMOV\tEBP, ESP\tFALL_THROUGH\tx\n" +
                "00401040\tram:00401043\te800000000\tCALL\t0x00401048\tUNCONDITIONAL_CALL\tx\n");
            var instructions = InstructionInventory.Read(inventory);
            Assert.Equal("abc", instructions.ExecutableSha256);

            var results = CheckDocs(new()
            {
                ["a.md"] = "fn_00401040 calls at 0x00401043, operand at 0x00401044, " +
                    "table at 0x00401060, and fn_00401041 is wrong. Range 0x00401040..0x00401048."
            }, instructions: instructions);

            Assert.Equal(
            [
                "0x00401040 function-entry", "0x00401041 not-a-function-entry", "0x00401043 instruction-start",
                "0x00401044 inside-instruction", "..0x00401048 code", "0x00401060 not-disassembled"
            ], results.Select(Describe));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private static IReadOnlyList<CitedAddress> CheckDocs(Dictionary<string, string> files, string? build = null,
        InstructionInventory? instructions = null)
    {
        var root = TestRoot();
        try
        {
            foreach (var (path, text) in files)
            {
                var full = Path.Combine(root, path);
                Directory.CreateDirectory(Path.GetDirectoryName(full)!);
                File.WriteAllText(full, text);
            }
            var image = PortableExecutableImage.Read(Executable);
            return AddressCitations.Check(image, AddressCitations.Find(root, image, build), instructions);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private static string Describe(CitedAddress result) =>
        $"{(result.Citations[0].IsRangeEnd ? ".." : "")}0x{result.Address:X8} {result.Kind}";

    private static string TestRoot() =>
        Path.Combine(Path.GetTempPath(), "restoration-citations-" + Guid.NewGuid().ToString("N"));

    private static byte[] SyntheticPe()
    {
        var file = new byte[0x400];
        file[0] = (byte)'M';
        file[1] = (byte)'Z';
        BinaryPrimitives.WriteInt32LittleEndian(file.AsSpan(0x3C), 0x80);
        "PE\0\0"u8.CopyTo(file.AsSpan(0x80));
        BinaryPrimitives.WriteUInt16LittleEndian(file.AsSpan(0x84), 0x14C);
        BinaryPrimitives.WriteUInt16LittleEndian(file.AsSpan(0x86), 2);
        BinaryPrimitives.WriteUInt16LittleEndian(file.AsSpan(0x94), 0xE0);
        var optional = 0x98;
        BinaryPrimitives.WriteUInt16LittleEndian(file.AsSpan(optional), 0x10B);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(optional + 28), 0x0040_0000);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(optional + 56), 0x3000);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(optional + 60), 0x200);
        var table = optional + 0xE0;
        Section(file.AsSpan(table, 40), ".text", 0x100, 0x1000, 0x100, 0x200, 0x6000_0020);
        Section(file.AsSpan(table + 40, 40), ".data", 0x200, 0x2000, 0x80, 0x300, 0xC000_0040);
        return file;
    }

    private static void Section(Span<byte> entry, string name, uint virtualSize, uint virtualAddress,
        uint rawSize, uint rawOffset, uint characteristics)
    {
        System.Text.Encoding.ASCII.GetBytes(name).CopyTo(entry);
        BinaryPrimitives.WriteUInt32LittleEndian(entry[8..], virtualSize);
        BinaryPrimitives.WriteUInt32LittleEndian(entry[12..], virtualAddress);
        BinaryPrimitives.WriteUInt32LittleEndian(entry[16..], rawSize);
        BinaryPrimitives.WriteUInt32LittleEndian(entry[20..], rawOffset);
        BinaryPrimitives.WriteUInt32LittleEndian(entry[36..], characteristics);
    }
}
