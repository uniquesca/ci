# Scan Docker images

Scans Docker images for vulnerabilities with Trivy. The run summary counts the critical and high
vulnerabilities that have a fix, and the `vulnerability-reports` artifact lists them. The run stays
green unless `fail_on_critical` is on.

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

A scheduled or hand-started run posts to the Teams Alerts channel through comms-api: the images
with a critical vulnerability, or a short all-clear when there are none.

```yaml
# .trivyignore.yaml in the calling repository, for vulnerabilities you accept
vulnerabilities:
  - id: CVE-2026-42216
    expired_at: 2027-01-31
    statement: Not reachable, the image never reads OpenEXR files
```

## Secrets

| Secret | Description |
|---|---|
| `REGISTRY_TOKEN` | Token that can read the images. Defaults to the run's `GITHUB_TOKEN` |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `images` | string | | **Required.** Images to scan, one per line |
| `registry_username` | string | `''` | User `REGISTRY_TOKEN` belongs to. Defaults to the actor of the run |
| `report_only_images` | string | `''` | Images, one per line, that are scanned and listed but never alert or fail the run |
| `fail_on_critical` | boolean | `false` | Fail the run when an image has a critical vulnerability that has a fix |
| `alert` | boolean | `true` | Leave the annotation comms-api turns into a Teams alert. The all-clear is left either way |

## Outputs

| Output | Description |
|---|---|
| `critical` | Images with a critical vulnerability that has a fix, one per line, leaving out the report-only ones |

## Dig deeper

### Registry access

The images are pulled from ghcr.io with the calling run's `GITHUB_TOKEN`, so each image's package
has to give the calling repository read access, or `REGISTRY_TOKEN` has to be a token that can
read it. An image that cannot be pulled shows as "scan failed" in the summary and a warning on the run.
