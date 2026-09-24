using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Xunit;

namespace Restoration.Tests;

/// <summary>
/// Files from a maintainer's copy of the original game, for tests that compare the rebuild with
/// it. They live under the directory named by <c>GAME_DIR</c>: one directory per build, named by
/// its build ID, laid out as the build entry's paths give them, with a file from a disc under a
/// directory named after the disc (<c>CD:</c>, <c>CD2:</c>). Captures, dumps and recordings that
/// cannot be committed sit in <c>GAME_DIR/captures/</c>, named by their SHA-256. A test whose file
/// is absent is skipped, and a file whose hash differs from the spec fails the test.
/// </summary>
public static partial class OriginalGameFiles
{
    public const string EnvironmentVariable = "GAME_DIR";

    [GeneratedRegex(@"^BLD-[A-Z][A-Z0-9.-]*$")]
    private static partial Regex BuildPattern();

    [GeneratedRegex(@"^(?<disc>CD[0-9]*):(?<path>.+)$")]
    private static partial Regex DiscPattern();

    [GeneratedRegex(@"^[0-9a-f]{64}$")]
    private static partial Regex Sha256Pattern();

    /// <summary>
    /// The full path of <paramref name="path"/> in <paramref name="build"/>, after checking it
    /// against <paramref name="sha256"/> from the build entry. Skips the test when it is absent.
    /// </summary>
    public static string Require(string build, string path, string sha256) =>
        Resolve(Environment.GetEnvironmentVariable(EnvironmentVariable), build, path, sha256)
        ?? throw SkipMissing($"{build}/{path}");

    /// <summary>The full path of a capture, dump or recording named by its SHA-256.</summary>
    public static string RequireCapture(string sha256) =>
        ResolveCapture(Environment.GetEnvironmentVariable(EnvironmentVariable), sha256)
        ?? throw SkipMissing($"captures/{sha256}");

    internal static string? Resolve(string? root, string build, string path, string sha256)
    {
        if (!BuildPattern().IsMatch(build))
        {
            throw new ArgumentException($"'{build}' is not a build ID.", nameof(build));
        }
        var disc = DiscPattern().Match(path);
        var relative = disc.Success ? $"{disc.Groups["disc"].Value}/{disc.Groups["path"].Value}" : path;
        return Verified(root, Path.Combine(build, Portable(relative)), sha256);
    }

    internal static string? ResolveCapture(string? root, string sha256) =>
        Verified(root, Path.Combine("captures", sha256), sha256);

    private static string? Verified(string? root, string relative, string sha256)
    {
        if (!Sha256Pattern().IsMatch(sha256))
        {
            throw new ArgumentException($"'{sha256}' is not a lower-case SHA-256.", nameof(sha256));
        }
        if (string.IsNullOrWhiteSpace(root))
        {
            return null;
        }
        var file = Path.Combine(root, relative);
        if (!File.Exists(file))
        {
            return null;
        }
        using var stream = File.OpenRead(file);
        var actual = Convert.ToHexStringLower(SHA256.HashData(stream));
        if (actual != sha256)
        {
            throw new InvalidDataException($"{file} has SHA-256 {actual}, but the spec gives {sha256}.");
        }
        return file;
    }

    private static string Portable(string path)
    {
        var parts = path.Split('/');
        if (Path.IsPathRooted(path) || parts.Any(part => part is "" or "." or ".." || part.Contains('\\')))
        {
            throw new ArgumentException($"'{path}' is not a relative path with forward slashes.", nameof(path));
        }
        return Path.Combine(parts);
    }

    private static Exception SkipMissing(string what)
    {
        Assert.Skip($"{what} is not available under {EnvironmentVariable}.");
        return new UnreachableException();
    }
}
