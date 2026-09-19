using System.Security.Cryptography;
using Restoration.Resources;
using Xunit;

namespace Restoration.Tests;

public sealed class OriginalContentSourceTests
{
    [Theory]
    [InlineData(SourceKinds.Iso9660, SyntheticIso9660.CookedSectorSize)]
    [InlineData(SourceKinds.CueBin, SyntheticIso9660.RawSectorSize)]
    public async Task InventoriesAndVerifiesSyntheticMedia(string kind, int sectorSize)
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var payload = new byte[] { 1, 2, 3, 4 };
            var image = SyntheticIso9660.Build(sectorSize, "GAME/TEST.BIN", payload);
            string source;
            if (kind == SourceKinds.Iso9660)
            {
                source = Path.Combine(root, "game.iso");
                await File.WriteAllBytesAsync(source, image, TestContext.Current.CancellationToken);
            }
            else
            {
                source = Path.Combine(root, "game.cue");
                await File.WriteAllBytesAsync(Path.Combine(root, "game.bin"), image,
                    TestContext.Current.CancellationToken);
                await File.WriteAllTextAsync(source,
                    "FILE \"game.bin\" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n",
                    TestContext.Current.CancellationToken);
            }

            using (var media = OriginalContentSource.Open(source, kind))
            {
                Assert.Equal("SYNTHETIC", media.Label);
                Assert.Equal(kind == SourceKinds.CueBin, media.Cue is not null);
                var entry = Assert.Single(media.Files);
                Assert.Equal("GAME/TEST.BIN", entry.Path);
                await using var stream = media.OpenRead("game/test.bin");
                var actual = new byte[payload.Length];
                await stream.ReadExactlyAsync(actual, TestContext.Current.CancellationToken);
                Assert.Equal(payload, actual);
            }

            var manifest = new SourceManifest("game", "synthetic",
                [new("GAME/TEST.BIN", payload.Length,
                    Convert.ToHexStringLower(SHA256.HashData(payload)))], kind);
            Assert.Empty(await OriginalContent.VerifySourceAsync(source, manifest,
                TestContext.Current.CancellationToken));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void CueParserRejectsTraversalAndAmbiguousDirectories()
    {
        Assert.Throws<InvalidDataException>(() => CueSheet.Parse(
            "FILE \"../game.bin\" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n"));

        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            File.WriteAllText(Path.Combine(root, "one.cue"),
                "FILE \"one.bin\" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n");
            File.WriteAllText(Path.Combine(root, "two.cue"),
                "FILE \"two.bin\" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n");
            Assert.Throws<InvalidDataException>(() => OriginalContentSource.Open(root, SourceKinds.CueBin));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task IsoReaderRejectsDisagreeingEndianFields()
    {
        var path = Path.Combine(TestRoot(), "bad.iso");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var image = SyntheticIso9660.Build(SyntheticIso9660.CookedSectorSize, "GAME/TEST.BIN", [1]);
        image[(16 * SyntheticIso9660.CookedSectorSize) + 86] ^= 1;
        await File.WriteAllBytesAsync(path, image, TestContext.Current.CancellationToken);
        try { Assert.Throws<InvalidDataException>(() => OriginalContentSource.Open(path, SourceKinds.Iso9660)); }
        finally { Directory.Delete(Path.GetDirectoryName(path)!, true); }
    }

    [Fact]
    public void SourceManifestRejectsUnknownSourceKind()
    {
        var manifest = new SourceManifest("game", "edition", [new("file", 0, new string('0', 64))], "zip");
        Assert.Throws<InvalidDataException>(manifest.Validate);
    }

    private static string TestRoot() => Path.Combine(Path.GetTempPath(),
        "restoration-media-tests", Guid.NewGuid().ToString("N"));
}
