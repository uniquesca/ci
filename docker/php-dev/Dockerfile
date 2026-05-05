ARG PHP_VERSION=8.2
ARG PHP_BASE_IMAGE=ghcr.io/uniquesca/php-demo:${PHP_VERSION}

FROM ${PHP_BASE_IMAGE} AS php-apache

# Add xdebug
RUN apk update && apk upgrade && \
    set -eux; \
	chmod +x /usr/local/bin/install-php-extensions && install-php-extensions xdebug; \
    echo 'SetEnv XDEBUG_MODE ${XDEBUG_MODE}' > /etc/apache2/conf-enabled/environment.conf

# Add Postman CLI
RUN curl -o- "https://dl-cli.pstmn.io/install/linux64.sh" | sh