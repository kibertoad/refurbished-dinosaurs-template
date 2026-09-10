using System.Security.Cryptography;
using System.Text;
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
        if (Files is null || Files.Count == 0)
            throw new InvalidDataException("A source manifest requires at least one fingerprint.");
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in Files)
        {
            if (file is null) throw new InvalidDataException("Source manifest contains a null file record.");
            var path = Normalize(file.Path);
            if (!seen.Add(path)) throw new InvalidDataException($"Duplicate source path '{path}'.");
            if (file.Size < 0 || !IsSha256(file.Sha256))
                throw new InvalidDataException($"Invalid fingerprint for '{path}'.");
        }
    }

    public string Fingerprint()
    {
        var canonical = string.Join('\n', Files.OrderBy(file => file.Path, StringComparer.OrdinalIgnoreCase)
            .Select(file => $"{Normalize(file.Path)}\0{file.Size}\0{file.Sha256.ToLowerInvariant()}"));
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    internal static string Normalize(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var normalized = path.Replace('\\', '/');
        if (Path.IsPathRooted(path) || normalized.Split('/').Any(x => x is "" or "." or ".."))
            throw new InvalidDataException($"Source path must be relative: '{path}'.");
        return normalized;
    }

    private static bool IsSha256(string? value) =>
        value is { Length: 64 } && value.All(Uri.IsHexDigit);
}

public sealed record SourceFile(string Path, long Size, string Sha256);
public sealed record ImportedFile(string Path, long Size, string Sha256, string SourcePath);
public sealed record ImportManifest(
    int FormatVersion, string GameId, string SourceEdition, string SourceFingerprintSha256,
    DateTimeOffset ImportedAtUtc, string ImporterVersion, IReadOnlyList<ImportedFile> Files);
public sealed record SourceIdentification(SourceManifest? Edition, IReadOnlyList<string> Errors)
{
    public bool IsSupported => Edition is not null;
}

public static class OriginalContent
{
    public const int ImportFormatVersion = 1;

    public static async Task<SourceIdentification> IdentifyAsync(
        string root, IEnumerable<SourceManifest> editions,
        CancellationToken cancellationToken = default)
    {
        var summaries = new List<string>();
        foreach (var edition in editions)
        {
            var errors = await VerifySourceAsync(root, edition, cancellationToken);
            if (errors.Count == 0) return new(edition, []);
            summaries.Add($"{edition.SourceEdition}: {string.Join("; ", errors)}");
        }
        return new(null, summaries);
    }

    public static async Task<IReadOnlyList<string>> VerifySourceAsync(
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

    public static async Task<ImportManifest> ImportAsync(
        string sourceRoot, string destination, SourceManifest edition, string importerVersion,
        CancellationToken cancellationToken = default)
    {
        var errors = await VerifySourceAsync(sourceRoot, edition, cancellationToken);
        if (errors.Count != 0) throw new InvalidDataException(string.Join(Environment.NewLine, errors));
        var destinationPath = Path.GetFullPath(destination).TrimEnd(
            Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var parent = Directory.GetParent(destinationPath)?.FullName
            ?? throw new ArgumentException("Destination requires a parent.", nameof(destination));
        Directory.CreateDirectory(parent);
        var operation = Guid.NewGuid().ToString("N");
        var stage = Path.Combine(parent, $".{Path.GetFileName(destinationPath)}.staging-{operation}");
        var backup = Path.Combine(parent, $".{Path.GetFileName(destinationPath)}.backup-{operation}");
        var movedOld = false;
        try
        {
            Directory.CreateDirectory(stage);
            var installed = new List<ImportedFile>();
            foreach (var file in edition.Files)
            {
                var normalized = SourceManifest.Normalize(file.Path);
                var relative = normalized.Replace('/', Path.DirectorySeparatorChar);
                var target = SafeTarget(stage, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                File.Copy(Path.Combine(sourceRoot, relative), target);
                installed.Add(new(normalized, file.Size, file.Sha256.ToLowerInvariant(), normalized));
            }
            var manifest = new ImportManifest(ImportFormatVersion, edition.GameId, edition.SourceEdition,
                edition.Fingerprint(), DateTimeOffset.UtcNow, importerVersion, installed);
            WriteManifest(Path.Combine(stage, "manifest.json"), manifest);
            var stagedErrors = await VerifyInstalledAsync(stage, cancellationToken);
            if (stagedErrors.Count != 0)
                throw new InvalidDataException("Staged import is invalid: " + string.Join("; ", stagedErrors));
            if (Directory.Exists(destinationPath))
            {
                Directory.Move(destinationPath, backup);
                movedOld = true;
            }
            try { Directory.Move(stage, destinationPath); }
            catch
            {
                if (movedOld && !Directory.Exists(destinationPath))
                { Directory.Move(backup, destinationPath); movedOld = false; }
                throw;
            }
            if (movedOld)
            {
                Directory.Delete(backup, recursive: true);
                movedOld = false;
            }
            return manifest;
        }
        finally
        {
            if (Directory.Exists(stage)) Directory.Delete(stage, true);
            if (movedOld && Directory.Exists(backup) && !Directory.Exists(destinationPath))
                Directory.Move(backup, destinationPath);
        }
    }

    public static async Task<IReadOnlyList<string>> VerifyInstalledAsync(
        string root, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(root, "manifest.json");
        if (!File.Exists(path)) return [$"Manifest not found: {path}"];
        ImportManifest? manifest;
        try { manifest = JsonSerializer.Deserialize<ImportManifest>(await File.ReadAllTextAsync(path, cancellationToken)); }
        catch (JsonException exception) { return [$"Manifest is invalid: {exception.Message}"]; }
        if (manifest is null) return ["Manifest is empty."];
        var errors = new List<string>();
        if (manifest.FormatVersion != ImportFormatVersion) errors.Add("Unsupported import format version.");
        if (manifest.Files is null || manifest.Files.Count == 0) errors.Add("Manifest has no files.");
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in manifest.Files ?? [])
        {
            if (file is null || !paths.Add(file.Path)) { errors.Add("Null or duplicate file record."); continue; }
            string target;
            try { target = SafeTarget(root, file.Path); }
            catch (InvalidDataException) { errors.Add($"Unsafe path: {file.Path}"); continue; }
            if (!File.Exists(target)) { errors.Add($"Missing: {file.Path}"); continue; }
            if (new FileInfo(target).Length != file.Size) { errors.Add($"Wrong size: {file.Path}"); continue; }
            await using var stream = File.OpenRead(target);
            var hash = Convert.ToHexStringLower(await SHA256.HashDataAsync(stream, cancellationToken));
            if (!hash.Equals(file.Sha256, StringComparison.OrdinalIgnoreCase)) errors.Add($"Wrong hash: {file.Path}");
        }
        return errors;
    }

    private static string SafeTarget(string root, string relative)
    {
        if (Path.IsPathFullyQualified(relative)) throw new InvalidDataException("Path must be relative.");
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var target = Path.GetFullPath(Path.Combine(root, relative));
        if (!target.StartsWith(fullRoot, OperatingSystem.IsWindows()
                ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
            throw new InvalidDataException("Path escapes content root.");
        return target;
    }

    private static void WriteManifest(string path, ImportManifest manifest)
    {
        var temporary = path + $".{Guid.NewGuid():N}.tmp";
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(manifest,
                new JsonSerializerOptions { WriteIndented = true }));
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
