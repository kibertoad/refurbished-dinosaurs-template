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
        using var pack = StagedAssetPack.Create(output);
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
