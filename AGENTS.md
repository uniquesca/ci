# Working in this repository

## Never edit `CHANGELOG.md`

The release generates it from the git log, and it rewrites the section for the version being
released - so a hand-written entry is either overwritten or left conflicting with the commit the
release makes. **Your commit message is the changelog entry.** Prefix it `BREAKING:`, `Depr:`,
`Fix:`, `New:`, `Update:` or `QA:` and the release picks it up; anything else is left out. This
holds for every Uniques repository, not only this one.

## Documentation

Everything under `docs/` is laid out the same way: task-oriented sections first, then a single
`## Dig deeper` heading, then the detail.

**Keep the sections above `## Dig deeper` terse.** They exist to get somebody running, and every
sentence added to them costs the reader something. Caveats, rationale, failure modes, "why it is
built this way" and anything a reader can safely not know on their first pass belong under
`## Dig deeper`, in the subsection that already covers that topic.

When adding something to a section above `## Dig deeper`:

* Prefer a comment inside the YAML or code example over any prose at all.
* One paragraph is the ceiling. Two is too many - move it down.
* If it does not fit in one paragraph, it was always a `## Dig deeper` note.

Match the surrounding density. These docs use short declarative sentences, bold lead-ins for
things that fail silently, and tables for enumerable outcomes.

**Size a `## Dig deeper` note to the change it documents.** A small feature gets one mid-size
paragraph, not a heading with bullets and sub-paragraphs - an oversized note misrepresents how much
of the system the reader has to hold. Prefer extending the subsection that already covers the topic.
The same goes for explaining the change in conversation.

One page per reusable workflow under `docs/workflows/` and per action under `docs/actions/`, each
title, description, `## Secrets` and `## Inputs` and `## Outputs` tables, then `## Dig deeper`.
Both are listed in `docs/workflows-and-actions.md` - **add a new workflow or action to that page**,
or it exists without anybody being able to find it. `docs/qa-checks.md` and `docs/ai/*.md` cover
several workflows at once and are the exception; leave them that way.

Every input, output and secret the YAML declares belongs in its table, with the same default. A
table that has quietly fallen behind the YAML is worse than no table.

## Workflows

`.github/workflows/ai-*.yml` explain themselves in comments, and those comments carry the
reasoning rather than restating the YAML. Match that when editing them, and update the comment
when the code under it changes.

`ai-implement.yml` and `ai-review.yml` both use a `PROCEED` environment variable to stand down
without failing. The contract is documented where it is declared in each file - read it before
adding a step to either.
