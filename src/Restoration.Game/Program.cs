using Restoration.Game;

try
{
    if (args.Contains("--smoke-test", StringComparer.OrdinalIgnoreCase)) return 0;
    var platformSmoke = args.Contains("--platform-smoke-test", StringComparer.OrdinalIgnoreCase);
    using var game = new RestorationGame(platformSmoke);
    game.Run();
    return 0;
}
catch (Exception exception)
{
    StartupFailureReporter.Report(exception);
    return 1;
}
