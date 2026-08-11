# Merge environment variables

Merges two JSON objects of environment variables and hands back the result, so a workflow can lay
its own defaults under whatever the caller passed in.

```yaml
- name: Prepare environment variables
  id: env
  uses: uniquesca/ci/merge-environment-variables@main
  with:
    variables1: '{"db.host":"127.0.0.1","db.port":"3306"}'
    variables2: ${{ inputs.env_variables }}

- uses: uniquesca/ci/prepare-environment@main
  with:
    env_variables: ${{ steps.env.outputs.variables }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `variables1` | yes | | JSON object of variables |
| `variables2` | yes | | JSON object of variables, applied over `variables1` |

## Outputs

| Output | Description |
|---|---|
| `variables` | JSON object of `variables1` with `variables2` merged over it |

## Dig deeper

### Which side wins

`variables2` wins. That is what makes the argument order the useful part: put the defaults your
workflow needs in `variables1` and the caller's `env_variables` in `variables2`, and a repository
can override any one of them without having to restate the rest.

This is how the database credentials reach a repository's config templates in
[`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow),
[`prepare-release`](../workflows/prepare-release.md) and
[`migrate-db-dump`](migrate-db-dump.md) - the workflow points them at the database it just
created, and a caller that has its own `db.host` still gets its own.

The merge is one level deep, over the flat dot-notation keys. `db.host` and `db.port` are two
separate keys, so overriding one does not disturb the other - there is no nested object for
either side to replace wholesale.

### Invalid JSON

Both inputs are parsed, so a malformed object fails the step with a parse error rather than
producing a half-merged result. An empty object is `'{}'`, not `''`.
