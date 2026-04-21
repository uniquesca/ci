FROM ghcr.io/uniquesca/php-fpm-demo:8.2 AS php-apache

# Add xdebug
RUN apk update && apk upgrade && \
    set -eux; \
	chmod +x /usr/local/bin/install-php-extensions && install-php-extensions xdebug;

# Install Python + venv support
RUN apt-get update && apt-get install -y python3 python3-venv; \
    python3 -m venv /opt/venv; \
   /opt/venv/bin/pip install --no-cache-dir jinja2-cli[yaml,json]; \
   PATH="/opt/venv/bin:$PATH"

# Add Postman CLI
RUN curl -o- "https://dl-cli.pstmn.io/install/linux64.sh" | sh
