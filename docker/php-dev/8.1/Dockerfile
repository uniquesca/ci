FROM ghcr.io/uniquesca/php-demo:8.1 AS php-apache

# Add xdebug
RUN apk update && apk upgrade && \
    set -eux; \
	chmod +x /usr/local/bin/install-php-extensions && install-php-extensions xdebug \
    echo 'SetEnv XDEBUG_MODE ${XDEBUG_MODE}' > /etc/apache2/conf-enabled/environment.conf
