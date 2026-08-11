# Prepare config

Renders one template file with the variables you pass it, using
[nunjucks](https://mozilla.github.io/nunjucks/). Reach for it when a single config file has to be
written and there is no `_ci_environment.json` describing it - otherwise use
[`prepare-environment`](prepare-environment.md), which renders every template the repository
declares.

```yaml
- name: Render the test config
  uses: uniquesca/ci/prepare-config@main
  with:
    source: 'config/app.php.stub'
    destination: 'config/app.php'
    variables: '{"db.host":"127.0.0.1","db.port":"3306"}'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `source` | yes | | Template file, relative to `working_directory` |
| `destination` | yes | | File to write, relative to `working_directory` |
| `variables` | yes | | JSON object of variables the template is rendered with |
| `working_directory` | no | `.` | Directory both paths are resolved against |

## Outputs

This action produces no outputs - it writes `destination`.

## Dig deeper

### Dot notation

Keys are expanded into nested objects before rendering, so `db.host` reaches the template as
`{{ db.host }}`. That is the same convention [`prepare-environment`](prepare-environment.md) uses,
which means the same variables JSON works with either.

### What it does not do

**`$(name)` references are not resolved and `token_fallbacks` are not read.** This action renders
exactly the object it is given, so a value like `"https://$(api.host)/v1"` reaches the output file
verbatim. Anything relying on either belongs in `prepare-environment`.

A missing template fails the step, and the destination directory is created if it does not exist.
Autoescaping is off, so a value containing `&` or `<` is written as-is - which is what a
`.env` or an `.ini` file wants.
