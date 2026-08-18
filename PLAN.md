# Rymdresan – Från jorden till månen – produktionsplan

## Vision

Rymdresan – Från jorden till månen är ett lättillgängligt, varmt och visuellt påkostat arkadspel i stående format. Johannes styr en liten charmig raket från en skånsk uppskjutningsplats hela vägen till månen, med Leo och Oliver som medresenärer. Resan ska kännas som en sammanhängande expedition: marken försvinner, molnen tunnas ut, himlen mörknar, stjärnorna tar över och månen växer gradvis fram.

Målet med första versionen är ett komplett spel med början, mitt och slut – inte en teknisk demo. En normal lyckad runda ska ta ungefär 3–4 minuter.

## Teknikval

- **Phaser 3 + TypeScript + Vite** för snabb, pålitlig 2D-rendering, fysik, animationer, ljud och bra prestanda i webbläsare.
- **Capacitor** paketerar exakt samma spel som Android-app. Det minimerar dubbelt arbete och gör webbläsar- och mobilversionen visuellt identiska.
- **Arcade Physics** används för tydliga, förlåtande kollisioner. Rörelsen är spelkänsla framför realism.
- **Web Audio** genererar en liten original-ljudbild i kod, så spelet inte blir beroende av externa ljudbibliotek.
- Grafiken delas mellan AI-skapade nyckelbilder/karaktärer och noggrant ritade spelobjekt i Phaser. Det gör resultatet enhetligt, snabbt och lätt att animera utan ett onödigt tungt assetflöde.

## Skärm, kontroller och tillgänglighet

- Intern spelyta: **720 × 1280**, responsivt skalad med bibehållen proportion.
- Mobil: håll och dra horisontellt; raketen följer mjukt med en liten tröghet.
- Webbläsare: mus/pekdon eller A/D och vänster/höger.
- Paintball: automatisk målsökning medan powerupen är aktiv; på så sätt behövs ingen extra knapp på mobil.
- Stora tryckytor, hög kontrast, få ord mitt i spelet och möjlighet att pausa.
- Portrait-orientering på Android.

## Spelflöde

### 1. Titel och briefing

- Animerad titelbild med raketen på startplattan och de tre resenärerna.
- Knappar för **STARTA**, **SÅ SPELAR DU** och ljud.
- Bästa poäng visas lokalt.

### 2. Introsekvens på jorden

- Johannes går först mot raketen; Leo och Oliver följer efter med lite studs och individuellt rörelsemönster.
- De klättrar in i ordning och dyker upp i raketens tre fönster.
- Kort nedräkning, motorstart, rökpuffar och uppskjutning.
- Intro kan hoppas över efter första visningen.

### 3. Flygningen

Raketen ligger i nedre tredjedelen och världen rör sig nedåt. En höjdmätare och månprogress visar färden.

| Zon | Andel | Visuellt | Typiska hinder |
| --- | ---: | --- | --- |
| Äng & låg himmel | 0–18 % | gräs, hustak, fåglar, ljusa cumulusmoln | fåglar, små propellerplan |
| Molnhav | 18–42 % | flera molnlager, solstrålar, luftballonger | ballonger, passagerarplan |
| Övre atmosfär | 42–62 % | mörkare blått, tunna slöjmoln, väderballonger | jetplan, väderballonger |
| Nära rymden | 62–82 % | violett övergång, jordens krökning, meteorer | satelliter, rymdskrot |
| Månfärd | 82–100 % | djup rymd, månen växer, stjärnstoft | satelliter, asteroider |

- Mynt placeras i bågar, vågor och risk/reward-linjer.
- Svårigheten ökar med höjden genom högre fart, fler korsande objekt och tätare mönster.
- Kollision kostar ett hjärta och ger kort odödlighet med tydlig blinkning/skakning.
- Tre förlorade hjärtan ger en vänlig krasch-/försök-igen-sekvens.

## Powerups

- **Sköld**: absorberar nästa kollision, blå energibubbla runt raketen.
- **Paintball**: skjuter automatiskt färgkulor mot närmaste farliga objekt och knuffar undan det; färgstänk ger komisk feedback.
- **Boost**: magnetiserar mynt, ökar poängmultiplikatorn och ger en kort fartkänsla utan att göra styrningen orättvis.
- **Tidsbubbla**: saktar ner hinder i några sekunder medan raketen behåller normal styrrespons.

Powerups har färgkodade ikoner, en tidsring och en kort svensk etikett när de plockas upp.

## Parallax och grafiskt uttryck

- Minst fyra samtidiga djupskikt: bakgrundsgradient, fjärrsilhuetter/stjärnor, mellanlager och snabba förgrundsobjekt.
- Varje zon tonas mjukt in i nästa; inga hårda banbyten.
- Cartoonkroppar med något större huvud, mjuka former, subtila texturer och ansikten i realistisk cartoonstil baserade på fotoreferenserna.
- Johannes är tydligt synlig i raketens främsta fönster under hela flygningen. Leo och Oliver syns i mindre sidofönster.
- Färgpalett: varm korall/orange på jorden, klar cyan i himlen, violett övergång och djup marinblå rymd. Mynt och UI använder varmt guld.
- Små sekundäranimationer: raketgung, flamvariation, molndrift, stjärnglitter, fönsterreflexer och passagerarnas huvudrörelser.

## Månfinal

- Månen fyller gradvis nederdelen, raketen bromsar och landar med dammpuffar.
- Johannes klättrar ut först; Leo och Oliver följer.
- Johannes tar ett stort låggravitationhopp och de andra studsar efter i formation.
- Resultatkort visar mynt, träffar, bonus, höjd och ny highscore.
- Avslutande knapp: **FLYG IGEN**.

## Kvalitetsmål och acceptanskriterier

- Stabilt 60 fps på en normal Androidtelefon och modern desktopwebbläsare.
- Fungerande touch, mus och tangentbord.
- Fullt spelbar resa från intro till månyta, inklusive game over och omstart.
- Ingen kritisk grafik klipps på vanliga portraitformat; safe-area respekteras.
- Alla centrala figurer känns igen från referenserna och den visuella stilen är konsekvent.
- Minst 5 hindertyper, 4 powerups, myntmönster, parallax i alla zoner och tydlig ljud/visuell feedback.
- Highscore och ljudinställning sparas lokalt.
- Webbuild och installerbar debug-APK byggs utan fel.

## Prioritering och genvägar

1. Spelkänsla, tydlig progression och stabil mobilprestanda.
2. Karaktärslikhet, raket, intro/final och visuell polish.
3. Variation i hinder/mönster och ljudfeedback.
4. Fler kosmetiska variationer först när kärnloopen är stark.

Första versionen använder ett handbyggt, deterministiskt mönstersystem med kontrollerad variation i stället för en komplicerad nivåeditor. Det ger ett mer balanserat spel och snabbare iteration.

## Leveranser

- Webprojekt med utvecklings- och produktionskommandon.
- Androidprojekt via Capacitor.
- Installerbar debug-APK.
- Samlade spelassets och fotoreferenser separerade i tydliga mappar.
- README med kontroller, körning, bygge och projektstruktur.
