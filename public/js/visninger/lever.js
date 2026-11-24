// Levere inn sider: velg bilder/PDF-er, send til Claude, lagre analysen.

import { post } from '../api.js';
import { lagre, nyId, leggTilBegreper } from '../db.js';
import { esc, html, laster, melding } from '../ui.js';

const MAKS_SIDE = 1800; // bilder skaleres ned til maks 1800 piksler på lengste side (raskere og billigere)

// Skalerer ned store mobilbilder og gjør dem om til JPEG.
async function forberedBilde(fil) {
  const bilde = await createImageBitmap(fil);
  const skala = Math.min(1, MAKS_SIDE / Math.max(bilde.width, bilde.height));
  if (skala === 1 && fil.size < 3_000_000 && ['image/jpeg', 'image/png'].includes(fil.type)) return fil;
  const lerret = document.createElement('canvas');
  lerret.width = Math.round(bilde.width * skala);
  lerret.height = Math.round(bilde.height * skala);
  const ctx = lerret.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, lerret.width, lerret.height);
  ctx.drawImage(bilde, 0, 0, lerret.width, lerret.height);
  return new Promise((resolve) => lerret.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
}

function tilBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function vis(main) {
  let valgte = []; // { navn, type, blob, url }

  main.innerHTML = `
    <h1>Lever sider</h1>
    <div class="kort">
      <p>Last opp bilder eller PDF-er av sider fra læreboka eller notatene dine. Du kan levere flere sider samlet, for eksempel et helt delkapittel.</p>
      <label class="slippsone" tabindex="0">
        <input type="file" accept="image/*,application/pdf" multiple hidden>
        <span class="slipp-ikon">📄</span>
        <strong>Klikk for å velge filer</strong>
        <span class="dempet">eller dra dem hit (JPG, PNG eller PDF)</span>
      </label>
      <div class="forhandsvisning"></div>
      <label class="felt">Kommentar (valgfritt)
        <input type="text" class="notat" maxlength="200" placeholder="F.eks. «Kapittel 4.2 – finanspolitikk»">
      </label>
      <button class="knapp analyser" type="button" disabled>✨ Analyser med Claude</button>
      <div class="status"></div>
    </div>`;

  const input = main.querySelector('input[type=file]');
  const sone = main.querySelector('.slippsone');
  const visning = main.querySelector('.forhandsvisning');
  const knapp = main.querySelector('.analyser');
  const statusBoks = main.querySelector('.status');

  function oppdater() {
    visning.innerHTML = '';
    valgte.forEach((f, i) => {
      const el = html(`
        <div class="miniatyr">
          ${f.type === 'application/pdf' ? '<div class="pdf-ikon">PDF</div>' : `<img src="${f.url}" alt="">`}
          <span>${esc(f.navn)}</span>
          <button type="button" class="fjern" title="Fjern">✕</button>
        </div>`);
      el.querySelector('.fjern').addEventListener('click', () => { URL.revokeObjectURL(f.url); valgte.splice(i, 1); oppdater(); });
      visning.appendChild(el);
    });
    knapp.disabled = valgte.length === 0;
  }

  async function leggTil(filer) {
    for (const fil of filer) {
      if (fil.type === 'application/pdf') {
        if (fil.size > 25_000_000) { melding(`${fil.name} er for stor (maks 25 MB).`, 'feil'); continue; }
        valgte.push({ navn: fil.name, type: fil.type, blob: fil, url: URL.createObjectURL(fil) });
      } else if (fil.type.startsWith('image/')) {
        try {
          const blob = await forberedBilde(fil);
          valgte.push({ navn: fil.name, type: blob.type, blob, url: URL.createObjectURL(blob) });
        } catch {
          melding(`Klarte ikke å lese bildet ${fil.name}. Prøv JPG eller PNG.`, 'feil');
        }
      } else {
        melding(`${fil.name}: Bare bilder og PDF støttes.`, 'feil');
      }
    }
    oppdater();
  }

  input.addEventListener('change', () => { leggTil([...input.files]); input.value = ''; });
  sone.addEventListener('dragover', (e) => { e.preventDefault(); sone.classList.add('over'); });
  sone.addEventListener('dragleave', () => sone.classList.remove('over'));
  sone.addEventListener('drop', (e) => { e.preventDefault(); sone.classList.remove('over'); leggTil([...e.dataTransfer.files]); });
  sone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });

  knapp.addEventListener('click', async () => {
    knapp.disabled = true;
    statusBoks.innerHTML = laster('Claude leser sidene … Dette tar vanligvis 20–90 sekunder.');
    try {
      const filer = await Promise.all(valgte.map(async (f) => ({ type: f.type, data: await tilBase64(f.blob) })));
      const notat = main.querySelector('.notat').value.trim();
      const { analyse } = await post('/api/analyser', { filer, notat });
      if (!analyse.lesbar) melding('Claude hadde problemer med å lese sidene. Prøv gjerne et skarpere bilde.', 'feil');
      const id = nyId();
      await lagre('leveranser', {
        id,
        dato: Date.now(),
        notat,
        filer: valgte.map((f) => ({ navn: f.navn, type: f.type, blob: f.blob })),
        analyse,
      });
      const nye = await leggTilBegreper(analyse.begreper, id);
      melding(`Ferdig! ${nye} nye begreper lagt til i ordlisten.`, 'ok');
      location.hash = `#/side/${id}`;
    } catch (e) {
      statusBoks.innerHTML = `<p class="feiltekst">${esc(e.message)}</p>`;
      knapp.disabled = false;
    }
  });
}
