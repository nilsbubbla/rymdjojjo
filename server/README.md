# Rymdresan high score server

The service is fully separated from everything else: its own system user, port, SQLite database, public JSON file, backup directory and systemd units.

## Install

On the server, from the uploaded staging directory:

```sh
sudo sh server/install.sh
```

## Update

To deploy a newer version of the code and configuration:

```sh
sudo sh server/update.sh
```

The script copies the Python files and `config.json` into place, removes leftover test scores, restarts the service and verifies the health endpoint and the published leaderboard.

## Verify

```sh
curl http://127.0.0.1:8001/rymdresan/api/v1/health
sudo -u rymdresan /usr/bin/python3 -m rymdresan.admin \
  --config /etc/rymdresan/config.json integrity
```

## Layout

The database lives in `/var/lib/rymdresan/data`, while only the generated `highscores.json` is exposed by Apache. The service listens on `127.0.0.1:8001` and Apache proxies `/rymdresan/api/` to it.
