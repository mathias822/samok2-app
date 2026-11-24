// Flashkort med «bokser» (Leitner-metoden):
// Alle begreper starter i boks 1. «Kunne det» flytter kortet én boks opp, «Øv mer» sender det tilbake til boks 1.
// Kort i lave bokser kommer oftere.

import { hentAlle, lagre } from '../db.js';
import { TEMAER } from '../fag.js';
import { esc, lesHøytKnapp, naviger } from '../ui.js';

const ØKT_STØRRELSE = 15;

function lagØkt(begreper) {
  // Vekt: boks 1 = 16, boks 2 = 8, ... boks 5 = 1. Tilfeldig trekking uten tilbakelegging.
  const pott = begreper.map((b) => ({ b, vekt: Math.pow(2, 5 - b.boks) * (0.5 + Math.random()) }));
  pott.sort((a, b) => b.vekt - a.vekt);
  return pott.slice(0, ØKT_STØRRELSE).map((x) => x.b).sort(() => Math.random() - 0.5);
}

export async function vis(main, deler, query) {
  const alle = await hentAlle('begreper');
  const temaFilter = query.tema || '';
  const utvalg = temaFilter ? alle.filter((b) => b.temaer.includes(temaFilter)) : alle;

  main.innerHTML = `
    <div class="rad-mellom">
      <h1>Flashkort</h1>
      <select class="tema"><option value="">Alle temaer</option>${TEMAER.map((t) => `<option value="${t.id}" ${t.id === temaFilter ? 'selected' : ''}>${esc(t.navn)}</option>`).join('')}</select>
    </div>
    <div class="bokser">${[1, 2, 3, 4, 5].map((n) => `<div><strong>${utvalg.filter((b) => b.boks === n).length}</strong><span>Boks ${n}</span></div>`).join('')}</div>
    <div class="flashflate"></div>`;

  main.querySelector('.tema').addEventListener('change', (e) => { naviger(`/flashkort${e.target.value ? '?tema=' + e.target.value : ''}`); });

  const flate = main.querySelector('.flashflate');
  if (!utvalg.length) {
    flate.innerHTML = '<div class="kort tom"><p>Ingen begreper å øve på ennå. Lever en side først!</p><a class="knapp" href="#/lever">Lever side</a></div>';
    return;
  }

  const økt = lagØkt(utvalg);
  let i = 0, kunne = 0;

  function visKort() {
    if (i >= økt.length) {
      flate.innerHTML = `<div class="kort tom"><h2>Ferdig! 🎉</h2><p>Du kunne ${kunne} av ${økt.length} kort.</p><button class="knapp igjen" type="button">Ny runde</button></div>`;
      flate.querySelector('.igjen').addEventListener('click', () => vis(main, deler, query));
      return;
    }
    const b = økt[i];
    flate.innerHTML = `
      <p class="dempet midt">Kort ${i + 1} av ${økt.length}</p>
      <div class="flashkort" tabindex="0" title="Klikk for å snu">
        <div class="forside"><h2>${esc(b.begrep)}</h2><p class="dempet">Hva betyr dette? Tenk deg om, og klikk for å snu kortet.</p></div>
        <div class="bakside" hidden><h3>${esc(b.begrep)}</h3><p>${esc(b.forklaring)}</p>${b.eksempel ? `<p class="eksempel"><strong>Eksempel:</strong> ${esc(b.eksempel)}</p>` : ''}<span class="les"></span></div>
      </div>
      <div class="flash-knapper" hidden>
        <button class="knapp fare ov" type="button">😕 Øv mer</button>
        <button class="knapp ok kunne" type="button">😊 Kunne det</button>
      </div>`;
    const kort = flate.querySelector('.flashkort');
    const snu = () => {
      kort.querySelector('.forside').hidden = true;
      kort.querySelector('.bakside').hidden = false;
      flate.querySelector('.flash-knapper').hidden = false;
    };
    kort.addEventListener('click', snu);
    kort.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); snu(); } });
    kort.querySelector('.les').appendChild(lesHøytKnapp(() => `${b.begrep}. ${b.forklaring}`));
    kort.querySelector('.les').addEventListener('click', (e) => e.stopPropagation());
    const svar = async (kunneDet) => {
      b.boks = kunneDet ? Math.min(5, b.boks + 1) : 1;
      b.sistØvd = Date.now();
      if (kunneDet) kunne++;
      await lagre('begreper', b);
      i++;
      visKort();
    };
    flate.querySelector('.kunne').addEventListener('click', () => svar(true));
    flate.querySelector('.ov').addEventListener('click', () => svar(false));
    kort.focus();
  }
  visKort();
}
