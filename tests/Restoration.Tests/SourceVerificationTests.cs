using RefurbishedDinosaurs.Core.Assets;
using RefurbishedDinosaurs.LegacyFormats;
using Xunit;

namespace Restoration.Tests;

/// <summary>
/// Source verification through the kind an edition manifest declares. The readers themselves are
/// RefurbishedDinosaurs.LegacyFormats' <see cref="OriginalContentSource"/>, tested in that package;
/// these tests cover how edition manifests in the Extractor's form reach and judge them through
/// <see cref="AssetVerifier"/>.
/// </summary>
public sealed class SourceVerificationTests
{
    [Theory]
    [InlineData(ContentSourceKinds.Iso9660)]
    [InlineData(ContentSourceKinds.CueBin)]
    public async Task VerifiesSyntheticMediaThroughTheDeclaredKind(string kind)
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var payload = new byte[] { 1, 2, 3, 4 };
            var source = await WriteMediaAsync(root, kind, payload);

            Assert.True((await AssetVerifier.VerifyAsync(source, Manifest(kind, payload),
                TestContext.Current.CancellationToken)).IsValid);

            var wrong = new byte[] { 4, 3, 2, 1 };
            var issue = Assert.Single((await AssetVerifier.VerifyAsync(source,
                Manifest(kind, wrong), TestContext.Current.CancellationToken)).Issues);
            Assert.Equal(AssetProblem.WrongHash, issue.Problem);
            Assert.Equal("GAME/TEST.BIN", issue.Path);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task MediaOfAnotherKindIsReportedUnreadable()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var payload = new byte[] { 1, 2, 3, 4 };
            var iso = await WriteMediaAsync(root, ContentSourceKinds.Iso9660, payload);

            // The manifest says cue-bin, but the owner pointed at a cooked ISO with no sheet beside it.
            var issue = Assert.Single((await AssetVerifier.VerifyAsync(iso,
                Manifest(ContentSourceKinds.CueBin, payload), TestContext.Current.CancellationToken)).Issues);
            Assert.Equal(AssetProblem.Unreadable, issue.Problem);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task MalformedMediaIsReportedUnreadable()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var path = Path.Combine(root, "bad.iso");
            var image = SyntheticIso9660.Build(SyntheticIso9660.CookedSectorSize, "GAME/TEST.BIN", [1]);
            // Make the volume size's two byte orders disagree.
            image[(16 * SyntheticIso9660.CookedSectorSize) + 86] ^= 1;
            await File.WriteAllBytesAsync(path, image, TestContext.Current.CancellationToken);

            var issue = Assert.Single((await AssetVerifier.VerifyAsync(path,
                Manifest(ContentSourceKinds.Iso9660, [1]), TestContext.Current.CancellationToken)).Issues);
            Assert.Equal(AssetProblem.Unreadable, issue.Problem);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task DirectorySourceMatchesManifestPathsIgnoringCase()
    {
        var root = TestRoot();
        Directory.CreateDirectory(Path.Combine(root, "Game"));
        try
        {
            var payload = new byte[] { 9, 8, 7 };
            await File.WriteAllBytesAsync(Path.Combine(root, "Game", "TEST.BIN"), payload,
                TestContext.Current.CancellationToken);

            // The manifest's default source kind is a directory.
            var manifest = new AssetManifest("game", "synthetic",
                [new("game/test.bin", payload.Length, FileFingerprint.Xxh3(payload))]);
            Assert.True((await AssetVerifier.VerifyAsync(root, manifest,
                TestContext.Current.CancellationToken)).IsValid);

            var missing = new AssetManifest("game", "synthetic",
                [new("Game/OTHER.BIN", 1, new string('0', 32))]);
            Assert.Equal(AssetProblem.Missing, Assert.Single((await AssetVerifier.VerifyAsync(
                root, missing, TestContext.Current.CancellationToken)).Issues).Problem);

            // Identification names the edition the copy is and why the others are not.
            var identification = await AssetVerifier.IdentifyAsync(root, [missing, manifest with { SourceEdition = "match" }],
                TestContext.Current.CancellationToken);
            Assert.Equal("match", identification.Edition?.SourceEdition);
            Assert.Equal(AssetProblem.Missing, Assert.Single(Assert.Single(identification.Mismatches).Issues).Problem);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void FingerprintIdentifiesContentRatherThanTransport()
    {
        AssetManifest Manifest(string kind) => new("game", "edition",
            [new("GAME/TEST.BIN", 4, new string('a', 32))], kind);

        Assert.Equal(Manifest(ContentSourceKinds.Directory).Fingerprint(),
            Manifest(ContentSourceKinds.Iso9660).Fingerprint());
        Assert.Equal(Manifest(ContentSourceKinds.Directory).Fingerprint(),
            Manifest(ContentSourceKinds.CueBin).Fingerprint());
    }

    [Fact]
    public async Task ManifestWithAnUnknownSourceKindIsRejected()
    {
        var manifest = new AssetManifest("game", "edition", [new("file", 0, new string('0', 32))], "zip");
        await Assert.ThrowsAsync<InvalidDataException>(() => AssetVerifier.VerifyAsync(
            Path.GetTempPath(), manifest, TestContext.Current.CancellationToken));
    }

    private static AssetManifest Manifest(string kind, byte[] payload) => new("game", "synthetic",
        [new("GAME/TEST.BIN", payload.Length, FileFingerprint.Xxh3(payload))], kind);

    private static async Task<string> WriteMediaAsync(string root, string kind, byte[] payload)
    {
        var raw = kind == ContentSourceKinds.CueBin;
        var image = SyntheticIso9660.Build(
            raw ? SyntheticIso9660.RawSectorSize : SyntheticIso9660.CookedSectorSize, "GAME/TEST.BIN", payload);
        if (!raw)
        {
            var iso = Path.Combine(root, "game.iso");
            await File.WriteAllBytesAsync(iso, image, TestContext.Current.CancellationToken);
            return iso;
        }
        await File.WriteAllBytesAsync(Path.Combine(root, "game.bin"), image, TestContext.Current.CancellationToken);
        var cue = Path.Combine(root, "game.cue");
        await File.WriteAllTextAsync(cue, "FILE \"game.bin\" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n",
            TestContext.Current.CancellationToken);
        return cue;
    }

    private static string TestRoot() => Path.Combine(Path.GetTempPath(),
        "restoration-media-tests", Guid.NewGuid().ToString("N"));
}
