using RefurbishedDinosaurs.Core.Assets;
using RefurbishedDinosaurs.Core.Paths;

namespace Restoration.Resources;

/// <summary>
/// This game's original-content rules: its id, where its asset pack lives, and what the pack is
/// checked against. Identifying the player's copy and verifying the pack are the toolkit's
/// (<c>AssetVerifier</c> and <see cref="InstalledAssetVerifier"/>).
/// </summary>
public static class OriginalContent
{
    /// <summary>
    /// The asset-pack manifest format this build reads. Version 2 records XXH3-128 hashes; a pack
    /// written with an earlier version is reported as incompatible and the player imports again.
    /// </summary>
    public const int AssetPackFormatVersion = 2;
    public const string GameId = "{{GAME_ID}}";
    public const string AssetPackManifestFileName = "manifest.json";

    /// <summary>The per-user directory names the game and the Extractor share.</summary>
    public static RestorationPathOptions PathOptions { get; } = new("{{APP_DATA_DIRECTORY}}");

    /// <summary>
    /// What an asset pack is checked against. The pack directory holds nothing but the pack, so a
    /// file the manifest does not list is a problem.
    /// </summary>
    public static InstalledAssetExpectations AssetPackExpectations { get; } =
        new(AssetPackFormatVersion, GameId, AssetPackManifestFileName, RejectUnlistedFiles: true);

    /// <summary>The per-user directory for settings, saves and logs.</summary>
    /// <exception cref="InvalidOperationException">The account has no local application data folder.</exception>
    public static string StateRoot()
    {
        var localApplicationData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        // RestorationPaths would reject the empty folder with an ArgumentException naming its parameter,
        // which tells a player nothing.
        if (string.IsNullOrWhiteSpace(localApplicationData))
            throw new InvalidOperationException("This account has no local application data folder, so the " +
                "per-user directory for the asset pack, settings and logs cannot be resolved.");
        return RestorationPaths.ResolveStateRoot(PathOptions, localApplicationData);
    }

    /// <summary>The per-user asset pack the Extractor writes and the game reads by default.</summary>
    public static string DefaultAssetPackPath() => Path.Combine(StateRoot(), PathOptions.ContentDirectory);

    /// <summary>Checks the asset pack at <paramref name="root"/> as the game does at startup.</summary>
    public static Task<InstalledAssetVerification> VerifyInstalledAsync(
        string root,
        CancellationToken cancellationToken = default) =>
        InstalledAssetVerifier.VerifyDirectoryAsync(root, AssetPackExpectations, cancellationToken);

    /// <summary>Reads one supported edition's manifest and checks that it belongs to this game.</summary>
    /// <exception cref="InvalidDataException">The manifest is invalid or names another game.</exception>
    public static AssetManifest LoadEdition(Stream json)
    {
        var edition = AssetManifest.Load(json);
        if (!string.Equals(edition.GameId, GameId, StringComparison.Ordinal))
            throw new InvalidDataException(
                $"Edition manifest '{edition.SourceEdition}' is for '{edition.GameId}', not '{GameId}'.");
        return edition;
    }
}
