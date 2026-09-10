using System.Reflection;
using Restoration.Resources;

return await RunAsync(args);

static async Task<int> RunAsync(string[] args)
{
    try
    {
        if (args.Length == 0 || args[0] is "--help" or "-h") return Usage();
        var command = args[0].ToLowerInvariant();
        var output = Option(args, "--output") ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "{{APP_DATA_DIRECTORY}}", "UserContent");
        var editions = LoadManifests();
        if (command == "list-editions")
        {
            foreach (var edition in editions) Console.WriteLine(edition.SourceEdition);
            return 0;
        }
        if (command == "verify-output")
        {
            var errors = await OriginalContent.VerifyInstalledAsync(output);
            return Report(errors, $"Verified installed content at {output}");
        }
        var source = Option(args, "--source");
        if (string.IsNullOrWhiteSpace(source)) throw new ArgumentException("--source is required.");
        var identification = await OriginalContent.IdentifyAsync(source, editions);
        if (!identification.IsSupported)
        {
            Console.Error.WriteLine("The source does not match a supported edition.");
            foreach (var error in identification.Errors) Console.Error.WriteLine(error);
            return 2;
        }
        if (command == "verify-source")
        {
            Console.WriteLine($"Verified {identification.Edition!.SourceEdition}.");
            return 0;
        }
        if (command != "import") return Usage();
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "unknown";
        var manifest = await OriginalContent.ImportAsync(source, output, identification.Edition!, version);
        Console.WriteLine($"Installed {manifest.Files.Count} verified original files from {manifest.SourceEdition} at {output}");
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Import failed: {exception.Message}");
        return 1;
    }
}

static SourceManifest[] LoadManifests()
{
    var assembly = Assembly.GetExecutingAssembly();
    return assembly.GetManifestResourceNames()
        .Where(name => name.EndsWith(".json", StringComparison.Ordinal))
        .Order(StringComparer.Ordinal)
        .Select(name => { using var stream = assembly.GetManifestResourceStream(name)!; return SourceManifest.Load(stream); })
        .ToArray();
}

static int Report(IReadOnlyList<string> errors, string success)
{
    if (errors.Count == 0) { Console.WriteLine(success); return 0; }
    foreach (var error in errors) Console.Error.WriteLine(error);
    return 3;
}

static string? Option(string[] args, string name)
{
    var index = Array.FindIndex(args, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
}

static int Usage()
{
    Console.WriteLine("{{DISPLAY_NAME}} original-content importer");
    Console.WriteLine("  list-editions");
    Console.WriteLine("  verify-source --source <owned-original>");
    Console.WriteLine("  import --source <owned-original> [--output <path>]");
    Console.WriteLine("  verify-output [--output <path>]");
    return 64;
}
