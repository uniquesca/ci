FROM ghcr.io/uniquesca/php-prod:8.2 AS php-apache

# Add xdebug
RUN apk update && apk upgrade && \
    set -eux; \
	chmod +x /usr/local/bin/install-php-extensions && install-php-extensions \
      xdebug \
	;