# Prepare environment

The `prepare-environment` action renders an application's config files from templates that live in
the repository. It reads `_ci_environment.json` from the working directory, merges the tokens the
workflow passes in with the fallbacks declared in that file, resolves any references between them,
and renders each configured template with [nunjucks](https://mozilla.github.io/nunjucks/).

If `_ci_environment.json` is not present the action exits successfully without doing anything.

## Inputs

| Input               | Required | Default | Description                                              |
|---------------------|----------|---------|----------------------------------------------------------|
| `env_variables`     | yes      |         | JSON object of tokens and their values                   |
| `working_directory` | no       | `.`     | Directory holding `_ci_environment.json` and the templates |

```yaml
- name: Set up environment
  uses: uniquesca/ci/prepare-environment@main
  with:
    env_variables: '{"db.host":"127.0.0.1","db.port":"3306"}'
```

## The environment file

```json
{
  "configs": [
    { "stub": "config/app.php.stub", "path": "config/app.php" }
  ],
  "token_fallbacks": {
    "db.host": "127.0.0.1",
    "db.port": "3306"
  }
}
```

* `configs` — the templates to render. `stub` is the template, `path` is the file to write. Both are
  resolved relative to the working directory, and the output directory is created if missing.
* `token_fallbacks` — values used for tokens that `env_variables` does not define.

A fallback is skipped whenever `env_variables` contains the token **at all** — including when it is
set to an empty string. Emptiness is treated as a deliberate value, not as a missing one.

## Tokens in templates

Token names use dot notation and are expanded into nested objects before rendering, so `db.host`
is available to the template as `{{ db.host }}`:

```
DB_HOST={{ db.host }}
DB_PORT={{ db.port }}
```

## Token references

A token can take its value from another token by referencing it as `$(name)`. References work in
`env_variables` and in `token_fallbacks` alike, and either may reference the other.

```json
{
  "api.host": "example.com",
  "api.url": "https://$(api.host)/v1"
}
```

`api.url` resolves to `https://example.com/v1`.

References can appear anywhere inside a value, several times over, and can point at a token
declared later:

```json
{
  "db.dsn": "mysql://$(db.host):$(db.port)/app"
}
```

They can also be chained — a referenced token may itself contain references — to any depth.

### Value types

A value that is *nothing but* a single reference keeps the referenced value's type, so
`"cache.port": "$(db.port)"` stays a number if `db.port` is one. A reference embedded in a longer
string is always converted to text.

### Escaping

Write `$$(` to produce a literal `$(` — useful for config values that carry shell syntax:

```json
{
  "shell.cmd": "echo $$(pwd)"
}
```

renders as `echo $(pwd)`.

A lone `$` needs no escaping; only `$(` starts a reference.

### Errors

Both of these fail the workflow rather than rendering something surprising:

* **Unknown target** — `Referenced variable "api.host" is not found.`
* **Circular reference** — `Circular token reference detected: a -> b -> a`

### Deprecated `$name` syntax

Before partial references existed, a fallback could reference another token by taking the whole
value form `$name`:

```json
{
  "token_fallbacks": {
    "cache.host": "$db.host"
  }
}
```

This still works but emits a deprecation warning and **will be removed in v11**. Replace it with
`$(db.host)`.

The old syntax was only ever honoured in `token_fallbacks` and is deliberately *not* recognised in
`env_variables`, so runtime values that legitimately begin with `$` — bcrypt hashes, shell
snippets — pass through untouched.
