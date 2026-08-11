# Migrate DB dump

Brings a committed database dump up to date: imports it into a scratch database, runs the
repository's migrations against it, and exports it back over the same file. Point a job at it and
commit what changes.

```yaml
- name: Migrate the dump
  uses: uniquesca/ci/migrate-db-dump@main
  with:
    db_dump_path: 'db/dump.sql'
    migration_command: './vendor/bin/phinx migrate'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `db_dump_path` | yes | | Dump to migrate. Read, then written back over |
| `migration_command` | yes | | Command that runs the migrations |
| `sql_command` | no | | SQL to run after migrating, usually cleanup |
| `env_variables` | no | `'{}'` | JSON object of environment variables for the config templates |

## Outputs

This action produces no outputs - it rewrites `db_dump_path` in place.

## Dig deeper

### What the step does, in order

1. Creates a database called `mysql_migration_db`.
2. Imports `db_dump_path` into it with [`mysql-import`](mysql-import.md).
3. Merges `db.dbname`, `db.username`, `db.password`, `db.host` and `db.port` for that database over
   `env_variables` ([`merge-environment-variables`](merge-environment-variables.md)) and renders the
   repository's config templates with them
   ([`prepare-environment`](prepare-environment.md)) - so `migration_command` finds the scratch
   database without being told where it is.
4. Runs `migration_command`.
5. Runs `sql_command` against `mysql_migration_db`, if one was given.
6. Exports the result back over `db_dump_path` with [`mysql-export`](mysql-export.md).

Because the export strips the dump's timestamp, host and `DEFINER` clauses, a run where the
migrations changed nothing leaves the file byte-identical and there is nothing to commit.

### What it needs from the job

A **running MySQL server** with `root`/`root` on `127.0.0.1:3306` - set one up with
`shogo82148/actions-setup-mysql` before this step. The database name is fixed at
`mysql_migration_db`, so nothing collides with a database the rest of the job is using.

Whatever `migration_command` needs to exist has to be installed first as well: dependencies for
`./vendor/bin/phinx`, PHP for the version the migrations expect.

The credentials your own `env_variables` pass in are overridden - the merge puts the scratch
database's on top, deliberately, since a migration run against the developer's own database is not
what anybody wanted here.

### Committing the result

This action does not commit. Add the file yourself afterwards, or let
[`prepare-release`](../workflows/prepare-release.md) do the whole thing at release time - it takes
`update_db`, `migration_command` and `sql_command` and commits the regenerated dump with the rest
of the release.
