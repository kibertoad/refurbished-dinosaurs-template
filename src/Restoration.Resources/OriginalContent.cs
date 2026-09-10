using System.Security.Cryptography;
using System.Text.Json;

namespace Restoration.Resources;

public sealed record SourceManifest(string GameId, string SourceEdition, IReadOnlyList<SourceFile> Files)
{
    public static SourceManifest Load(Stream stream)
    {
        var result = JsonSerializer.Deserialize<SourceManifest>(stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true, AllowTrailingCommas = true })
            ?? throw new InvalidDataException("Source manifest is empty.");
        result.Validate();
        return result;
    }

    public void Validate()
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(GameId);
        ArgumentException.ThrowIfNullOrWhiteSpace(SourceEdition);
        if (Files.Count == 0) throw new InvalidDataException("Replace the sample manifest with at least one source fingerprint.");
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in Files)
        {
            var path = Normalize(file.Path);
            if (!seen.Add(path)) throw new InvalidDataException($"Duplicate source path '{path}'.");
            if (file.Size < 0 || file.Sha256.Length != 64 || !file.Sha256.All(Uri.IsHexDigit))
                throw new InvalidDataException($"Invalid fingerprint for '{path}'.");
        }
    }

    internal static string Normalize(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var normalized = path.Replace('\\', '/');
        if (Path.IsPathRooted(path) || normalized.Split('/').Any(x => x is "" or "." or ".."))
            throw new InvalidDataException($"Source path must be relative: '{path}'.");
        return normalized;
    }
}

public sealed record SourceFile(string Path, long Size, string Sha256);

public static class OriginalContent
{
    public static async Task<IReadOnlyList<string>> VerifyAsync(
        string root, SourceManifest manifest, CancellationToken cancellationToken = default)
    {
        var errors = new List<string>();
        foreach (var expected in manifest.Files)
        {
            var relative = SourceManifest.Normalize(expected.Path);
            var path = Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(path)) { errors.Add($"Missing: {relative}"); continue; }
            var info = new FileInfo(path);
            if (info.Length != expected.Size) { errors.Add($"Wrong size: {relative}"); continue; }
            await using var stream = File.OpenRead(path);
            var hash = Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken));
            if (!hash.Equals(expected.Sha256, StringComparison.OrdinalIgnoreCase))
                errors.Add($"Wrong hash: {relative}");
        }
        return errors;
    }

    public static async Task CopyVerifiedAsync(
        string sourceRoot, string destination, SourceManifest manifest,
        CancellationToken cancellationToken = default)
    {
        var errors = await VerifyAsync(sourceRoot, manifest, cancellationToken);
        if (errors.Count != 0) throw new InvalidDataException(string.Join(Environment.NewLine, errors));
        var parent = Directory.GetParent(Path.GetFullPath(destination))?.FullName
            ?? throw new ArgumentException("Destination requires a parent.", nameof(destination));
        Directory.CreateDirectory(parent);
        var stage = Path.Combine(parent, $".{Path.GetFileName(destination)}.staging-{Guid.NewGuid():N}");
        var backup = destination + $".backup-{Guid.NewGuid():N}";
        Directory.CreateDirectory(stage);
        try
        {
            foreach (var file in manifest.Files)
            {
                var relative = SourceManifest.Normalize(file.Path).Replace('/', Path.DirectorySeparatorChar);
                var target = Path.Combine(stage, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                File.Copy(Path.Combine(sourceRoot, relative), target);
            }
            var stagedErrors = await VerifyAsync(stage, manifest, cancellationToken);
            if (stagedErrors.Count != 0) throw new InvalidDataException(string.Join(Environment.NewLine, stagedErrors));
            if (Directory.Exists(destination)) Directory.Move(destination, backup);
            Directory.Move(stage, destination);
            if (Directory.Exists(backup)) Directory.Delete(backup, true);
        }
        catch
        {
            if (!Directory.Exists(destination) && Directory.Exists(backup)) Directory.Move(backup, destination);
            throw;
        }
        finally { if (Directory.Exists(stage)) Directory.Delete(stage, true); }
    }
}
