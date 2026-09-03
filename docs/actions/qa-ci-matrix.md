# QA CI matrix

Reads the job matrix out of `_ci_environment.json` and hands it back as JSON for a
`strategy.matrix`. A repository without that file gets one job on PHP 8.2.

```yaml
jobs:
  matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v7
      - id: matrix
        uses: uniquesca/ci/qa-ci-matrix@v11

  qa:
    needs: [ matrix ]
    strategy:
      matrix:
        setup: ${{ fromJSON(needs.matrix.outputs.matrix) }}
    runs-on: ${{ matrix.setup.os }}
```

## Inputs

This action takes no inputs. It reads `_ci_environment.json` from the current working directory,
so the repository has to be checked out first.

## Outputs

| Output | Description |
|---|---|
| `matrix` | JSON array of matrix entries, each with `os`, `php.version`, `php.extensions`, `default` and `locked` |

## Dig deeper

### The matrix in `_ci_environment.json`

```json
{
  "job_matrix": [
    { "os": "ubuntu-latest", "php": { "version": "8.1", "extensions": "gd intl" }, "locked": true },
    { "os": "ubuntu-latest", "php": { "version": "8.2", "extensions": "gd intl" }, "default": true }
  ]
}
```

| Key | Default | What it does |
|---|---|---|
| `os` | `ubuntu-latest` | Runner the entry's job runs on |
| `php.version` | `8.1` | PHP version to set up |
| `php.extensions` | `''` | Space-separated extensions for `shivammathur/setup-php` |
| `default` | `false` | Marks the entry [`get-default-ci-environment`](get-default-ci-environment.md) picks |
| `locked` | `false` | `true` installs from the lock file, `false` updates - see [`install-packages`](install-packages.md) |

**`xdebug` is added to every entry's extensions** if it is not there already, because it is what
makes coverage work and a matrix that omits it produces a coverage report of nothing.

### No file, or no matrix in it

Both give you the same single entry: `ubuntu-latest`, PHP 8.2, `xdebug`, `default: true`,
`locked: false`. So the QA workflows can be added to a repository before its CI environment file
is, which is the point.

### The other two matrix actions

| Action | Gives you |
|---|---|
| `qa-ci-matrix` | Every entry in `_ci_environment.json` - the whole matrix
| [`get-default-ci-environment`](get-default-ci-environment.md) | One entry, for a job that should run once
| [`ci-matrix-from-file`](ci-matrix-from-file.md) | The contents of any JSON file you name, unchanged
