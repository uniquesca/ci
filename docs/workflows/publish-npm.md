# Publish NPM package

Builds a package, publishes it to the Github NPM registry, and publishes a Github release for the
same version with the built folder attached.

```yaml
name: Publish

on:
  push:
    tags: [ '*' ]

jobs:
  version:
    uses: uniquesca/ci/.github/workflows/get-version.yml@v11
    with:
      ref: ${{ github.ref }}

  publish:
    needs: [ version ]
    uses: uniquesca/ci/.github/workflows/publish-npm.yml@v11
    with:
      release_version: ${{ needs.version.outputs.version }}
      build_cmd: 'npm run build'
    secrets:
      NODE_AUTH_TOKEN: ${{ secrets.NODE_AUTH_TOKEN }}
```

## Secrets

| Secret | Required | Description |
|---|---|---|
| `NODE_AUTH_TOKEN` | yes | Access token for authentication with the NPM registry |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `release_version` | string | | **Required.** Version being published, `x.y.z` |
| `build_cmd` | string | `''` | Command that builds the package. Nothing is built when empty |
| `dist_folder` | string | `dist` | Folder that gets published, relative to `working_directory` |
| `working_directory` | string | `.` | Directory the NPM commands run in |
| `node_version` | number | `20` | Node version to build and publish with |
| `cleanup_dependencies` | boolean | `false` | Strip `dependencies`, `devDependencies` and `scripts` from the published `package.json` |
| `github_release` | boolean | `true` | Also publish a Github release, with the built folder zipped and attached |

## Outputs

None.

## Dig deeper

### What is published

**`dist_folder`, not the repository.** The workflow installs dependencies, runs `build_cmd`, then
publishes from `<working_directory>/<dist_folder>` - so that folder needs a `package.json` of its
own, which is what the build is expected to put there. `release_version` is written into it with
`npm pkg set` first; a missing `package.json` there is reported and publishing then fails.

The registry is `npm.pkg.github.com` for the `@uniquesca` scope, configured through an `.npmrc`
written in the dist folder at publish time.

### Permissions

The job sets `permissions: contents: write` for itself, because the Github release at the end is
published with the run's own token. **The caller does not have to grant anything** - `NODE_AUTH_TOKEN`
is a registry credential, not a Github permission.

### `cleanup_dependencies`

Removes `dependencies`, `devDependencies` and `scripts` from the published manifest. That is right
for a bundle whose dependencies are already inside it - a consumer installing it should not resolve a
build's worth of packages it will never load. It is wrong for a library that genuinely needs its
dependencies at runtime, which is why it is off by default.

### The Github release

[`github-release`](../actions/github-release.md) runs last, with `attach_dist: true`, so the release
body is the changelog between the previous tag and this one and the asset is the built folder zipped.
The dist folder is copied outside the working tree first, so that the release action's own checkout
cannot clean it away.

Worth knowing: a release created with `GITHUB_TOKEN` raises no events, so nothing waiting on
`on: release` fires for it.

### Ordering with the tag

`release_version` has to be a version that already exists as a tag, since the release is attached to
it - which is why this is normally triggered by the tag push and takes its version from
[`get-version`](get-version.md).
