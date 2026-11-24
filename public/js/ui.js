// Små hjelpefunksjoner for å lage HTML trygt og likt over hele appen.

import { tale } from './tale.js';
import { temaNavn } from './fag.js';

// Gjør tekst trygg å sette inn i HTML (hindrer at tegn som < og > tolkes som kode).
export function esc(tekst) {
  return String(tekst ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Lager et HTML-element fra en tekststreng.
export function html(streng) {
  const t = document.createElement('template');
  t.innerHTML = streng.trim();
  return t.content.firstElementChild;
}

export function lesHøytKnapp(hentTekst, etikett = 'Les høyt') {
  const knapp = html(`<button class="knapp liten lys" type="button" title="Les teksten høyt">🔊 ${esc(etikett)}</button>`);
  knapp.addEventListener('click', () => tale.les(typeof hentTekst === 'function' ? hentTekst() : hentTekst));
  return knapp;
}

export function temaChips(temaer = []) {
  return temaer.map((t) => `<a class="chip" href="#/oversikt?tema=${encodeURIComponent(t)}">${esc(temaNavn(t))}</a>`).join(' ');
}

export function dato(ms) {
  return new Date(ms).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function melding(tekst, type = 'info') {
  const boks = html(`<div class="melding ${type}">${esc(tekst)}</div>`);
  document.body.appendChild(boks);
  setTimeout(() => boks.classList.add('vis'), 10);
  setTimeout(() => { boks.classList.remove('vis'); setTimeout(() => boks.remove(), 400); }, 4000);
}

export function laster(tekst) {
  return `<div class="laster"><div class="spinner"></div><p>${esc(tekst)}</p></div>`;
}

// ---------- Navigasjon ----------
// Lokalt bytter vi side via adressen (#/side/...). Nettsideversjonen på claude.ai styrer det selv.
let navigator = (sti) => { location.hash = '#' + sti; };
export function settNavigator(fn) { navigator = fn; }
export function naviger(sti) { navigator(sti); }

// ---------- Dialoger (erstatter confirm/prompt, som ikke virker overalt) ----------
function dialog(innhold, knapper) {
  return new Promise((resolve) => {
    const bakgrunn = html(`<div class="dialog-bakgrunn"><div class="dialog" role="dialog" aria-modal="true">${innhold}<div class="dialog-knapper"></div></div></div>`);
    const rad = bakgrunn.querySelector('.dialog-knapper');
    const lukk = (verdi) => { bakgrunn.remove(); document.removeEventListener('keydown', escTast); resolve(verdi); };
    const escTast = (e) => { if (e.key === 'Escape') lukk(null); };
    for (const k of knapper) {
      const b = html(`<button type="button" class="knapp ${k.klasse || ''}">${k.tekst}</button>`);
      b.addEventListener('click', () => lukk(k.verdi(bakgrunn)));
      rad.appendChild(b);
    }
    bakgrunn.addEventListener('click', (e) => { if (e.target === bakgrunn) lukk(null); });
    document.addEventListener('keydown', escTast);
    document.body.appendChild(bakgrunn);
    (bakgrunn.querySelector('input, textarea') || rad.lastElementChild).focus();
  });
}

export async function bekreft(tekst, { ja = 'Ja', fare = false } = {}) {
  const svar = await dialog(`<p>${esc(tekst)}</p>`, [
    { tekst: 'Avbryt', klasse: 'lys', verdi: () => false },
    { tekst: esc(ja), klasse: fare ? 'fare-fylt' : '', verdi: () => true },
  ]);
  return svar === true;
}

// felter: [{ id, navn, flerlinje }] → { id: verdi } eller null
export async function skjemaDialog(tittel, felter, okTekst = 'Lagre') {
  const innhold = `<h3>${esc(tittel)}</h3>` + felter.map((f) => `<label class="felt">${esc(f.navn)}${f.flerlinje
    ? `<textarea data-id="${f.id}" rows="3"></textarea>` : `<input type="text" data-id="${f.id}">`}</label>`).join('');
  return dialog(innhold, [
    { tekst: 'Avbryt', klasse: 'lys', verdi: () => null },
    { tekst: esc(okTekst), verdi: (el) => Object.fromEntries([...el.querySelectorAll('[data-id]')].map((i) => [i.dataset.id, i.value.trim()])) },
  ]);
}
