# Github release

Publishes a Github release for a version, with the changelog for that tag as the body, optionally
attaching a zipped dist folder and reindexing the package on Satis.

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    # What lets the run's own token publish the release
    permissions:
      contents: write
    steps:
      - uses: uniquesca/ci/github-release@main
        with:
          release_version: ${{ needs.version.outputs.version }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `release_version` | yes | | Version being published, `x.y.z`. Also the tag the release is attached to |
| `attach_dist` | no | `'false'` | Attach a zipped dist folder to the release |
| `dist_folder` | no | `dist` | Folder to zip. Ignored unless `attach_dist` is `'true'` |
| `rescan_satis` | no | `'false'` | Ask Satis to reindex this package afterwards |
| `satis_base_url` | no | `https://satis.unqs.ca` | Satis base URL, no trailing slash |
| `satis_rebuild_token` | no | `''` | Bearer token for the Satis rebuild endpoint |

## Outputs

This action produces no outputs.

## Dig deeper

### What it needs from the job

**`permissions: contents: write` on the calling job.** The release is published with the run's own
`GITHUB_TOKEN` and nothing else - there is no token input.

**The tag has to exist already.** The release is attached to `release_version` as a tag name, so
this belongs in a workflow triggered by the tag push, not one that creates it.

The action checks the repository out itself, with `fetch-depth: 0`, because the body comes from the
git history.

### The release body

[`update-changelog`](update-changelog.md) is run in `raw` mode with `offset: 1` - the changes
between the previous tag and this one - into a scratch `_github_ci_changelog` directory, so the
repository's own `CHANGELOG.md` is untouched. Only commits prefixed `BREAKING:`, `Depr:`, `Fix:`,
`New:` or `Update:` appear; see that page for the rules.

A body over 125,000 characters is cut to 124,000 with `...` appended, because Github rejects
anything longer.

### A release created this way starts no workflow run

Github does not raise events for a release, or a tag, created with `GITHUB_TOKEN` - deliberately,
so a workflow cannot start itself in a loop. So nothing waiting on `on: release` or
`on: push: tags` fires for this release. Both tag-triggered workflows in this repository run off
the tag push that led here instead, which is why it does not come up in practice.

### Satis

With `rescan_satis` set, the action calls `POST <satis_base_url>/-/rebuild?package=<owner/repo>`
with `satis_rebuild_token` as a bearer token, so the new version is installable with Composer
without waiting for the next scheduled scan. The call fails the step if Satis rejects it - by then
the release is already published, so a red step here means "the release is out, the index is
stale".

### Doing this for an NPM package instead

[`publish-npm`](../workflows/publish-npm.md) calls this action at the end of publishing, with
`attach_dist: true`. If you are publishing a package, call that workflow rather than this action.
