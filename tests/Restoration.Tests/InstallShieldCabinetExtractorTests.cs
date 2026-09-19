using Restoration.Extractor;
using Xunit;

namespace Restoration.Tests;

public sealed class InstallShieldCabinetExtractorTests
{
    [Fact]
    public void CombinesPortableArchivePath()
    {
        Assert.Equal("group/Game/Data/file.dat",
            InstallShieldCabinetExtractor.CombineSafeArchivePath("group", "Game\\Data", "file.dat"));
    }

    [Theory]
    [InlineData("../escape")]
    [InlineData("CON")]
    [InlineData("bad:name")]
    [InlineData("trailing.")]
    public void RejectsUnsafeArchiveSegments(string value)
    {
        Assert.Throws<InvalidDataException>(() =>
            InstallShieldCabinetExtractor.CombineSafeArchivePath(value, "file.dat"));
    }

    [Fact]
    public void DerivesCabinetSetPrefix()
    {
        var root = Path.Combine(Path.GetTempPath(), "installshield-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, "data1.cab");
        File.WriteAllBytes(path, [0]);
        try { Assert.Equal(Path.Combine(root, "data"), InstallShieldCabinetExtractor.CabinetSetPattern(path)); }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void UnsupportedCabinetFailsInsideIsolationBoundary()
    {
        var root = Path.Combine(Path.GetTempPath(), "installshield-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var cabinet = Path.Combine(root, "data1.cab");
        var output = Path.Combine(root, "output");
        File.WriteAllBytes(cabinet, [0]);
        Directory.CreateDirectory(output);
        try { Assert.Equal(1, InstallShieldCabinetExtractor.ExtractIsolated(cabinet, output)); }
        finally
        {
            // The third-party parser can retain a failed-open handle until finalization;
            // production contains it in the short-lived child process.
            GC.Collect();
            GC.WaitForPendingFinalizers();
            Directory.Delete(root, true);
        }
    }
}
