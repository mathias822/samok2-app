// Grafbibliotek: utforsk alle modellene fritt, og se grafene fra sidene du har levert.

import { MALER } from '../grafmaler.js';
import { hentAlle } from '../db.js';
import { esc } from '../ui.js';
import { visGraf } from '../grafvisning.js';

export async function vis(main, deler, query) {
  const leveranser = (await hentAlle('leveranser')).sort((a, b) => b.dato - a.dato);
  const fraSider = [];
  for (const l of leveranser) (l.analyse.grafer || []).forEach((g, i) => fraSider.push({ nøkkel: `${l.id}:${i}`, graf: g, side: l }));

  const valgt = query.vis || Object.keys(MALER)[0];

  main.innerHTML = `
    <h1>Grafer</h1>
    <div class="graf-oppsett">
      <aside class="kort grafmeny">
        <h3>Modeller</h3>
        <ul>${Object.values(MALER).map((m) => `<li><a class="${valgt === m.id ? 'aktiv' : ''}" href="#/grafer?vis=${m.id}">${esc(m.navn)}</a></li>`).join('')}</ul>
        ${fraSider.length ? `<h3>Fra sidene dine</h3>
        <ul>${fraSider.map((g) => `<li><a class="${valgt === g.nøkkel ? 'aktiv' : ''}" href="#/grafer?vis=${encodeURIComponent(g.nøkkel)}">${esc(g.graf.tittel)}<small>${esc(g.side.analyse.tittel)}</small></a></li>`).join('')}</ul>` : ''}
      </aside>
      <section class="kort graf-flate"></section>
    </div>`;

  const flate = main.querySelector('.graf-flate');
  if (MALER[valgt]) {
    const m = MALER[valgt];
    flate.innerHTML = `<p class="dempet">${esc(m.beskrivelse)}</p>`;
    visGraf(flate, { mal: m.id, tittel: m.navn, startverdier: [] });
  } else {
    const g = fraSider.find((x) => x.nøkkel === valgt);
    if (g) {
      flate.innerHTML = `<p class="dempet">Fra siden <a href="#/side/${g.side.id}">${esc(g.side.analyse.tittel)}</a></p>`;
      visGraf(flate, g.graf);
    } else flate.innerHTML = '<p>Fant ikke grafen.</p>';
  }
}
