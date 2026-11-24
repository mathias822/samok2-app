// Tegner en interaktiv graf med glidebrytere, markert likevekt og forklaring.
// Brukes både på sidene du har levert, i grafbiblioteket og i grafoppgaver.

import { malFor, startParametre, fmt } from './grafmaler.js';
import { esc, html, lesHøytKnapp } from './ui.js';

const FØR_FARGE = '#9ca3af';

function likeKurver(a, b) {
  if (!a || !b || a.x.length !== b.x.length) return false;
  for (let i = 0; i < a.x.length; i++) {
    if (Math.abs((a.x[i] ?? 0) - (b.x[i] ?? 0)) > 1e-9 || Math.abs((a.y[i] ?? 0) - (b.y[i] ?? 0)) > 1e-9) return false;
  }
  return true;
}

function somKart(verdier) {
  const k = {};
  for (const v of verdier) k[v.id] = v.verdi;
  return k;
}

/**
 * @param beholder  HTML-elementet grafen skal tegnes i
 * @param graf      { mal, tittel, kobling, startverdier, fri }
 * @param valg      { oppgave: { riktigParameter, riktigRetning } } for grafoppgaver
 * @returns { sjekk() } – sjekk() brukes i grafoppgaver
 */
export function visGraf(beholder, graf, valg = {}) {
  let mal;
  try {
    mal = malFor(graf);
  } catch (e) {
    beholder.appendChild(html(`<div class="graf-kort"><h3>${esc(graf.tittel || 'Graf')}</h3><p class="feiltekst">Kunne ikke tegne grafen: ${esc(e.message)}</p></div>`));
    return { sjekk: () => null };
  }
  const erOppgave = !!valg.oppgave;
  const { parametre, verdier: start } = startParametre(mal, graf.startverdier);
  let nå = { ...start };
  let vistForklaring = !erOppgave;

  const kort = html(`
    <div class="graf-kort">
      ${graf.tittel && !erOppgave ? `<h3>${esc(graf.tittel)}</h3>` : ''}
      ${graf.kobling && !erOppgave ? `<p class="dempet">${esc(graf.kobling)}</p>` : ''}
      <div class="graf-innhold">
        <div class="plott"></div>
        <div class="kontroller">
          <div class="glidere"></div>
          <button class="knapp liten lys nullstill" type="button">↺ Nullstill</button>
        </div>
      </div>
      <div class="graf-resultat"></div>
    </div>`);
  beholder.appendChild(kort);
  const plott = kort.querySelector('.plott');
  const glidere = kort.querySelector('.glidere');
  const resultat = kort.querySelector('.graf-resultat');

  // Glidebrytere
  const inputs = {};
  for (const p of parametre) {
    const rad = html(`
      <label class="glider">
        <span class="glider-navn">${esc(p.navn)}</span>
        <span class="glider-rad">
          <input type="range" min="${p.min}" max="${p.max}" step="${p.steg}" value="${start[p.id]}">
          <output>${fmt(start[p.id], 2)}</output>
        </span>
      </label>`);
    const input = rad.querySelector('input');
    const ut = rad.querySelector('output');
    input.addEventListener('input', () => {
      nå[p.id] = Number(input.value);
      ut.textContent = fmt(nå[p.id], 2);
      planlegg();
    });
    inputs[p.id] = { input, ut };
    glidere.appendChild(rad);
  }
  kort.querySelector('.nullstill').addEventListener('click', () => {
    nå = { ...start };
    for (const p of parametre) { inputs[p.id].input.value = start[p.id]; inputs[p.id].ut.textContent = fmt(start[p.id], 2); }
    tegn();
  });

  let ventende = false;
  function planlegg() {
    if (ventende) return;
    ventende = true;
    requestAnimationFrame(() => { ventende = false; tegn(); });
  }

  function erEndret() {
    return parametre.some((p) => Math.abs(nå[p.id] - start[p.id]) > 1e-9);
  }

  function tegn() {
    const A = mal.beregn(start);
    const B = mal.beregn(nå);
    const endret = erEndret();
    const vis = !erOppgave || vistForklaring;
    const område = mal.omrade(start, nå);
    const spor = [];

    for (const f of B.flater || []) {
      spor.push({ x: f.x, y: f.y, fill: 'toself', fillcolor: f.farge, mode: 'lines', line: { width: 0 }, name: f.navn, hoverinfo: 'name', showlegend: true });
    }
    if (endret) {
      for (const k of A.kurver) {
        const ny = B.kurver.find((b) => b.id === k.id);
        if (ny && likeKurver(k, ny)) continue;
        spor.push({ x: k.x, y: k.y, mode: 'lines', name: `${k.navn} (før)`, line: { color: k.farge, width: 2, dash: 'dash' }, opacity: 0.45, hoverinfo: 'skip' });
      }
    }
    for (const k of B.kurver) {
      spor.push({ x: k.x, y: k.y, mode: 'lines', name: k.navn, line: { color: k.farge, width: k.strek ? 2 : 3, dash: k.strek || 'solid' },
        hovertemplate: `${esc(k.navn)}<br>${esc(mal.akser.x)}: %{x:.1f}<br>${esc(mal.akser.y)}: %{y:.1f}<extra></extra>` });
    }
    const shapes = [];
    const annotations = [];
    const etikett = (x, y, tekst, farge, ax, ay) => ({ x, y, text: tekst, showarrow: true, arrowhead: 0, arrowcolor: farge, ax, ay,
      bgcolor: 'rgba(255,255,255,0.92)', bordercolor: farge, borderpad: 3, borderwidth: 1, font: { size: 12, color: farge } });
    if (endret && vis) {
      const gamle = A.punkter.filter((p) => !p.bi);
      spor.push({ x: gamle.map((p) => p.x), y: gamle.map((p) => p.y), mode: 'markers', name: 'Før', showlegend: false,
        marker: { size: 11, color: 'white', line: { color: FØR_FARGE, width: 2.5 } },
        hovertemplate: `Før<br>%{x:.1f}, %{y:.1f}<extra></extra>` });
      for (const p of gamle) annotations.push(etikett(p.x, p.y, 'Før', '#6b7280', -34, 30));
    }
    const nye = B.punkter;
    spor.push({ x: nye.map((p) => p.x), y: nye.map((p) => p.y), mode: 'markers', name: 'Punkter', text: nye.map((p) => p.navn), showlegend: false,
      marker: { size: nye.map((p) => (p.bi ? 9 : 13)), color: nye.map((p) => (p.bi ? '#7c3aed' : '#111827')), line: { color: 'white', width: 2 } },
      hovertemplate: `%{text}<br>${esc(mal.akser.x)}: %{x:.2f}<br>${esc(mal.akser.y)}: %{y:.2f}<extra></extra>` });
    for (const p of nye) {
      const tekst = endret && vis && !p.bi && p.navn === 'Likevekt' ? 'Ny likevekt' : p.navn;
      annotations.push(etikett(p.x, p.y, tekst, p.bi ? '#7c3aed' : '#111827', 36, -32));
    }
    for (const p of nye) {
      shapes.push({ type: 'line', x0: p.x, x1: p.x, y0: område.y[0], y1: p.y, line: { color: '#6b7280', width: 1, dash: 'dot' } });
      shapes.push({ type: 'line', x0: område.x[0], x1: p.x, y0: p.y, y1: p.y, line: { color: '#6b7280', width: 1, dash: 'dot' } });
    }

    const mørk = document.documentElement.dataset.tema === 'mork';
    const tekstFarge = mørk ? '#e5e7eb' : '#1f2937';
    const layout = {
      margin: { l: 60, r: 16, t: 16, b: 50 },
      xaxis: { title: { text: mal.akser.x }, range: område.x, fixedrange: true, zeroline: true, gridcolor: mørk ? '#374151' : '#eef0f3' },
      yaxis: { title: { text: mal.akser.y }, range: område.y, fixedrange: true, zeroline: true, gridcolor: mørk ? '#374151' : '#eef0f3' },
      legend: { orientation: 'h', y: -0.22, font: { size: 11 } },
      shapes,
      annotations,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'system-ui, -apple-system, Segoe UI, sans-serif', color: tekstFarge, size: 12 },
      hovermode: 'closest',
    };
    if (window.Plotly) window.Plotly.react(plott, spor, layout, { displayModeBar: false, responsive: true });
    else plott.textContent = 'Graf-biblioteket ble ikke lastet.';

    // Nøkkeltall og forklaring
    if (!vis) { resultat.innerHTML = ''; return; }
    const vA = somKart(A.verdier), vB = somKart(B.verdier);
    const rader = B.verdier.map((v) => {
      const før = vA[v.id];
      const d = v.desimaler ?? 1;
      const diff = typeof før === 'number' ? v.verdi - før : null;
      const pil = diff == null || Math.abs(diff) < 1e-9 ? '' : diff > 0 ? '▲' : '▼';
      return `<tr><td>${esc(v.navn)}</td>${endret ? `<td class="tall">${fmt(før, d)}</td>` : ''}<td class="tall"><strong>${fmt(v.verdi, d)}</strong></td>${endret ? `<td class="tall endring">${pil} ${diff == null || Math.abs(diff) < 1e-9 ? '–' : (diff > 0 ? '+' : '') + fmt(diff, d)}</td>` : ''}</tr>`;
    }).join('');
    const tabell = `<table class="nokkeltall"><thead><tr><th></th>${endret ? '<th>Før</th><th>Nå</th><th>Endring</th>' : '<th>Verdi</th>'}</tr></thead><tbody>${rader}</tbody></table>`;

    let tekst = '';
    if (!endret) {
      tekst = mal.tolk(start, nå, vA, vB).filter(() => ['konjunktursykel', 'ad-as', 'phillips'].includes(mal.id)).join(' ')
        || 'Flytt en glidebryter for å se hva som skjer med kurvene og likevekten.';
    } else {
      const endringer = parametre.filter((p) => Math.abs(nå[p.id] - start[p.id]) > 1e-9)
        .map((p) => `${p.navn.split(' – ')[0]} fra ${fmt(start[p.id], 2)} til ${fmt(nå[p.id], 2)}`);
      const virkninger = B.verdier.filter((v) => typeof vA[v.id] === 'number' && Math.abs(v.verdi - vA[v.id]) > 1e-6)
        .slice(0, 3)
        .map((v) => `${v.navn.replace(/\s*\(.*\)$/, '')} ${v.verdi > vA[v.id] ? 'øker' : 'faller'} fra ${fmt(vA[v.id], v.desimaler ?? 1)} til ${fmt(v.verdi, v.desimaler ?? 1)}`);
      tekst = `Du endret ${endringer.join(' og ')}. `;
      if (virkninger.length) tekst += `${virkninger.join('. ')}. `;
      tekst += mal.tolk(start, nå, vA, vB).join(' ');
    }
    resultat.innerHTML = `${tabell}<div class="forklaring"><h4>Hva skjer?</h4><p>${esc(tekst)}</p></div>`;
    resultat.querySelector('.forklaring h4').appendChild(lesHøytKnapp(() => tekst));
  }

  tegn();

  return {
    // For grafoppgaver: finner glidebryteren som er flyttet mest, og sjekker om det er riktig parameter i riktig retning.
    sjekk() {
      const { riktigParameter, riktigRetning } = valg.oppgave;
      let størst = null;
      for (const p of parametre) {
        const rel = (nå[p.id] - start[p.id]) / (p.max - p.min || 1);
        if (Math.abs(rel) > 1e-9 && (!størst || Math.abs(rel) > Math.abs(størst.rel))) størst = { p, rel };
      }
      vistForklaring = true;
      tegn();
      if (!størst) return { flyttet: false };
      const retning = størst.rel > 0 ? 'opp' : 'ned';
      const riktigP = parametre.find((p) => p.id === riktigParameter);
      return {
        flyttet: true,
        riktig: størst.p.id === riktigParameter && retning === riktigRetning,
        valgt: `${størst.p.navn} (${retning === 'opp' ? 'økt' : 'redusert'})`,
        fasit: riktigP ? `${riktigP.navn} (${riktigRetning === 'opp' ? 'økes' : 'reduseres'})` : riktigParameter,
      };
    },
  };
}
