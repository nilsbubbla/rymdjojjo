#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Kör med sudo: sudo sh server/install.sh" >&2
  exit 1
fi

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! getent group rymdresan >/dev/null; then
  addgroup --system rymdresan
fi
if ! id rymdresan >/dev/null 2>&1; then
  adduser --system --ingroup rymdresan --home /var/lib/rymdresan --no-create-home rymdresan
fi

install -d -m 0755 /opt/rymdresan-highscores
install -d -o root -g rymdresan -m 0750 /etc/rymdresan
install -d -o rymdresan -g rymdresan -m 0750 /var/lib/rymdresan/data /var/lib/rymdresan/backups
install -d -o rymdresan -g rymdresan -m 0755 /var/lib/rymdresan/public
install -d -o codex -g www-data -m 0775 /var/www/html/rymdresan

install -d -m 0755 /opt/rymdresan-highscores/rymdresan
install -o root -g root -m 0644 "$SOURCE_DIR"/rymdresan/*.py /opt/rymdresan-highscores/rymdresan/
chown -R root:root /opt/rymdresan-highscores
find /opt/rymdresan-highscores -type d -exec chmod 0755 {} \;
find /opt/rymdresan-highscores -type f -exec chmod 0644 {} \;

install -o root -g rymdresan -m 0640 "$SOURCE_DIR/config.json" /etc/rymdresan/config.json
install -o root -g root -m 0644 "$SOURCE_DIR/rymdresan.service" /etc/systemd/system/rymdresan.service
install -o root -g root -m 0644 "$SOURCE_DIR/rymdresan-backup.service" /etc/systemd/system/rymdresan-backup.service
install -o root -g root -m 0644 "$SOURCE_DIR/rymdresan-backup.timer" /etc/systemd/system/rymdresan-backup.timer
install -o root -g root -m 0644 "$SOURCE_DIR/apache-rymdresan.conf" /etc/apache2/conf-available/rymdresan.conf

a2enmod proxy proxy_http headers >/dev/null
a2enconf rymdresan >/dev/null
systemctl daemon-reload
systemctl enable --now rymdresan.service rymdresan-backup.timer
apache2ctl configtest
systemctl reload apache2

curl --fail --silent http://127.0.0.1:8001/rymdresan/api/v1/health
printf '\nRymdresans separata highscore-tjänst är installerad.\n'
