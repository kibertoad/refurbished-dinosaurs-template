using Restoration.Core;
using Restoration.Resources;
using Xunit;

namespace Restoration.Tests;

public sealed class BootstrapTests
{
    [Fact]
    public void CoreStateAdvancesDeterministically() =>
        Assert.Equal(new GameState(2, 42), GameState.Create(42).AdvanceTurn());

    [Fact]
    public void ManifestRejectsPathTraversal()
    {
        var manifest = new SourceManifest("game", "edition", [new("../outside", 0, new string('0', 64))]);
        Assert.Throws<InvalidDataException>(manifest.Validate);
    }

    [Fact]
    public async Task ImportIdentifiesEditionAndInstallsVerifiedManifest()
    {
        var root = Path.Combine(Path.GetTempPath(), "restoration-template-tests", Guid.NewGuid().ToString("N"));
        var source = Path.Combine(root, "source");
        var output = Path.Combine(root, "content");
        Directory.CreateDirectory(source);
        try
        {
            var sourceFile = Path.Combine(source, "GAME.DAT");
            await File.WriteAllBytesAsync(sourceFile, [1, 2, 3], TestContext.Current.CancellationToken);
            await using var stream = File.OpenRead(sourceFile);
            var hash = Convert.ToHexStringLower(await System.Security.Cryptography.SHA256.HashDataAsync(
                stream, TestContext.Current.CancellationToken));
            var edition = new SourceManifest("game", "retail-disc", [new("GAME.DAT", 3, hash)]);
            var identification = await OriginalContent.IdentifyAsync(
                source, [edition], TestContext.Current.CancellationToken);
            Assert.Equal("retail-disc", identification.Edition?.SourceEdition);
            await OriginalContent.ImportAsync(
                source, output, edition, "test", TestContext.Current.CancellationToken);
            Assert.Empty(await OriginalContent.VerifyInstalledAsync(
                output, TestContext.Current.CancellationToken));
            Assert.True(File.Exists(Path.Combine(output, "manifest.json")));
        }
        finally { Directory.Delete(root, true); }
    }
}
