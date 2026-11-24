// Nettsideversjonen av appen (publiseres som en side på claude.ai).
// Samme visninger og grafer som den lokale appen, men:
//   - Claude brukes direkte via innloggingen din på claude.ai (ingen API-nøkkel, ingen server)
//   - Dataene lagres i din private del av sidens database (følger kontoen din),
//     eller i nettleseren hvis databasen ikke er tilgjengelig
//   - Høytlesning med nettleserens norske stemme, eller Claudes stemme hvis nettleseren mangler norsk

import { settLagring } from '../public/js/db.js';
import { settTransport } from '../public/js/api.js';
import { settNavigator, esc, melding } from '../public/js/ui.js';
import { tale, settTale, NettleserTale } from '../public/js/tale.js';
import { FELLES, analyseTekst, oppgaveTekst, vurderingTekst } from '../public/js/prompter.js';
import { ANALYSE_SKJEMA, OPPGAVE_SKJEMA, VURDERING_SKJEMA } from '../server/skjema.js';
import { TEMA_IDER } from '../public/js/fag.js';
import { MALER, MAL_IDER } from '../public/js/grafmaler.js';
import * as oversikt from '../public/js/visninger/oversikt.js';
import * as lever from '../public/js/visninger/lever.js';
import * as side from '../public/js/visninger/side.js';
import * as grafer from '../public/js/visninger/grafer.js';
import * as oppgaver from '../public/js/visninger/oppgaver.js';
import * as begreper from '../public/js/visninger/begreper.js';
import * as flashkort from '../public/js/visninger/flashkort.js';
import * as innstillinger from '../public/js/visninger/innstillinger.js';

const RUTER = { oversikt, lever, side, grafer, oppgaver, begreper, flashkort, innstillinger };
const claude = window.claude;
const bruk = (navn) => (claude?.use ? claude.use(navn).catch(() => null) : Promise.resolve(null));

// ---------- Navigasjon (inne i siden, uten å endre adressen) ----------
const main = document.getElementById('innhold');
let nåværende = '/oversikt';

async function visRute(sti) {
  nåværende = sti;
  const [rute, spørring = ''] = sti.replace(/^\/?/, '').split('?');
  const [navn = 'oversikt', ...deler] = rute.split('/').filter(Boolean);
  const visning = RUTER[navn] || oversikt;
  const query = Object.fromEntries(new URLSearchParams(spørring));
  document.querySelectorAll('.meny a').forEach((a) => a.classList.toggle('aktiv', a.dataset.rute === (RUTER[navn] ? navn : 'oversikt')));
  tale.stopp();
  main.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    await visning.vis(main, deler.map(decodeURIComponent), query);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="kort"><h2>Noe gikk galt</h2><p class="feiltekst">${esc(e?.message || String(e))}</p></div>`;
  }
}
settNavigator((sti) => visRute(sti));
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a) return;
  e.preventDefault();
  visRute(a.getAttribute('href').slice(1));
});

// ---------- Lagring: Claude-sidens database, privat per bruker ----------
const NØKKEL = { leveranser: 'id', begreper: 'nokkel', oppgavesett: 'id', innstillinger: 'id' };
const MAKS_BILDE_TEGN = 190_000; // et dokument kan være maks 256 KiB

// Dokument-id-er kan bare inneholde enkle tegn, så begreper (med æøå og mellomrom) kodes om.
function trygId(verdi) {
  const s = String(verdi);
  if (/^[A-Za-z0-9_-]{1,150}$/.test(s)) return s;
  let hex = '';
  for (const byte of new TextEncoder().encode(s)) hex += byte.toString(16).padStart(2, '0');
  if (hex.length <= 180) return 'x' + hex;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return 'x' + hex.slice(0, 160) + '-' + (h >>> 0).toString(36);
}

function klon(o) { return JSON.parse(JSON.stringify(o)); }

function lastBilde(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunne ikke lese bildet')); };
    img.src = url;
  });
}

// Komprimerer et bilde til en data-URL som får plass i ett databasedokument.
async function bildeTilDataUrl(blob) {
  const img = await lastBilde(blob);
  for (const [maks, kvalitet] of [[1600, 0.8], [1400, 0.7], [1200, 0.6], [1000, 0.55], [800, 0.5], [600, 0.5]]) {
    const skala = Math.min(1, maks / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * skala);
    c.height = Math.round(img.naturalHeight * skala);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', kvalitet);
    if (url.length <= MAKS_BILDE_TEGN) return url;
  }
  return null;
}

function dataUrlTilBlob(dataUrl) {
  const [hode, data] = dataUrl.split(',');
  const type = hode.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function lagClaudeLagring(db, brukerId) {
  const rot = db.doc(`data/users/${brukerId}/fag`);
  const samling = (navn) => rot.collection(navn);
  const filSamling = () => rot.collection('filer');

  return {
    async hentAlle(navn) {
      const snap = await samling(navn).get();
      // Filene hentes ikke her (bare når én side åpnes), for å spare tid.
      return snap.docs.map((d) => klon(d.data()));
    },
    async hent(navn, id) {
      const snap = await samling(navn).doc(trygId(id)).get();
      if (!snap.exists) return undefined;
      const obj = klon(snap.data());
      if (navn === 'leveranser') {
        obj.filer = await Promise.all((obj.filer || []).map(async (f) => {
          if (!f.filId) return f;
          const fs = await filSamling().doc(f.filId).get().catch(() => null);
          return fs?.exists ? { ...f, blob: dataUrlTilBlob(fs.data().data) } : f;
        }));
      }
      return obj;
    },
    async lagre(navn, objekt) {
      const kopi = { ...objekt };
      if (navn === 'leveranser') {
        kopi.filer = [];
        for (const f of objekt.filer || []) {
          if (f.filId || !f.blob) { const { blob, ...rest } = f; kopi.filer.push(rest); continue; }
          let dataUrl = null;
          try { dataUrl = f.type.startsWith('image/') ? await bildeTilDataUrl(f.blob) : null; } catch { /* hopp over */ }
          if (!dataUrl) { kopi.filer.push({ navn: f.navn, type: f.type, mangler: true }); continue; }
          const filId = `${kopi.id}-${kopi.filer.length}`;
          await filSamling().doc(filId).set({ data: dataUrl });
          kopi.filer.push({ navn: f.navn, type: 'image/jpeg', filId });
        }
      }
      await samling(navn).doc(trygId(kopi[NØKKEL[navn]])).set(klon(kopi));
    },
    async slett(navn, id) {
      const ref = samling(navn).doc(trygId(id));
      if (navn === 'leveranser') {
        const snap = await ref.get();
        for (const f of snap.exists ? snap.data().filer || [] : []) {
          if (f.filId) await filSamling().doc(f.filId).delete();
        }
      }
      await ref.delete();
    },
    async tøm(navn) {
      const snap = await samling(navn).get();
      for (const d of snap.docs) await samling(navn).doc(d.id).delete();
      if (navn === 'leveranser') {
        const filer = await filSamling().get();
        for (const d of filer.docs) await filSamling().doc(d.id).delete();
      }
    },
  };
}

let lagringsType = 'nettleser';
async function settOppLagring() {
  const [db, user] = await Promise.all([bruk('db'), bruk('user')]);
  const id = await user?.id?.().catch(() => null);
  if (!db || !id) return;
  const lagring = lagClaudeLagring(db, id);
  try {
    await lagring.hentAlle('innstillinger'); // test at databasen svarer
    settLagring(lagring);
    lagringsType = 'claude';
  } catch (e) {
    console.warn('Databasen svarte ikke, bruker nettleserlagring', e);
  }
}

// ---------- Claude: analyse, oppgaver og vurdering ----------
const FEILTEKST = {
  not_granted: 'Siden fikk ikke lov til å bruke Claude. Tillat det i spørsmålet som dukker opp, eller under sidens tillatelser, og prøv igjen.',
  sampling_disabled: 'Claude er ikke tilgjengelig for kontoen din her.',
  rate_limited: 'Du har brukt Claude mye den siste tiden. Vent litt og prøv igjen.',
  session_expired: 'Du er logget ut av claude.ai. Logg inn igjen og prøv på nytt.',
  image_rejected: 'Et av bildene kunne ikke brukes. Prøv et annet bilde (JPG eller PNG).',
  images_unavailable: 'Bilder kan ikke sendes til Claude fra denne visningen. Prøv å åpne siden i nettleseren på claude.ai.',
  prompt_too_large: 'Det ble for mye tekst på én gang. Velg færre sider.',
  refused: 'Claude ville ikke svare på denne forespørselen.',
  invalid_json: 'Claude svarte i et format appen ikke forstod. Prøv igjen.',
  empty_completion: 'Claude ga et tomt svar. Prøv igjen.',
  cancelled: 'Avbrutt.',
};

function jsonInstruks(skjema) {
  return `\n\nSVARFORMAT: Svar KUN med ett JSON-objekt, uten annen tekst og uten kodeblokk. Objektet skal følge dette JSON-skjemaet nøyaktig (alle felt må være med):\n${JSON.stringify(skjema)}`;
}

async function spørClaude(prompt, valg = {}) {
  const sample = await bruk('sample');
  if (!sample) throw new Error('Claude er ikke tilgjengelig her. Åpne siden på claude.ai mens du er logget inn.');
  try {
    return await sample.json(prompt, { modelTier: 'default', ...valg });
  } catch (e) {
    throw new Error(FEILTEKST[e?.code] || `Noe gikk galt hos Claude (${e?.code || 'ukjent feil'}). Prøv igjen.`);
  }
}

const liste = (v) => (Array.isArray(v) ? v : []);
const tekst = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const tall = (v, standard = 0) => (Number.isFinite(Number(v)) ? Number(v) : standard);

function rensStartverdier(v) {
  return liste(v).filter((s) => s && typeof s.id === 'string').map((s) => ({ id: s.id, verdi: tall(s.verdi) }));
}

function rensAnalyse(a) {
  a = a && typeof a === 'object' ? a : {};
  return {
    lesbar: a.lesbar !== false,
    tittel: tekst(a.tittel) || 'Uten tittel',
    sammendrag: tekst(a.sammendrag),
    hovedpoenger: liste(a.hovedpoenger).map(tekst).filter(Boolean),
    temaer: liste(a.temaer).filter((t) => TEMA_IDER.includes(t)),
    begreper: liste(a.begreper).filter((b) => b && b.begrep).map((b) => ({
      begrep: tekst(b.begrep), forklaring: tekst(b.forklaring), eksempel: tekst(b.eksempel), tema: TEMA_IDER.includes(b.tema) ? b.tema : null,
    })),
    grafer: liste(a.grafer).filter((g) => g && (MAL_IDER.includes(g.mal) || (g.mal === 'fri' && g.fri && typeof g.fri === 'object'))).map((g) => ({
      mal: g.mal, tittel: tekst(g.tittel), kobling: tekst(g.kobling), startverdier: rensStartverdier(g.startverdier),
      fri: g.mal === 'fri' ? {
        xAkse: { navn: tekst(g.fri.xAkse?.navn), min: tall(g.fri.xAkse?.min), max: tall(g.fri.xAkse?.max, 100) },
        yAkse: { navn: tekst(g.fri.yAkse?.navn), min: tall(g.fri.yAkse?.min), max: tall(g.fri.yAkse?.max, 100) },
        parametre: liste(g.fri.parametre).map((p) => ({ id: tekst(p.id), navn: tekst(p.navn), min: tall(p.min), max: tall(p.max, 10), steg: tall(p.steg, 1) || 1, start: tall(p.start) })),
        kurver: liste(g.fri.kurver).map((k) => ({ id: tekst(k.id), navn: tekst(k.navn), type: k.type === 'loddrett' ? 'loddrett' : 'y_av_x', uttrykk: tekst(k.uttrykk) })),
        skjaeringer: liste(g.fri.skjaeringer).map((s) => ({ kurve1: tekst(s.kurve1), kurve2: tekst(s.kurve2), navn: tekst(s.navn) })),
      } : null,
    })),
  };
}

function rensOppgaver(svar) {
  return liste(svar?.oppgaver).map((o) => {
    if (!o || !['flervalg', 'regning', 'drofting', 'graf'].includes(o.type) || !o.sporsmal) return null;
    const ut = {
      type: o.type, tema: TEMA_IDER.includes(o.tema) ? o.tema : 'modeller', sporsmal: tekst(o.sporsmal),
      alternativer: liste(o.alternativer).map(tekst), riktigAlternativ: Math.round(tall(o.riktigAlternativ, -1)),
      fasitTall: tall(o.fasitTall), enhet: tekst(o.enhet), toleranse: Math.abs(tall(o.toleranse)),
      losningsforslag: tekst(o.losningsforslag), vurderingskriterier: liste(o.vurderingskriterier).map(tekst), graf: null,
    };
    if (ut.type === 'flervalg' && (ut.alternativer.length < 2 || ut.riktigAlternativ < 0 || ut.riktigAlternativ >= ut.alternativer.length)) return null;
    if (ut.type === 'graf') {
      const g = o.graf;
      const mal = g && MALER[g.mal];
      if (!mal || !mal.parametre.some((p) => p.id === g.riktigParameter)) return null;
      ut.graf = { mal: g.mal, startverdier: rensStartverdier(g.startverdier), riktigParameter: g.riktigParameter, riktigRetning: g.riktigRetning === 'ned' ? 'ned' : 'opp' };
    }
    return ut;
  }).filter(Boolean);
}

function base64TilBlob(data, type) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

settTransport({
  async status() {
    return { demo: false, artifact: true, lagring: lagringsType };
  },
  async post(url, data) {
    if (url === '/api/analyser') {
      const sample = await bruk('sample');
      if (!sample) throw new Error('Claude er ikke tilgjengelig her. Åpne siden på claude.ai mens du er logget inn.');
      const grenser = await sample.limits().catch(() => null);
      if (!grenser?.images) throw new Error(FEILTEKST.images_unavailable);
      const bilder = data.filer.map((f) => base64TilBlob(f.data, f.type));
      if (bilder.length > grenser.images.maxCount) {
        throw new Error(`Claude kan lese maks ${grenser.images.maxCount} bilder om gangen her. Del opp i flere innleveringer.`);
      }
      const prompt = `${FELLES}\n\nBildene som følger med, er sider fra læreboka eller notatene mine.\n\n${analyseTekst(bilder.length, tekst(data.notat).slice(0, 1000))}${jsonInstruks(ANALYSE_SKJEMA)}`;
      return { analyse: rensAnalyse(await spørClaude(prompt, { images: bilder })) };
    }
    if (url === '/api/oppgaver') {
      const prompt = `${FELLES}\n\n${oppgaveTekst(tekst(data.kontekst).slice(0, 150000), data.antall, data.nivå)}${jsonInstruks(OPPGAVE_SKJEMA)}`;
      const oppg = rensOppgaver(await spørClaude(prompt, { cache: false }));
      if (!oppg.length) throw new Error('Claude laget ingen gyldige oppgaver. Prøv igjen.');
      return { oppgaver: oppg };
    }
    if (url === '/api/vurder') {
      if (!tekst(data.svar).trim()) throw new Error('Skriv et svar først.');
      const prompt = `${FELLES}\n\n${vurderingTekst({ ...data, svar: tekst(data.svar).slice(0, 30000) })}${jsonInstruks(VURDERING_SKJEMA)}`;
      const v = await spørClaude(prompt);
      return {
        tilbakemelding: tekst(v?.tilbakemelding), styrker: liste(v?.styrker).map(tekst), forbedringer: liste(v?.forbedringer).map(tekst),
        karakter: Math.min(6, Math.max(1, Math.round(tall(v?.karakter, 3)))), modellsvar: tekst(v?.modellsvar),
      };
    }
    throw new Error(`Ukjent forespørsel: ${url}`);
  },
});

// ---------- Høytlesning ----------
class ClaudeTale extends NettleserTale {
  constructor(tts, språk) {
    super();
    this.tts = tts;
    this.språk = språk;
    this.navn = 'Claudes stemme';
    tts.onState(({ state }) => {
      this.status = state === 'idle' ? 'stoppet' : state === 'paused' ? 'pause' : 'spiller';
      this.vedEndring();
    });
  }
  støttes() { return true; }
  stemmer() { return []; }
  velgStemme() { return null; }
  fart() { return Math.min(1.5, Math.max(0.7, this.hastighet)); }
  les(tekstSomLeses) {
    const linjer = this.delOpp(tekstSomLeses).map((t) => ({ text: t.trim(), ...(this.språk ? { language: this.språk } : {}) })).filter((l) => l.text);
    this.status = 'spiller';
    this.vedEndring();
    this.tts.speak(linjer, { rate: this.fart() }).catch((e) => {
      if (e?.code === 'not_granted') melding('Høytlesning er slått av for denne siden.');
    });
  }
  pause() { this.tts.pause().catch(() => {}); }
  fortsett() { this.tts.resume().catch(() => {}); }
  stopp() { if (this.tts.active?.()) this.tts.stop().catch(() => {}); this.status = 'stoppet'; this.vedEndring(); }
  settHastighet(h) { this.hastighet = h; if (this.status !== 'stoppet') this.tts.setRate(this.fart()).catch(() => {}); }
}

async function velgTalemotor() {
  // Vent kort på at nettleseren laster stemmene sine.
  if ('speechSynthesis' in window && speechSynthesis.getVoices().length === 0) {
    await new Promise((r) => { speechSynthesis.addEventListener('voiceschanged', r, { once: true }); setTimeout(r, 1500); });
  }
  const harNorsk = 'speechSynthesis' in window && speechSynthesis.getVoices().some((v) => /^(nb|no|nn)([-_]|$)/i.test(v.lang));
  if (harNorsk) return;
  const tts = await bruk('tts');
  if (!tts) return;
  const språk = await tts.languages?.().then((l) => ['nb', 'no', 'nb-NO'].find((x) => l.includes(x))).catch(() => undefined);
  settTale(new ClaudeTale(tts, språk));
}

// ---------- Høytlesningslinja ----------
const linje = document.getElementById('talelinje');
const pauseKnapp = document.getElementById('tale-pause');
const hastighet = document.getElementById('tale-hastighet');
const hastighetVerdi = document.getElementById('tale-hastighet-verdi');
const visFart = (h) => { hastighetVerdi.textContent = `${h.toLocaleString('nb-NO', { minimumFractionDigits: 1 })}×`; };

function kobleTalelinje() {
  try {
    const lagret = JSON.parse(localStorage.getItem('tale') || '{}');
    if (lagret.hastighet) tale.hastighet = lagret.hastighet;
    if (lagret.stemme) tale.stemmeNavn = lagret.stemme;
  } catch { /* ignorer */ }
  hastighet.value = tale.hastighet;
  visFart(tale.hastighet);
  tale.vedEndring = () => {
    linje.hidden = tale.status === 'stoppet';
    pauseKnapp.textContent = tale.status === 'pause' ? '▶ Fortsett' : '⏸ Pause';
  };
}
pauseKnapp.addEventListener('click', () => (tale.status === 'pause' ? tale.fortsett() : tale.pause()));
document.getElementById('tale-stopp').addEventListener('click', () => tale.stopp());
hastighet.addEventListener('input', () => {
  const h = Number(hastighet.value);
  visFart(h);
  tale.settHastighet(h);
  try { localStorage.setItem('tale', JSON.stringify({ hastighet: h, stemme: tale.stemmeNavn })); } catch { /* ignorer */ }
});

// ---------- Start ----------
kobleTalelinje();
main.innerHTML = '<div class="laster"><div class="spinner"></div><p>Laster faget ditt …</p></div>';
(async () => {
  await settOppLagring();
  if (lagringsType !== 'claude') document.getElementById('lagring-banner').hidden = false;
  await visRute('/oversikt');
  velgTalemotor().then(kobleTalelinje).catch(() => {});
})();
