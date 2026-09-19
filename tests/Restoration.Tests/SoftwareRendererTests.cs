using Restoration.Game;
using Xunit;

namespace Restoration.Tests;

/// <summary>
/// Software rendering must stay unreachable for anyone playing the game: it is a CI diagnostic, and
/// a player who landed on it would see the game as broken rather than slow. These pin every way in.
/// </summary>
public sealed class SoftwareRendererTests
{
    private const string Driver = "/opt/gl/opengl32.dll";

    [Fact]
    public void NotRequestedStaysOff()
    {
        var request = SoftwareRenderer.Evaluate(requested: false, platformSmoke: true, Driver);
        Assert.False(request.Enabled);
        Assert.Null(request.Rejection);
    }

    [Fact]
    public void NotRequestedStaysOffEvenForAnOrdinaryLaunchWithADriverPresent()
    {
        var request = SoftwareRenderer.Evaluate(requested: false, platformSmoke: false, Driver);
        Assert.False(request.Enabled);
        Assert.Null(request.Rejection);
    }

    [Theory]
    [InlineData(Driver)]
    [InlineData(null)]
    public void RequestingItForAnOrdinaryLaunchIsRefused(string? driverPath)
    {
        var request = SoftwareRenderer.Evaluate(requested: true, platformSmoke: false, driverPath);
        Assert.False(request.Enabled);
        Assert.Null(request.DriverPath);
        Assert.Contains("--platform-smoke-test", request.Rejection);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void SmokeTestWithoutASuppliedDriverIsRefused(string? driverPath)
    {
        var request = SoftwareRenderer.Evaluate(requested: true, platformSmoke: true, driverPath);
        Assert.False(request.Enabled);
        Assert.Null(request.DriverPath);
        Assert.Contains(SoftwareRenderer.DriverVariable, request.Rejection);
    }

    [Fact]
    public void AllThreeConditionsTogetherEnableIt()
    {
        var request = SoftwareRenderer.Evaluate(requested: true, platformSmoke: true, Driver);
        Assert.True(request.Enabled);
        Assert.Equal(Driver, request.DriverPath);
        Assert.Null(request.Rejection);
    }

    [Fact]
    public void ApplyRefusesADriverThatIsNotThere()
    {
        var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"), "opengl32.dll");
        var failure = Assert.Throws<FileNotFoundException>(() => SoftwareRenderer.Apply(missing));
        Assert.Contains(SoftwareRenderer.DriverVariable, failure.Message);
    }
}
