using System.Runtime.InteropServices;

namespace Restoration.Game;

/// <summary>The outcome of asking for software rendering: enabled, refused, or not asked for.</summary>
/// <param name="Enabled">Whether the caller should apply <see cref="DriverPath"/> before starting.</param>
/// <param name="DriverPath">The driver to load, set only when <paramref name="Enabled"/> is true.</param>
/// <param name="Rejection">Why the request was refused, or <c>null</c> when there is nothing to refuse.</param>
internal sealed record SoftwareRendererRequest(bool Enabled, string? DriverPath, string? Rejection);

/// <summary>Opt-in software OpenGL, for the platform smoke test and nothing else.</summary>
/// <remarks>
/// A software rasterizer renders at a small fraction of the speed of a real driver, so a player who
/// ended up on one would experience the game as broken rather than as slow. It is therefore reached
/// only by three independent conditions holding at once: the flag is passed explicitly, it is
/// passed together with --platform-smoke-test, and an external driver is named by
/// <see cref="DriverVariable"/> and exists on disk. Any one of them missing refuses the run rather
/// than falling back.
///
/// The third condition is the one that makes leaking into a shipped build impossible rather than
/// merely unlikely: a release package contains no OpenGL driver of its own, and
/// tools/Publish-Windows.ps1 fails the package if one ever appears in it. There is nothing for the
/// flag to load outside CI, where the driver is provisioned into the runner's temp directory.
/// </remarks>
internal static class SoftwareRenderer
{
    public const string Flag = "--software-renderer";
    public const string DriverVariable = "PLATFORM_SMOKE_TEST_GL_DRIVER";

    /// <summary>Decides whether software rendering applies. Pure: reads nothing and sets nothing.</summary>
    public static SoftwareRendererRequest Evaluate(bool requested, bool platformSmoke, string? driverPath)
    {
        if (!requested) return new(false, null, null);
        if (!platformSmoke)
            return new(false, null,
                $"{Flag} is a diagnostic for --platform-smoke-test and is not available for playing. " +
                "A software rasterizer is far too slow to render the game at a usable frame rate.");
        if (string.IsNullOrWhiteSpace(driverPath))
            return new(false, null,
                $"{Flag} requires {DriverVariable} to name an OpenGL driver to load. " +
                "A shipped build does not carry one, which is why this mode is unavailable outside CI.");
        return new(true, driverPath, null);
    }

    /// <summary>Points SDL at the named driver. Must run before the graphics device is created.</summary>
    public static void Apply(string driverPath)
    {
        if (!File.Exists(driverPath))
            throw new FileNotFoundException(
                $"The software OpenGL driver named by {DriverVariable} does not exist.", driverPath);

        // Windows resolves a loaded DLL's own dependencies from the process search path, not from
        // the directory it was loaded from, so a driver outside the application directory would
        // fail to find the rasterizer libraries sitting beside it. Putting its directory on PATH
        // first is what makes an out-of-tree driver loadable -- and keeping the driver out of the
        // tree is what stops it reaching a player.
        var driverDirectory = Path.GetDirectoryName(Path.GetFullPath(driverPath));
        if (!string.IsNullOrEmpty(driverDirectory))
            Publish("PATH", driverDirectory + Path.PathSeparator + Environment.GetEnvironmentVariable("PATH"));

        // SDL_OPENGL_LIBRARY is the variable SDL's desktop GL backends read to load an
        // implementation other than the system one -- verified by pointing it at a library that is
        // not OpenGL and watching startup fail, which SDL_VIDEO_GL_DRIVER does not do. That one is
        // set as well because SDL's EGL path reads it instead.
        Publish("SDL_OPENGL_LIBRARY", driverPath);
        Publish("SDL_VIDEO_GL_DRIVER", driverPath);
        Publish("LIBGL_ALWAYS_SOFTWARE", "1");
        Publish("GALLIUM_DRIVER", "llvmpipe");
        Console.Error.WriteLine(
            $"[software-renderer] Rendering through the software OpenGL driver at '{driverPath}'. " +
            "This mode exists for the platform smoke test and is never used by a shipped build.");
    }

    /// <summary>
    /// Sets a variable so that native code in this process can read it.
    /// </summary>
    /// <remarks>
    /// SDL and Mesa read their configuration with getenv. On Unix, .NET keeps its own copy of the
    /// environment and never calls setenv, so a value set only through Environment.SetEnvironmentVariable
    /// is invisible to them -- which is why setting the right variable still changed nothing until
    /// this went in. Windows updates the process environment block, which SDL does read.
    /// </remarks>
    private static void Publish(string name, string value)
    {
        Environment.SetEnvironmentVariable(name, value);
        if (OperatingSystem.IsWindows()) return;
        try
        {
            if (setenv(name, value, 1) != 0)
                Console.Error.WriteLine($"[software-renderer] Could not publish {name} to native code.");
        }
        catch (Exception exception) when (exception is DllNotFoundException or EntryPointNotFoundException)
        {
            Console.Error.WriteLine($"[software-renderer] Could not publish {name}: {exception.Message}");
        }
    }

    [DllImport("libc", EntryPoint = "setenv", SetLastError = true)]
    private static extern int setenv(
        [MarshalAs(UnmanagedType.LPUTF8Str)] string name,
        [MarshalAs(UnmanagedType.LPUTF8Str)] string value,
        int overwrite);
}
