# {{DISPLAY_NAME}}

{{PROJECT_SUMMARY}}

This repository intentionally contains no copyrighted assets from the original
game. You must own a supported legal copy; the included importer verifies that
copy and builds a local content pack without modifying the original
installation.

> New repository checklist: fill in `tools/project-config.json`, run
> `./tools/Configure-Project.ps1`, then work through
> `docs/BOOTSTRAP-CHECKLIST.md`. `docs/CUSTOMIZATION.md` explains every knob,
> and `AGENTS.md` is the working agreement for humans and coding agents alike.

## Quick start

1. Install a supported, legally owned release of {{ORIGINAL_TITLE}}.
2. Download the latest {{DISPLAY_NAME}} installer from
   [GitHub Releases]({{REPOSITORY_URL}}/releases/latest).
3. During Setup, select the original installation and keep asset import enabled.

The installer contains no original assets. It verifies and imports the required
content locally from the copy selected by the player.

## Current status

| Area | Supported now | Current limitations |
|---|---|---|
| Installation and assets | Windows, Linux, and macOS packages include an importer for supported legal releases. | Original assets are never bundled; release packages are unsigned by default. |
| Gameplay | Describe the currently playable end-to-end slice here. | List material missing or provisional behavior here. |
| Saves and compatibility | Describe native save, replay, and migration support here. | State compatibility guarantees and unsupported original formats here. |
| Presentation | Describe restored graphics, audio, controls, and scaling here. | List presentation work still awaiting parity validation here. |

## Controls

Document the keyboard, mouse, and controller mappings that players need. A
compact table works well once the playable interaction model is established.

## Acknowledgements

Credit {{ORIGINAL_DEVELOPER}} and the other original creators and publishers,
reverse-engineering research, and further sources that materially helped the
clean-room restoration. Do not imply that those parties endorse this project.

This project copies no source code and redistributes no copyrighted resources
from the original game. Players must import those resources locally from a
legally owned copy.

## License

Copyright (C) {{COPYRIGHT_YEAR}} {{COPYRIGHT_HOLDER}}.

The original code in this repository is licensed under the [MIT License](LICENSE).
The license does not cover or grant rights to original-game assets, which are not
distributed by this project.

Developer setup is documented in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md),
and packaging and releases are documented in
[docs/RELEASING.md](docs/RELEASING.md).
