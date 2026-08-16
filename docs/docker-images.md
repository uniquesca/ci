# Docker Images

We build and publish 3 types of Docker Images in this CI repo:
1. PHP FPM image
2. PHP + Apache + MOD_PHP image
3. PHP FPM + Apache image

All of them are built in the following sequence:
1. PROD <- [Base Image](https://hub.docker.com/_/php)
2. DEV <- PROD

And most of the images are built for the following PHP versions:
* 5.6
* 8.1
* 8.2
* 8.3
* 8.4

All the images contain:
1. OS packages:
   * default-mysql-client
   * jq 
   * zip 
   * git 
   * logrotate
   * nano
2. PHP Extensions: 
   * dom
   * gettext
   * gd
   * imagick
   * intl
   * opcache
   * pdo_mysql
   * simplexml
   * sockets
   * tidy
   * xml
   * zip
3. Node 24
   * Yarn - installed globally through NPM
4. Additional tools:
   * supercronic
   * config processing layer (documentation to be added) 

DEV images additional have:
1. PHP Extensions:
   * xdebug

## When they are built

On a tag push, and **only when something under `docker/` changed since the previous tag**. The
images carry a PHP version rather than a release version, so a tag that touches nothing they are
built from would republish them unchanged under the names they already have.

The three PROD images build in parallel, and the DEV images follow once their PROD image is
pushed. Build layers are cached in each image's own package, under a `buildcache-<php-version>`
tag alongside the images themselves.

To build everything regardless, run the **Build Docker images** workflow by hand from the Actions
tab. **That is the only way to recover a failed build**: if the run for the tag that changed a
Dockerfile went red, no later tag rebuilds it, because by then nothing has changed.