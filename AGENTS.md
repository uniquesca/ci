# Working in this repository

## Never edit `CHANGELOG.md`

The release generates it from the git log, and it rewrites the section for the version being
released - so a hand-written entry is either overwritten or left conflicting with the commit the
release makes. **Your commit message is the changelog entry.** Prefix it `BREAKING:`, `Depr:`,
`Fix:`, `New:`, `Update:` or `QA:` and the release picks it up; anything else is left out. This
holds for every Uniques repository, not only this one.

## Moving to the next major version

The workflows and actions reference each other at the active version branch, so a caller on it
stays inside its code. `bin/pin-ci-version.sh v12` moves the repository: it rewrites every
reference and `VERSION_BRANCH` in `update-current-version.yml`, and lists the versions in prose for
you to judge by hand. Create the `v12` branch off `main` in the same change. `self-tests.yml` fails
on a reference left behind, so a new action added at `@main` does not get past a pull request.

# Documentation and comments

Write documentation and code comments in plain, easily readable English, and
keep them as short as they can be while still being clear. Review anything you
write for AI slop and cut it.

Add a comment only when the code cannot speak for itself:

- when the code is not obvious and a reader needs the intent behind it, or
- to protect a sensitive or fragile place from careless change or deletion.

Do not add a comment that restates what the code plainly does, explains
something a reader can deduce from the code, or states common sense. If a
comment does not earn its place, leave it out.

# Documentation

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

**Describe what is, not what changed** - here and in the workflow comments. Whoever reads this is
meeting the code for the first time and never saw the state it replaced, so "now that", "no longer",
"rather than a workaround" and "there is no second token any more" spend their attention on
something they do not have, and read as stale the moment the next change lands. Write the sentence
you would have written if it had always been this way. Nothing is allowed to define itself by its
own absence: if a thing is gone, the text does not mention it. Why it changed belongs in the commit
message, where anybody asking that is already looking.

**A `## Dig deeper` note gets one paragraph, in the subsection that already covers the topic.** An
oversized note misrepresents how much of the system the reader has to hold, so the limits are
countable: extend an existing `###` rather than adding one, one paragraph per change, and no
bullets, sub-headings or code blocks inside the note.

**When the change is finished, read your own `docs/` diff and cut.** Docs say how a thing works
where the code does not make that obvious; the reasoning belongs in the comment on the code it
explains. So cut anything that argues *why*, anything the code or its comments already say, and
anything a reader does not need in order to act - "true and useful" is not the test, and everything
you want to keep will pass it. This is a step to take after the work, not a principle to hold during
it: what feels load-bearing while the implementation is fresh reads as padding to somebody meeting
the page for the first time. The same applies to explaining the change in conversation.

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
