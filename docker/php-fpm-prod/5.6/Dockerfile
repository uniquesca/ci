FROM php:5.6-fpm-jessie AS php-apache

ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
ADD https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 /usr/local/bin/supercronic

COPY src/entrypoint.sh /usr/local/bin/entrypoint

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
      git  \
      nano; \
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
    chmod +x /usr/local/bin/entrypoint; \
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
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
      && . $NVM_DIR/nvm.sh \
      && nvm install 18 \
      && nvm alias default 18 \
      && nvm use default \
      && npm install -g yarn; \
    mkdir /.npm -p; \
    chmod 777 /.npm -Rf;

ENV NODE_PATH=$NVM_DIR/v20/lib/node_modules
ENV PATH=$NVM_DIR/v20/bin:$PATH

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

# Final touch
WORKDIR /var/www/app
LABEL org.opencontainers.image.source=https://github.com/uniquesca/ci
