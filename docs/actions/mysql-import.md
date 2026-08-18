# MySQL import

Imports a SQL dump into a database with the `mysql` client. The database has to exist already.

```yaml
- name: Create the database
  run: mysql -u root -proot --execute="CREATE DATABASE phpunit;"

- name: Import the dump
  uses: uniquesca/ci/mysql-import@main
  with:
    dump_file_path: 'db/dump.sql'
    db_name: phpunit
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `dump_file_path` | yes | | Path to the dump to import. Decompressed on the way in when it ends in `.gz` |
| `db_name` | yes | | Database to import into |
| `host` | no | `127.0.0.1` | MySQL server address |
| `port` | no | `3306` | MySQL port |
| `username` | no | `root` | MySQL username |
| `password` | no | `root` | MySQL password |

## Outputs

This action produces no outputs.

## Dig deeper

### What it expects to be there

A `mysql` client on the runner, and the database named in `db_name`. **Neither is created for
you** - `CREATE DATABASE` comes first, as in the example above. A server set up with
`shogo82148/actions-setup-mysql` and the default `root`/`root` credentials needs no other input
than the two required ones, which is why they are the defaults.

The dump is fed in on stdin, so anything a dump can contain runs: a `USE` statement in the file
wins over `db_name`, and a dump taken with `--all-databases` ignores it entirely.

`unique_checks` and `foreign_key_checks` are turned off for the connection, which is what makes a
large import worth waiting for. A dump from `mysqldump` turns both off in its own preamble
anyway - this is for the ones written by something else.

### Where it is used for you

You rarely need this directly. [`php-qa-checks`](../qa-checks.md#php-qa-checks-workflow),
[`prepare-release`](../workflows/prepare-release.md) and
[`migrate-db-dump`](migrate-db-dump.md) each create a database and call it, so a repository only
has to name its dump.

The counterpart is [`mysql-export`](mysql-export.md), which writes a dump back out in a form that
is stable enough to commit.
