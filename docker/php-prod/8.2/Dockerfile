FROM php:8.2-apache AS php-apache

ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
ADD https://github.com/aptible/supercronic/releases/latest/download/supercronic-linux-amd64 /usr/local/bin/supercronic

COPY docker/entrypoint.sh /usr/local/bin/entrypoint

ENV NVM_DIR=/usr/local/nvm
ENV COMPOSER_HOME=/.composer/
ENV YARN_CACHE_FOLDER=/yarn/cache/

RUN \
    set -eux; \
    \
    # Replace sh with bash \
    rm /bin/sh && ln -s /bin/bash /bin/sh; \
    \
    # Apache config \
    a2enmod ssl rewrite headers; \
    \
    # PHP config \
    apk update && apk upgrade -y \
	&& chmod +x /usr/local/bin/install-php-extensions \
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
    # Additional software \
    apt-get update && apt-get install default-mysql-client jq zip git nano -y; \
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
      && nvm install 20 \
      && nvm alias default 20 \
      && nvm use default \
      && npm install -g yarn; \
    mkdir /.npm -p; \
    chmod 777 /.npm -Rf;

ENV NODE_PATH=$NVM_DIR/v20/lib/node_modules
ENV PATH=$NVM_DIR/v20/bin:$PATH

ENTRYPOINT ["entrypoint"]
CMD ["apache2-foreground"]

# Final touch
EXPOSE 80 443
WORKDIR /var/www/app
LABEL org.opencontainers.image.source=https://github.com/uniquesca/ci
