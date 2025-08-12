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

## v3.0.8

* Fix: fixed syntax issue for autodeployment CI (ee5e4f3 by George Shestayev)

## v3.0.9

* Update: added more debug information to the deploy CI (58d8976 by George Shestayev)

## v3.0.10

* Update: temporarily disabling stop_script flag in `deploy` job due to a vendor issue (#7) (85ebea2 by George Shestayev)

## v3.1.0

* BREAKING: input prep_release_command renamed to post_cmd in prepare-release job (79937a9 by George Shestayev)
* BREAKING: default node version switched to 20 in prepare-release job (79937a9 by George Shestayev)
* BREAKING: removed build_command and build_path inputs from prepare-release job as obsolete (64923a8 by George Shestayev)
* New: added node_version and pre_cmd inputs to prepare-release job (79937a9 by George Shestayev)
* Update: fixed type in an input descripion (9cac171 by George Shestayev)
* Update: composer install with --no-scripts flag now in prepare-release job (79937a9 by George Shestayev)

## v3.1.1

* Update: improved Github Release process to shrink bodies too big (ee7d850 by George Shestayev)

## v3.1.2

* BREAKING: mysql-export job - switching to mysqldump instead of mysqlpump (627b6bc0 by George Shestayev)
* Fix: publish-github-release job - added missing shell input (8138675 by George Shestayev)

## v3.1.3

* Fix: mysql-export job - added missing newline escape (f20f612 by George Shestayev)

## v3.1.4

* Update: mysql-export job - improved DEFINER clause removed from the resulting db dumps (2ba8f4e by George Shestayev)

## v3.1.5

* Update: mysql-export job - removing dump completion time to avoid unnecessary commits (5f162c5 by George Shestayev)

## v3.1.6

* New: added env_variables inputs to prepare-release and migrate-db-dump actions to allow to set up environment properly (c9b318e by George Shestayev)
* Update: mysql-export job - removing dump completion time line instead of replacing it with an empty one (e1134c4 by George Shestayev)

## v3.1.7

* Fix: removed wrong condition for merging env variables for mysql-migrate CI job (53149ee by George Shestayev)

## v3.1.8

* Fix: fixed automatic git commits when preparing a release to limit it to the changes (c4b232c by George Shestayev)
* Update: added working-directory to the prepare-environment CI job (dbd848e by George Shestayev)
* Update: improved dump cleanup routine for mysql-export CI job (7d76b27 by George Shestayev)

## v3.1.9

* Fix: fixed check for cleanup_dependencies input in publish-npm ci (4de4968 by George Shestayev)

## v3.1.10

* New: added TSLint to QA checks (97af9e4 by George Shestayev)

## v3.1.11

* Fix: fixed qa-checks workflow syntax issue (c225c89 by George Shestayev)

## v3.2.0

* New: introduced reusable action for spinning application up in Docker (08664be by George Shestayev)
* Update: added set -eux for the deploy job (47f632d by George Shestayev)

## v3.3.0

* Update: improving caching of Composer, NPM and Yarn packages (9287469e by George Shestayev)
* Update: allowing parallel Docker builds (26165829 by George Shestayev)
* Update: adjusted GHA triggers for Docker building job (93545249 by George Shestayev)
* New: added basic autobuilt Docker PHP+Apache images (#8) (00436175 by George Shestayev)

## v3.3.1

* Fix: fixed process of getting npm and yarn cache directories (184d011 by George Shestayev)
* Fix: fixed default npm install command (184d011 by George Shestayev)
* Fix: fixed syntax in install-packages job (afc9001 by George Shestayev)
* Fix: fixed syntax in install-packages job (b7cbc53 by George Shestayev)
* Fix: fixed syntax in install-packages job (bb888fb by George Shestayev)
* Fix: adding missing properties to CI (79778e7 by George Shestayev)
* New: add cache fraction key (62ac74f by George Shestayev)
* Update: removing debug output (23d981b by George Shestayev)
* Update: added debug info (260197b by George Shestayev)
* Update: minor improvements (fbccad0 by George Shestayev)
* Update: adding customizations to install-packages CI job (fe61744 by George Shestayev)
* Update: minor improvements (40e9d14 by George Shestayev)
* Update: allowing to skip Composer or NPM/Yarn installation (6fec74e by George Shestayev)

## v3.3.2

* Fix: added checks cache dirs when doing caching in install-packages (263765f by George Shestayev)
* Fix: fixed a process for determining composer cache directory (263765f by George Shestayev)
* Fix: using proper lock file for caching Yarn dependencies (0040f8e by George Shestayev)
* Fix: fixed process of getting npm and yarn cache directories (e44f93f by George Shestayev)
* Fix: fixed default npm install command (e44f93f by George Shestayev)

## v3.3.3

* Add .dist file support (#9) (6135b05 by Thomas Baier)

## v3.4.0

* Update: added integration with task.sh file when spinning up Docker (3547c2a by George Shestayev)

## v3.4.1

* Introduce working_directory input for publish-npm.yml (#10) (4f0456f by Thomas Baier)

## v3.4.2

* publish workflow changes (#11) (1d670dc by Thomas Baier)

## v3.4.3

* New: added msmtp to docker images to help forwarding mails to mailhog (21a87c8 by George Shestayev)

## v3.5.0

* New: added nano to docker images for simple text editing (a290c04 by George Shestayev)
* Update: removed copy_to_dist and dist_subdirectory inputs from publish-npm job to avoid unnecessary complication (d8603aa by George Shestayev)
* Update: introduced working-directory in install-packages CI (6954a6a2 by George Shestayev)

## v3.5.1

* Update: added support for profile and custom arguments for docker-spin-up action (1aabd2b by George Shestayev)

## v3.5.2

* Fix: fixed using docker_up_arguments input in docker-spin-up job (686eae9 by George Shestayev)

## v3.5.3

* Fix: fixed install-packages job to use inputs properly and use working directory for determination Yarn vs NPM (328a7b3 by George Shestayev)
* Fix: fixed cache key calculation in install-packages job (aee3e7c by George Shestayev)

## v3.5.4

* Update: improved output in install-packages job (d04a28b by George Shestayev)

## v3.5.5

* Fix: fixed wrong parameter pass when installing dependencies from qa checks (b4ffa7a by George Shestayev)

## v3.6.0

* New: introduced docker-deploy CI job (b73c6dd by George Shestayev)
* Update: cleaned up deploy CI job (b73c6dd by George Shestayev)
* Update: improved output for docker-spin-up CI job (b73c6dd by George Shestayev)

## v3.7.0

* New: added working_directory input for docker-spin-up job (c58210d by George Shestayev)

## v3.7.1

* Fix: fixed syntax issues introduced in the previous changes (40c80bd by George Shestayev)

## v3.7.2

* Update: Add working_directory to Docker config (#12) (2dfa123 by Poraich Troy)

## v3.7.3

* Fix: Docker images are built only on tag push (33fed24 by George Shestayev)
* Fix: fixed platforms for building docker images (7af73dc by George Shestayev)
* Update: docker_env_variables made not required in docker-spin-up job (62a89f4 by George Shestayev)
* Update: removing multiplatform build for Docker due to performance issues (0276035 by George Shestayev)
* Update: added QEMU and Docker buildx to support multi-platform build (6456f96 by George Shestayev)
* Update: enable ARM platform for the Docker images (cf9ef82 by George Shestayev)

## v3.7.4

* Update: hostname input made optional for docker-spin-up job (7007c18 by George Shestayev)

## v3.7.5

* Fix: added missing shell property (fe709a8 by George Shestayev)
* Update: automated commits now prefixed with `Ci` (b6a7959 by George Shestayev)
* Update: improved changelog generation (b6a7959 by George Shestayev)
* Update: made env config preparation in docker-spin-up job optional (06feeb4 by George Shestayev)

## v3.8.0

* BREAKING: removed coverage badge generation from qa-checks job (0923011 by George Shestayev)
* Fix: use inputs.ref when generating version instead of GITHUB_REF (#13) (c32d883 by Poraich Troy)
* New: introduced prepare-pull-request CI job (472486e by George Shestayev)
* New: added `sleep` input for docker-spin-up job (34e2e7d by George Shestayev)

## v3.8.1

* Fix: fixed sleep step in docker spin up job (2e35b34 by George Shestayev)
* Update: using docker compose up & down instead of restart on docker deploy (7874601 by George Shestayev)
* Update: using --force-restart as a default argument for docker compose up on docker deploy (7874601 by George Shestayev)

## v3.8.2

* Fix: removing default command for docker spin up action as it's supposed to be calculated (59e6fa7 by George Shestayev)

## v3.9.0

* Update: prepare-release job now updated version in composer.json file (#14) (52b3619 by Poraich Troy)

## v3.9.1

* Fix: remove inputs.working_directory which is not passed into workflow and assume composer.json exists in the current path (#15) (d33f97e by Poraich Troy)

## v3.10.0

* BREAKING: removed prepare-pull-request job (8a64680 by George Shestayev)
* New: added sql_command input for prepare-pr and migrate-db jobs (35f1608 by George Shestayev)
* Update: prepare-release job now runs phpunit and generates coverage badge (8a64680 by George Shestayev)

## v3.11.0

* BREAKING: composer_update, composer_install_cmd and composer_update_cmd inputs are replaced by composer_cmd in install-packages job (f8dd17a by George Shestayev)
* New: added composer_lock input to install-packages job allowing to use non-default lock file when installing packages (f8dd17a by George Shestayev)
* Update: improved qa-checks job to use alternative lock files when on an alternative (non-locked) php version (f8dd17a by George Shestayev)
* Update: setting up PHP in prepare-release only if necessary (f9baba2 by George Shestayev)
* Update: removing SOAP PHP extension from base Docker images (f9baba2 by George Shestayev)

## v3.11.1

* Fix: fixed SQL command execution step not having shell specified in migrate-db-dump job (22e460b by George Shestayev)

## v3.12.0

* BREAKING: CI now cleans up .npmrc and auth.json files after installing dependencies to avoid personal tokens exposure (6b97d50 by George Shestayev)
* BREAKING: use task.sh supports ability to check if migration and cache clearing are necessary during autodeployment (c012097 by George Shestayev)
* New: added task.sh file stub (712bfca by George Shestayev)
* New: added Docker images for php8.3 and php8.4 (9f535aab by George Shestayev)
* Update: added mapping for XDEBUG_DEMO env variable (9f535aab by George Shestayev)
* Update: removing msmtp from Docker images (712bfca by George Shestayev)

## v3.13.0

* Update: added cron to the docker images (6c8b3cc by George Shestayev)
* Update: cache in install-packages now take composer.json and package.json files into key generation to accommodate libraries (6c8b3cc by George Shestayev)

## v3.14.0

* Fix: fixed the issue with composer cache dir in install-packages CI (b7d52be by George Shestayev)
* Update: improved the process of determining cache key for install-packages CI (b7d52be by George Shestayev)

## v3.14.2

* Fix: fixed missing working directory property in install-package CI job (b62e501 by George Shestayev)

## v3.15.0

* New: added supercronic to all docker images (934ab66 by George Shestayev)
* Update: rework Docker image structure to improve caching and speed up the building time
* Update: added `ll` alias for `ls -al` command

## v3.15.1

* Fix: fixed docker image build settings (89cac1b by George Shestayev)
