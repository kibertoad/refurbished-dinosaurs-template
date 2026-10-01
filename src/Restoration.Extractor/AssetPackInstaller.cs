using System.Text.Json;
using Restoration.Resources;
using ScientificMethod.Core.Assets;

namespace Restoration.Extractor;

public static class AssetPackInstaller
{
    /// <summary>
    /// Writes a pack into a staging directory beside <paramref name="output"/>, verifies it there, and
    /// only then replaces the installed pack. A pack that fails verification leaves the old one in place.
    /// </summary>
    public static async Task<AssetPackManifest> InstallAsync(
        string output,
        Func<string, Task<AssetPackManifest>> writeStagedPack)
    {
        ArgumentNullException.ThrowIfNull(writeStagedPack);
        var outputPath = Path.GetFullPath(output).TrimEnd(
            Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (Directory.GetParent(outputPath) is null)
            throw new ArgumentException("Asset-pack output must be below a filesystem root.", nameof(output));
        if (string.IsNullOrWhiteSpace(Path.GetFileName(outputPath)))
            throw new ArgumentException("Asset-pack output must name a directory.", nameof(output));

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
