// Ordlisten for hele faget. Vokser for hver side du leverer.

import { hentAlle, hent, lagre, slett, begrepNøkkel } from '../db.js';
import { TEMAER, temaNavn } from '../fag.js';
import { esc, html, lesHøytKnapp, melding, bekreft, skjemaDialog } from '../ui.js';

export async function vis(main) {
  const leveranser = await hentAlle('leveranser');
  const sideNavn = Object.fromEntries(leveranser.map((l) => [l.id, l.analyse.tittel]));
  let begreper = await hentAlle('begreper');

  main.innerHTML = `
    <div class="rad-mellom"><h1>Begreper</h1><a class="knapp" href="#/flashkort">🃏 Øv med flashkort</a></div>
    <div class="kort filterlinje">
      <input type="search" class="sok" placeholder="Søk etter begrep …">
      <select class="tema"><option value="">Alle temaer</option>${TEMAER.map((t) => `<option value="${t.id}">${esc(t.navn)}</option>`).join('')}</select>
      <button class="knapp lys liten ny" type="button">+ Legg til eget begrep</button>
    </div>
    <p class="dempet antall"></p>
    <div class="ordliste"></div>`;

  const liste = main.querySelector('.ordliste');
  const søk = main.querySelector('.sok');
  const tema = main.querySelector('.tema');

  function tegn() {
    const q = søk.value.trim().toLowerCase();
    const t = tema.value;
    const utvalg = begreper
      .filter((b) => !t || b.temaer.includes(t))
      .filter((b) => !q || b.begrep.toLowerCase().includes(q) || (b.forklaring || '').toLowerCase().includes(q))
      .sort((a, b) => a.begrep.localeCompare(b.begrep, 'nb'));
    main.querySelector('.antall').textContent = `${utvalg.length} av ${begreper.length} begreper`;
    liste.innerHTML = utvalg.length ? '' : '<div class="kort tom"><p>Ingen begreper ennå. De kommer automatisk når du leverer sider.</p></div>';
    let forrigeBokstav = '';
    for (const b of utvalg) {
      const bokstav = b.begrep[0].toUpperCase();
      if (bokstav !== forrigeBokstav) { liste.appendChild(html(`<h3 class="bokstav">${esc(bokstav)}</h3>`)); forrigeBokstav = bokstav; }
      const kort = html(`
        <article class="kort begrep">
          <div class="rad-mellom"><h3>${esc(b.begrep)}</h3><span class="verktoy"></span></div>
          <p>${esc(b.forklaring)}</p>
          ${b.eksempel ? `<p class="eksempel"><strong>Eksempel:</strong> ${esc(b.eksempel)}</p>` : ''}
          <div class="dempet liten-tekst">
            ${b.temaer.map((x) => esc(temaNavn(x))).join(' · ')}
            ${b.kilder.length ? ' · Fra: ' + b.kilder.map((k) => `<a href="#/side/${k}">${esc(sideNavn[k] || 'side')}</a>`).join(', ') : ''}
            · Flashkort-boks ${b.boks}/5
          </div>
        </article>`);
      const verktøy = kort.querySelector('.verktoy');
      verktøy.appendChild(lesHøytKnapp(() => `${b.begrep}. ${b.forklaring} ${b.eksempel ? 'Eksempel: ' + b.eksempel : ''}`, ''));
      const slettKnapp = html('<button class="knapp liten lys" type="button" title="Slett begrepet">🗑</button>');
      slettKnapp.addEventListener('click', async () => {
        if (!(await bekreft(`Slette «${b.begrep}» fra ordlisten?`, { ja: 'Slett', fare: true }))) return;
        await slett('begreper', b.nokkel);
        begreper = begreper.filter((x) => x.nokkel !== b.nokkel);
        tegn();
      });
      verktøy.appendChild(slettKnapp);
      liste.appendChild(kort);
    }
  }

  søk.addEventListener('input', tegn);
  tema.addEventListener('change', tegn);
  main.querySelector('.ny').addEventListener('click', async () => {
    const svar = await skjemaDialog('Legg til eget begrep', [
      { id: 'navn', navn: 'Begrep' },
      { id: 'forklaring', navn: 'Forklaring', flerlinje: true },
      { id: 'eksempel', navn: 'Eksempel (valgfritt)', flerlinje: true },
    ]);
    if (!svar?.navn) return;
    const { navn, forklaring, eksempel } = svar;
    const nokkel = begrepNøkkel(navn);
    if (await hent('begreper', nokkel)) { melding('Begrepet finnes allerede.'); return; }
    const nytt = { nokkel, begrep: navn.trim(), forklaring, eksempel, temaer: tema.value ? [tema.value] : [], kilder: [], boks: 1, sistØvd: null, lagt: Date.now(), egendefinert: true };
    await lagre('begreper', nytt);
    begreper.push(nytt);
    tegn();
  });
  tegn();
}
