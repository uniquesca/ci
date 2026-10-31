# Send event

Sends an event about the job it runs in to the
[Events API](https://github.com/uniquesca/infra-apps/blob/develop/docs/events-api.md), where the CI
reports in Grafana read it. Never fails the job: a problem is a warning on the run.

```yaml
- uses: uniquesca/ci/send-event@v11
  if: ${{ !cancelled() }}   # failed jobs are the ones worth counting
  with:
    type: e2e-result
    data_file: cypress-e2e/cypress/results/results.json
    data: '{"testname": "${{ matrix.setup.testname }}"}'
    token: ${{ secrets.EVENTS_API_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `type` | yes | | What the event is, such as `e2e-result`. Lower case, digits, `.`, `-` and `_` |
| `data_file` | no | | JSON file holding an object, sent as the event's data. A missing file sends nothing |
| `data` | no | `{}` | JSON object added to the data, over what `data_file` holds |
| `version` | no | `1` | Version of the shape of `data`. Raise it when the shape changes |
| `token` | yes | | The Events API token, `EVENTS_API_TOKEN`. Empty sends nothing |
| `url` | no | `https://events.unqs.ca/events` | Where to send it |

## Outputs

This action produces no outputs.

## Dig deeper

### What it sends

Besides `type`, `version` and the data, the event carries the repository, the run ID and attempt,
the job's key and `job.check_run_id` as `job_id`. `job_id` is the ID GitHub's own events give the
job, so a report joins to the `ci_jobs` view on it. The event's ID is built from these and the
type, so one job sends each type once, and a retry or re-sent request is stored only once.
