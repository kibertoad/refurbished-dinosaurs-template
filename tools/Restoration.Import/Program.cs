using System.Reflection;
using Restoration.Resources;

return await RunAsync(args);

static async Task<int> RunAsync(string[] args)
{
    try
    {
        if (args.Length == 0 || args[0] is "--help" or "-h") return Usage();
        var command = args[0].ToLowerInvariant();
        var source = Option(args, "--source");
        var output = Option(args, "--output") ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "{{APP_DATA_DIRECTORY}}", "UserContent");
        if (command == "verify-output") { source = output; command = "verify-source"; }
        if (string.IsNullOrWhiteSpace(source)) throw new ArgumentException("--source is required.");
        var manifest = LoadManifest();
        var errors = await OriginalContent.VerifyAsync(source, manifest);
        if (errors.Count != 0)
        {
            foreach (var error in errors) Console.Error.WriteLine(error);
            return 2;
        }
        if (command == "verify-source") { Console.WriteLine($"Verified {manifest.SourceEdition}."); return 0; }
        if (command != "import") return Usage();
        await OriginalContent.CopyVerifiedAsync(source, output, manifest);
        Console.WriteLine($"Installed verified original content at {output}");
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Import failed: {exception.Message}");
        return 1;
    }
}

static SourceManifest LoadManifest()
{
    var assembly = Assembly.GetExecutingAssembly();
    var name = assembly.GetManifestResourceNames().Single(x => x.EndsWith("example.json", StringComparison.Ordinal));
    using var stream = assembly.GetManifestResourceStream(name)!;
    return SourceManifest.Load(stream);
}

static string? Option(string[] args, string name)
{
    var index = Array.FindIndex(args, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
}

static int Usage()
{
    Console.WriteLine("{{DISPLAY_NAME}} original-content importer");
    Console.WriteLine("  verify-source --source <owned-original> [--output <path>]");
    Console.WriteLine("  import --source <owned-original> [--output <path>]");
    Console.WriteLine("  verify-output [--output <path>]");
    return 64;
}
