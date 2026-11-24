// Grafmaler: ferdigprogrammerte økonomiske modeller med riktige formler og norske betegnelser.
//
// Hver mal har:
//   parametre  – det glidebryterne styrer (id, navn, min, max, steg, start)
//   beregn(p)  – regner ut kurver, likevektspunkter og nøkkeltall for parameterverdiene p
//   omrade()   – hvilke akseverdier som vises
//   tolk()     – korte forklaringssetninger når noe er endret
//
// Claude velger bare mal og startverdier. Selve matematikken ligger her, så grafene alltid blir riktige.
// Filen brukes både i nettleseren og av backenden (som lager en liste over malene til Claude).

import { kompiler } from './uttrykk.js';

// ---------- hjelpefunksjoner ----------

export function fmt(tall, desimaler = 1) {
  if (typeof tall !== 'number' || !isFinite(tall)) return '–';
  return tall.toLocaleString('nb-NO', { maximumFractionDigits: desimaler, minimumFractionDigits: 0 });
}

function fortegn(tall, desimaler = 1) {
  return (tall > 0 ? '+' : '') + fmt(tall, desimaler);
}

function pentTak(v) {
  if (v <= 0) return 10;
  const størrelse = Math.pow(10, Math.floor(Math.log10(v)));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (f * størrelse >= v) return f * størrelse;
  }
  return 10 * størrelse;
}

function prøv(x0, x1, f, n = 2) {
  const xs = [], ys = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    xs.push(x);
    ys.push(f(x));
  }
  return { x: xs, y: ys };
}

function endret(a, b, id) {
  return Math.abs((a[id] ?? 0) - (b[id] ?? 0)) > 1e-9;
}

const FARGER = {
  ettersporsel: '#2563eb',
  tilbud: '#dc2626',
  hjelp: '#6b7280',
  gronn: '#059669',
  lilla: '#7c3aed',
  oransje: '#d97706',
};

// ---------- malene ----------

const tilbudEttersporsel = {
  id: 'tilbud-ettersporsel',
  navn: 'Tilbud og etterspørsel',
  beskrivelse: 'Markedslikevekt med lineær etterspørsel P = a − b·Q og tilbud P = c + d·Q. Avgift per enhet (t) gir en kile mellom kjøperpris og selgerpris. Viser konsument- og produsentoverskudd.',
  akser: { x: 'Mengde (Q)', y: 'Pris (P)' },
  parametre: [
    { id: 'a', navn: 'Etterspørselsnivå (a) – forskyver etterspørselskurven', min: 40, max: 160, steg: 5, start: 100 },
    { id: 'b', navn: 'Helning på etterspørselskurven (b)', min: 0.5, max: 3, steg: 0.1, start: 1 },
    { id: 'c', navn: 'Kostnadsnivå (c) – forskyver tilbudskurven', min: 0, max: 80, steg: 5, start: 20 },
    { id: 'd', navn: 'Helning på tilbudskurven (d)', min: 0.5, max: 3, steg: 0.1, start: 1 },
    { id: 't', navn: 'Avgift per enhet (t)', min: 0, max: 40, steg: 1, start: 0 },
  ],
  beregn(p) {
    const Q = Math.max(0, (p.a - p.c - p.t) / (p.b + p.d));
    const Pk = p.a - p.b * Q; // kjøperpris
    const Ps = Pk - p.t; // selgerpris
    const qMaks = p.a / p.b;
    const kurver = [
      { id: 'D', navn: 'Etterspørsel (D)', farge: FARGER.ettersporsel, ...prøv(0, qMaks, (q) => p.a - p.b * q) },
      { id: 'S', navn: 'Tilbud (S)', farge: FARGER.tilbud, ...prøv(0, 200, (q) => p.c + p.d * q) },
    ];
    if (p.t > 0) {
      kurver.push({ id: 'St', navn: 'Tilbud med avgift (S + t)', farge: FARGER.oransje, ...prøv(0, 200, (q) => p.c + p.t + p.d * q) });
    }
    const flater = [
      { navn: 'Konsumentoverskudd', farge: 'rgba(37,99,235,0.12)', x: [0, 0, Q], y: [Pk, p.a, Pk] },
      { navn: 'Produsentoverskudd', farge: 'rgba(220,38,38,0.12)', x: [0, 0, Q], y: [p.c, Ps, Ps] },
    ];
    if (p.t > 0) flater.push({ navn: 'Avgiftsinntekt', farge: 'rgba(217,119,6,0.18)', x: [0, Q, Q, 0], y: [Ps, Ps, Pk, Pk] });
    const punkter = [{ navn: 'Likevekt', x: Q, y: Pk, xEtikett: 'Q*', yEtikett: p.t > 0 ? 'P kjøper' : 'P*' }];
    if (p.t > 0) punkter.push({ navn: 'Selgerpris', x: Q, y: Ps, yEtikett: 'P selger', bi: true });
    return {
      kurver, flater, punkter,
      verdier: [
        { id: 'Q', navn: 'Likevektsmengde (Q*)', verdi: Q },
        { id: 'P', navn: p.t > 0 ? 'Pris kjøperne betaler' : 'Likevektspris (P*)', verdi: Pk },
        ...(p.t > 0 ? [{ id: 'Ps', navn: 'Pris selgerne får', verdi: Ps }, { id: 'skatt', navn: 'Avgiftsinntekt til staten', verdi: p.t * Q }] : []),
        { id: 'KO', navn: 'Konsumentoverskudd', verdi: 0.5 * Q * (p.a - Pk) },
        { id: 'PO', navn: 'Produsentoverskudd', verdi: 0.5 * Q * (Ps - p.c) },
      ],
    };
  },
  omrade(pA, pB) {
    return { x: [0, 120], y: [0, pentTak(Math.max(pA.a, pB.a, pA.c + pA.t + 60, pB.c + pB.t + 60) * 1.1)] };
  },
  tolk(pA, pB, vA, vB) {
    const s = [];
    if (endret(pA, pB, 'a')) s.push(pB.a > pA.a
      ? 'Etterspørselskurven forskyves mot høyre (økt etterspørsel – f.eks. høyere inntekt, endrede preferanser eller dyrere substitutter). Både pris og mengde øker.'
      : 'Etterspørselskurven forskyves mot venstre (redusert etterspørsel). Både pris og mengde faller.');
    if (endret(pA, pB, 'c')) s.push(pB.c > pA.c
      ? 'Tilbudskurven forskyves oppover/mot venstre (høyere produksjonskostnader). Prisen stiger og omsatt mengde faller.'
      : 'Tilbudskurven forskyves nedover/mot høyre (lavere kostnader, f.eks. ny teknologi). Prisen faller og omsatt mengde øker.');
    if (endret(pA, pB, 't')) s.push('En avgift per enhet legger seg som en kile mellom prisen kjøperne betaler og prisen selgerne får. Omsatt mengde går ned. Hvem som bærer mest av avgiften, avhenger av hvor bratte kurvene er: den siden av markedet som er minst prisfølsom (brattest kurve), bærer mest.');
    if (endret(pA, pB, 'b')) s.push(pB.b > pA.b
      ? 'En brattere etterspørselskurve betyr at etterspørselen er mindre prisfølsom (mer uelastisk).'
      : 'En slakere etterspørselskurve betyr at etterspørselen er mer prisfølsom (mer elastisk).');
    if (endret(pA, pB, 'd')) s.push(pB.d > pA.d
      ? 'En brattere tilbudskurve betyr at tilbudet er mindre prisfølsomt.'
      : 'En slakere tilbudskurve betyr at tilbudet er mer prisfølsomt.');
    return s;
  },
};

const keynesKryss = {
  id: 'keynes-kryss',
  navn: 'Keynesiansk kryssdiagram (multiplikator)',
  beskrivelse: 'Enkel keynesiansk makromodell: Y = C + I + G + X − Q, med C = C₀ + c·(Y − T) og Q = q·Y. Likevekt der samlet etterspørsel (SE) krysser 45°-linjen. Multiplikator = 1/(1 − c + q).',
  akser: { x: 'BNP / samlet produksjon (Y)', y: 'Samlet etterspørsel (SE)' },
  parametre: [
    { id: 'C0', navn: 'Autonomt konsum (C₀)', min: 0, max: 400, steg: 10, start: 100 },
    { id: 'c', navn: 'Marginal konsumtilbøyelighet (c)', min: 0.3, max: 0.95, steg: 0.05, start: 0.6 },
    { id: 'T', navn: 'Nettoskatter (T)', min: 0, max: 600, steg: 10, start: 150 },
    { id: 'I', navn: 'Realinvesteringer (I)', min: 0, max: 600, steg: 10, start: 150 },
    { id: 'G', navn: 'Offentlig kjøp av varer og tjenester (G)', min: 0, max: 600, steg: 10, start: 200 },
    { id: 'X', navn: 'Eksport (X)', min: 0, max: 600, steg: 10, start: 150 },
    { id: 'q', navn: 'Marginal importtilbøyelighet (q)', min: 0, max: 0.5, steg: 0.05, start: 0.2 },
  ],
  hjelp: {
    autonom: (p) => p.C0 - p.c * p.T + p.I + p.G + p.X,
    mult: (p) => 1 / (1 - p.c + p.q),
  },
  beregn(p) {
    const m = this.hjelp.mult(p);
    const Y = this.hjelp.autonom(p) * m;
    const xMaks = 6000;
    const SE = (y) => p.C0 + p.c * (y - p.T) + p.I + p.G + p.X - p.q * y;
    return {
      kurver: [
        { id: '45', navn: '45°-linjen (SE = Y)', farge: FARGER.hjelp, strek: 'dash', ...prøv(0, xMaks, (y) => y) },
        { id: 'SE', navn: 'Samlet etterspørsel (SE)', farge: FARGER.ettersporsel, ...prøv(0, xMaks, SE) },
      ],
      punkter: [{ navn: 'Likevekt', x: Y, y: Y, xEtikett: 'Y*' }],
      verdier: [
        { id: 'Y', navn: 'Likevekts-BNP (Y*)', verdi: Y },
        { id: 'mult', navn: 'Multiplikator 1/(1 − c + q)', verdi: m, desimaler: 2 },
        { id: 'C', navn: 'Privat konsum (C)', verdi: p.C0 + p.c * (Y - p.T) },
        { id: 'Q', navn: 'Import (Q)', verdi: p.q * Y },
        { id: 'budsjett', navn: 'Offentlig budsjettbalanse (T − G)', verdi: p.T - p.G },
        { id: 'handel', navn: 'Handelsbalanse (X − Q)', verdi: p.X - p.q * Y },
      ],
    };
  },
  omrade(pA, pB) {
    const yA = this.hjelp.autonom(pA) * this.hjelp.mult(pA);
    const yB = this.hjelp.autonom(pB) * this.hjelp.mult(pB);
    const maks = pentTak(Math.max(yA, yB, 100) * 1.5);
    return { x: [0, maks], y: [0, maks] };
  },
  tolk(pA, pB) {
    const s = [];
    const mA = this.hjelp.mult(pA), mB = this.hjelp.mult(pB);
    const dAut = this.hjelp.autonom(pB) - this.hjelp.autonom(pA);
    const sammeHelning = !endret(pA, pB, 'c') && !endret(pA, pB, 'q');
    if (endret(pA, pB, 'G') && endret(pA, pB, 'T') && Math.abs((pB.G - pA.G) - (pB.T - pA.T)) < 1e-9 && sammeHelning) {
      s.push(`Balansert budsjett-endring: G og T endres like mye (${fortegn(pB.G - pA.G, 0)}). BNP endres likevel, fordi skatteøkningen bare reduserer konsumet med c·ΔT, mens G øker etterspørselen fullt ut. Den balanserte budsjettmultiplikatoren er (1 − c)/(1 − c + q) = ${fmt((1 - pB.c) / (1 - pB.c + pB.q), 2)}.`);
    } else {
      if (endret(pA, pB, 'G')) s.push(pB.G > pA.G
        ? 'Økte offentlige kjøp (G) er ekspansiv finanspolitikk. SE-kurven forskyves opp, og produksjonen øker til den nye likevekten.'
        : 'Reduserte offentlige kjøp (G) er kontraktiv finanspolitikk. SE-kurven forskyves ned, og BNP faller.');
      if (endret(pA, pB, 'T')) s.push(`${pB.T > pA.T ? 'Høyere' : 'Lavere'} skatter ${pB.T > pA.T ? 'reduserer' : 'øker'} disponibel inntekt (Y − T) og dermed konsumet. Skattemultiplikatoren er −c/(1 − c + q) = ${fmt(-pB.c / (1 - pB.c + pB.q), 2)}, altså mindre i tallverdi enn multiplikatoren for G.`);
    }
    if (endret(pA, pB, 'I')) s.push(`${pB.I > pA.I ? 'Økte' : 'Lavere'} realinvesteringer (f.eks. pga. ${pB.I > pA.I ? 'lavere rente eller bedre framtidsutsikter' : 'høyere rente eller dårligere framtidsutsikter'}) forskyver SE-kurven ${pB.I > pA.I ? 'opp' : 'ned'}.`);
    if (endret(pA, pB, 'X')) s.push(`${pB.X > pA.X ? 'Økt' : 'Redusert'} eksport forskyver SE-kurven ${pB.X > pA.X ? 'opp' : 'ned'} og påvirker også handelsbalansen.`);
    if (endret(pA, pB, 'C0')) s.push(`${pB.C0 > pA.C0 ? 'Økt' : 'Redusert'} autonomt konsum (f.eks. pga. ${pB.C0 > pA.C0 ? 'økt optimisme eller formue' : 'pessimisme eller økt sparing'}) forskyver SE-kurven ${pB.C0 > pA.C0 ? 'opp' : 'ned'}.`);
    if (endret(pA, pB, 'c')) s.push(`${pB.c > pA.c ? 'Høyere' : 'Lavere'} marginal konsumtilbøyelighet gjør SE-kurven ${pB.c > pA.c ? 'brattere' : 'slakere'}, og multiplikatoren går fra ${fmt(mA, 2)} til ${fmt(mB, 2)}.`);
    if (endret(pA, pB, 'q')) s.push(`${pB.q > pA.q ? 'Større' : 'Mindre'} importtilbøyelighet betyr at ${pB.q > pA.q ? 'mer' : 'mindre'} av etterspørselen «lekker ut» til utlandet. Multiplikatoren går fra ${fmt(mA, 2)} til ${fmt(mB, 2)}.`);
    if (sammeHelning && Math.abs(dAut) > 1e-9) {
      s.push(`Regnestykket: Den autonome etterspørselen (C₀ − c·T + I + G + X) endret seg med ${fortegn(dAut, 1)}. Multiplikatoren er ${fmt(mB, 2)}, så BNP endres med ${fmt(mB, 2)} · ${fmt(dAut, 1)} = ${fortegn(mB * dAut, 1)}.`);
    }
    return s;
  },
};

const adAs = {
  id: 'ad-as',
  navn: 'AD-AS-modellen',
  beskrivelse: 'Samlet etterspørsel AD: P = A − Y, kortsiktig samlet tilbud AS: P = K + 0,5·Y og langsiktig tilbud (LAS) loddrett ved potensielt BNP Yp. Viser produksjonsgap, etterspørselssjokk og tilbudssjokk.',
  akser: { x: 'BNP (Y)', y: 'Prisnivå (P)' },
  parametre: [
    { id: 'A', navn: 'Samlet etterspørsel (A) – forskyver AD', min: 100, max: 200, steg: 5, start: 150 },
    { id: 'K', navn: 'Kostnadsnivå (K) – forskyver AS', min: -50, max: 50, steg: 5, start: 0 },
    { id: 'Yp', navn: 'Potensielt BNP (Yp) – forskyver LAS', min: 70, max: 130, steg: 5, start: 100 },
  ],
  beregn(p) {
    const Y = (p.A - p.K) / 1.5;
    const P = p.A - Y;
    const gap = ((Y - p.Yp) / p.Yp) * 100;
    return {
      kurver: [
        { id: 'AD', navn: 'AD (samlet etterspørsel)', farge: FARGER.ettersporsel, ...prøv(0, 200, (y) => p.A - y) },
        { id: 'AS', navn: 'AS (samlet tilbud, kort sikt)', farge: FARGER.tilbud, ...prøv(0, 200, (y) => p.K + 0.5 * y) },
        { id: 'LAS', navn: 'LAS (langsiktig tilbud = potensielt BNP)', farge: FARGER.gronn, strek: 'dash', x: [p.Yp, p.Yp], y: [0, 200] },
      ],
      punkter: [{ navn: 'Likevekt', x: Y, y: P, xEtikett: 'Y', yEtikett: 'P' }],
      verdier: [
        { id: 'Y', navn: 'BNP (Y)', verdi: Y },
        { id: 'P', navn: 'Prisnivå (P)', verdi: P },
        { id: 'gap', navn: 'Produksjonsgap (%)', verdi: gap },
      ],
    };
  },
  omrade() { return { x: [0, 180], y: [0, 160] }; },
  tolk(pA, pB, vA, vB) {
    const s = [];
    if (endret(pA, pB, 'A')) s.push(pB.A > pA.A
      ? 'AD forskyves mot høyre: økt samlet etterspørsel (f.eks. lavere rente, økte offentlige utgifter, skattelette eller økt eksport). På kort sikt øker både BNP og prisnivået.'
      : 'AD forskyves mot venstre: redusert samlet etterspørsel (f.eks. høyere rente, innstramming i finanspolitikken eller fall i eksporten). BNP og prisnivå faller.');
    if (endret(pA, pB, 'K')) s.push(pB.K > pA.K
      ? 'AS forskyves oppover: et negativt tilbudssjokk (f.eks. høyere lønnskostnader eller dyrere energi/råvarer). Prisene stiger mens BNP faller. Kombinasjonen kalles stagflasjon.'
      : 'AS forskyves nedover: et positivt tilbudssjokk (f.eks. billigere råvarer eller høyere produktivitet). Prisene faller og BNP øker.');
    if (endret(pA, pB, 'Yp')) s.push(pB.Yp > pA.Yp
      ? 'Potensielt BNP øker (LAS flyttes mot høyre), f.eks. pga. teknologisk fremgang, mer kapital eller større arbeidsstyrke.'
      : 'Potensielt BNP faller (LAS flyttes mot venstre), f.eks. pga. lavere produktivitet eller mindre arbeidsstyrke.');
    const gap = vB.gap;
    if (gap > 0.5) s.push(`Positivt produksjonsgap (${fmt(gap)} %): Økonomien er i høykonjunktur. Det er press i økonomien, lav ledighet og fare for økende inflasjon. Det kan begrunne en mer kontraktiv penge- eller finanspolitikk.`);
    else if (gap < -0.5) s.push(`Negativt produksjonsgap (${fmt(gap)} %): Økonomien er i lavkonjunktur. Det er ledig kapasitet og høyere arbeidsledighet. Det kan begrunne en mer ekspansiv penge- eller finanspolitikk.`);
    else s.push('BNP er omtrent lik potensielt BNP. Økonomien er nær langsiktig likevekt.');
    return s;
  },
};

const konjunktursykel = {
  id: 'konjunktursykel',
  navn: 'Konjunktursykel og trend',
  beskrivelse: 'BNP svinger rundt en voksende trend (potensielt BNP): Y(t) = 100·(1 + g)^t · (1 + A·sin(2πt/T)). Viser høykonjunktur, lavkonjunktur og produksjonsgap på et valgt tidspunkt.',
  akser: { x: 'Tid (år)', y: 'BNP (indeks, år 0 = 100)' },
  parametre: [
    { id: 'g', navn: 'Trendvekst (% per år)', min: 0, max: 5, steg: 0.5, start: 2 },
    { id: 'A', navn: 'Amplitude – hvor store svingningene er (%)', min: 0, max: 10, steg: 0.5, start: 4 },
    { id: 'T', navn: 'Lengde på én konjunktursykel (år)', min: 4, max: 12, steg: 1, start: 8 },
    { id: 't', navn: 'Valgt tidspunkt (år)', min: 0, max: 20, steg: 0.25, start: 3 },
  ],
  hjelp: {
    trend: (p, t) => 100 * Math.pow(1 + p.g / 100, t),
    bnp: (p, t) => 100 * Math.pow(1 + p.g / 100, t) * (1 + (p.A / 100) * Math.sin((2 * Math.PI * t) / p.T)),
    fase(p) {
      const v = (2 * Math.PI * p.t) / p.T;
      const gap = p.A * Math.sin(v);
      const stiger = Math.cos(v) > 0;
      if (p.A === 0) return 'Ingen svingninger – BNP følger trenden.';
      if (Math.abs(gap) < p.A * 0.15) return stiger ? 'BNP er rundt trendnivået og på vei opp (oppgangskonjunktur).' : 'BNP er rundt trendnivået og på vei ned (nedgangskonjunktur).';
      if (gap > 0) return stiger ? 'Høykonjunktur på vei mot toppen: BNP er over trend og stiger fortsatt.' : 'Høykonjunktur der toppen er passert: BNP er over trend, men på vei ned.';
      return stiger ? 'Lavkonjunktur der bunnen er passert: BNP er under trend, men på vei opp.' : 'Lavkonjunktur på vei mot bunnen: BNP er under trend og faller.';
    },
  },
  beregn(p) {
    const h = this.hjelp;
    const gap = (p.A) * Math.sin((2 * Math.PI * p.t) / p.T);
    return {
      kurver: [
        { id: 'trend', navn: 'Trend-BNP (potensielt BNP)', farge: FARGER.gronn, strek: 'dash', ...prøv(0, 20, (t) => h.trend(p, t), 100) },
        { id: 'bnp', navn: 'Faktisk BNP', farge: FARGER.ettersporsel, ...prøv(0, 20, (t) => h.bnp(p, t), 400) },
      ],
      punkter: [{ navn: 'Valgt tidspunkt', x: p.t, y: h.bnp(p, p.t), xEtikett: 't' }],
      verdier: [
        { id: 'bnp', navn: 'BNP på valgt tidspunkt', verdi: h.bnp(p, p.t) },
        { id: 'trend', navn: 'Trend-BNP på valgt tidspunkt', verdi: h.trend(p, p.t) },
        { id: 'gap', navn: 'Produksjonsgap (%)', verdi: gap },
      ],
    };
  },
  omrade(pA, pB) {
    const maks = Math.max(this.hjelp.trend(pA, 20), this.hjelp.trend(pB, 20)) * (1 + Math.max(pA.A, pB.A) / 100);
    return { x: [0, 20], y: [Math.min(85, 100 - Math.max(pA.A, pB.A) - 3), Math.ceil((maks + 5) / 10) * 10] };
  },
  tolk(pA, pB) {
    const s = [this.hjelp.fase(pB)];
    if (endret(pA, pB, 'g')) s.push(`Trendveksten ${pB.g > pA.g ? 'økte' : 'falt'}. Trendveksten bestemmes på lang sikt av tilbudssiden: teknologi, kapital, arbeidskraft og kompetanse.`);
    if (endret(pA, pB, 'A')) s.push(`Svingningene ble ${pB.A > pA.A ? 'større' : 'mindre'}. Stabiliseringspolitikk (penge- og finanspolitikk) har som mål å dempe konjunktursvingningene.`);
    if (endret(pA, pB, 'T')) s.push(`Hver konjunktursykel varer nå ${fmt(pB.T, 0)} år fra topp til topp.`);
    return s;
  },
};

const isLm = {
  id: 'is-lm',
  navn: 'IS-LM-modellen',
  beskrivelse: 'IS-kurven (likevekt i varemarkedet): r = (200 + G − Y/2)/20. LM-kurven (likevekt i pengemarkedet): r = (0,5·Y − M)/25. Viser hvordan finanspolitikk (G) og pengepolitikk (M) påvirker BNP og rente.',
  akser: { x: 'BNP (Y)', y: 'Rente (r, %)' },
  parametre: [
    { id: 'G', navn: 'Offentlige utgifter (G) – forskyver IS', min: 0, max: 300, steg: 10, start: 100 },
    { id: 'M', navn: 'Pengemengde (M) – forskyver LM', min: 50, max: 400, steg: 10, start: 200 },
  ],
  beregn(p) {
    const Y = (5000 + 25 * p.G + 20 * p.M) / 22.5;
    const r = (200 + p.G - Y / 2) / 20;
    return {
      kurver: [
        { id: 'IS', navn: 'IS (varemarkedet)', farge: FARGER.ettersporsel, ...prøv(0, 1200, (y) => (200 + p.G - y / 2) / 20) },
        { id: 'LM', navn: 'LM (pengemarkedet)', farge: FARGER.tilbud, ...prøv(0, 1200, (y) => (0.5 * y - p.M) / 25) },
      ],
      punkter: [{ navn: 'Likevekt', x: Y, y: r, xEtikett: 'Y*', yEtikett: 'r*' }],
      verdier: [
        { id: 'Y', navn: 'BNP (Y*)', verdi: Y },
        { id: 'r', navn: 'Rente (r*, %)', verdi: r, desimaler: 2 },
      ],
    };
  },
  omrade() { return { x: [0, 1000], y: [0, 15] }; },
  tolk(pA, pB) {
    const s = [];
    if (endret(pA, pB, 'G')) s.push(pB.G > pA.G
      ? 'Ekspansiv finanspolitikk forskyver IS mot høyre. BNP øker, men renten stiger også. Den høyere renten demper private investeringer (fortrengning, «crowding out»), så BNP øker mindre enn i den enkle keynesianske modellen.'
      : 'Kontraktiv finanspolitikk forskyver IS mot venstre. BNP og rente faller.');
    if (endret(pA, pB, 'M')) s.push(pB.M > pA.M
      ? 'Ekspansiv pengepolitikk (økt pengemengde) forskyver LM mot høyre. Renten faller, noe som stimulerer investeringer og konsum, og BNP øker.'
      : 'Kontraktiv pengepolitikk (redusert pengemengde) forskyver LM mot venstre. Renten stiger og BNP faller.');
    s.push('I Norge styrer Norges Bank renten direkte gjennom styringsrenten, i stedet for pengemengden. Virkningen på etterspørselen er den samme: lavere rente gir høyere etterspørsel.');
    return s;
  },
};

const arbeidsmarked = {
  id: 'arbeidsmarked',
  navn: 'Arbeidsmarkedet',
  beskrivelse: 'Etterspørsel etter arbeidskraft W = a − N og tilbud av arbeidskraft W = c + N. En minstelønn over likevektslønnen gir arbeidsledighet (tilbudsoverskudd).',
  akser: { x: 'Sysselsetting / antall arbeidere (N)', y: 'Reallønn (W/P)' },
  parametre: [
    { id: 'a', navn: 'Etterspørsel etter arbeidskraft (a) – f.eks. produktivitet og produktpriser', min: 100, max: 300, steg: 10, start: 200 },
    { id: 'c', navn: 'Tilbud av arbeidskraft (c) – laveste lønn folk vil jobbe for', min: 0, max: 100, steg: 5, start: 50 },
    { id: 'Wmin', navn: 'Minstelønn (0 = ingen minstelønn)', min: 0, max: 250, steg: 5, start: 0 },
  ],
  beregn(p) {
    const Nl = Math.max(0, (p.a - p.c) / 2);
    const Wl = (p.a + p.c) / 2;
    const bindende = p.Wmin > Wl;
    const N = bindende ? Math.max(0, p.a - p.Wmin) : Nl;
    const W = bindende ? p.Wmin : Wl;
    const tilbudt = bindende ? Math.max(0, p.Wmin - p.c) : Nl;
    const kurver = [
      { id: 'D', navn: 'Etterspørsel etter arbeidskraft (bedriftene)', farge: FARGER.ettersporsel, ...prøv(0, p.a, (n) => p.a - n) },
      { id: 'S', navn: 'Tilbud av arbeidskraft (arbeidstakerne)', farge: FARGER.tilbud, ...prøv(0, 300, (n) => p.c + n) },
    ];
    const punkter = [{ navn: bindende ? 'Sysselsetting med minstelønn' : 'Likevekt', x: N, y: W, xEtikett: 'N', yEtikett: 'W' }];
    if (p.Wmin > 0) kurver.push({ id: 'min', navn: 'Minstelønn', farge: FARGER.lilla, strek: 'dot', x: [0, 300], y: [p.Wmin, p.Wmin] });
    if (bindende) punkter.push({ navn: 'Ønsket arbeidstilbud', x: tilbudt, y: W, bi: true });
    return {
      kurver, punkter,
      verdier: [
        { id: 'N', navn: 'Sysselsetting (N)', verdi: N },
        { id: 'W', navn: 'Reallønn (W/P)', verdi: W },
        { id: 'L', navn: 'Arbeidsledighet (tilbud − sysselsetting)', verdi: tilbudt - N },
      ],
    };
  },
  omrade() { return { x: [0, 250], y: [0, 300] }; },
  tolk(pA, pB, vA, vB) {
    const s = [];
    if (endret(pA, pB, 'a')) s.push(pB.a > pA.a
      ? 'Etterspørselen etter arbeidskraft øker (f.eks. høyere produktivitet eller økt etterspørsel etter varene). Både lønn og sysselsetting øker.'
      : 'Etterspørselen etter arbeidskraft faller (f.eks. lavkonjunktur). Lønn og sysselsetting går ned.');
    if (endret(pA, pB, 'c')) s.push(pB.c > pA.c
      ? 'Tilbudet av arbeidskraft går ned (f.eks. færre i arbeidsfør alder). Lønnen stiger, sysselsettingen faller.'
      : 'Tilbudet av arbeidskraft øker (f.eks. arbeidsinnvandring). Lønnen faller, sysselsettingen øker.');
    if (vB.L > 0.01) s.push(`Minstelønnen ligger over likevektslønnen. Flere vil jobbe enn bedriftene vil ansette, så det oppstår arbeidsledighet på ${fmt(vB.L)}.`);
    else if (pB.Wmin > 0) s.push('Minstelønnen ligger under likevektslønnen og har ingen virkning.');
    return s;
  },
};

const phillips = {
  id: 'phillips',
  navn: 'Phillipskurven',
  beskrivelse: 'Forventningsutvidet Phillipskurve: π = πᵉ − β·(u − u*). Lav arbeidsledighet gir høy inflasjon på kort sikt. På lang sikt er Phillipskurven loddrett ved likevektsledigheten u*.',
  akser: { x: 'Arbeidsledighet (u, %)', y: 'Inflasjon (π, %)' },
  parametre: [
    { id: 'pe', navn: 'Forventet inflasjon (πᵉ, %)', min: 0, max: 8, steg: 0.5, start: 2 },
    { id: 'un', navn: 'Likevektsledighet (u*, %)', min: 2, max: 8, steg: 0.5, start: 4 },
    { id: 'b', navn: 'Helning (β)', min: 0.2, max: 2, steg: 0.1, start: 0.8 },
    { id: 'u', navn: 'Faktisk arbeidsledighet (u, %)', min: 1, max: 10, steg: 0.25, start: 4 },
  ],
  beregn(p) {
    const pi = p.pe - p.b * (p.u - p.un);
    return {
      kurver: [
        { id: 'SPK', navn: 'Kortsiktig Phillipskurve', farge: FARGER.ettersporsel, ...prøv(0, 12, (u) => p.pe - p.b * (u - p.un)) },
        { id: 'LPK', navn: 'Langsiktig Phillipskurve (u = u*)', farge: FARGER.gronn, strek: 'dash', x: [p.un, p.un], y: [-6, 16] },
        { id: 'mal', navn: 'Inflasjonsmål (2 %)', farge: FARGER.hjelp, strek: 'dot', x: [0, 12], y: [2, 2] },
      ],
      punkter: [{ navn: 'Økonomien nå', x: p.u, y: pi, xEtikett: 'u', yEtikett: 'π' }],
      verdier: [
        { id: 'pi', navn: 'Inflasjon (π, %)', verdi: pi },
        { id: 'u', navn: 'Arbeidsledighet (u, %)', verdi: p.u },
        { id: 'avvik', navn: 'Avvik fra inflasjonsmålet (prosentpoeng)', verdi: pi - 2 },
      ],
    };
  },
  omrade() { return { x: [0, 12], y: [-4, 12] }; },
  tolk(pA, pB, vA, vB) {
    const s = [];
    if (endret(pA, pB, 'u')) s.push(pB.u < pA.u
      ? 'Lavere arbeidsledighet gir et strammere arbeidsmarked. Lønningene stiger raskere, og det gir høyere inflasjon (bevegelse langs kurven).'
      : 'Høyere arbeidsledighet demper lønnsveksten og gir lavere inflasjon (bevegelse langs kurven).');
    if (endret(pA, pB, 'pe')) s.push(pB.pe > pA.pe
      ? 'Høyere forventet inflasjon forskyver hele kurven opp. Ved samme ledighet blir inflasjonen høyere. Derfor er det viktig at inflasjonsforventningene er forankret rundt inflasjonsmålet.'
      : 'Lavere forventet inflasjon forskyver kurven ned.');
    if (endret(pA, pB, 'un')) s.push('Likevektsledigheten bestemmes av strukturelle forhold, f.eks. lønnsdannelse, utdanning og hvor godt arbeidsmarkedet fungerer.');
    if (pB.u < pB.un) s.push('Ledigheten er under likevektsledigheten, så inflasjonen blir høyere enn forventet. Over tid vil forventningene justeres opp, og kurven flyttes oppover.');
    else if (pB.u > pB.un) s.push('Ledigheten er over likevektsledigheten, så inflasjonen blir lavere enn forventet.');
    return s;
  },
};

export const MALER = {
  [tilbudEttersporsel.id]: tilbudEttersporsel,
  [keynesKryss.id]: keynesKryss,
  [adAs.id]: adAs,
  [konjunktursykel.id]: konjunktursykel,
  [isLm.id]: isLm,
  [arbeidsmarked.id]: arbeidsmarked,
  [phillips.id]: phillips,
};

export const MAL_IDER = Object.keys(MALER);

// Tekstkatalog som sendes til Claude, slik at Claude vet hvilke maler og parametre som finnes.
export function malKatalog() {
  return Object.values(MALER).map((m) => {
    const p = m.parametre.map((x) => `    - ${x.id}: ${x.navn} (min ${x.min}, maks ${x.max}, standard ${x.start})`).join('\n');
    return `- mal "${m.id}" – ${m.navn}: ${m.beskrivelse}\n  Akser: x = ${m.akser.x}, y = ${m.akser.y}\n  Parametre:\n${p}`;
  }).join('\n');
}

// ---------- fri graf (beskrevet av Claude med likninger) ----------

// Lager et mal-lignende objekt fra en fri grafbeskrivelse:
// { xAkse:{navn,min,max}, yAkse:{navn,min,max}, parametre:[{id,navn,min,max,steg,start}],
//   kurver:[{id,navn,type:'y_av_x'|'loddrett',uttrykk}], skjaeringer:[{kurve1,kurve2,navn}] }
export function lagFriMal(spek) {
  const palett = [FARGER.ettersporsel, FARGER.tilbud, FARGER.gronn, FARGER.lilla, FARGER.oransje, FARGER.hjelp];
  const kurver = spek.kurver.map((k, i) => ({ ...k, farge: palett[i % palett.length], f: kompiler(k.uttrykk) }));
  const [x0, x1] = [spek.xAkse.min, spek.xAkse.max];

  function verdiAv(k, p, x) {
    try { return k.f({ ...p, x }); } catch { return NaN; }
  }
  function skjæring(k1, k2, p) {
    if (k1.type === 'loddrett' && k2.type === 'loddrett') return null;
    if (k1.type === 'loddrett' || k2.type === 'loddrett') {
      const [l, a] = k1.type === 'loddrett' ? [k1, k2] : [k2, k1];
      const x = verdiAv(l, p, 0);
      return { x, y: verdiAv(a, p, x) };
    }
    const n = 600;
    let forrige = null;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const d = verdiAv(k1, p, x) - verdiAv(k2, p, x);
      if (!isFinite(d)) { forrige = null; continue; }
      if (forrige && Math.sign(d) !== Math.sign(forrige.d)) {
        let a = forrige.x, b = x;
        for (let j = 0; j < 50; j++) {
          const m = (a + b) / 2;
          const dm = verdiAv(k1, p, m) - verdiAv(k2, p, m);
          if (Math.sign(dm) === Math.sign(verdiAv(k1, p, a) - verdiAv(k2, p, a))) a = m; else b = m;
        }
        const xs = (a + b) / 2;
        return { x: xs, y: verdiAv(k1, p, xs) };
      }
      if (d === 0) return { x, y: verdiAv(k1, p, x) };
      forrige = { x, d };
    }
    return null;
  }

  return {
    id: 'fri',
    navn: spek.tittel || 'Graf',
    akser: { x: spek.xAkse.navn, y: spek.yAkse.navn },
    parametre: spek.parametre,
    beregn(p) {
      const ut = kurver.map((k) => {
        if (k.type === 'loddrett') {
          const x = verdiAv(k, p, 0);
          return { id: k.id, navn: k.navn, farge: k.farge, x: [x, x], y: [spek.yAkse.min, spek.yAkse.max] };
        }
        const data = prøv(x0, x1, (x) => verdiAv(k, p, x), 300);
        return { id: k.id, navn: k.navn, farge: k.farge, x: data.x, y: data.y.map((y) => (isFinite(y) ? y : null)) };
      });
      const punkter = [];
      const verdier = [];
      (spek.skjaeringer || []).forEach((s, i) => {
        const k1 = kurver.find((k) => k.id === s.kurve1);
        const k2 = kurver.find((k) => k.id === s.kurve2);
        if (!k1 || !k2) return;
        const pkt = skjæring(k1, k2, p);
        if (!pkt || !isFinite(pkt.x) || !isFinite(pkt.y)) return;
        const navn = s.navn || `Skjæringspunkt ${i + 1}`;
        punkter.push({ navn, x: pkt.x, y: pkt.y });
        verdier.push({ id: `x${i}`, navn: `${navn}: ${spek.xAkse.navn}`, verdi: pkt.x });
        verdier.push({ id: `y${i}`, navn: `${navn}: ${spek.yAkse.navn}`, verdi: pkt.y });
      });
      return { kurver: ut, punkter, verdier };
    },
    omrade() { return { x: [spek.xAkse.min, spek.xAkse.max], y: [spek.yAkse.min, spek.yAkse.max] }; },
    tolk() { return []; },
  };
}

// Henter riktig mal for en grafbeskrivelse fra Claude: { mal, startverdier:[{id,verdi}], fri }
export function malFor(graf) {
  if (graf.mal === 'fri') {
    if (!graf.fri) throw new Error('Grafen mangler beskrivelse.');
    return lagFriMal({ ...graf.fri, tittel: graf.tittel });
  }
  const mal = MALER[graf.mal];
  if (!mal) throw new Error(`Ukjent grafmal «${graf.mal}».`);
  return mal;
}

// Startverdier: malens standardverdier, overskrevet av verdiene Claude har valgt.
// Hvis en verdi ligger utenfor glidebryterens område, utvides området.
export function startParametre(mal, startverdier = []) {
  const parametre = mal.parametre.map((p) => ({ ...p }));
  const verdier = {};
  for (const p of parametre) verdier[p.id] = p.start;
  for (const { id, verdi } of startverdier || []) {
    const p = parametre.find((x) => x.id === id);
    if (!p || typeof verdi !== 'number' || !isFinite(verdi)) continue;
    verdier[id] = verdi;
    if (verdi < p.min) p.min = verdi;
    if (verdi > p.max) p.max = verdi;
  }
  return { parametre, verdier };
}
