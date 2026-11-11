# How we release

Every repository releases in one of two ways. Both start from a button in GitHub, and neither can
be done by hand from your own machine.

## The rules everywhere

- Only the release app (`uniques-releaser`) can create `release/*` and `hotfix/*` branches, create
  tags, and push to the main branch (`main` or `master`). Nobody else can, admins included.
- A version number looks like `1.2.3` and has to be higher than the last release.
- The changelog is made from commit messages. Never edit `CHANGELOG.md` or a version number by hand.
- A release is started and finished by a maintainer or an admin of the repository.

## Libraries: one button

**Repositories:** angular-core, condition-manager, context-lib, field-framework, form-tools,
formula-builder, laminas-stdlib, php-stdlib, scoring-lib, sentry-lib, uforms, uforms-php,
uforms-v1-php.

1. Make sure QA has passed on `develop`.
2. Open **Actions**, pick **Release**, enter the version and press **Run workflow**.
3. That is it. The workflow creates the release branch, sets the version and the changelog, merges
   into the main branch and `develop`, tags the version, publishes it, and deletes the branch.

If something has to change, fix it in `develop` through a normal pull request and run the release
again. Nothing should be pushed to the release branch: it only lives for a few minutes, and the
release stops if anything unexpected lands on it.

If the release fails, the branch is deleted and nothing is released. Fix the cause and run it again.

## Applications: a release issue

**Repositories:** officio, officio-gui, form-suite.

These are tested before they go out, so the release stays open for a while.

1. **Start.** Open **Actions**, pick **Start a release**, choose *release* (from `develop`) or
   *hotfix* (from the main branch), enter the version and run it. This creates the branch and opens
   an issue called *Release 1.2.3* with the `release` label.
2. **Wait for the checks.** The issue shows a table of checks (QA, tests, deployments to test
   servers, and so on) and keeps it up to date. In officio, QA also ticks a checklist in the issue.
3. **Fix things if needed.** Push fixes to the release branch, or open a pull request into it. The
   checks run again on the new commit, and the changelog is updated.
4. **Release.** When everything is green, a maintainer comments `/release` on the issue. The branch
   is merged into the main branch and `develop`, tagged, and deleted. The tag starts publishing.
5. **Watch it go out.** A second table in the issue follows publishing (packages, Docker images,
   GitHub release, deployments). The issue closes by itself when everything has passed.

### Commands on the release issue

| Comment | What it does |
|---|---|
| `/release` | Merges, tags and publishes. Refused until every check has passed on the latest commit |
| `/sync` | Brings the latest `develop` into the release branch |
| `/abandon` | Drops the release: deletes the branch and closes the issue |
| `/version 1.2.4` | Changes the version number (officio only) |
| `/status` | Refreshes the tables. Anyone can use it |

If a command cannot run, the reason is posted as a reply on the issue.

## Where things are

- [How the one-button release works](workflows/release-flow.md)
- [How the release issue works](workflows/release-tracker.md)
- Each repository's README has a link to its release button.
