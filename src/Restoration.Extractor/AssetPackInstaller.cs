using System.Text.Json;
using Restoration.Resources;

namespace Restoration.Extractor;

public static class AssetPackInstaller
{
    public static async Task<AssetPackManifest> InstallAsync(
        string output,
        Func<string, Task<AssetPackManifest>> writeStagedPack)
    {
        ArgumentNullException.ThrowIfNull(writeStagedPack);
        var outputPath = Path.GetFullPath(output).TrimEnd(
            Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var parent = Directory.GetParent(outputPath)?.FullName
            ?? throw new ArgumentException("Asset-pack output must be below a filesystem root.", nameof(output));
        var leaf = Path.GetFileName(outputPath);
        if (string.IsNullOrWhiteSpace(leaf))
            throw new ArgumentException("Asset-pack output must name a directory.", nameof(output));

        Directory.CreateDirectory(parent);
        var operation = Guid.NewGuid().ToString("N");
        var staging = Path.Combine(parent, $".{leaf}.staging-{operation}");
        var backup = Path.Combine(parent, $".{leaf}.backup-{operation}");
        var oldPackMoved = false;
        try
        {
            Directory.CreateDirectory(staging);
            var manifest = await writeStagedPack(staging);
            await WriteManifestAsync(Path.Combine(staging, "manifest.json"), manifest);
            var diagnostics = await OriginalContent.VerifyInstalledAsync(staging);
            if (diagnostics.Count != 0)
                throw new InvalidDataException("Staged asset pack failed verification: " +
                    string.Join("; ", diagnostics.Select(item => $"[{item.Code}] {item.Message}")));

            if (Directory.Exists(outputPath))
            {
                Directory.Move(outputPath, backup);
                oldPackMoved = true;
            }
            try
            {
                Directory.Move(staging, outputPath);
            }
            catch
            {
                if (oldPackMoved && !Directory.Exists(outputPath))
                {
                    Directory.Move(backup, outputPath);
                    oldPackMoved = false;
                }
                throw;
            }
            if (oldPackMoved)
            {
                Directory.Delete(backup, true);
                oldPackMoved = false;
            }
            return manifest;
        }
        finally
        {
            if (Directory.Exists(staging)) Directory.Delete(staging, true);
            if (oldPackMoved && Directory.Exists(backup) && !Directory.Exists(outputPath))
                Directory.Move(backup, outputPath);
        }
    }

    private static async Task WriteManifestAsync(string path, AssetPackManifest manifest)
    {
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, manifest,
            new JsonSerializerOptions { WriteIndented = true });
    }
}


