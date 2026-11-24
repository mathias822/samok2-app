// Startsiden: oversikt over faget, temaene og alt du har levert.

import { hentAlle } from '../db.js';
import { TEMAER, temaNavn } from '../fag.js';
import { esc, temaChips, dato } from '../ui.js';

export async function vis(main, deler, query) {
  const [leveranser, begreper, sett] = await Promise.all([hentAlle('leveranser'), hentAlle('begreper'), hentAlle('oppgavesett')]);
  leveranser.sort((a, b) => b.dato - a.dato);

  let besvart = 0, riktige = 0;
  for (const s of sett) for (const o of s.oppgaver) {
    if (o.resultat && typeof o.resultat.riktig === 'boolean') { besvart++; if (o.resultat.riktig) riktige++; }
  }

  const valgtTema = query.tema;
  const telling = {};
  for (const l of leveranser) for (const t of l.analyse.temaer || []) telling[t] = (telling[t] || 0) + 1;
  const liste = valgtTema ? leveranser.filter((l) => (l.analyse.temaer || []).includes(valgtTema)) : leveranser;

  main.innerHTML = `
    <h1>Samfunnsøkonomi 2</h1>
    <div class="statistikk">
      <div class="stat"><strong>${leveranser.length}</strong><span>leverte sider</span></div>
      <div class="stat"><strong>${begreper.length}</strong><span>begreper i ordlisten</span></div>
      <div class="stat"><strong>${besvart}</strong><span>oppgaver rettet</span></div>
      <div class="stat"><strong>${besvart ? Math.round((riktige / besvart) * 100) + ' %' : '–'}</strong><span>riktige svar</span></div>
    </div>

    ${leveranser.length === 0 ? `
      <div class="kort tom">
        <h2>Velkommen! 👋</h2>
        <p>Start med å levere inn en side fra læreboka eller notatene dine. Du kan bruke et bilde eller en PDF.</p>
        <p>Claude lager et sammendrag og finner temaer og begreper. Appen lager interaktive grafer og oppgaver du kan øve på.</p>
        <a class="knapp" href="#/lever">📄 Lever din første side</a>
      </div>` : ''}

    <section class="kort">
      <h2>Temaer i faget</h2>
      <p class="dempet">Trykk på et tema for å se sidene du har levert om det.</p>
      <div class="temanett">
        ${TEMAER.map((t) => `
          <a class="tema ${telling[t.id] ? 'har' : ''} ${valgtTema === t.id ? 'valgt' : ''}" href="#/oversikt?tema=${t.id}">
            <span>${esc(t.navn)}</span><small>${telling[t.id] || 0} sider</small>
          </a>`).join('')}
      </div>
    </section>

    ${leveranser.length ? `
    <section class="kort">
      <div class="rad-mellom">
        <h2>${valgtTema ? `Sider om «${esc(temaNavn(valgtTema))}»` : 'Alle leverte sider'}</h2>
        ${valgtTema ? '<a class="knapp liten lys" href="#/oversikt">Vis alle</a>' : '<a class="knapp liten" href="#/lever">+ Lever ny side</a>'}
      </div>
      ${liste.length === 0 ? '<p class="dempet">Ingen sider om dette temaet ennå.</p>' : `
      <ul class="leveranseliste">
        ${liste.map((l) => `
          <li>
            <a href="#/side/${l.id}">
              <strong>${esc(l.analyse.tittel)}</strong>
              <span class="dempet">${dato(l.dato)} · ${l.filer.length} fil${l.filer.length === 1 ? '' : 'er'}${l.notat ? ' · ' + esc(l.notat) : ''}</span>
            </a>
            <div>${temaChips(l.analyse.temaer)}</div>
          </li>`).join('')}
      </ul>`}
    </section>` : ''}
  `;
}
