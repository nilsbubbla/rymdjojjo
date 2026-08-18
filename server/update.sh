#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Kör med sudo: sudo sh update.sh" >&2
  exit 1
fi

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

echo "Uppdaterar serverkoden (service.py med ruleset 1.1.0)…"
install -o root -g root -m 0644 "$SOURCE_DIR"/rymdresan/*.py /opt/rymdresan-highscores/rymdresan/

echo "Uppdaterar config.json (tillåter 1.0.0 och 1.1.0)…"
install -o root -g rymdresan -m 0640 "$SOURCE_DIR/config.json" /etc/rymdresan/config.json

echo "Rensar testpoäng från incidenten (TestNy, VerifieraPadda)…"
sudo -u rymdresan /usr/bin/python3 - <<'PY'
import sqlite3
conn = sqlite3.connect("/var/lib/rymdresan/data/highscores.sqlite3")
row = conn.execute("DELETE FROM scores WHERE name IN ('TestNy', 'VerifieraPadda')").rowcount
conn.commit()
conn.close()
print("Raderade %d testpoäng(er)." % row)
PY

echo "Startar om rymdresan-tjänsten…"
systemctl restart rymdresan

echo "Väntar på att tjänsten ska svara…"
for _ in $(seq 1 20); do
  if curl --fail --silent http://127.0.0.1:8001/rymdresan/api/v1/health >/dev/null; then
    break
  fi
  sleep 1
done
if ! curl --fail --silent http://127.0.0.1:8001/rymdresan/api/v1/health >/dev/null; then
  echo "FEL: tjänsten svarar inte på 127.0.0.1:8001" >&2
  exit 1
fi
echo "Tjänsten svarar."
echo
if grep -q '"ruleset": *"1.1.0"' /var/lib/rymdresan/public/highscores.json; then
  echo "OK: servern kör nya regelsätet 1.1.0"
else
  echo "FEL: highscores.json saknar ruleset 1.1.0" >&2
  exit 1
fi
if grep -q 'TestNy' /var/lib/rymdresan/public/highscores.json; then
  echo "FEL: TestNy finns fortfarande kvar i topplistan" >&2
  exit 1
else
  echo "OK: TestNy är borta"
fi
echo
cat /var/lib/rymdresan/public/highscores.json
echo
echo "Klart! Servern accepterar nu både 1.0.0- och 1.1.0-klienter, och oliver_mode."
