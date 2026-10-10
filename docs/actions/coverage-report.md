# Coverage report

Writes a Markdown unit test coverage report from PHPUnit's Clover output: totals, then each file's
line and method coverage and its uncovered lines.

```yaml
- run: ./vendor/bin/phpunit --coverage-clover clover.xml

- uses: uniquesca/ci/coverage-report@v11
  with:
    report_file: docs/coverage.md
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `clover_file` | no | `clover.xml` | PHPUnit Clover output to build the report from |
| `report_file` | no | `docs/coverage.md` | Path to write the Markdown report to |

## Outputs

This action produces no outputs - it writes `report_file` and leaves committing it to the caller.

## Dig deeper

### File paths

Paths are shown relative to the repository, including when PHPUnit ran in a container and Clover
holds the container's paths, such as `/var/www/app/module/...`. A file shows up only if PHPUnit
measured it, so **a directory missing from `<source>` in `phpunit.xml` is missing from the report**.
The action also removes `docs/coverage-report`, where the HTML report used to be written.
