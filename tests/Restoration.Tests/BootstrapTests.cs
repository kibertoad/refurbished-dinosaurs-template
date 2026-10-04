using RefurbishedDinosaurs.Core.Assets;
using Restoration.Core;
using Restoration.Extractor;
using Restoration.Resources;
using Xunit;

namespace Restoration.Tests;

public sealed class BootstrapTests
{
    [Fact]
    public void CoreStateAdvancesDeterministically() =>
        Assert.Equal(new GameState(2, 42), GameState.Create(42).AdvanceTurn());

    [Theory]
    [InlineData("../outside")]
    [InlineData("/rooted")]
    [InlineData("C:drive-relative.dat")]
    [InlineData("GAME/trailing-dot.")]
    [InlineData("GAME/nul.dat")]
    [InlineData("")]
    public void ManifestRejectsPathsThatAreNotPortable(string path)
    {
        var manifest = new AssetManifest("game", "edition", [new(path, 0, new string('0', 32))]);
        Assert.Throws<InvalidDataException>(manifest.Validate);
    }

    [Fact]
    public void EmbeddedEditionManifestsLoadForThisGame()
    {
        var assembly = typeof(AssetPackInstaller).Assembly;
        var names = assembly.GetManifestResourceNames().Where(name => name.EndsWith(".json", StringComparison.Ordinal));
        Assert.NotEmpty(names);
        foreach (var name in names)
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            Assert.Equal(OriginalContent.GameId, OriginalContent.LoadEdition(stream).GameId);
        }
    }

    [Fact]
    public void EditionManifestForAnotherGameIsRejected()
    {
        var json = """{ "gameId": "another-game", "sourceEdition": "retail", "files": [ { "path": "A", "size": 1 } ] }""";
        Assert.Throws<InvalidDataException>(() =>
            OriginalContent.LoadEdition(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json))));
    }

    [Fact]
    public async Task VerifiedAssetPackRequiresExactInventoryAndHashes()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var assetPath = Path.Combine(root, "images", "synthetic.bin");
            Directory.CreateDirectory(Path.GetDirectoryName(assetPath)!);
            await File.WriteAllBytesAsync(assetPath, [4, 5, 6], TestContext.Current.CancellationToken);
            PackManifest([new("images/synthetic.bin", 3, FileFingerprint.Xxh3(assetPath), "SOURCE.GFF")])
                .Write(Path.Combine(root, OriginalContent.AssetPackManifestFileName));

            Assert.True((await OriginalContent.VerifyInstalledAsync(
                root, TestContext.Current.CancellationToken)).IsValid);

            await File.WriteAllBytesAsync(Path.Combine(root, "unexpected.bin"), [7],
                TestContext.Current.CancellationToken);
            var verification = await OriginalContent.VerifyInstalledAsync(
                root, TestContext.Current.CancellationToken);
            Assert.Contains(verification.Issues, issue => issue.Problem == InstalledAssetProblem.Unlisted);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task AssetPackFromAnotherFormatVersionIsRejected()
    {
        var root = TestRoot();
        Directory.CreateDirectory(root);
        try
        {
            var assetPath = Path.Combine(root, "asset.bin");
            await File.WriteAllBytesAsync(assetPath, [1], TestContext.Current.CancellationToken);
            (PackManifest([new("asset.bin", 1, FileFingerprint.Xxh3(assetPath), "SOURCE.GFF")]) with
                { FormatVersion = OriginalContent.AssetPackFormatVersion - 1 })
                .Write(Path.Combine(root, OriginalContent.AssetPackManifestFileName));

            var issue = Assert.Single((await OriginalContent.VerifyInstalledAsync(
                root, TestContext.Current.CancellationToken)).Issues);
            Assert.Equal(InstalledAssetProblem.FormatVersionMismatch, issue.Problem);
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public async Task MissingAssetPackIsReported()
    {
        var verification = await OriginalContent.VerifyInstalledAsync(
            Path.Combine(TestRoot(), "missing"), TestContext.Current.CancellationToken);

        Assert.Equal(InstalledAssetProblem.ManifestMissing, Assert.Single(verification.Issues).Problem);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AssetPackInstallIsVerifiedAndReplacesStaleOutput(bool trailingSeparator)
    {
        var root = TestRoot();
        var output = Path.Combine(root, "pack");
        Directory.CreateDirectory(output);
        await File.WriteAllTextAsync(Path.Combine(output, "stale.bin"), "stale",
            TestContext.Current.CancellationToken);
        try
        {
            var requested = trailingSeparator ? output + Path.DirectorySeparatorChar : output;
            await AssetPackInstaller.InstallAsync(requested, async staging =>
            {
                var asset = Path.Combine(staging, "images", "synthetic.bin");
                Directory.CreateDirectory(Path.GetDirectoryName(asset)!);
                await File.WriteAllBytesAsync(asset, [8, 9], TestContext.Current.CancellationToken);
                return PackManifest([new("images/synthetic.bin", 2, FileFingerprint.Xxh3(asset), "SOURCE.GFF")]);
            });

            Assert.False(File.Exists(Path.Combine(output, "stale.bin")));
            Assert.True((await OriginalContent.VerifyInstalledAsync(
                output, TestContext.Current.CancellationToken)).IsValid);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    [Fact]
    public async Task AssetPackThatFailsVerificationLeavesThePreviousPackInPlace()
    {
        var root = TestRoot();
        var output = Path.Combine(root, "pack");
        Directory.CreateDirectory(output);
        await File.WriteAllTextAsync(Path.Combine(output, "previous.bin"), "previous",
            TestContext.Current.CancellationToken);
        try
        {
            var failure = await Assert.ThrowsAsync<InvalidDataException>(() =>
                AssetPackInstaller.InstallAsync(output, async staging =>
                {
                    var asset = Path.Combine(staging, "images", "synthetic.bin");
                    Directory.CreateDirectory(Path.GetDirectoryName(asset)!);
                    await File.WriteAllBytesAsync(asset, [8, 9], TestContext.Current.CancellationToken);
                    // The recorded size is wrong, so the staged pack must not be committed.
                    return PackManifest([new("images/synthetic.bin", 3, FileFingerprint.Xxh3(asset), "SOURCE.GFF")]);
                }));

            Assert.Contains($"[{InstalledAssetProblem.WrongSize}]", failure.Message, StringComparison.Ordinal);
            Assert.Equal("previous", await File.ReadAllTextAsync(Path.Combine(output, "previous.bin"),
                TestContext.Current.CancellationToken));
            Assert.Equal(new[] { output }, Directory.GetDirectories(root));
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    private static string TestRoot() => Path.Combine(
        Path.GetTempPath(), "restoration-template-tests", Guid.NewGuid().ToString("N"));

    private static InstalledAssetManifest PackManifest(IReadOnlyList<InstalledAsset> files) => new(
        OriginalContent.AssetPackFormatVersion,
        OriginalContent.GameId,
        "synthetic-edition",
        new AssetManifest("game", "synthetic-edition", [new("SOURCE.GFF", 1)]).Fingerprint(),
        DateTimeOffset.UnixEpoch,
        files,
        "test");
}
