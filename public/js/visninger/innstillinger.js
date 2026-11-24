// Innstillinger: stemme for høytlesning, backup og sletting.

import { eksporter, importer, slettAlt } from '../db.js';
import { status } from '../api.js';
import { tale } from '../tale.js';
import { esc, melding, naviger, bekreft } from '../ui.js';

export async function vis(main) {
  const s = await status();

  main.innerHTML = `
    <h1>Innstillinger</h1>

    <section class="kort">
      <h2>Høytlesning</h2>
      <p class="dempet">Talemotor: ${esc(tale.navn)}. Microsoft Edge har ofte de mest naturlige norske stemmene (f.eks. «Pernille» eller «Finn»).</p>
      <label class="felt">Stemme <select class="stemme"></select></label>
      <button class="knapp lys test" type="button">🔊 Test stemmen</button>
    </section>

    ${s.artifact ? `
    <section class="kort">
      <h2>Lagring</h2>
      <p>${s.lagring === 'claude'
        ? 'Sidene, begrepene og oppgavene dine lagres privat på claude.ai-kontoen din. Bare du kan se dem, og de følger deg på alle enheter der du er logget inn.'
        : 'Dataene lagres bare i denne nettleseren, fordi sidens database ikke var tilgjengelig. De kan forsvinne hvis du tømmer nettleserdata.'}</p>
    </section>` : `
    <section class="kort">
      <h2>Backup</h2>
      <p>Alt du har levert og øvd på, lagres i denne nettleseren på denne PC-en. Ta backup jevnlig, særlig før du tømmer nettleserdata eller bytter PC eller nettleser.</p>
      <div class="handlinger">
        <button class="knapp eksporter" type="button">⬇ Last ned backup</button>
        <label class="knapp lys">⬆ Gjenopprett fra backup<input type="file" accept=".json,application/json" hidden class="importer"></label>
      </div>
    </section>`}

    <section class="kort">
      <h2>Om appen</h2>
      <p>${s.artifact ? 'Appen bruker Claude via innloggingen din på claude.ai. Bruken teller mot Claude-abonnementet ditt.' : s.frakoblet ? 'Får ikke kontakt med serveren.' : s.demo ? 'Kjører i <strong>demo-modus</strong> (ingen API-nøkkel).' : `Bruker Claude-modellen <code>${esc(s.modell)}</code>. Du kan endre modellen i filen <code>.env</code>.`}</p>
    </section>

    <section class="kort">
      <h2>Slett alt</h2>
      <p class="dempet">Sletter alle sider, begreper og oppgaver fra denne nettleseren. Dette kan ikke angres.</p>
      <button class="knapp fare slett" type="button">Slett alle data</button>
    </section>`;

  const velg = main.querySelector('.stemme');
  function fyllStemmer() {
    const stemmer = tale.støttes() ? tale.stemmer() : [];
    const valgt = tale.velgStemme?.();
    velg.innerHTML = stemmer.length
      ? stemmer.map((v) => `<option value="${esc(v.name)}" ${valgt?.name === v.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')
      : '<option>Fant ingen norske stemmer – standardstemmen brukes</option>';
  }
  fyllStemmer();
  if (tale.støttes()) speechSynthesis.addEventListener('voiceschanged', fyllStemmer);
  velg.addEventListener('change', () => {
    tale.settStemme(velg.value);
    try { localStorage.setItem('tale', JSON.stringify({ hastighet: tale.hastighet, stemme: velg.value })); } catch { /* ignorer */ }
  });
  main.querySelector('.test').addEventListener('click', () => tale.les('Hei! Når samlet etterspørsel øker, øker produksjonen, og arbeidsledigheten går ned.'));

  main.querySelector('.eksporter')?.addEventListener('click', async () => {
    const data = await eksporter();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `samok2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    melding('Backup lastet ned.', 'ok');
  });

  main.querySelector('.importer')?.addEventListener('change', async (e) => {
    const fil = e.target.files[0];
    if (!fil) return;
    if (!(await bekreft('Gjenoppretting erstatter alt som ligger i appen nå. Fortsette?', { ja: 'Gjenopprett' }))) return;
    try {
      await importer(JSON.parse(await fil.text()));
      melding('Backup gjenopprettet!', 'ok');
      naviger('/oversikt');
    } catch (err) {
      melding(`Kunne ikke gjenopprette: ${err.message}`, 'feil');
    }
  });

  main.querySelector('.slett').addEventListener('click', async () => {
    if (!(await bekreft('Er du helt sikker på at du vil slette alle sider, begreper og oppgaver?', { ja: 'Slett alt', fare: true }))) return;
    await slettAlt();
    melding('Alle data er slettet.');
    naviger('/oversikt');
  });
}
