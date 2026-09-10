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
}
