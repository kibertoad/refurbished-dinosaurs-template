using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using SabreTools.Wrappers;

namespace Restoration.Extractor;

public sealed record InstallShieldExtractedFile(string Path, long Size, string Sha256);

/// <summary>
/// Bounded expansion of a supported InstallShield cabinet set.
/// </summary>
/// <remarks>
/// The expansion runs in a short-lived child process. That is a crash and handle boundary -- a
/// third-party parser that faults, leaks a file handle, or corrupts its own heap takes the child
/// down instead of the caller -- and not a sandbox: the child inherits this process's user,
/// filesystem access, and environment. Containment of the output itself comes from the path,
/// count, and size limits enforced below, which apply in both processes.
/// </remarks>
public static partial class InstallShieldCabinetExtractor
{
    private const int MaximumFiles = 10_000;
    private const ulong MaximumFileBytes = 512UL * 1024 * 1024;
    private const ulong MaximumOutputBytes = 4UL * 1024 * 1024 * 1024;

    public static async Task<IReadOnlyList<InstallShieldExtractedFile>> ExtractAsync(
        string cabinetPath, string outputRoot, CancellationToken cancellationToken = default)
    {
        var cabinet = RequireFile(cabinetPath);
        var root = Path.GetFullPath(outputRoot);
        Directory.CreateDirectory(root);
        if (Directory.EnumerateFileSystemEntries(root).Any())
            throw new InvalidDataException("InstallShield output directory must be empty.");
        await RunIsolatedAsync(cabinet, root, cancellationToken);
        return await InventoryAsync(root, cancellationToken);
    }

    internal static int ExtractIsolated(string cabinetPath, string outputRoot)
    {
        try { Extract(cabinetPath, outputRoot); return 0; }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
    }

    private static void Extract(string cabinetPath, string outputRoot)
    {
        var pattern = CabinetSetPattern(cabinetPath);
        var cabinet = InstallShieldCabinet.OpenSet(pattern)
            ?? throw new InvalidDataException($"'{Path.GetFileName(cabinetPath)}' is not a supported InstallShield cabinet.");
        if (cabinet.FileCount is 0 or > MaximumFiles)
            throw new InvalidDataException($"InstallShield file count is outside the safety limit: {cabinet.FileCount}.");

        ulong total = 0;
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < cabinet.FileCount; index++)
        {
            if (!cabinet.FileIsValid(index)) continue;
            var size = cabinet.GetExpandedFileSize(index);
            if (size > MaximumFileBytes || total > MaximumOutputBytes - size)
                throw new InvalidDataException("InstallShield expanded output exceeds the safety limit.");
            total += size;
            var relative = BuildRelativePath(cabinet, index);
            if (!paths.Add(relative))
                throw new InvalidDataException($"Duplicate InstallShield output path: {relative}.");
            var target = SafeTarget(outputRoot, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            if (File.Exists(target) || !cabinet.FileSave(index, target, includeDebug: false))
                throw new InvalidDataException($"Failed to extract InstallShield entry {index}.");
            if ((ulong)new FileInfo(target).Length != size)
                throw new InvalidDataException($"InstallShield entry {index} produced an unexpected size.");
        }
        if (paths.Count == 0)
            throw new InvalidDataException("InstallShield cabinet contains no extractable files.");
    }

    private static async Task RunIsolatedAsync(string cabinetPath, string outputRoot,
        CancellationToken cancellationToken)
    {
        var executable = Environment.ProcessPath
            ?? throw new InvalidOperationException("Cannot locate the Extractor executable.");
        var start = new ProcessStartInfo(executable)
        {
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false
        };
        // A single-file publish runs the apphost directly, so there is nothing to pass. A framework
        // run (`dotnet run`, `dotnet Extractor.dll`) needs the managed entry assembly named back,
        // and Assembly.Location is empty in a single-file app -- so derive it from the base
        // directory and the entry assembly's simple name instead.
        if (Path.GetFileNameWithoutExtension(executable).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
        {
            var name = Assembly.GetEntryAssembly()?.GetName().Name;
            if (string.IsNullOrWhiteSpace(name))
                throw new InvalidOperationException("Cannot locate the Extractor assembly.");
            var assembly = Path.Combine(AppContext.BaseDirectory, name + ".dll");
            if (!File.Exists(assembly))
                throw new InvalidOperationException($"Cannot locate the Extractor assembly at '{assembly}'.");
            start.ArgumentList.Add(assembly);
        }
        start.ArgumentList.Add("--internal-extract-installshield");
        start.ArgumentList.Add(cabinetPath);
        start.ArgumentList.Add(outputRoot);
        using var process = Process.Start(start)
            ?? throw new InvalidOperationException("Failed to start the isolated InstallShield extractor.");
        // The reads are started before the wait so a child that fills a pipe buffer cannot deadlock,
        // and they are given a cancellation token of their own: cancelling the wait must not leave
        // them running against a killed process as unobserved tasks.
        using var readCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var output = process.StandardOutput.ReadToEndAsync(readCancellation.Token);
        var error = process.StandardError.ReadToEndAsync(readCancellation.Token);
        string outputText;
        string errorText;
        try
        {
            await process.WaitForExitAsync(cancellationToken);
            outputText = await output;
            errorText = await error;
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { /* The child already exited. */ }
            await readCancellation.CancelAsync();
            await Task.WhenAll(output, error).ContinueWith(_ => { }, TaskScheduler.Default);
            throw;
        }
        if (process.ExitCode != 0)
            throw new InvalidDataException("InstallShield extraction failed: " +
                (string.IsNullOrWhiteSpace(errorText) ? outputText.Trim() : errorText.Trim()));
    }

    private static async Task<IReadOnlyList<InstallShieldExtractedFile>> InventoryAsync(
        string root, CancellationToken cancellationToken)
    {
        var files = Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Order(StringComparer.Ordinal).ToArray();
        if (files.Length is 0 or > MaximumFiles)
            throw new InvalidDataException("InstallShield output file count is outside the safety limit.");
        ulong total = 0;
        var result = new List<InstallShieldExtractedFile>(files.Length);
        foreach (var file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var info = new FileInfo(file);
            if ((info.Attributes & FileAttributes.ReparsePoint) != 0 || info.Length < 0 ||
                (ulong)info.Length > MaximumFileBytes || total > MaximumOutputBytes - (ulong)info.Length)
                throw new InvalidDataException("InstallShield output violates the safety limits.");
            total += (ulong)info.Length;
            await using var stream = File.OpenRead(file);
            result.Add(new(Path.GetRelativePath(root, file).Replace('\\', '/'), info.Length,
                Convert.ToHexStringLower(await SHA256.HashDataAsync(stream, cancellationToken))));
        }
        return result;
    }

    internal static string CabinetSetPattern(string cabinetPath)
    {
        var fullPath = RequireFile(cabinetPath);
        var stem = Path.GetFileNameWithoutExtension(fullPath);
        var baseName = TrailingDigits().Replace(stem, string.Empty);
        if (string.IsNullOrWhiteSpace(baseName))
            throw new InvalidDataException("InstallShield cabinet name has no set prefix.");
        return Path.Combine(Path.GetDirectoryName(fullPath)!, baseName);
    }

    internal static string CombineSafeArchivePath(params string?[] values)
    {
        var parts = new List<string>();
        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value)) continue;
            foreach (var part in value.Replace('\\', '/').Split('/'))
            {
                if (part is "" or ".") continue;
                ValidateSegment(part);
                parts.Add(part);
            }
        }
        if (parts.Count == 0) throw new InvalidDataException("InstallShield entry has no output path.");
        return string.Join('/', parts);
    }

    private static string BuildRelativePath(InstallShieldCabinet cabinet, int index)
    {
        var filename = cabinet.GetFileName(index);
        if (string.IsNullOrWhiteSpace(filename))
            throw new InvalidDataException($"InstallShield entry {index} has no filename.");
        return CombineSafeArchivePath(cabinet.GetFileGroupNameFromFile(index),
            cabinet.GetDirectoryName(checked((int)cabinet.GetDirectoryIndexFromFile(index))), filename);
    }

    private static void ValidateSegment(string value)
    {
        if (value == ".." || value.Any(char.IsControl) ||
            value.IndexOfAny(['<', '>', ':', '"', '|', '?', '*']) >= 0 ||
            value.EndsWith(' ') || value.EndsWith('.'))
            throw new InvalidDataException($"InstallShield contains an unsafe path segment: '{value}'.");
        var stem = value.Split('.')[0];
        if (stem.Equals("CON", StringComparison.OrdinalIgnoreCase) ||
            stem.Equals("PRN", StringComparison.OrdinalIgnoreCase) ||
            stem.Equals("AUX", StringComparison.OrdinalIgnoreCase) ||
            stem.Equals("NUL", StringComparison.OrdinalIgnoreCase) ||
            IsDevice(stem, "COM") || IsDevice(stem, "LPT"))
            throw new InvalidDataException($"InstallShield path is not portable: '{value}'.");
    }

    private static bool IsDevice(string value, string prefix) => value.Length == 4 &&
        value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && value[3] is >= '1' and <= '9';

    private static string SafeTarget(string root, string relative)
    {
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var target = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!target.StartsWith(fullRoot, OperatingSystem.IsWindows()
                ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
            throw new InvalidDataException("InstallShield output path escapes the output root.");
        return target;
    }

    private static string RequireFile(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException("Cabinet path is required.", nameof(path));
        var fullPath = Path.GetFullPath(path);
        if (!File.Exists(fullPath)) throw new FileNotFoundException("InstallShield cabinet not found.", fullPath);
        return fullPath;
    }

    [GeneratedRegex("[0-9]+$", RegexOptions.CultureInvariant)]
    private static partial Regex TrailingDigits();
}
