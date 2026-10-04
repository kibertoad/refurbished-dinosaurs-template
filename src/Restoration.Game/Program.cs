using RefurbishedDinosaurs.Core.Diagnostics;
using Restoration.Game;
using Restoration.Resources;

// Read before the try so the failure path knows whether this launch is a person or a smoke test.
var platformSmoke = args.Contains("--platform-smoke-test", StringComparer.OrdinalIgnoreCase);
string? assetPack = null;
try
{
    // Decided before the --smoke-test shortcut so that asking for software rendering in a mode
    // that never draws anything is refused rather than silently ignored.
    var softwareRendering = SoftwareRenderer.Evaluate(
        args.Contains(SoftwareRenderer.Flag, StringComparer.OrdinalIgnoreCase),
        platformSmoke,
        Environment.GetEnvironmentVariable(SoftwareRenderer.DriverVariable));
    if (softwareRendering.Rejection is not null)
    {
        Console.Error.WriteLine(softwareRendering.Rejection);
        return 64;
    }

    if (args.Contains("--smoke-test", StringComparer.OrdinalIgnoreCase)) return 0;
    if (softwareRendering.Enabled) SoftwareRenderer.Apply(softwareRendering.DriverPath!);
    if (!platformSmoke)
    {
        assetPack = Option(args, "--asset-pack") ?? OriginalContent.DefaultAssetPackPath();
        var verification = await OriginalContent.VerifyInstalledAsync(assetPack);
        if (!verification.IsValid)
        {
            var details = string.Join(Environment.NewLine,
                verification.Issues.Select(issue => $"[{issue.Problem}] {issue.Detail}"));
            // The startup failure report names the asset pack and how to recreate it.
            throw new InvalidDataException(
                "A verified local asset pack is required." + Environment.NewLine + details);
        }
    }
    using var game = new RestorationGame(platformSmoke);
    game.Run();
    return 0;
}
catch (Exception exception)
{
    ReportStartupFailure(exception, assetPack, unattended: platformSmoke);
    return 1;
}

// A smoke test or any other unattended run must not block on a modal dialog: there is nobody to
// dismiss it, so it would replace a diagnosable non-zero exit with a hang. Only an explicit signal
// counts as unattended. This process is a WinExe, so a person launching it from Explorer has no
// console and its standard handles look redirected; inferring "unattended" from those would take
// the dialog away from the one case it exists for.
static void ReportStartupFailure(Exception exception, string? assetPack, bool unattended)
{
    var options = new StartupFailureOptions(
        "{{DISPLAY_NAME}}",
        Path.Combine(StateRootOrTemp(), "Logs"),
        "If the asset pack is missing or damaged, run {{PROJECT_NAME}}.Extractor against your " +
        "legally owned copy of the original game.",
        "Asset pack");
    var showDialog = !unattended && string.IsNullOrEmpty(Environment.GetEnvironmentVariable("CI"));
    StartupFailure.Report(options, exception, assetPack, showDialog);
}

// The failure being reported may be the one that stopped the state directory from resolving.
static string StateRootOrTemp()
{
    try { return OriginalContent.StateRoot(); }
    catch (InvalidOperationException) { return Path.Combine(Path.GetTempPath(), "{{APP_DATA_DIRECTORY}}"); }
}
static string? Option(string[] values, string name)
{
    var index = Array.FindIndex(values, value => value.Equals(name, StringComparison.OrdinalIgnoreCase));
    return index >= 0 && index + 1 < values.Length ? values[index + 1] : null;
}
