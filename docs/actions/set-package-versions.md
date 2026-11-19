# Set package versions

Sets `version` in the root `package.json` and in every package listed under `release.npm_packages`
in `_ci_environment.json`, and stages the files it changed. A dependency of one of these packages on
another is set to the same version.

```json
{
  "job_matrix": [ ... ],
  "release": {
    "npm_packages": ["ng-src/libs/context-lib", "ng-src/libs/context-field", "apps/*"]
  }
}
```

```yaml
- name: Set package versions
  uses: uniquesca/ci/set-package-versions@v11
  with:
    version: '2.0.1'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `version` | yes | | Version being released, `x.y.z` |

## Outputs

This action produces no outputs - it writes and stages the `package.json` files.

## Dig deeper

### Which files and dependencies

Each entry is a folder relative to the repository root, and `*` stands for any name in one path
segment. Only folders holding a `package.json` count, `node_modules` never does, and **an entry
that matches nothing fails the release** so that a typo or a moved folder is noticed. The root
`package.json` is always included when there is one. Dependencies are matched by the packages'
`name` in `dependencies`, `peerDependencies`, `devDependencies` and `optionalDependencies`, and set
to the exact version, since packages from one repository are always released together.
Indentation and line endings of each file are kept.
