# Get default CI environment

Picks the one entry from `_ci_environment.json` that a job which should run only once ought to run
on - releasing, publishing, preparing a dump - and hands it back as a one-element matrix.

```yaml
jobs:
  environment:
    runs-on: ubuntu-latest
    outputs:
      env: ${{ steps.env.outputs.env }}
    steps:
      - uses: actions/checkout@v6
      - id: env
        uses: uniquesca/ci/get-default-ci-environment@v11

  release:
    needs: [ environment ]
    strategy:
      matrix:
        env: ${{ fromJSON(needs.environment.outputs.env) }}
    runs-on: ${{ matrix.env.os }}
```

## Inputs

This action takes no inputs. It reads `_ci_environment.json` from the current working directory,
so the repository has to be checked out first.

## Outputs

| Output | Description |
|---|---|
| `env` | JSON array holding exactly one matrix entry, in the same shape [`qa-ci-matrix`](qa-ci-matrix.md) produces |

## Dig deeper

### How the entry is chosen

1. A matrix with exactly one entry - that entry, whether or not it is marked.
2. Otherwise the first entry with `"default": true`.
3. Otherwise `ubuntu-latest` on PHP 8.2 with `xdebug`, invented on the spot.

So **a multi-entry matrix with nothing marked `default` silently gets PHP 8.2** rather than any of
the versions the repository actually named. Mark one.

The output is an array of one rather than a bare object so that it can be dropped straight into
`strategy.matrix` - which is also what makes `matrix.env.os` and `matrix.env.php.version`
available the same way the QA matrix makes them available.

### It is not PHP-specific in intent

The name and the shape are historical: the entry is the repository's "default CI environment", and
PHP happens to be what is described in it. The `action.yml` carries a `TODO` about this. Nothing
outside PHP reads `php.version`, so a JavaScript-only repository can leave the matrix out entirely
and take the invented entry.
