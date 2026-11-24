// Hovedfilen i nettleseren: bestemmer hvilken side som vises (ut fra adressen etter #),
// og styrer høytlesningslinjen nederst.

import { tale } from './tale.js';
import { status } from './api.js';
import { esc } from './ui.js';
import * as oversikt from './visninger/oversikt.js';
import * as lever from './visninger/lever.js';
import * as side from './visninger/side.js';
import * as grafer from './visninger/grafer.js';
import * as oppgaver from './visninger/oppgaver.js';
import * as begreper from './visninger/begreper.js';
import * as flashkort from './visninger/flashkort.js';
import * as innstillinger from './visninger/innstillinger.js';

const RUTER = { oversikt, lever, side, grafer, oppgaver, begreper, flashkort, innstillinger };

const main = document.getElementById('innhold');

async function visRute() {
  const [sti, spørring = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [navn = 'oversikt', ...deler] = sti.split('/').filter(Boolean);
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
    main.innerHTML = `<div class="kort"><h2>Noe gikk galt</h2><p class="feiltekst">${esc(e.message)}</p></div>`;
  }
}

window.addEventListener('hashchange', visRute);

// ---------- Høytlesningslinje ----------
const linje = document.getElementById('talelinje');
const pauseKnapp = document.getElementById('tale-pause');
const hastighet = document.getElementById('tale-hastighet');
const hastighetVerdi = document.getElementById('tale-hastighet-verdi');

function lagreTaleInnstillinger() {
  try { localStorage.setItem('tale', JSON.stringify({ hastighet: tale.hastighet, stemme: tale.stemmeNavn })); } catch { /* ignorer */ }
}
try {
  const lagret = JSON.parse(localStorage.getItem('tale') || '{}');
  if (lagret.hastighet) tale.hastighet = lagret.hastighet;
  if (lagret.stemme) tale.stemmeNavn = lagret.stemme;
} catch { /* ignorer */ }
hastighet.value = tale.hastighet;
hastighetVerdi.textContent = `${tale.hastighet.toLocaleString('nb-NO', { minimumFractionDigits: 1 })}×`;

tale.vedEndring = () => {
  linje.hidden = tale.status === 'stoppet';
  pauseKnapp.textContent = tale.status === 'pause' ? '▶ Fortsett' : '⏸ Pause';
};
pauseKnapp.addEventListener('click', () => (tale.status === 'pause' ? tale.fortsett() : tale.pause()));
document.getElementById('tale-stopp').addEventListener('click', () => tale.stopp());
hastighet.addEventListener('input', () => {
  const h = Number(hastighet.value);
  hastighetVerdi.textContent = `${h.toLocaleString('nb-NO', { minimumFractionDigits: 1 })}×`;
  tale.settHastighet(h);
  lagreTaleInnstillinger();
});
export { lagreTaleInnstillinger };

// ---------- Start ----------
status().then((s) => { document.getElementById('demo-banner').hidden = !s.demo; });
if (!location.hash) location.hash = '#/oversikt';
else visRute();
