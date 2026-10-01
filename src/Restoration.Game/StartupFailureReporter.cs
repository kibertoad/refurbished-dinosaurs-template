using System.Runtime.InteropServices;
using ScientificMethod.Core.Diagnostics;

namespace Restoration.Game;

internal static class StartupFailureReporter
{
    private static readonly StartupFailureOptions Options = new(
        "{{DISPLAY_NAME}}",
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "{{APP_DATA_DIRECTORY}}", "Logs"),
        "If the asset pack is missing or damaged, run {{PROJECT_NAME}}.Extractor again.",
        "Asset pack");

    /// <param name="assetPack">The asset pack this launch tried, or <c>null</c> when it tried none.</param>
    /// <param name="allowDialog">
    /// Whether this launch may block on a modal dialog. A smoke test or any other unattended run
    /// passes <c>false</c>: there is nobody to dismiss a message box, so showing one replaces a
    /// diagnosable non-zero exit with a hang that hides the very error it is reporting.
    /// </param>
    public static void Report(Exception exception, string? assetPack, bool allowDialog = true)
    {
        // StartupFailure.Report always shows the dialog on Windows, so only its log and message are
        // used here and the dialog stays behind allowDialog.
        var log = StartupFailure.TryWriteLog(Options, exception, assetPack);
        var message = StartupFailure.BuildMessage(Options, exception, assetPack, log);
        Console.Error.WriteLine(message);
        Console.Error.WriteLine(exception);
        if (allowDialog && OperatingSystem.IsWindows() && !IsAutomated())
            _ = MessageBoxW(IntPtr.Zero, message, Options.ApplicationTitle, 0x10);
    }

    // Deliberately only an explicit signal. This process is a WinExe, so a person launching it from
    // Explorer has no console and its standard handles look redirected -- inferring "unattended"
    // from those would take the dialog away from the one case it exists for.
    private static bool IsAutomated() =>
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("CI"));

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr window, string text, string caption, uint type);
}
