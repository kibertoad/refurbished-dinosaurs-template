using System.Security.Cryptography;
using System.Text.Json;
using Restoration.Inspect;
using Restoration.Resources;

if (args.Length > 0 && args[0] == "citations")
{
    return CitationCommand.Run(args[1..]);
}

try
{
    var sourcePath = Option(args, "--source") ?? (args.Length == 1 ? args[0] : null);
    var sourceKind = Option(args, "--kind") ?? SourceKinds.Directory;
    if (string.IsNullOrWhiteSpace(sourcePath) || !SourceKinds.IsSupported(sourceKind))
    {
        Console.Error.WriteLine("Usage: Restoration.Inspect --source <path> " +
            "[--kind directory|iso9660|cue-bin]\n" +
            "       Restoration.Inspect citations --executable <owned.exe> --docs <directory> [options]");
        return 64;
    }

    using var source = OriginalContentSource.Open(sourcePath, sourceKind);
    var files = new List<object>();
    foreach (var entry in source.Files)
    {
        await using var stream = source.OpenRead(entry.Path);
        files.Add(new
        {
            path = entry.Path,
            size = entry.Size,
            sha256 = Convert.ToHexStringLower(await SHA256.HashDataAsync(stream))
        });
    }
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        source = Path.GetFullPath(sourcePath),
        kind = source.Kind,
        label = source.Label,
        cueTracks = source.Cue?.Tracks.Count,
        files
    }, new JsonSerializerOptions { WriteIndented = true }));
    return 0;
}
catch (Exception exception) when (exception is IOException or UnauthorizedAccessException
                                  or InvalidDataException or ArgumentException)
{
    Console.Error.WriteLine($"[inspect_failed] Source inspection failed safely: {exception.Message}");
    return 1;
}

static string? Option(string[] arguments, string name)
{
    var index = Array.FindIndex(arguments, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < arguments.Length ? arguments[index + 1] : null;
}
