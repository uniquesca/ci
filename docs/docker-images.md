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
   * pcntl - FPM and FPM + Apache images only
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

## What runs in a container

In the FPM and FPM + Apache images, supervisord is the main process. It runs php-fpm (and Apache),
supercronic when `/etc/crontab` exists, and every program file in `/etc/supervisor/conf.d/`:

```ini
; /etc/supervisor/conf.d/worker.conf, added by the application image
[program:worker]
command=php /app/bin/worker.php
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
redirect_stderr=true
autorestart=true
```

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

## Dig deeper

### Restarts

supervisord restarts a program that exits unexpectedly, and one with `autorestart=true` whenever it
exits. If a program keeps failing to start, supervisord stops the container; a clean one starts only
if the container has a restart policy. This covers a process killed outright, whose children can
keep its port and block every restart inside the container.

### Running another command

Running the FPM image with a command other than `php-fpm` (`composer install`, a one-off script)
runs that command without supervisord, as before: supercronic still starts alongside it when
`/etc/crontab` exists. The FPM + Apache image ignores the command and always starts supervisord.

### Stopping

`docker stop` stops every program before supervisord exits. A program that finishes its current
work on SIGTERM needs the container's stop timeout to cover that work.
