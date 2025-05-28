FROM php:8.3-apache AS php-apache

# Replace sh with bash
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Apache config
RUN a2enmod ssl rewrite headers

# PHP config
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN apk update && apk upgrade && \
    set -eux; \
	chmod +x /usr/local/bin/install-php-extensions && install-php-extensions \
      gettext \
      gd \
      imagick \
      intl \
      opcache \
      pdo_mysql \
      sockets \
      tidy \
      zip \
	;

# Additional software
RUN apt-get update && apt-get install default-mysql-client jq zip git nano -y

# Set up Composer
ENV COMPOSER_HOME=/.composer/
RUN mkdir -p $COMPOSER_HOME \
    && chmod 777 $COMPOSER_HOME -Rf

# Set up Yarn
ENV NVM_DIR=/usr/local/nvm
ENV YARN_CACHE_FOLDER=/yarn/cache/
# TODO See if we want more persistent cache for Yarn
RUN mkdir -p $YARN_CACHE_FOLDER \
    && chmod 777 $YARN_CACHE_FOLDER -Rf \
    && touch /.yarnrc \
    && chmod 666 /.yarnrc
RUN mkdir -p $NVM_DIR \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install 20 \
    && nvm alias default 20 \
    && nvm use default \
    && npm install -g yarn \
    && mkdir /.npm -p \
    && chmod 777 /.npm -Rf

# Final touch
EXPOSE 80 443
WORKDIR /var/www/app
LABEL org.opencontainers.image.source=https://github.com/uniquesca/ci
