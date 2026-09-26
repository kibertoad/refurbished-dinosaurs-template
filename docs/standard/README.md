# Local copy of the standard

This directory holds the three pages published at dinorefurb.com that every
restoration follows:

- [methodology.md](methodology.md): <https://dinorefurb.com/methodology/>
- [documentation-standard.md](documentation-standard.md): <https://dinorefurb.com/documentation-standard/>
- [work-protocol.md](work-protocol.md): <https://dinorefurb.com/work-protocol/>

They were copied from `website/content/english/pages/` of
[kibertoad/refurbished-dinosaurs](https://github.com/kibertoad/refurbished-dinosaurs)
at commit `5556777af3c9e94b9bff619f8502322c22ba4e87` (2026-09-27). The copy
drops the site's front matter, puts the page title in a heading, turns links
between the three pages into relative links, and points links to the site's
other pages at dinorefurb.com. The text is otherwise unchanged.

Agents read this copy and assume it is up to date (see `AGENTS.md`). They do
not go online to compare it with the published pages.

## Refreshing the copy

A refresh is always started by a person. When the owner asks for one:

1. Take the three pages from the newest commit of the website repository and
   convert them as described above.
2. Update the commit and date in this file.
3. Check that every link into these pages from the rest of the repository
   still reaches a heading, and follow any change the new version makes to the
   rules in `AGENTS.md`, the skills and the documents that summarize them.
