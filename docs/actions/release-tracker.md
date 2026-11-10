# Release tracker

The code behind the release issue: starts a release, refreshes the status comments, and runs the
commands posted on the issue. Called from `release-start.yml`, `release-commands.yml` and
`release-refresh.yml`; see [Release tracker](../workflows/release-tracker.md) for the settings and
the whole flow.

Call it directly only to post release notes into the issue:

```yaml
      - uses: uniquesca/ci/release-tracker@v11
        with:
          command: notes
          branch: ${{ github.ref_name }}
          notes_dir: ${{ runner.temp }}/release-notes
```

`notes_dir` holds `meta.json` (`previousTag`, `head`, `commits`), `changelog.md` and an optional
`overview.md`. The inputs and outputs of every command are in [`action.yml`](../../release-tracker/action.yml).
