# Samøk 2 – øvingsapp

En øvingsapp for faget **Samfunnsøkonomi 2** (videregående, LK20). Den kjører lokalt på din egen PC, i nettleseren.

- **Lever sider:** Last opp bilder eller PDF-er fra læreboka eller notatene dine. Claude lager sammendrag og hovedpoenger, og finner temaer og begreper.
- **Høytlesning:** Få sammendrag og forklaringer lest høyt med norsk stemme.
- **Interaktive grafer:** Tilbud og etterspørsel, keynesiansk kryssdiagram, AD-AS, konjunktursykel, IS-LM, arbeidsmarkedet og Phillipskurven. Flytt glidebryterne og se den nye likevekten, med forklaring.
- **Oppgaver:** Flervalg, regneoppgaver, drøftingsoppgaver (vurdert av Claude) og grafoppgaver («flytt riktig kurve»).
- **Begreper:** En ordliste for hele faget som vokser for hver side du leverer, og flashkort for å øve.

---

## Enklest: Bruk nettsideversjonen på claude.ai
Appen finnes også som en nettside på claude.ai: **https://claude.ai/artifact/38Bj7RVJWWUHTanMF3V7yC**
Du trenger ikke å installere noe eller ha en API-nøkkel. Claude brukes via innloggingen din, og bruken teller mot Claude-abonnementet ditt. Dataene lagres privat på kontoen din.
Nettsiden bygges fra den samme koden med `npm run bygg-nettside` (se mappen `artifact/`).

Resten av denne README-en gjelder den lokale versjonen, som kjører på din egen PC med egen API-nøkkel.

---

## Første gang: Slik setter du opp appen (Windows)

### 1. Installer Node.js
1. Gå til **https://nodejs.org**.
2. Last ned versjonen merket **LTS** og installer den. Du kan trykke «Next» på alle stegene.
3. Start PC-en på nytt etterpå.

### 2. Last ned appen fra GitHub
1. Åpne repositoryet på GitHub.
2. Trykk den grønne knappen **Code**, og velg **Download ZIP**.
3. Høyreklikk zip-filen, velg **Pakk ut alle …** og legg mappen et sted du finner den igjen, for eksempel i Dokumenter.

### 3. Legg inn API-nøkkelen
1. Dobbeltklikk **`start.bat`** i mappen. Første gang installerer den det appen trenger, og det tar 1–2 minutter. Den lager også en fil som heter **`.env`**.
2. Lukk det svarte vinduet.
3. Høyreklikk **`.env`**, velg **Åpne med → Notisblokk**.
4. Lim inn nøkkelen din etter `ANTHROPIC_API_KEY=`, slik:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
   ```
   Det skal ikke være mellomrom eller anførselstegn.
5. Lagre filen med Ctrl+S.

> 🔒 Nøkkelen ligger bare i `.env` på PC-en din. Nettleseren ser den aldri, og `.env` lastes aldri opp til GitHub.
> Ikke del filen med andre.

> Ser du ikke `.env`? Åpne Filutforsker, velg **Vis → Vis → Filnavnutvidelser** og sjekk at filen ikke heter `.env.txt`.

### 4. Start appen
Dobbeltklikk **`start.bat`**. Nettleseren åpnes automatisk på **http://localhost:3000**.
Hvis siden er tom, trykker du F5 for å laste den på nytt.

**Det svarte vinduet må være åpent så lenge du bruker appen.** Lukk det når du er ferdig.

---

## Hver gang du skal bruke appen
Dobbeltklikk `start.bat`. Det er alt.

## Demo-modus (gratis prøving)
Uten API-nøkkel kjører appen i **demo-modus**. Den viser ferdige eksempelsvar, slik at du kan prøve grafene, oppgavene og flashkortene uten å betale. Du kan også slå på demo-modus med `DEMO=1` i `.env`.

## Hva koster det?
Du betaler Anthropic per bruk. Med standardmodellen (Claude Sonnet 5.5) koster analysen av én side omtrent 20 øre til 1 krone, avhengig av hvor mye tekst den har. Et oppgavesett eller en vurdering av et drøftingssvar koster omtrent det samme. Følg forbruket ditt på **console.anthropic.com**.
Du kan bytte modell i `.env` (`CLAUDE_MODELL`). Start appen på nytt etter at du har endret noe i `.env`.

## Hvor lagres dataene mine?
Alt du leverer og øver på, lagres **i nettleseren på denne PC-en**. Det gjelder bilder, analyser, begreper og svar.
- Bruk alltid samme nettleser, for eksempel Edge.
- Ta **backup** jevnlig under ⚙︎ (Innstillinger) → «Last ned backup». Da får du én fil du kan gjenopprette fra.
- Hvis du tømmer nettleserdata («slett informasjonskapsler og nettstedsdata»), kan alt forsvinne. Ta backup først!

## Høytlesning
Appen bruker stemmene som er innebygd i nettleseren. **Microsoft Edge** har ofte de mest naturlige norske stemmene. Velg stemme under ⚙︎ Innstillinger.
Finner appen ingen norsk stemme, kan du installere en: Windows-innstillinger → **Tid og språk → Tale → Legg til stemmer → Norsk (bokmål)**.

### Bytte til bedre stemme senere
All høytlesning går gjennom filen `public/js/tale.js`. For å bruke en annen taletjeneste lager du en ny klasse med de samme funksjonene: `les`, `pause`, `fortsett`, `stopp`, `settHastighet` og `settStemme`. Deretter bytter du den inn på den siste linjen i filen. Resten av appen trenger ikke endres.

---

## Feilsøking
| Problem | Løsning |
|---|---|
| «Node.js er ikke installert» | Installer Node.js (steg 1) og start PC-en på nytt. |
| «API-nøkkelen ble avvist» | Sjekk at hele nøkkelen er limt inn i `.env`, uten mellomrom. Start appen på nytt. |
| «For mange forespørsler eller tom kreditt» | Sjekk at du har kreditt på console.anthropic.com. |
| Nettsiden laster ikke | Sjekk at det svarte vinduet fortsatt er åpent. Trykk F5. |
| Port 3000 er opptatt | Endre `PORT=3001` i `.env` og åpne http://localhost:3001. |

---

## Hvordan appen er bygd (for den nysgjerrige)
```
start.bat              Starter appen (Windows)
server.js              Backend: viser nettsiden og videresender forespørsler til Claude
server/claude.js       Instruksjonene (promptene) til Claude og selve API-kallene
server/skjema.js       JSON-formatet Claude må svare i
server/demo.js         Eksempelsvar for demo-modus
public/index.html      Selve nettsiden
public/css/stil.css    Design og farger
public/js/fag.js       Temaene i faget
public/js/grafmaler.js Grafmodellene: formler, glidebrytere og forklaringer
public/js/grafvisning.js  Tegner grafene (med Plotly)
public/js/tale.js      Høytlesning
public/js/db.js        Lagring i nettleseren
public/js/visninger/   De ulike sidene i appen
```
Claude tegner aldri grafene selv. Claude velger hvilken modell som passer og hvilke tall den skal starte med. Formlene ligger i `grafmaler.js`, så grafene alltid er matematisk riktige. Hvis ingen ferdig modell passer, beskriver Claude kurvene med likninger, og appen tegner dem.

Temaene i `fag.js` er en praktisk inndeling av faget basert på LK20. De er ikke ordrette kompetansemål.
