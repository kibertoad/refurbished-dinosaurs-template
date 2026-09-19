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
    public async Task ReadsDataTrackUpToTheFollowingPregap()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            // 23 data sectors, a 150-sector pregap, then audio. The data track ends at INDEX 00.
            const int dataSectors = 23;
            const int pregapSectors = 150;
            var image = SyntheticIso9660.Build(SyntheticIso9660.RawSectorSize, "GAME/TEST.BIN", [7]);
            Array.Resize(ref image, (dataSectors + pregapSectors + 75) * SyntheticIso9660.RawSectorSize);
            await File.WriteAllBytesAsync(Path.Combine(root, "game.bin"), image,
                TestContext.Current.CancellationToken);
            var cue = Path.Combine(root, "game.cue");
            await File.WriteAllTextAsync(cue, string.Join('\n',
                "FILE \"game.bin\" BINARY",
                "  TRACK 01 MODE1/2352",
                "    INDEX 01 00:00:00",
                "  TRACK 02 AUDIO",
                "    INDEX 00 00:00:23",
                "    INDEX 01 00:02:23",
                ""), TestContext.Current.CancellationToken);

            var sheet = CueSheet.Load(cue);
            Assert.Equal(dataSectors, sheet.DataTrackSectors);

            using var media = OriginalContentSource.Open(cue, SourceKinds.CueBin);
            Assert.Equal("GAME/TEST.BIN", Assert.Single(media.Files).Path);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void CueParserRejectsPregapAfterItsOwnStart()
    {
        Assert.Throws<InvalidDataException>(() => CueSheet.Parse(string.Join('\n',
            "FILE \"game.bin\" BINARY",
            "  TRACK 01 MODE1/2352",
            "    INDEX 01 00:00:00",
            "  TRACK 02 AUDIO",
            "    INDEX 00 00:04:00",
            "    INDEX 01 00:02:00",
            "")));
    }

    [Fact]
    public async Task RawReaderRejectsAnImageThatIsNotMode1()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var image = SyntheticIso9660.Build(SyntheticIso9660.RawSectorSize, "GAME/TEST.BIN", [1]);
            // Sector 16 carries the primary volume descriptor; claim it is MODE2 instead.
            image[(16 * SyntheticIso9660.RawSectorSize) + 15] = 2;
            await File.WriteAllBytesAsync(Path.Combine(root, "game.bin"), image,
                TestContext.Current.CancellationToken);
            var cue = Path.Combine(root, "game.cue");
            await File.WriteAllTextAsync(cue,
                "FILE \"game.bin\" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n",
                TestContext.Current.CancellationToken);
            var failure = Assert.Throws<InvalidDataException>(
                () => OriginalContentSource.Open(cue, SourceKinds.CueBin));
            Assert.Contains("MODE1/2352", failure.Message, StringComparison.Ordinal);
        }
        finally { Directory.Delete(root, true); }
    }

    [Theory]
    [InlineData("../ESCAPE.TXT")]
    [InlineData("A/B.TXT")]
    [InlineData("A\\B.TXT")]
    public async Task IsoReaderRejectsIdentifiersThatEscapeTheirDirectory(string identifier)
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var path = Path.Combine(root, "bad.iso");
            var image = SyntheticIso9660.Build(SyntheticIso9660.CookedSectorSize, "GAME/TEST.BIN", [1]);
            SyntheticIso9660.OverwriteLeafIdentifier(image, SyntheticIso9660.CookedSectorSize, identifier);
            await File.WriteAllBytesAsync(path, image, TestContext.Current.CancellationToken);
            Assert.Throws<InvalidDataException>(() => OriginalContentSource.Open(path, SourceKinds.Iso9660));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task IsoReaderRejectsAnExtentOutsideTheImage()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var path = Path.Combine(root, "bad.iso");
            var image = SyntheticIso9660.Build(SyntheticIso9660.CookedSectorSize, "GAME/TEST.BIN", [1]);
            // Grow the payload's declared length far past the end of the 23-sector image.
            SyntheticIso9660.OverwriteLeafDataLength(image, SyntheticIso9660.CookedSectorSize, 1 << 30);
            await File.WriteAllBytesAsync(path, image, TestContext.Current.CancellationToken);
            var failure = Assert.Throws<InvalidDataException>(
                () => OriginalContentSource.Open(path, SourceKinds.Iso9660));
            Assert.Contains("outside the image", failure.Message, StringComparison.Ordinal);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task DirectorySourceInventoriesAndVerifiesNestedFiles()
    {
        var root = TestRoot();
        Directory.CreateDirectory(Path.Combine(root, "Game"));
        try
        {
            var payload = new byte[] { 9, 8, 7 };
            await File.WriteAllBytesAsync(Path.Combine(root, "Game", "TEST.BIN"), payload,
                TestContext.Current.CancellationToken);

            using (var media = OriginalContentSource.Open(root, SourceKinds.Directory))
            {
                Assert.Equal("Game/TEST.BIN", Assert.Single(media.Files).Path);
                Assert.True(media.TryGetFile("game/test.bin", out _));
                await using var stream = media.OpenRead("game/test.bin");
                var actual = new byte[payload.Length];
                await stream.ReadExactlyAsync(actual, TestContext.Current.CancellationToken);
                Assert.Equal(payload, actual);
            }

            var manifest = new SourceManifest("game", "synthetic",
                [new("Game/TEST.BIN", payload.Length, Convert.ToHexStringLower(SHA256.HashData(payload)))]);
            Assert.Empty(await OriginalContent.VerifySourceAsync(root, manifest,
                TestContext.Current.CancellationToken));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void FingerprintIdentifiesContentRatherThanTransport()
    {
        SourceManifest Manifest(string kind) => new("game", "edition",
            [new("GAME/TEST.BIN", 4, new string('a', 64))], kind);

        Assert.Equal(Manifest(SourceKinds.Directory).Fingerprint(),
            Manifest(SourceKinds.Iso9660).Fingerprint());
        Assert.Equal(Manifest(SourceKinds.Directory).Fingerprint(),
            Manifest(SourceKinds.CueBin).Fingerprint());
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
