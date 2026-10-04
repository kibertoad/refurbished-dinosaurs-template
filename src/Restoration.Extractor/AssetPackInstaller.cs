using RefurbishedDinosaurs.Core.Assets;
using Restoration.Resources;

namespace Restoration.Extractor;

/// <summary>
/// Writes an asset pack into a <see cref="StagedAssetPack"/>, adds its manifest, verifies the staged
/// pack as the game will, and only then commits it over the installed one.
/// </summary>
public static class AssetPackInstaller
{
    public static async Task<InstalledAssetManifest> InstallAsync(
        string output,
        Func<string, Task<InstalledAssetManifest>> writeStagedPack)
    {
        ArgumentNullException.ThrowIfNull(writeStagedPack);
        using var pack = StagedAssetPack.Create(output);
        var manifest = await writeStagedPack(pack.StagingDirectory);
        manifest.Write(Path.Combine(pack.StagingDirectory, OriginalContent.AssetPackManifestFileName));
        var verification = await OriginalContent.VerifyInstalledAsync(pack.StagingDirectory);
        if (!verification.IsValid)
            throw new InvalidDataException("Staged asset pack failed verification: " +
                string.Join("; ", verification.Issues.Select(issue => $"[{issue.Problem}] {issue.Detail}")));
        pack.Commit();
        return manifest;
    }
}
