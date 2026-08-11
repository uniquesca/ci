# Install packages

Installs Composer, NPM and Yarn dependencies, with caching, authenticating against the Uniques
private registries. Each ecosystem is installed only if the working directory has its manifest, so
one call covers a PHP repository, a JavaScript one, and one that is both.

```yaml
- name: Install dependencies
  uses: uniquesca/ci/install-packages@main
  with:
    composer_access_token: ${{ secrets.COMPOSER_ACCESS_TOKEN }}
    npm_access_token: ${{ secrets.NPM_ACCESS_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `working_directory` | no | `.` | Directory the manifests live in and the commands run in |
| `cache_key` | no | `''` | Extra fragment mixed into every cache key, to keep two callers' caches apart |
| `skip_composer` | no | `false` | Skip Composer entirely |
| `composer_cmd` | no | `composer install --no-scripts` | Command that installs. `composer update` for an unlocked job |
| `composer_lock` | no | `composer.lock` | Alternative lock file to install from |
| `composer_cache_dir` | no | `false` | Cache directory. Asks Composer when unset or missing |
| `composer_access_token` | no | | Token for `satis.unqs.ca`, the Uniques Composer registry |
| `skip_npm_yarn` | no | `false` | Skip NPM and Yarn entirely |
| `npm_install_cmd` | no | `npm install` | Command that installs, when NPM is the package manager |
| `npm_cache_dir` | no | `false` | Cache directory. Asks NPM when unset or missing |
| `yarn_install_cmd` | no | `yarn install --production=false` | Command that installs, when Yarn is the package manager |
| `yarn_cache_dir` | no | `false` | Cache directory. Asks Yarn when unset or missing |
| `npm_access_token` | no | | Token for `npm.pkg.github.com`, used for `@uniquesca` packages |

## Outputs

This action produces no outputs.

## Dig deeper

### What it detects, and what it skips

| In `working_directory` | What happens |
|---|---|
| `composer.json` | Composer dependencies are installed |
| `package.json` and `.yarnrc` | Yarn installs |
| `package.json`, no `.yarnrc` | NPM installs |
| Neither manifest | Nothing, and the step still passes |

**Yarn is chosen by `.yarnrc`, not by `yarn.lock`.** A repository with a `yarn.lock` and no
`.yarnrc` is installed with NPM. That rule is shared with
[`npm-qa-checks`](../qa-checks.md#npm-qa-checks-workflow), so the tool that installs the
dependencies is the tool that runs the scripts.

### Caching

One `actions/cache` entry per ecosystem, keyed on the runner OS, `cache_key`, and a hash of the
lock file - `composer.lock`, `package-lock.json` or `yarn.lock`, each falling back to its manifest
when the lock file is absent. `restore-keys` fall back to the newest cache for the same ecosystem,
so a changed lock file still starts from a warm cache.

`cache_key` matters when two jobs in the same repository install different dependency sets - a PHP
version matrix, say, where an unlocked leg resolves different packages. Give them different
fragments and neither restores the other's cache.

### Credentials, and where they are written

Composer's token goes in with `composer config --auth`, and any `auth.json` in the working
directory is deleted before and after. NPM and Yarn get a generated `.npmrc` pointing `@uniquesca`
at `npm.pkg.github.com`, and it is deleted at the end of the step for the same reason: a token
written into the working tree is a token a later step could commit.

Both are optional. A repository with only public dependencies needs neither.

### Two things worth knowing

**An alternative `composer_lock` is swapped in and swapped back.** The real `composer.lock` is
moved aside, the alternative copied over it, `composer_cmd` runs, and the original is restored.
This is how a PHP version with its own `composer.<version>.lock` is installed in
[`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow) without the repository carrying two lock
files at the same path.

**A Yarn install that fails with `401 Unauthorized` is retried once without `yarn.lock`.** Yarn
intermittently authenticates against the registry for a package the lock file pins, fails, and
succeeds on a fresh resolve. Any other failure is reported and fails the step as usual.
