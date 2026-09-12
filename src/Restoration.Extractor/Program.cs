using System.Reflection;
using Restoration.Resources;

return await RunAsync(args);

static async Task<int> RunAsync(string[] args)
{
    try
    {
        if (args.Length == 0 || args[0] is "--help" or "-h") return Usage();
        var command = args[0].ToLowerInvariant();
        var output = Option(args, "--output") ?? OriginalContent.DefaultAssetPackPath();
        var editions = LoadManifests();

        if (command == "list-editions")
        {
            foreach (var edition in editions) Console.WriteLine(edition.SourceEdition);
            return 0;
        }
        if (command == "verify-pack")
            return Report(await OriginalContent.VerifyInstalledAsync(output), $"Verified asset pack at {output}");

        var source = Option(args, "--source");
        if (string.IsNullOrWhiteSpace(source))
            return Fail("source_required", "--source must name a legally owned GOG installation.", 64);

        var identification = await OriginalContent.IdentifyAsync(source, editions);
        if (!identification.IsSupported)
        {
            Console.Error.WriteLine("The selected directory does not match a supported edition.");
            return Report(identification.Diagnostics, null, 2);
        }
        if (command == "verify-source")
        {
            Console.WriteLine($"Verified {identification.Edition!.SourceEdition}.");
            Console.WriteLine($"Source fingerprint: {identification.Edition.Fingerprint()}");
            return 0;
        }
        if (command != "extract") return Usage();

        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";
        Console.WriteLine($"Verified {identification.Edition!.SourceEdition} with Extractor {version}.");
        Console.Error.WriteLine("[asset_decoders_unavailable] Source verification succeeded, but the first " +
            "bounded game-specific asset decoders have not been implemented yet. No output was written and any " +
            "existing asset pack was left unchanged.");
        return 4;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"[extractor_failed] Asset Extractor failed safely: {exception.Message}");
        return 1;
    }
}

static SourceManifest[] LoadManifests()
{
    var assembly = Assembly.GetExecutingAssembly();
    return assembly.GetManifestResourceNames()
        .Where(name => name.EndsWith(".json", StringComparison.Ordinal))
        .Order(StringComparer.Ordinal)
        .Select(name =>
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            return SourceManifest.Load(stream);
        })
        .ToArray();
}

static int Report(
    IReadOnlyList<ContentDiagnostic> diagnostics,
    string? success,
    int errorCode = 3)
{
    if (diagnostics.Count == 0)
    {
        if (success is not null) Console.WriteLine(success);
        return 0;
    }
    foreach (var diagnostic in diagnostics)
        Console.Error.WriteLine($"[{diagnostic.Code}] {diagnostic.Message}");
    return errorCode;
}

static int Fail(string code, string message, int exitCode)
{
    Console.Error.WriteLine($"[{code}] {message}");
    return exitCode;
}

static string? Option(string[] args, string name)
{
    var index = Array.FindIndex(args, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
}

static int Usage()
{
    Console.WriteLine("{{DISPLAY_NAME}} Asset Extractor");
    Console.WriteLine("A legally owned supported GOG copy is required. The original installation is read-only.");
    Console.WriteLine("  list-editions");
    Console.WriteLine("  verify-source --source <gog-installation>");
    Console.WriteLine("  extract --source <gog-installation> [--output <asset-pack>]");
    Console.WriteLine("  verify-pack [--output <asset-pack>]");
    return 64;
}


