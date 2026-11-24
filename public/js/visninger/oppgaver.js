// Oppgaver: lag oppgavesett fra sidene dine, svar, og få tilbakemelding.

import { hentAlle, hent, lagre, slett, nyId } from '../db.js';
import { post } from '../api.js';
import { TEMAER, temaNavn } from '../fag.js';
import { esc, html, laster, lesHøytKnapp, dato, melding } from '../ui.js';
import { visGraf } from '../grafvisning.js';
import { fmt } from '../grafmaler.js';

const TYPE_NAVN = { flervalg: 'Flervalg', regning: 'Regneoppgave', drofting: 'Drøftingsoppgave', graf: 'Grafoppgave' };

export async function vis(main, [settId], query) {
  if (settId) return visSett(main, settId);
  return visOversikt(main, query);
}

// ---------- Oversikt + lag nye ----------

function lagKontekst(leveranser) {
  return leveranser.map((l, i) => {
    const a = l.analyse;
    return `### Side ${i + 1}: ${a.tittel}
Temaer: ${(a.temaer || []).map(temaNavn).join(', ')}
Sammendrag: ${a.sammendrag}
Hovedpoenger:
${a.hovedpoenger.map((p) => `- ${p}`).join('\n')}
Begreper:
${a.begreper.map((b) => `- ${b.begrep}: ${b.forklaring}`).join('\n')}`;
  }).join('\n\n');
}

async function visOversikt(main, query) {
  const leveranser = (await hentAlle('leveranser')).sort((a, b) => b.dato - a.dato);
  const sett = (await hentAlle('oppgavesett')).sort((a, b) => b.dato - a.dato);

  if (!leveranser.length) {
    main.innerHTML = `<h1>Oppgaver</h1><div class="kort tom"><p>Du må levere minst én side før du kan lage oppgaver.</p><a class="knapp" href="#/lever">Lever en side</a></div>`;
    return;
  }

  const forhåndsvalgt = query.kilde ? [query.kilde] : leveranser.slice(0, 1).map((l) => l.id);
  const brukteTemaer = TEMAER.filter((t) => leveranser.some((l) => (l.analyse.temaer || []).includes(t.id)));

  main.innerHTML = `
    <h1>Oppgaver</h1>
    <section class="kort">
      <h2>Lag nye oppgaver</h2>
      <div class="to-kolonner">
        <div>
          <h3>1. Hvilke sider?</h3>
          <label class="felt">Velg alle sider om et tema:
            <select class="velg-tema"><option value="">– velg tema –</option>${brukteTemaer.map((t) => `<option value="${t.id}">${esc(t.navn)}</option>`).join('')}<option value="*">Alle sider</option></select>
          </label>
          <div class="sidevalg">
            ${leveranser.map((l) => `<label class="avkryss"><input type="checkbox" value="${l.id}" ${forhåndsvalgt.includes(l.id) ? 'checked' : ''}> ${esc(l.analyse.tittel)}</label>`).join('')}
          </div>
        </div>
        <div>
          <h3>2. Hvor mange?</h3>
          <div class="antall">
            <label>Flervalg <input type="number" data-type="flervalg" min="0" max="10" value="4"></label>
            <label>Regneoppgaver <input type="number" data-type="regning" min="0" max="10" value="2"></label>
            <label>Drøfting <input type="number" data-type="drofting" min="0" max="5" value="1"></label>
            <label>Grafoppgaver <input type="number" data-type="graf" min="0" max="10" value="2"></label>
          </div>
          <label class="felt">Nivå
            <select class="niva">
              <option value="lett – grunnleggende forståelse">Lett</option>
              <option value="middels – vanlig prøvenivå" selected>Middels</option>
              <option value="eksamensnivå – som eksamen i Samfunnsøkonomi 2">Eksamensnivå</option>
            </select>
          </label>
          <button class="knapp lag" type="button">✨ Lag oppgaver</button>
        </div>
      </div>
      <div class="status"></div>
    </section>

    <section class="kort">
      <h2>Tidligere oppgavesett</h2>
      ${sett.length === 0 ? '<p class="dempet">Ingen ennå.</p>' : `
      <ul class="leveranseliste">
        ${sett.map((s) => {
          const rettet = s.oppgaver.filter((o) => typeof o.resultat?.riktig === 'boolean');
          const riktige = rettet.filter((o) => o.resultat.riktig).length;
          const besvart = s.oppgaver.filter((o) => o.resultat).length;
          return `<li><a href="#/oppgaver/${s.id}"><strong>${esc(s.tittel)}</strong>
            <span class="dempet">${dato(s.dato)} · ${besvart}/${s.oppgaver.length} besvart${rettet.length ? ` · ${riktige}/${rettet.length} riktige` : ''}</span></a></li>`;
        }).join('')}
      </ul>`}
    </section>`;

  main.querySelector('.velg-tema').addEventListener('change', (e) => {
    const t = e.target.value;
    if (!t) return;
    main.querySelectorAll('.sidevalg input').forEach((cb) => {
      const l = leveranser.find((x) => x.id === cb.value);
      cb.checked = t === '*' || (l.analyse.temaer || []).includes(t);
    });
  });

  main.querySelector('.lag').addEventListener('click', async (e) => {
    const valgte = [...main.querySelectorAll('.sidevalg input:checked')].map((cb) => leveranser.find((l) => l.id === cb.value));
    if (!valgte.length) { melding('Velg minst én side.', 'feil'); return; }
    const antall = {};
    main.querySelectorAll('.antall input').forEach((i) => { antall[i.dataset.type] = Number(i.value) || 0; });
    const status = main.querySelector('.status');
    e.target.disabled = true;
    status.innerHTML = laster('Claude lager oppgaver … Dette tar vanligvis 30–90 sekunder.');
    try {
      const svar = await post('/api/oppgaver', { kontekst: lagKontekst(valgte), antall, nivå: main.querySelector('.niva').value });
      const id = nyId();
      await lagre('oppgavesett', {
        id,
        dato: Date.now(),
        tittel: valgte.length === 1 ? valgte[0].analyse.tittel : `${valgte.length} sider: ${valgte.map((v) => v.analyse.tittel).join(', ').slice(0, 80)}`,
        kilder: valgte.map((v) => v.id),
        oppgaver: svar.oppgaver.map((o) => ({ ...o, id: nyId(), resultat: null })),
      });
      location.hash = `#/oppgaver/${id}`;
    } catch (err) {
      status.innerHTML = `<p class="feiltekst">${esc(err.message)}</p>`;
      e.target.disabled = false;
    }
  });
}

// ---------- Et oppgavesett ----------

function tolkTall(tekst) {
  const renset = String(tekst).replace(/\s/g, '').replace(/[^\d,.\-−]/g, '').replace('−', '-').replace(',', '.');
  const n = parseFloat(renset);
  return isFinite(n) ? n : null;
}

async function visSett(main, settId) {
  const sett = await hent('oppgavesett', settId);
  if (!sett) { main.innerHTML = '<div class="kort"><p>Fant ikke oppgavesettet.</p></div>'; return; }

  main.innerHTML = `
    <a class="tilbake" href="#/oppgaver">← Alle oppgaver</a>
    <h1>${esc(sett.tittel)}</h1>
    <p class="poengsum"></p>
    <div class="oppgaveliste"></div>
    <div class="handlinger"><button class="knapp fare slett" type="button">🗑 Slett oppgavesettet</button></div>`;

  const liste = main.querySelector('.oppgaveliste');
  const lagreSett = () => lagre('oppgavesett', sett);

  function oppdaterPoeng() {
    const rettet = sett.oppgaver.filter((o) => typeof o.resultat?.riktig === 'boolean');
    const riktige = rettet.filter((o) => o.resultat.riktig).length;
    main.querySelector('.poengsum').textContent =
      `${sett.oppgaver.filter((o) => o.resultat).length} av ${sett.oppgaver.length} besvart` +
      (rettet.length ? ` · ${riktige} av ${rettet.length} automatisk rettede er riktige` : '');
  }

  sett.oppgaver.forEach((o, i) => {
    const kort = html(`
      <section class="kort oppgave">
        <div class="rad-mellom">
          <span class="merke">${i + 1}. ${TYPE_NAVN[o.type]} · ${esc(temaNavn(o.tema))}</span>
          <span class="les"></span>
        </div>
        <p class="sporsmal">${esc(o.sporsmal)}</p>
        <div class="svarflate"></div>
        <div class="tilbakemelding"></div>
      </section>`);
    kort.querySelector('.les').appendChild(lesHøytKnapp(() => o.sporsmal + (o.type === 'flervalg' ? ' Alternativene er: ' + o.alternativer.join('. ') : '')));
    liste.appendChild(kort);
    tegnOppgave(o, kort);
  });
  oppdaterPoeng();

  function visLøsning(o, boks, ekstra = '') {
    boks.innerHTML = `${ekstra}<details class="losning" ${o.resultat?.riktig === false ? 'open' : ''}><summary>Løsningsforslag og forklaring</summary><p>${esc(o.losningsforslag)}</p></details>
      <button class="knapp liten lys igjen" type="button">↺ Prøv igjen</button>`;
    boks.querySelector('summary').appendChild(lesHøytKnapp(() => o.losningsforslag));
    boks.querySelector('.igjen').addEventListener('click', async () => {
      o.resultat = null;
      await lagreSett();
      const kort = boks.closest('.oppgave');
      kort.querySelector('.svarflate').innerHTML = '';
      boks.innerHTML = '';
      tegnOppgave(o, kort);
      oppdaterPoeng();
    });
  }

  function dom(riktig, tekst) {
    return `<p class="dom ${riktig ? 'riktig' : 'feil'}">${riktig ? '✅ Riktig!' : '❌ Ikke riktig.'} ${esc(tekst || '')}</p>`;
  }

  function tegnOppgave(o, kort) {
    const flate = kort.querySelector('.svarflate');
    const tilbake = kort.querySelector('.tilbakemelding');
    const r = o.resultat;

    if (o.type === 'flervalg') {
      flate.innerHTML = `<div class="alternativer">${o.alternativer.map((a, j) => `
        <label class="alternativ ${r ? (j === o.riktigAlternativ ? 'er-riktig' : j === r.svar ? 'er-feil' : '') : ''}">
          <input type="radio" name="alt-${o.id}" value="${j}" ${r ? 'disabled' : ''} ${r?.svar === j ? 'checked' : ''}> ${esc(a)}
        </label>`).join('')}</div>
        ${r ? '' : '<button class="knapp sjekk" type="button">Sjekk svar</button>'}`;
      if (r) visLøsning(o, tilbake, dom(r.riktig, r.riktig ? '' : `Riktig svar er: ${o.alternativer[o.riktigAlternativ]}`));
      flate.querySelector('.sjekk')?.addEventListener('click', async () => {
        const valgt = flate.querySelector('input:checked');
        if (!valgt) { melding('Velg et alternativ først.'); return; }
        const svar = Number(valgt.value);
        o.resultat = { svar, riktig: svar === o.riktigAlternativ, tid: Date.now() };
        await lagreSett();
        tegnOppgave(o, kort);
        oppdaterPoeng();
      });
    }

    if (o.type === 'regning') {
      flate.innerHTML = `<div class="regnesvar">
          <input type="text" inputmode="decimal" placeholder="Ditt svar" value="${r ? esc(r.svar) : ''}" ${r ? 'disabled' : ''}>
          <span>${esc(o.enhet || '')}</span>
          ${r ? '' : '<button class="knapp sjekk" type="button">Sjekk svar</button>'}
        </div>`;
      if (r) visLøsning(o, tilbake, dom(r.riktig, `Fasit: ${fmt(o.fasitTall, 4)} ${o.enhet || ''}`));
      const felt = flate.querySelector('input');
      const sjekk = async () => {
        const tall = tolkTall(felt.value);
        if (tall === null) { melding('Skriv et tall (bruk komma eller punktum som desimaltegn).'); return; }
        const tol = o.toleranse > 0 ? o.toleranse : Math.max(Math.abs(o.fasitTall) * 0.01, 0.01);
        o.resultat = { svar: felt.value, riktig: Math.abs(tall - o.fasitTall) <= tol + 1e-9, tid: Date.now() };
        await lagreSett();
        tegnOppgave(o, kort);
        oppdaterPoeng();
      };
      flate.querySelector('.sjekk')?.addEventListener('click', sjekk);
      felt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !r) sjekk(); });
    }

    if (o.type === 'drofting') {
      flate.innerHTML = `
        ${o.vurderingskriterier?.length ? `<details class="kriterier"><summary>Hva vektlegges? (vurderingskriterier)</summary><ul>${o.vurderingskriterier.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></details>` : ''}
        <textarea rows="10" placeholder="Skriv svaret ditt her …" ${r ? 'disabled' : ''}>${r ? esc(r.svar) : ''}</textarea>
        <div class="rad-mellom"><span class="dempet ordtelling"></span>${r ? '' : '<button class="knapp sjekk" type="button">✨ Få vurdering fra Claude</button>'}</div>`;
      const felt = flate.querySelector('textarea');
      const telling = flate.querySelector('.ordtelling');
      const tell = () => { telling.textContent = `${felt.value.trim().split(/\s+/).filter(Boolean).length} ord`; };
      felt.addEventListener('input', () => {
        tell();
        try { localStorage.setItem(`utkast-${o.id}`, felt.value); } catch { /* ignorer */ }
      });
      if (!r) { try { felt.value = localStorage.getItem(`utkast-${o.id}`) || ''; } catch { /* ignorer */ } }
      tell();
      if (r) {
        const v = r.vurdering;
        const tekst = `${v.tilbakemelding}`;
        visLøsning(o, tilbake, `
          <div class="vurdering">
            <div class="rad-mellom"><h4>Tilbakemelding</h4><span class="karakter" title="Omtrentlig karakter">Karakter ca. ${v.karakter}</span></div>
            <p>${esc(v.tilbakemelding)}</p>
            ${v.styrker.length ? `<h5>👍 Bra</h5><ul>${v.styrker.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
            ${v.forbedringer.length ? `<h5>💡 Slik kan du forbedre svaret</h5><ul>${v.forbedringer.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
            <details><summary>Eksempel på et godt svar</summary><p class="modellsvar">${esc(v.modellsvar)}</p></details>
          </div>`);
        tilbake.querySelector('.vurdering h4').appendChild(lesHøytKnapp(() => tekst + ' ' + v.forbedringer.join(' ')));
      }
      flate.querySelector('.sjekk')?.addEventListener('click', async (e) => {
        if (felt.value.trim().split(/\s+/).length < 15) { melding('Skriv litt mer før du ber om vurdering.'); return; }
        e.target.disabled = true;
        tilbake.innerHTML = laster('Claude leser svaret ditt …');
        try {
          const vurdering = await post('/api/vurder', { sporsmal: o.sporsmal, vurderingskriterier: o.vurderingskriterier, losningsforslag: o.losningsforslag, svar: felt.value });
          o.resultat = { svar: felt.value, riktig: null, karakter: vurdering.karakter, vurdering, tid: Date.now() };
          await lagreSett();
          try { localStorage.removeItem(`utkast-${o.id}`); } catch { /* ignorer */ }
          tegnOppgave(o, kort);
          oppdaterPoeng();
        } catch (err) {
          tilbake.innerHTML = `<p class="feiltekst">${esc(err.message)}</p>`;
          e.target.disabled = false;
        }
      });
    }

    if (o.type === 'graf') {
      if (!o.graf) { flate.innerHTML = '<p class="feiltekst">Oppgaven mangler graf.</p>'; return; }
      flate.innerHTML = '<p class="dempet">Flytt den glidebryteren du mener er riktig, i riktig retning. Trykk deretter «Sjekk svar».</p>';
      const grafBoks = html('<div></div>');
      flate.appendChild(grafBoks);
      const g = visGraf(grafBoks, { mal: o.graf.mal, startverdier: o.graf.startverdier }, { oppgave: o.graf });
      const knapp = html('<button class="knapp sjekk" type="button">Sjekk svar</button>');
      flate.appendChild(knapp);
      if (r) {
        // Tidligere besvart: vis resultatet (grafen starter på nytt fra utgangspunktet)
        visLøsning(o, tilbake, dom(r.riktig, r.riktig ? '' : `Du flyttet: ${r.valgt}. Riktig: ${r.fasit}.`));
        knapp.remove();
      }
      knapp.addEventListener('click', async () => {
        const res = g.sjekk();
        if (!res.flyttet) { melding('Du har ikke flyttet noen glidebryter ennå.'); return; }
        o.resultat = { riktig: res.riktig, valgt: res.valgt, fasit: res.fasit, tid: Date.now() };
        await lagreSett();
        knapp.remove();
        visLøsning(o, tilbake, dom(res.riktig, res.riktig ? '' : `Du flyttet: ${res.valgt}. Riktig: ${res.fasit}.`));
        oppdaterPoeng();
      });
    }
  }

  main.querySelector('.slett').addEventListener('click', async () => {
    if (!confirm('Slette dette oppgavesettet og svarene dine?')) return;
    await slett('oppgavesett', sett.id);
    location.hash = '#/oppgaver';
  });
}
