ARG PHP_VERSION=8.2
ARG PHP_BASE_IMAGE=php:${PHP_VERSION}-apache-bookworm

FROM ${PHP_BASE_IMAGE} AS php-apache

ARG NODE_VERSION=20
ENV NODE_VERSION=${NODE_VERSION}

ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
ADD https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 /usr/local/bin/supercronic

COPY docker/php-apachemod-prod/entrypoint.sh /usr/local/bin/uniques-php-entrypoint

ENV NVM_DIR=/usr/local/nvm
ENV COMPOSER_HOME=/.composer/
ENV YARN_CACHE_FOLDER=/yarn/cache/
ENV INSTALL_PHP_EXTENSIONS_NO_DEPS=1

RUN \
    set -eux; \
    \
    # Replace sh with bash \
    rm /bin/sh && ln -s /bin/bash /bin/sh; \
    \
    # Upgrade everything and install additional tools\
    apt-get update && apt-get upgrade -y && apt-get install -y \
      default-mysql-client  \
      jq  \
      zip  \
      unzip \
      git  \
      logrotate \
      nano; \
    \
    # Apache config \
    a2enmod ssl rewrite headers; \
    \
    # PHP config \
	chmod +x /usr/local/bin/install-php-extensions \
    && install-php-extensions \
      dom \
      gettext \
      gd \
      imagick \
      intl \
      opcache \
      pdo_mysql \
      simplexml \
      sockets \
      tidy \
      xml \
      zip; \
    \
    # Add cron (supercronic) and an entrypoint \
    chmod +x /usr/local/bin/uniques-php-entrypoint; \
    chmod +x /usr/local/bin/supercronic; \
    \
    # Add 'll' alias to bash profile for all users \
    echo "alias ll='ls -al'" >> /etc/bash.bashrc;

RUN \
    # Set up Composer \
    mkdir -p $COMPOSER_HOME; \
    chmod 777 $COMPOSER_HOME -Rf; \
    \
    # Set up Yarn \
    # TODO See if we want more persistent cache for Yarn \
    mkdir -p $YARN_CACHE_FOLDER; \
    chmod 777 $YARN_CACHE_FOLDER -Rf; \
    touch /.yarnrc; \
    chmod 666 /.yarnrc; \
    \
    # Set up npm \
    mkdir -p $NVM_DIR; \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash; \
    . $NVM_DIR/nvm.sh; \
    nvm install $NODE_VERSION; \
    nvm alias default $NODE_VERSION; \
    nvm use default; \
    npm install -g yarn; \
    mkdir /.npm -p; \
    chmod 777 /.npm -Rf;

# Update PATH to use the actual nvm versioned node directory
ENV NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION.*/lib/node_modules
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION.*/bin:$PATH

# Copy CI helper scripts
COPY src/environment.js /usr/local/lib/ci/environment.js
COPY src/config.js /usr/local/lib/ci/config.js
COPY src/package.json /usr/local/lib/ci/package.json

# Install nunjucks
RUN bash -c ". \$NVM_DIR/nvm.sh && nvm use default && cd /usr/local/lib/ci/ && npm install"

ENTRYPOINT ["uniques-php-entrypoint"]
CMD ["apache2-foreground"]

# Final touch
EXPOSE 80 443
WORKDIR /var/www/app
LABEL org.opencontainers.image.source=https://github.com/uniquesca/ci
