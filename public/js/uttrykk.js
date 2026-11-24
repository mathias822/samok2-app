// En liten og trygg tolker for matematiske uttrykk, f.eks. "a - b*x" eller "100*(1+g/100)^x".
// Vi bruker den til "fri" grafer som Claude beskriver med likninger.
// Den kjører IKKE vilkårlig JavaScript – bare tall, variabler, + - * / ^, parenteser og noen få funksjoner.

const FUNKSJONER = {
  sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp,
  sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max,
};
const KONSTANTER = { pi: Math.PI, e: Math.E };

function tokeniser(tekst) {
  const tokens = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?(?:e[+-]?\d+)?)|([A-Za-z_æøåÆØÅ][A-Za-z0-9_æøåÆØÅ]*)|(\*\*|[-+*/^(),]))/y;
  let pos = 0;
  const s = String(tekst).trim();
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m || m[0].length === 0) throw new Error(`Ugyldig tegn i uttrykket ved «${s.slice(pos, pos + 5)}»`);
    pos = re.lastIndex;
    if (m[1]) tokens.push({ t: 'tall', v: parseFloat(m[1].replace(',', '.')) });
    else if (m[2]) tokens.push({ t: 'navn', v: m[2] });
    else tokens.push({ t: 'op', v: m[3] === '**' ? '^' : m[3] });
  }
  return tokens;
}

// Rekursiv nedstigning. Returnerer en funksjon (variabler) => tall.
export function kompiler(tekst) {
  const tokens = tokeniser(tekst);
  let i = 0;
  const se = () => tokens[i];
  const ta = (v) => {
    const tok = tokens[i];
    if (v !== undefined && (!tok || tok.v !== v)) throw new Error(`Forventet «${v}» i uttrykket`);
    i++;
    return tok;
  };

  function sum() {
    let venstre = produkt();
    while (se() && (se().v === '+' || se().v === '-')) {
      const op = ta().v;
      const høyre = produkt();
      const l = venstre;
      venstre = op === '+' ? (v) => l(v) + høyre(v) : (v) => l(v) - høyre(v);
    }
    return venstre;
  }
  function produkt() {
    let venstre = unær();
    while (se() && (se().v === '*' || se().v === '/')) {
      const op = ta().v;
      const høyre = unær();
      const l = venstre;
      venstre = op === '*' ? (v) => l(v) * høyre(v) : (v) => l(v) / høyre(v);
    }
    return venstre;
  }
  function unær() {
    if (se() && se().v === '-') { ta(); const u = unær(); return (v) => -u(v); }
    if (se() && se().v === '+') { ta(); return unær(); }
    return potens();
  }
  function potens() {
    const grunntall = atom();
    if (se() && se().v === '^') {
      ta();
      const eksponent = unær(); // høyreassosiativ
      return (v) => Math.pow(grunntall(v), eksponent(v));
    }
    return grunntall;
  }
  function atom() {
    const tok = ta();
    if (!tok) throw new Error('Uttrykket slutter for tidlig');
    if (tok.t === 'tall') return () => tok.v;
    if (tok.v === '(') { const inni = sum(); ta(')'); return inni; }
    if (tok.t === 'navn') {
      if (FUNKSJONER[tok.v] && se() && se().v === '(') {
        ta('(');
        const args = [sum()];
        while (se() && se().v === ',') { ta(); args.push(sum()); }
        ta(')');
        const f = FUNKSJONER[tok.v];
        return (v) => f(...args.map((a) => a(v)));
      }
      const navn = tok.v;
      return (v) => {
        if (navn in v) return v[navn];
        if (navn in KONSTANTER) return KONSTANTER[navn];
        throw new Error(`Ukjent variabel «${navn}»`);
      };
    }
    throw new Error(`Uventet «${tok.v}» i uttrykket`);
  }

  const resultat = sum();
  if (i < tokens.length) throw new Error(`Uventet «${tokens[i].v}» i uttrykket`);
  return resultat;
}
