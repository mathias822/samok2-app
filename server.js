// Backend for øvingsappen.
// Den gjør tre ting:
//   1. Viser nettsiden (filene i mappen "public")
//   2. Tar imot forespørsler fra nettsiden og sender dem videre til Claude API
//   3. Holder API-nøkkelen hemmelig (den leses fra .env og forlater aldri PC-en din, bortsett fra til Anthropic)

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyserSider, lagOppgaver, vurderSvar, BrukerFeil, MODELL } from './server/claude.js';
import { demoAnalyse, demoOppgaver, demoVurdering } from './server/demo.js';

const mappe = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DEMO = process.env.DEMO === '1' || !process.env.ANTHROPIC_API_KEY;

const app = express();
app.use(express.json({ limit: '60mb' })); // bilder og PDF-er sendes som tekst (base64)
app.use(express.static(path.join(mappe, 'public')));
app.use('/vendor/plotly.min.js', express.static(path.join(mappe, 'node_modules/plotly.js-dist-min/plotly.min.js')));

app.get('/api/status', (req, res) => {
  res.json({ demo: DEMO, modell: DEMO ? null : MODELL });
});

const TILLATTE_TYPER = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

app.post('/api/analyser', async (req, res, next) => {
  try {
    const { filer, notat } = req.body || {};
    if (!Array.isArray(filer) || filer.length === 0) throw new BrukerFeil('Ingen filer ble sendt.');
    if (filer.length > 20) throw new BrukerFeil('Maks 20 filer per innlevering.');
    for (const f of filer) {
      if (!TILLATTE_TYPER.includes(f.type)) throw new BrukerFeil(`Filtypen ${f.type} støttes ikke. Bruk bilder (JPG/PNG) eller PDF.`);
      if (typeof f.data !== 'string' || !f.data) throw new BrukerFeil('En av filene er tom.');
    }
    if (DEMO) return res.json({ analyse: demoAnalyse(), demo: true });
    const { data } = await analyserSider({ filer, notat: String(notat || '').slice(0, 1000) });
    res.json({ analyse: data });
  } catch (e) { next(e); }
});

app.post('/api/oppgaver', async (req, res, next) => {
  try {
    const { kontekst, antall, nivå } = req.body || {};
    const tall = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
    const a = { flervalg: tall(antall?.flervalg), regning: tall(antall?.regning), drofting: tall(antall?.drofting), graf: tall(antall?.graf) };
    if (a.flervalg + a.regning + a.drofting + a.graf === 0) throw new BrukerFeil('Velg minst én oppgave.');
    if (!kontekst) throw new BrukerFeil('Ingen sider å lage oppgaver fra.');
    if (DEMO) return res.json({ ...demoOppgaver(a), demo: true });
    const { data } = await lagOppgaver({ kontekst: String(kontekst).slice(0, 200000), antall: a, nivå: String(nivå || 'middels') });
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/api/vurder', async (req, res, next) => {
  try {
    const { sporsmal, vurderingskriterier, losningsforslag, svar } = req.body || {};
    if (!svar || !String(svar).trim()) throw new BrukerFeil('Skriv et svar først.');
    if (DEMO) return res.json({ ...demoVurdering(String(svar)), demo: true });
    const { data } = await vurderSvar({ sporsmal, vurderingskriterier, losningsforslag, svar: String(svar).slice(0, 30000) });
    res.json(data);
  } catch (e) { next(e); }
});

// Feilhåndtering: send en forståelig norsk feilmelding til nettsiden.
app.use((feil, req, res, next) => {
  if (feil instanceof BrukerFeil) return res.status(400).json({ feil: feil.message });
  if (feil?.type === 'entity.too.large') return res.status(413).json({ feil: 'Filene er for store. Prøv færre eller mindre filer.' });
  console.error(feil);
  res.status(500).json({ feil: 'Noe gikk galt på serveren. Se vinduet der appen kjører for detaljer.' });
});

// Lytter bare på din egen PC (127.0.0.1), ikke på nettverket.
app.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  Samøk 2 – øvingsapp kjører!');
  console.log(`  Åpne denne adressen i nettleseren:  http://localhost:${PORT}`);
  console.log(DEMO
    ? '  DEMO-MODUS: Ingen API-nøkkel funnet. Appen viser eksempelsvar (se README for å legge inn nøkkel).'
    : `  Bruker Claude-modellen: ${MODELL}`);
  console.log('  Lukk dette vinduet (eller trykk Ctrl+C) for å stoppe appen.');
  console.log('');
});
