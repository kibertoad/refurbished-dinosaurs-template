using System.Security.Cryptography;
using System.Text.Json;

if (args.Length != 1 || !Directory.Exists(args[0]))
{
    Console.Error.WriteLine("Usage: Restoration.Inspect <owned-original-directory>");
    return 64;
}

var root = Path.GetFullPath(args[0]);
var files = new List<object>();
foreach (var path in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories).Order())
{
    await using var stream = File.OpenRead(path);
    files.Add(new
    {
        path = Path.GetRelativePath(root, path).Replace('\\', '/'),
        size = stream.Length,
        sha256 = Convert.ToHexString(await SHA256.HashDataAsync(stream)).ToLowerInvariant()
    });
}
Console.WriteLine(JsonSerializer.Serialize(new { root, files }, new JsonSerializerOptions { WriteIndented = true }));
return 0;
