# CI matrix from file

Reads a JSON file and hands its contents back as a matrix. For a job matrix that is not the
repository's PHP matrix - a list of sites to deploy to, a set of packages to publish - kept in a
file of its own.

```yaml
jobs:
  matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v6
      - id: matrix
        uses: uniquesca/ci/ci-matrix-from-file@v11
        with:
          matrix_file: '.github/deploy-targets.json'

  deploy:
    needs: [ matrix ]
    strategy:
      matrix:
        target: ${{ fromJSON(needs.matrix.outputs.matrix) }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `matrix_file` | yes | | JSON file to read the matrix from, relative to the working directory |

## Outputs

| Output | Description |
|---|---|
| `matrix` | The file's contents, verbatim |

## Dig deeper

### It hands back the file, not a matrix

The contents are parsed only to check that they are valid JSON - whatever shape they have is what
comes out, and it is up to the caller's `strategy.matrix` to make sense of it. Nothing is added,
nothing is defaulted, and no `xdebug` is appended the way [`qa-ci-matrix`](qa-ci-matrix.md) does.

**A missing file and a malformed one both fail the step**, deliberately: a job matrix that quietly
came out empty is a run that passes without doing anything.

### Where the PHP matrix lives instead

`_ci_environment.json` is read by [`qa-ci-matrix`](qa-ci-matrix.md) and
[`get-default-ci-environment`](get-default-ci-environment.md), which understand its `job_matrix`
key. Pointing this action at that file would hand back the whole environment file, configs and
fallbacks included, which is not a matrix.
