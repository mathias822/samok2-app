// Viser én levert side: filene, sammendrag, hovedpoenger, begreper og grafer.

import { hent, slett, fjernKildeFraBegreper } from '../db.js';
import { esc, html, lesHøytKnapp, temaChips, dato, melding, naviger, bekreft } from '../ui.js';
import { visGraf } from '../grafvisning.js';

export async function vis(main, [id]) {
  const l = await hent('leveranser', id);
  if (!l) { main.innerHTML = '<div class="kort"><p>Fant ikke denne siden.</p><a href="#/oversikt">Tilbake</a></div>'; return; }
  const a = l.analyse;

  main.innerHTML = `
    <a class="tilbake" href="#/oversikt">← Oversikt</a>
    <h1>${esc(a.tittel)}</h1>
    <p class="dempet">${dato(l.dato)}${l.notat ? ' · ' + esc(l.notat) : ''}</p>
    <div class="chips">${temaChips(a.temaer)}</div>

    <div class="to-kolonner">
      <section class="kort">
        <div class="rad-mellom"><h2>Sammendrag</h2><span class="les-sammendrag"></span></div>
        <p class="sammendrag">${esc(a.sammendrag)}</p>
        <div class="rad-mellom"><h2>Hovedpoenger</h2><span class="les-poeng"></span></div>
        <ul class="poeng">${a.hovedpoenger.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </section>
      <section class="kort filer">
        <h2>Filer</h2>
        <div class="fil-liste"></div>
      </section>
    </div>

    ${a.grafer?.length ? '<section class="kort"><h2>Interaktive grafer</h2><p class="dempet">Flytt glidebryterne og se hva som skjer med likevekten.</p><div class="grafer"></div></section>' : ''}

    <section class="kort">
      <div class="rad-mellom"><h2>Begreper fra denne siden</h2><a class="knapp liten lys" href="#/begreper">Hele ordlisten →</a></div>
      <dl class="begrepliste">
        ${a.begreper.map((b) => `<div><dt>${esc(b.begrep)}</dt><dd>${esc(b.forklaring)}${b.eksempel ? `<br><em>Eksempel: ${esc(b.eksempel)}</em>` : ''}</dd></div>`).join('')}
      </dl>
    </section>

    <div class="handlinger">
      <a class="knapp" href="#/oppgaver?kilde=${l.id}">✏️ Lag oppgaver fra denne siden</a>
      <button class="knapp fare slett" type="button">🗑 Slett siden</button>
    </div>`;

  main.querySelector('.les-sammendrag').appendChild(lesHøytKnapp(() => `${a.tittel}. ${a.sammendrag}`));
  main.querySelector('.les-poeng').appendChild(lesHøytKnapp(() => a.hovedpoenger.join(' ')));

  const filListe = main.querySelector('.fil-liste');
  if (!l.filer.some((f) => f.blob)) filListe.innerHTML = '<p class="dempet">Ingen filer lagret.</p>';
  for (const f of l.filer.filter((x) => x.blob)) {
    const url = URL.createObjectURL(f.blob);
    filListe.appendChild(html(f.type === 'application/pdf'
      ? `<a class="fil-pdf" href="${url}" target="_blank" rel="noopener">📄 ${esc(f.navn)}</a>`
      : `<a href="${url}" target="_blank" rel="noopener" title="Åpne i full størrelse"><img src="${url}" alt="${esc(f.navn)}"></a>`));
  }

  const grafBeholder = main.querySelector('.grafer');
  for (const g of a.grafer || []) visGraf(grafBeholder, g);

  main.querySelector('.slett').addEventListener('click', async () => {
    if (!(await bekreft('Vil du slette denne siden? Begreper som bare kommer fra denne siden, slettes også.', { ja: 'Slett', fare: true }))) return;
    await slett('leveranser', l.id);
    await fjernKildeFraBegreper(l.id);
    melding('Siden er slettet.');
    naviger('/oversikt');
  });
}
