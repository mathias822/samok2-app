// Lokal lagring i nettleseren (IndexedDB). Alt du leverer og øver på lagres her, på din egen PC.
//
// Tabeller ("stores"):
//   leveranser  – innleverte sider (filer + analyse fra Claude)
//   begreper    – ordlisten for hele faget (nøkkel = begrepet med små bokstaver)
//   oppgavesett – genererte oppgaver og svarene dine
//   innstillinger

const DB_NAVN = 'samok2';
const VERSJON = 1;
const TABELLER = ['leveranser', 'begreper', 'oppgavesett', 'innstillinger'];

let dbLøfte = null;

function åpne() {
  if (dbLøfte) return dbLøfte;
  dbLøfte = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAVN, VERSJON);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('leveranser')) db.createObjectStore('leveranser', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('begreper')) db.createObjectStore('begreper', { keyPath: 'nokkel' });
      if (!db.objectStoreNames.contains('oppgavesett')) db.createObjectStore('oppgavesett', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('innstillinger')) db.createObjectStore('innstillinger', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbLøfte;
}

function løfte(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tabell(navn, modus = 'readonly') {
  const db = await åpne();
  return db.transaction(navn, modus).objectStore(navn);
}

export async function hentAlle(navn) {
  return løfte((await tabell(navn)).getAll());
}
export async function hent(navn, id) {
  return løfte((await tabell(navn)).get(id));
}
export async function lagre(navn, objekt) {
  return løfte((await tabell(navn, 'readwrite')).put(objekt));
}
export async function slett(navn, id) {
  return løfte((await tabell(navn, 'readwrite')).delete(id));
}
export async function tøm(navn) {
  return løfte((await tabell(navn, 'readwrite')).clear());
}

export function nyId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function begrepNøkkel(begrep) {
  return String(begrep).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Legger begreper fra en ny analyse inn i den felles ordlisten (uten duplikater).
export async function leggTilBegreper(begreper, leveranseId) {
  let nye = 0;
  for (const b of begreper || []) {
    if (!b.begrep) continue;
    const nokkel = begrepNøkkel(b.begrep);
    const finnes = await hent('begreper', nokkel);
    if (finnes) {
      if (!finnes.kilder.includes(leveranseId)) finnes.kilder.push(leveranseId);
      if (b.tema && !finnes.temaer.includes(b.tema)) finnes.temaer.push(b.tema);
      if (b.forklaring && !finnes.forklaring) finnes.forklaring = b.forklaring;
      await lagre('begreper', finnes);
    } else {
      await lagre('begreper', {
        nokkel,
        begrep: b.begrep.trim(),
        forklaring: b.forklaring,
        eksempel: b.eksempel,
        temaer: b.tema ? [b.tema] : [],
        kilder: [leveranseId],
        boks: 1, // flashkort: boks 1 = må øves mest, boks 5 = kan godt
        sistØvd: null,
        lagt: Date.now(),
      });
      nye++;
    }
  }
  return nye;
}

// Når en leveranse slettes, fjernes den som kilde. Begreper uten kilder slettes.
export async function fjernKildeFraBegreper(leveranseId) {
  for (const b of await hentAlle('begreper')) {
    if (!b.kilder.includes(leveranseId)) continue;
    b.kilder = b.kilder.filter((k) => k !== leveranseId);
    if (b.kilder.length === 0 && !b.egendefinert) await slett('begreper', b.nokkel);
    else await lagre('begreper', b);
  }
}

// ---------- Backup ----------

function blobTilDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlTilBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

export async function eksporter() {
  const ut = { app: 'samok2', versjon: 1, eksportert: new Date().toISOString() };
  for (const navn of TABELLER) {
    const rader = await hentAlle(navn);
    if (navn === 'leveranser') {
      for (const l of rader) {
        l.filer = await Promise.all(l.filer.map(async (f) => ({ ...f, blob: undefined, dataUrl: await blobTilDataUrl(f.blob) })));
      }
    }
    ut[navn] = rader;
  }
  return ut;
}

export async function importer(data) {
  if (data?.app !== 'samok2') throw new Error('Dette ser ikke ut som en backup-fil fra denne appen.');
  for (const navn of TABELLER) {
    await tøm(navn);
    for (const rad of data[navn] || []) {
      if (navn === 'leveranser') {
        rad.filer = await Promise.all(rad.filer.map(async (f) => {
          const { dataUrl, ...resten } = f;
          return { ...resten, blob: await dataUrlTilBlob(dataUrl) };
        }));
      }
      await lagre(navn, rad);
    }
  }
}

export async function slettAlt() {
  for (const navn of TABELLER) await tøm(navn);
}
