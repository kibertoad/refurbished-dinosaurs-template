using System.Text.Json;
using RefurbishedDinosaurs.Core.Assets;
using Restoration.Resources;

namespace Restoration.Extractor;

/// <summary>
/// Writes an asset pack into a <see cref="StagedAssetPack"/>, adds its manifest, verifies the staged
/// pack as the game will, and only then commits it over the installed one.
/// </summary>
public static class AssetPackInstaller
{
    public static async Task<AssetPackManifest> InstallAsync(
        string output,
        Func<string, Task<AssetPackManifest>> writeStagedPack)
    {
        ArgumentNullException.ThrowIfNull(writeStagedPack);
        // StagedAssetPack stages beside the destination, so a trailing separator must not turn the
        // destination's own directory into the staging parent.
        var outputPath = Path.GetFullPath(output).TrimEnd(
            Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (Directory.GetParent(outputPath) is null || string.IsNullOrWhiteSpace(Path.GetFileName(outputPath)))
            throw new ArgumentException("Asset-pack output must name a directory below a filesystem root.",
                nameof(output));

        using var pack = StagedAssetPack.Create(outputPath);
        var manifest = await writeStagedPack(pack.StagingDirectory);
        await WriteManifestAsync(Path.Combine(pack.StagingDirectory, "manifest.json"), manifest);
        var diagnostics = await OriginalContent.VerifyInstalledAsync(pack.StagingDirectory);
        if (diagnostics.Count != 0)
            throw new InvalidDataException("Staged asset pack failed verification: " +
                string.Join("; ", diagnostics.Select(item => $"[{item.Code}] {item.Message}")));
        pack.Commit();
        return manifest;
    }

    private static async Task WriteManifestAsync(string path, AssetPackManifest manifest)
    {
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, manifest,
            new JsonSerializerOptions { WriteIndented = true });
    }
}
