# Bump dependencies

Bumps one or more Composer or Yarn packages to the versions given, updates the lock files, and
opens a pull request. Meant for a library released elsewhere that this repository now needs.

```yaml
name: Bump dependencies

on:
  workflow_dispatch:
    inputs:
      packages:
        description: 'One per line, e.g. uniquesca/php-stdlib@1.15.0 or @uniquesca/uforms@2.6.0'
        required: true
        type: string

jobs:
  bump:
    uses: uniquesca/ci/.github/workflows/bump-dependencies.yml@v11
    with:
      packages: ${{ inputs.packages }}
    secrets:
      PR_TOKEN: ${{ secrets.GHA_PRIVATE_ACCESS_TOKEN }}
      COMPOSER_ACCESS_TOKEN: ${{ secrets.SATIS_COMPOSER_ACCESS_TOKEN }}
      NPM_ACCESS_TOKEN: ${{ secrets.GHA_PRIVATE_ACCESS_TOKEN }}
```

## Secrets

| Secret | Description |
|---|---|
| `PR_TOKEN` | **Required.** Pushes the branch and opens the pull request. **Not `GITHUB_TOKEN`**: a pull request it opens starts no checks |
| `COMPOSER_ACCESS_TOKEN` | Access to the private Composer repository. Needed for Composer packages |
| `NPM_ACCESS_TOKEN` | Access to the Github NPM registry. Needed for Yarn packages |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `packages` | string | | **Required.** One `name@version` per line. A name starting with `@` is a Yarn package |
| `base_branch` | string | `develop` | Branch the pull request is opened against |
| `allowed_prefixes` | string | `uniquesca/ @uniquesca/` | Space-separated name prefixes that may be bumped |
| `php_version` | string | `8.2` | PHP version Composer resolves the lock file for |
| `node_version` | string | `20` | Node version Yarn runs on |

## Dig deeper

### What it changes

Every tracked `composer.json` or `package.json` that lists the package gets the new version, not
only the root one. A monorepo's root `composer.json` is merged from its packages', and
`monorepo-builder validate` fails when they disagree. Each constraint keeps its operator: `^1.14.3`
becomes `^1.15.0`, an exact `2.10.0` stays exact.

Then every `composer.lock` or `yarn.lock` next to a changed manifest is updated. Composer updates
the bumped packages with their own dependencies and installs nothing. Yarn runs a full install with
scripts off, because Yarn 1 cannot update a lock file without installing.

Only manifests and lock files are committed.

### What it refuses

The run fails, and opens nothing, when:

| Case | Why |
|---|---|
| The person who started it has less than write access | Checked even though a manual run already needs it, in case a caller adds another trigger |
| A name does not start with one of `allowed_prefixes` | Anyone who can run it chooses the package |
| A name is a package of this repository | A monorepo's own packages match `uniquesca/` too |
| A package is in no manifest | Most likely a typo. Adding a new dependency is not a bump |
| A constraint is not a plain version with `^`, `~`, `>=` or nothing | `^1.0 \|\| ^2.0` or `self.version` has no single right answer |

Nothing is changed if one entry in the list is wrong.

### Running it again

The branch is `deps/<package>-<version>` for a single package, `deps/bump-<run id>` for several.
Running the same single bump again force-pushes the branch, so an open pull request for it is
updated instead of duplicated. If the repository is already at the requested versions, the run
ends with a notice and opens nothing.

Two runs in one repository queue rather than run side by side, since both rewrite the lock files.
