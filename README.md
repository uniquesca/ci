# Uniques CI/CD tools

This repository offer various tools to automate CI/CD with minimum code.

## Docker images

This repository provides Docker images crafted for Uniques projects, they are built on every release of this repo.
Every image has the following tags:

* `ghcr.io/uniquesca/php-%mode%-%phpversion%:latest`
* `ghcr.io/uniquesca/php-%mode%-%phpversion%:%version%`

Where:

* %mode% can be `prod`, `demo` and `dev`
* %phpversion` can be `5.6`, `8.1`, `8.2`, `8.3`, `8.4`
* %version% is the version of this CI repo

#### What are in the images:

* All images are based on `php:%phpversion%-apache` base images
* Apache mods installed:
  * ssl
  * rewrite
  * headers
* PHP extensions installed:
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
* NVM 0.40.1, Node 20, NPM and Yarn installed
* Additional software installed:
  * default-mysql-client
  * jq
  * zip
  * git
  * nano

Modes:
* `prod` images have all the aforementioned software installed.
* `demo` images are based on `prod` images and currently don't have anything additionally
* `dev` images are based `demo` images and have:
  * PHP `xdebug` extension

#### How to

* Code should be placed into /var/www/app folder, that's what Apache inside will serve
* Apache config files are located in `/etc/apache2/` and it is a typical Debian Apache structure
* PHP config is located in `/usr/local/etc/php`
* Cron configuration should be mapped to `/etc/crontab` file
* Ports exposed: 80 and 443
* 



## Reference

[Documentation](https://docs.officioplatform.com/books/ci-and-automation)
[Uniques Coding Standard](https://github.com/uniquesca/uniques-coding-standard)
