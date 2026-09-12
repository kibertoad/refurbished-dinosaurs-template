using Restoration.Game;
using Restoration.Resources;

try
{
    if (args.Contains("--smoke-test", StringComparer.OrdinalIgnoreCase)) return 0;
    var platformSmoke = args.Contains("--platform-smoke-test", StringComparer.OrdinalIgnoreCase);
    if (!platformSmoke)
    {
        var assetPack = Option(args, "--asset-pack") ?? OriginalContent.DefaultAssetPackPath();
        var diagnostics = await OriginalContent.VerifyInstalledAsync(assetPack);
        if (diagnostics.Count != 0)
        {
            var details = string.Join(Environment.NewLine,
                diagnostics.Select(diagnostic => $"[{diagnostic.Code}] {diagnostic.Message}"));
            throw new InvalidDataException(
                $"A verified local asset pack is required at '{assetPack}'." + Environment.NewLine +
                "Run {{PROJECT_NAME}}.Extractor against your legally owned GOG installation." +
                Environment.NewLine + details);
        }
    }
    using var game = new RestorationGame(platformSmoke);
    game.Run();
    return 0;
}
catch (Exception exception)
{
    StartupFailureReporter.Report(exception);
    return 1;
}
static string? Option(string[] values, string name)
{
    var index = Array.FindIndex(values, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < values.Length ? values[index + 1] : null;
}
