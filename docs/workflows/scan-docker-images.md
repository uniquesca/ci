# Scan Docker images

Scans Docker images for vulnerabilities with Trivy. It only reports: the run summary counts the
critical and high vulnerabilities that have a fix, the `vulnerability-reports` artifact lists them,
and the run stays green.

```yaml
on:
  schedule:
    - cron: '0 5 * * *'
  workflow_dispatch:

jobs:
  scan:
    uses: uniquesca/ci/.github/workflows/scan-docker-images.yml@v11
    permissions:
      contents: read
      packages: read
    with:
      images: |
        ghcr.io/uniquesca/my-app:latest
        ghcr.io/uniquesca/my-app-worker:latest
```

When a scheduled or hand-started run finds a critical vulnerability, comms-api posts the images to
the Teams Alerts channel.

## Secrets

None.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `images` | string | | **Required.** Images to scan, one per line |

## Outputs

None.

## Dig deeper

### Registry access

The images are pulled with the calling run's `GITHUB_TOKEN`, so they have to be on ghcr.io, and
each image's package has to give the calling repository read access. An image that cannot be
pulled shows as "scan failed" in the summary and a warning on the run.
