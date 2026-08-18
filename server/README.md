# Rymdresans highscore-server

Tjänsten är helt separerad från SparkOliver: egen systemanvändare, port, SQLite-databas,
publik JSON-fil, backupkatalog och systemd-enheter.

På servern, från den uppladdade stagingkatalogen:

```sh
sudo sh server/install.sh
```

Kontroll:

```sh
curl http://127.0.0.1:8001/rymdresan/api/v1/health
sudo -u rymdresan /usr/bin/python3 -m rymdresan.admin \
  --config /etc/rymdresan/config.json integrity
```

Databasen ligger i `/var/lib/rymdresan/data`, medan bara den genererade
`highscores.json` exponeras av Apache.

