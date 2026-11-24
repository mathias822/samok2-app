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
