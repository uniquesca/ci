# MySQL export

Dumps a database to a file with `mysqldump`, and strips out everything that would make the same
data produce a different file every time - so the result can be committed.

```yaml
- name: Export the dump
  uses: uniquesca/ci/mysql-export@v11
  with:
    dump_file_path: 'db/dump.sql'
    db_name: phpunit
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `dump_file_path` | yes | | File to write the dump to |
| `db_name` | yes | | Database to dump |
| `host` | no | `127.0.0.1` | MySQL server address |
| `port` | no | `3306` | MySQL port |
| `username` | no | `root` | MySQL username |
| `password` | no | `root` | MySQL password |

## Outputs

This action produces no outputs - it writes `dump_file_path`.

## Dig deeper

### What is dumped

Routines, triggers and one consistent snapshot (`--single-transaction`), with
`--max_allowed_packet=512M` so a large row does not stop the dump. Data and schema both.

### What is taken back out, and why

A dump is only worth committing if two runs over unchanged data produce an identical file.
Four things break that, and all four are removed:

| Removed | Why |
|---|---|
| `DEFINER=...` on views, procedures and functions | Names the MySQL account that happened to create the object, so a dump taken by one user cannot be restored by another |
| `-- Dump completed on ...` | Changes on every run, which is a commit on every run |
| `-- Host: ...` | Names the server the dump came from |
| The database name in `-- Dumping routines for database '...'` | Names the scratch database CI created, which is not the one the dump is for |

This is what makes [`prepare-release`](../workflows/prepare-release.md) and
[`migrate-db-dump`](migrate-db-dump.md) able to commit a regenerated dump and get no diff when
nothing about the data actually changed.

The edits are `sed -i` over the finished file, so `dump_file_path` is rewritten in place several
times before the step ends. Nothing else about the SQL is touched.
