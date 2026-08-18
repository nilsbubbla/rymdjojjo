# Global highscore för Rymdresan

## Status 2026-08-17

Servern är nu inventerad och implementationen är färdig lokalt. SparkOliver använder en
separat Python-tjänst med SQLite, engångs-ID för varje omgång, atomiskt publicerad JSON,
rate limiting och daglig backup. Rymdresan har fått samma beprövade arkitektur men med
egen port (`8001`), systemanvändare, databas, backupkatalog, API-sökväg och topplistefil.

Webbklienten är publicerad i `/var/www/html/rymdresan` och serverpaketet är uppladdat till
`/home/codex/rymdresan-server-stage`. Det återstående serversteget kräver root och körs med:

```sh
sudo sh /home/codex/rymdresan-server-stage/install.sh
```

## Utgångspunkt: det som fungerar i SparkOliver

Den lokala SparkOliver-klienten använder en enkel och bra modell:

1. Klienten skapar en spelomgång med `POST /api/v1/runs` och får ett engångs-ID.
2. När omgången är slut skickar klienten namn, poäng, faktisk speltid och spelversion till `POST /api/v1/scores`.
3. Topplistan läses från en separat `highscores.json`, med alternativ URL om `www`-adressen inte svarar.
4. De fem bästa lokala resultaten sparas också på enheten och visas om servern inte går att nå.
5. Namn rensas och begränsas till 15 tecken.

Det är en bra grund att återanvända. SparkOlivers serverkod finns däremot inte i den lokala projektmappen, så den behöver granskas på webbservern via SSH innan vi återanvänder någon serverspecifik kod.

## Rekommenderad lösning

Webb- och Androidversionen använder exakt samma HTTPS-API och samma topplista. Ingen hemlig API-nyckel läggs i appen; en sådan kan alltid plockas ut ur en webbläsare eller APK.

```text
Webbspel ─────┐
              ├── HTTPS-API ── SQLite/MariaDB ── highscores.json
Android-app ──┘
```

På den aktuella servern finns inte PHP. Därför återanvänds SparkOlivers beprövade upplägg med Python 3, SQLite, systemd och en loopback-tjänst bakom Apache. Datat är ändå helt separerat mellan spelen.

Topplistan blir topp 10. Klienten har dessutom en lokal topp 10 och en kö för resultat som inte kunde skickas på grund av tillfälligt nätverksfel.

## API-kontrakt

### 1. Starta en omgång

`POST /rymdresan/api/v1/runs`

```json
{
  "game_version": "1.0.0",
  "platform": "web"
}
```

Svar, HTTP 201:

```json
{
  "run_id": "slumpmässigt-engångs-id",
  "expires_at": "2026-08-17T14:30:00Z"
}
```

Omgången får en kort giltighetstid och kan bara användas för ett resultat.

### 2. Skicka resultat

`POST /rymdresan/api/v1/scores`

```json
{
  "run_id": "slumpmässigt-engångs-id",
  "name": "Nils",
  "score": 4280,
  "duration_ms": 96340,
  "reached_moon": true,
  "altitude": 100,
  "coins": 31,
  "lives_remaining": 2,
  "paint_hits": 7,
  "powerups": 4,
  "game_version": "1.0.0",
  "platform": "android"
}
```

Svar, HTTP 201:

```json
{
  "accepted": true,
  "rank": 4,
  "personal_best": 4280
}
```

### 3. Läs topplistan

`GET /rymdresan/highscores.json`

```json
{
  "ruleset": "1.0.0",
  "generated_at": "2026-08-17T14:18:00Z",
  "entries": [
    { "name": "Nils", "score": 4280 }
  ]
}
```

Servern skriver JSON-filen atomiskt efter ett godkänt resultat. Det gör listan snabb och stabil även om databasen tillfälligt är upptagen.

## Klientarbete i spelet

1. Lägg nätverkskoden i en fristående `HighscoreService` i stället för direkt i spelscenen.
2. Skapa omgångs-ID precis när den spelbara flygningen börjar, inte på menyn.
3. Samla telemetri under omgången: tid, vanliga och boostade mynt, träffar, powerups, högsta höjd, liv och om månen nåddes.
4. Frys poängreglerna under ett `ruleset`-versionsnummer. En senare poängbalansering får ett nytt versionsnummer så inkompatibla resultat inte blandas.
5. Visa namninsamling på resultatskärmen. Senast använda namn sparas lokalt; servern får aldrig HTML eller kontrolltecken och namn begränsas till 15 tecken.
6. Lägg en tydlig `TOPPLISTA`-knapp på menyn med topp 10, laddningsstatus och texten `Lokal topplista` om nätverket saknas.
7. Om en sändning misslyckas läggs resultatet i en begränsad lokal kö. Kön försöks igen vid nästa spelstart, men samma `run_id` skickas aldrig dubbelt efter ett godkänt svar.

## Rimligt fuskskydd utan att överkomplicera

Ett klientspel kan aldrig göras helt fusksäkert, men vanliga manipulationsförsök kan stoppas billigt:

- engångs-ID per spelomgång, skapat av servern och med kort giltighetstid;
- jämförelse mellan serverns verkliga omgångstid och rapporterad `duration_ms`;
- servern kontrollerar tillåten spelversion, rimlig höjd, mynt, träffar, powerups och maximal poängökning per sekund;
- servern räknar om de verifierbara bonusdelarna i poängen i stället för att blint lita på totalsumman;
- rate limiting per IP och per omgångs-ID;
- parametriserade databasfrågor, transaktion när resultat sparas och atomisk omskrivning av JSON-filen;
- CORS endast för den riktiga webbadressen samt de origin-värden som Capacitor faktiskt använder;
- loggning av avvisade resultat utan att lagra mer persondata än nödvändigt.

## Arbetsordning

### Fas A – kan göras lokalt utan SSH

- lås nuvarande poängformel och skapa `ruleset 1.0.0`;
- implementera `HighscoreService`, lokal topp 10, offlinekö och resultatformulär;
- bygga API:t mot en lokal mock så webb och Android kan testas identiskt;
- lägga automatiska tester på namnrening, sortering, köhantering och dubbelsändning.

### Fas B – när SSH finns

- inventera webbservern: operativsystem, Apache/Nginx, PHP-version, TLS, SparkOliver-endpoints, databas och filrättigheter;
- återanvända SparkOlivers serverstruktur där den är sund och hålla Rymdresans data åtskild;
- skapa databas/schema, API-konfiguration utanför publik webbrot och skrivbar katalog för den genererade JSON-filen;
- sätta CORS, rate limit, loggrotation och daglig backup;
- verifiera API:t först med testdata och därefter från både riktig webbadress och installerad Android-app.

### Fas C – publicering

- bygga en produktionsversion av webbspelet och lägga den på den slutliga URL:en;
- installera signerad Android-build och köra ett fullständigt test från start till månlandning;
- kontrollera att samma resultat syns på båda plattformarna;
- testa offline, avbruten sändning, ogiltigt namn, gammal spelversion, dublett och orimlig poäng;
- ta backup och dokumentera ett enkelt återställningskommando innan funktionen öppnas publikt.

## Klart-kriterier

- Webben och Android visar samma globala topp 10.
- Ett resultat kan bara registreras en gång.
- Spelet fungerar fullt ut när servern är nere och visar då lokala resultat.
- Ett nätverksavbrott tappar inte ett legitimt resultat.
- Servern avvisar utgångna omgångar, fel spelversion och uppenbart orimliga poäng.
- Ingen serverhemlighet finns i JavaScript-koden eller APK-filen.
- Topplistan innehåller bara rensade namn och heltalspoäng.

## Återstående driftssteg

- kör rootinstallationen ovan för Apache, systemd, databas och backup;
- verifiera ett riktigt resultat från webb och Android mot samma topplista;
- HTTPS går via Cloudflare till Apache; Android använder enbart den säkra `https://www.fnirp.com/rymdresan`-adressen;
- standarden är tidernas topp 10, med nivå och markering för nådd måne.
