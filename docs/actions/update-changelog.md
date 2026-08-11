# Update changelog

Generates a changelog section for a version out of the git log and writes it into `CHANGELOG.md`.
Commit subjects decide what appears: only those starting with `Breaking`, `Depr`, `Fix`, `New` or
`Update` are included, and they are grouped in that order.

```yaml
- name: Update the changelog
  uses: uniquesca/ci/update-changelog@main
  with:
    target_version: '10.4.0'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `target_version` | yes | | Version to write the section for. Has to be `x.y.z` |
| `working_directory` | no | `.` | Directory holding `CHANGELOG.md` |
| `mode` | no | `normal` | `normal` updates the file in place; `raw` replaces it with the bare list |
| `offset` | no | `0` | Which tag to end at. `0` means "up to `HEAD`", `1` means "up to the newest tag" |
| `use_tags` | no | `true` | Also write per-tag changelogs for `[tag]` markers in commit messages |

## Outputs

This action produces no outputs - it writes `CHANGELOG.md`, and in `normal` mode possibly
`CHANGELOG.<tag>.md` alongside it.

## Dig deeper

### Which commits make it in

Commits are read with `git log --no-merges`, and a subject has to start with one of five words to
count:

| Prefix | Meaning |
|---|---|
| `BREAKING:` | Something that is not backwards compatible |
| `Depr:` | A deprecation |
| `Fix:` | A bug fix |
| `New:` | A new feature |
| `Update:` | A change to something that exists |

Anything else - `CI:`, `Refactor:`, a bare subject - is left out. The list is sorted into the order
above, so the breaking changes are the first thing a reader sees. When commits exist but none of
them qualify, the section says so rather than being empty: *"All the changes in this version are
insignificant and are probably limited to code quality or infrastructure."*

**One commit can contribute several entries.** A message is split where a new `Word: ` begins, so
a commit whose body carries `Fix: ...` on its own line under an `Update: ...` subject produces both.
`Co-authored-by` trailers are dropped.

Each entry is written as `* <text> (<short hash> by <author>)`.

### Which range is read

| `offset` | Range | Used by |
|---|---|---|
| `0` | Newest tag to `HEAD` | [`prepare-release`](../workflows/prepare-release.md), preparing a version that is not tagged yet |
| `1` | Second-newest tag to the newest tag | [`github-release`](github-release.md), writing notes for the tag that was just pushed |

Higher offsets keep walking back a tag at a time. The repository has to be checked out with
`fetch-depth: 0` for any of this - a shallow clone has neither the tags nor the history.

### `normal` versus `raw`

`normal` keeps the file. The existing content is normalised - bullets given consistent
`* ` prefixes, headings rewritten to `## vX.Y.Z`, runs of blank lines collapsed - and the new
section is appended. **A section for `target_version` that is already in the file is cut off first
and regenerated**, so running the action twice for the same version does not duplicate it. The
version has to be `x.y.z` or the action exits with an error.

`raw` **overwrites the file** with nothing but the bullet list, no heading. That is for a
throwaway file being turned into a release body, which is what
[`github-release`](github-release.md) does - it renders into an empty `_github_ci_changelog`
directory rather than at the repository root.

### Per-tag changelogs

With `use_tags` on, a `[tag]` marker anywhere in a commit message also files that entry in
`CHANGELOG.<tag>.md` next to the main one. A commit carrying two markers appears in both files.

```
New: password reset flow [portal] [api]
```

Entries in a per-tag file leave out the hash and author, since those files tend to be read by
somebody who is not looking at the repository. The marker itself is stripped from the text
everywhere. Markers meaning "do not run CI" - `skip ci`, `skip-ci`, `ci skip`, `no ci`,
`skip actions`, `actions skip` - never produce a file. Characters that cannot go in a filename are
replaced with `-`.
