# Get version

Works out the version being released from a git ref. A `release/10.4.0` branch, a `hotfix/10.4.1`
branch and a `10.4.0` tag all yield `10.4.0`; anything else fails the run.

```yaml
jobs:
  version:
    uses: uniquesca/ci/.github/workflows/get-version.yml@v11
    with:
      ref: ${{ github.ref }}

  release:
    needs: [ version ]
    uses: uniquesca/ci/.github/workflows/prepare-release.yml@v11
    with:
      version: ${{ needs.version.outputs.version }}
```

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `ref` | string | | **Required.** Ref to read the version from, usually `${{ github.ref }}` |

## Outputs

| Output | Description |
|---|---|
| `version` | The version, in `x.y.z` form |

## Dig deeper

### Which refs it accepts

| Ref | Version |
|---|---|
| `refs/heads/release/10.4.0` | `10.4.0` |
| `refs/heads/hotfix/10.4.1` | `10.4.1` |
| `refs/tags/10.4.0` | `10.4.0` |

A fourth component is accepted too - `release/10.4.0.1` gives `10.4.0.1` - even though the release
actions ask for `x.y.z`. Everything else **exits 2 with `Unable to determine version from <ref>`**,
deliberately: a release pipeline that guessed a version wrong is worse than one that did not start.

Note that a `release/**` branch is where a version is *prepared* and a tag is where it is
*published*, so the same workflow serves both ends of the release flow and the calling workflow's
trigger is what distinguishes them.

### Why a whole workflow for one regular expression

So that the ref parsing exists once. A release pipeline is several workflows -
[`prepare-release`](prepare-release.md), [`publish-npm`](publish-npm.md), a deployment - and every
one of them needs the same version. Calling this as the first job and passing
`needs.version.outputs.version` around keeps them from disagreeing.

It runs on `ubuntu-latest` and does not check the repository out, so it costs seconds.
