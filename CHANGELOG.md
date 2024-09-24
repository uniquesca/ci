# Uniques CI Changelog

## v1.0.0

* New: created `deploy`, `publish-npm` and `qa-checks` reusable workflows;
* New: created `mysql-import`, `mysql-export` and `update-changelog` reusable actions;

## v1.1.0

* BREAKING: QA checks now uses only explicitly specified secrets (807df62 by George Shestayev)
* Fix: fixed caching dependencies in `publish-npm` packages for the packages without lock file (217ab26 by George Shestayev)
* Fix: fixed caching Composer dependencies for the libraries which don't have lock file (4691894 by George Shestayev)
* New: added sorting resulting changelog (54ec89c by George Shestayev)
* Update: improved changelog generation to handle automated commits and github-generated "co-authored" lines (d9b5a30 by George Shestayev)
* Update: added integration with the `prepare-release` pipeline (4691894 by George Shestayev)
* Update: deploy workflow will remove unindexed files now (9da66ed by George Shestayev)
* Documentation: minor improvement in changelog format, updated readme (87a0358 by George Shestayev)

## v1.1.1

* BREAKING: renamed inputs generate-coverage-badge and coverage-badge-file into generate_coverage_badge and 
* coverage_badge_file for `qa-checks` workflow
* Fix: added missing step input importing DB (includes new `db_dump_file` input) in `qa-checks` workflow

## v1.1.2

* BREAKING: renamed input use-db into use_db for `qa-checks` workflow
* Update: updated steps naming in `qa-checks` workflow

## v1.1.3

* Update: added `db_migration_cmd` to `deploy` workflow

## v1.1.4

* New: created `publish-github-release` action (#4) (81c862d by Ihor Ziubrovskyi)
* Update: updated changelog generation to filter out "Authored-by" records

## v1.1.5

* Fix: fixed npm dependencies installation command in `publish-npm` workflow (bee5494 by George Shestayev)
* Update: added step for updating npm package version to the `publish-npm` action (bee5494 by George Shestayev)

## v1.1.6

* New: added `changelog_path` input to the `prepare-release` workflow (548e407 by George Shestayev)
* Update: added .editorconfig (f1d1af2 by George Shestayev)
* Update: changed cache keys to be exclusive for ci action (f1d1af2 by George Shestayev)
* Update: added descriptions for all inputs and secrets, updated documentation reference (548e407 by George Shestayev)
* Removed: removed `ref` input from `mysql-export` workflow (548e407 by George Shestayev)

## v1.1.7

* Fix: removing input types in the actions as types are not supported (45e1e55 by George Shestayev)
* New: introduced `raw` mode in update-changelog action allowing to just retrieve list of changes (e0c12a8 by George Shestayev)
* New: introduced `attach_dist` input in `publish-github-release` action (8ff9cf1 by George Shestayev)
* New: introduced self workflow to publish releases for the `continuous-integration` repo
* Update: `update-changelog` action won't complain if changelog file doesn't exist (e0c12a8 by George Shestayev)
* Update: `publish-github-release` will use `update-changelog` action in `raw` mode to retrieve body of the release (e0c12a8 by George Shestayev)
* Update: changed actions used in `publish-github-release` - got rid of zip action, changed release to better supported (8ff9cf1 by George Shestayev)

## v1.1.8

* Fix: fixed bug in changelog processing
* Fix: switch to proper access token for publishing releases

## v1.1.9

* New: added `build_command` and `build_path` inputs to `prepare-release` workflow
* New: added NODE_AUTH_TOKEN secret to `prepare-release` workflow
* New: `prepare-release` workflow will install npm and composer dependencies always, so the building process can use them
* Update: improved caching Composer and NPM dependencies in `prepare-release`, `publish-npm` and `qa-checks` workflows
* Update: improved triggers for self-prepare-release workflow

## v1.1.10

* Fix: fixed job name in `publish-npm` workflow (a7640a4 by George Shestayev)
* Update: added additional output for `update-changelog` action to ease up debugging (ed051c4 by George Shestayev)
* Update: added .gitattributes file (7d5307c by George Shestayev)
* Update: cleaning git before committing updates on release preparation (7d5307c by George Shestayev)
* Improved code for changelog generation on github release publication (#5) (7d5307c by George Shestayev)

## v1.1.11

* Fix: fixed `publish-github-release` to properly retrieve changelog (b858448 by George Shestayev)
* Update: improved `update-changelog` action to allow changelog retrieval between any two tags (b858448 by George Shestayev)

## v1.1.12

* Update: improving remote git reset process in `deploy` workflow to be compatible with tags and commit hashes (a78aee8 by George Shestayev)
* Update: improved git commands in `deploy` workflow to fight with divergent branches (8503b1e by George Shestayev)
* Update: turned on xdebug coverage mode in qa-checks CI (2be2d7b by George Shestayev)

## v1.1.13

* Fix: fixed PHP setup code for `qa-checks` (5eee0d8 by George Shestayev)
* New: introduced `prepare-environment` action which parses JSON object and replaces variables in application config (8e9c359 by George Shestayev)

## v2.0.0

* BREAKING: `qa-checks` workflow updated to use `prepare-environment` and `prepare-ci-matrix` actions - ci.json has to be migrated to `_ci_environment.json`
* BREAKING: repository is renamed to uniquesca/ci
* New: introduced `prepare-environment` action which parses JSON object and replaces variables in application config
* New: introduced `prepare-ci-matrix action` allowing to retrieve CI-related environment information from `_ci_environment.json` file
* New: introduced `migrate-db-dump` action allowing to import, migrate and export DB dump
* New: added CI-related classes for better CI framework structure
* Update: `prepare-release` workflow update to use `migrate-db-dump` action

## v2.0.2

* Fix: fixed conditions for composer installation in `prepare-release` workflow
* New: introduced `get-default-ci-environment` action
* New: added version bumping using `officio.phar` if it's present in the repo in `prepare-release` workflow
* Update: improved debug output in `prepare-environment` workflow

## v2.0.3

* Fix: adjusted `prepare-release` CI for the cases when there is no composer involved (e30a667 by George Shestayev)
* Fix: fixed `self-prepare-release` workflow (fcb01ac by George Shestayev)
* Fix: fixed debug output (5845a97 by George Shestayev)
* New: added `db_migration_cmd` input for `qa-checks` in order migration needs to run before unit tests (3796cfd by George Shestayev)
* Update: switched composer usage from composer.phar to the system installed one - would have positive performance impact (0c669c3 by George Shestayev)

## v2.0.4

* Update: improved `prepare-environment` flow to properly exit if there is no environment file (6745f41 by George Shestayev)

## v2.0.5

* Update: improved the way to map environment variable, allowing multiple mappings for one value (4443631 by George Shestayev)

## v2.0.6

* Fix: fixed syntax bug in processing variable mappings in an environment file (33a4125 by George Shestayev)

## v2.0.7

* Fix: restricted possible format for CI environment tokens (e4f84a8 by George Shestayev)
* Fix: fixed debug output in processing CI environment tokens (e4f84a8 by George Shestayev)

## v2.0.8

* Fix: fixed escaping characters in regular expression (e6130f3 by George Shestayev)

## v2.0.9

* Fix: fixed running post_cmd in `deploy` CI (afd2765 by George Shestayev)
* New: added `merge-environment-variables` reusable action which merges two JSON strings together (76c6347 by George Shestayev)
* Update: improved `QA Checks` workflow to allow to pass environment variables to it (76c6347 by George Shestayev)

## v2.1.0

* Fix: fixed order of the DB migration step to run after env file is set up in `QA Checks` workflow (f5c0192 by George Shestayev)
* Fix: fixed bugs found in the latest changes related to env variables processing (778fc56 by George Shestayev)

## v2.1.1

* New: Added ESLint to QA Checks, improved NPM publish process (#1) (33767ee by George Shestayev)

## v2.1.2

* Fix: fixed DB migration call from prepare-release workflow (6eee407 by George Shestayev)
* New: fixed QA checks to install Yarn instead of NPM if .yarnrc file is detected (6eee407 by George Shestayev)

## v2.1.3

* Fix: added proper NPM/Yarn presence check for prepare-release workflow (0eae319 by George Shestayev)

## v2.1.4

* New: introduce setup_cmd in qa-checks workflow (8f60e41 by George Shestayev)
* Update: removing "USE %dbname%;" statement from exported DB dump (#2) (7158305 by Ihor Ziubrovskyi)
* Updated: added git checkout step for deployments so the branch is switched (59f75b2 by George Shestayev)

## v2.1.5

* Fix: fixed typo leading to a critical bug in qa-checks workflow (a475461 by George Shestayev)

## v2.1.6

* New: introduced "locked" flag for PHP environments (#3) (7ce598f by George Shestayev)
* Update: CiJob renamed to CiPhpJob (7ce598f by George Shestayev)
* Update: added "locked" flag to CiPhpJob (7ce598f by George Shestayev)
* Update: improved QA checks to choose between composer install and update depending on the CiPhpJob.locked flag (7ce598f by George Shestayev)
* Update: added debug output into `prepare-ci-matrix` workflow (7ce598f by George Shestayev)

## v2.1.7

* Fix: fixed phpunit call to be independent from execution bit (8b16111 by George Shestayev)

## v2.1.8

* Update: added git pull for the deployment process in order to avoid deployment issues when different branches involved (f5e2f48 by George Shestayev)
* Update: eslint command changed to run through npm to be consistent with phpcs and abstract CI from project path structure (12076fa by George Shestayev)

## v2.1.9

* Update: improved handling git branches/other refs when deploying (a231b26 by George Shestayev)

## v2.1.10

* Update: removed npm and composer caching from release and npm package publication - it's not needed there and might just cause issues (d87c6d2 by George Shestayev)
* Update: improved and fixed caching for Npm/Yarn in qa-checks (47ea9c2 by George Shestayev)

## v2.1.11

* Fix: fixed hashing composer and npm files for cache id (8067e6e by George Shestayev)

## v2.1.12

* New: added mysql setup to qa-checks and prepare-release workflows (88ff6f4 by George Shestayev)
* Update: removing debug output (be9f38c by George Shestayev)
* Update: fixing and debugging caching process (f87f959 by George Shestayev)
* Update: fixing and debugging caching process (584ff05 by George Shestayev)
* Update: removed code for starting mysql server as it's started by an action now (0f43de7 by George Shestayev)

## v2.1.13

* Update: npm and yarn will install dev dependencies in QA checks workflow (f18fd40 by George Shestayev)

## v2.1.14

* Fix: fixed default value for mysql_config input in qa-checks and prepare-release workflows (652437a by George Shestayev)

## v2.1.15

* Update: added more information to the deployment CI output (c6b64f1 by George Shestayev)

## v2.2.0

* Update: node version updated to 20 everywhere (0104568 by George Shestayev)
* Update: action/checkout updated to v4 (0104568 by George Shestayev)
* Update: npm config updated to avoid using --production false flag as it's deprecated (0104568 by George Shestayev)

## v2.2.1

* Update: temporarily removed ESLint from qa-checks (c7e5c48 by George Shestayev)
* Update: actions/cache updated to v4 (00e4530 by George Shestayev)

## v2.2.2

* Update: switching mysql connections to do 127.0.0.1 instead of localhost (5cd54f1 by George Shestayev)

## v2.2.3

* New: added `prep_release_command` step in `prepare-release` workflow (8923555 by George Shestayev)

## v2.3.0

* Update: bumping node version to v20 everywhere (ee66867 by George Shestayev)

## v2.3.1

* Fix: fixed calls for fs.readFileSync to specify encoding (635319f by George Shestayev)
* New: introduced new ci-matrix-from-file action allowing to retrieve matrix from any json file (8d03485 by George Shestayev)
* Update: add debug output to `ci-matrix-from-file` action (e06ab0f by George Shestayev)
* Update: prepare-ci-matrix action renamed to qa-ci-matrix to be more specific (8d03485 by George Shestayev)

## v2.3.2

* Update: improving autodeployment to do git hard resets always instead of sticking to branch which often fails deployments (945d0c8 by George Shestayev)
* Update: improving autodeployments to stop after an error (e8a752d by George Shestayev)
* Update: updating more workflows to node 20 (5f1c406 by George Shestayev)

## v2.3.3

* Update: improved logging for autodeployments (c9b2a8b by George Shestayev)
* Fix: fixed bash syntax for autodeployments (George Shestayev)

## v2.3.4

* Update: composer scripts are skipped now when performing QA checks (cd6e88f by George Shestayev)

## v2.3.5

* Update: moved npm package version update after build command in publish-npm workflow (c2f9bdf by George Shestayev)

## v3.0.0

* BREAKING: added NODE_AUTH_TOKEN secret to deploy pipeline (de521f0 by George Shestayev)
* Update: forcing .npmrc file updates so that it always gets the latest token (de521f0 by George Shestayev)
* Update: improved job names to be more human friendly (de521f0 by George Shestayev)

## v3.0.1

* Fix: fixed npmrc file preparation (cc1598e by George Shestayev)

## v3.0.2

* Fix: fix in get-version pipeline (c043ee6 by George Shestayev)
* New: introducing get-version workflow (#4) (2993c49 by George Shestayev)
* New: added get-version CI reusable action (ba86050 by George Shestayev)
* Update: updating to get-version workflow (3249d01 by George Shestayev)

## v3.0.3

* Update: adding retries to yarn installation on deploy (5860be4 by George Shestayev)
* Update: adding cache clean to npm and yarn on deploy (5860be4 by George Shestayev)

## v3.0.4

* Update: added a workaround for an intermittent issue with yarn authentication for autodeployment (a4cd34b by George Shestayev)

## v3.0.5

* Fix: fixed process of setting default node for nvm (a17cf92 by George Shestayev)

## v3.0.6

* Update: improving yarn intermittent issues on autodeployments (#5) (ff5b7d2 by George Shestayev)
* Update: improving yarn secondary attempt (ff5b7d2 by George Shestayev)
* Update: making yarn install not exit with non-zero code for the first attempt (ff5b7d2 by George Shestayev)
* Update: adding comments to the deployment script (ff5b7d2 by George Shestayev)

## v3.0.7

* Update: improved handling pull requests for autodeployment purposes (#6) (65f4a03 by George Shestayev)
