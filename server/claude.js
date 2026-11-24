// Alt som har med Claude API å gjøre ligger her.
// API-nøkkelen leses fra .env-filen av serveren og sendes aldri til nettleseren.

import Anthropic from '@anthropic-ai/sdk';
import { ANALYSE_SKJEMA, OPPGAVE_SKJEMA, VURDERING_SKJEMA } from './skjema.js';
import { TEMAER, FAG_NAVN } from '../public/js/fag.js';
import { malKatalog } from '../public/js/grafmaler.js';

export const MODELL = process.env.CLAUDE_MODELL || 'claude-sonnet-5-5';
const INNSATS = process.env.CLAUDE_INNSATS || 'medium'; // low | medium | high

// Disse modellene støtter automatisk «reserve-modell» hvis en forespørsel blir avvist av sikkerhetsfiltre.
const STØTTER_RESERVE = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-fable-5-2'];

let klient = null;
function hentKlient() {
  if (!klient) klient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return klient;
}

export class BrukerFeil extends Error {}

const TEMALISTE = TEMAER.map((t) => `- ${t.id}: ${t.navn}`).join('\n');

const FELLES = `Du er en erfaren og tålmodig lærer i faget ${FAG_NAVN} på videregående skole i Norge (læreplan LK20).
Du hjelper en elev med å forstå faget. Skriv alltid på norsk bokmål, med et enkelt og presist språk som en elev på vg2/vg3 forstår.
Bruk faglig korrekte norske økonomiske begreper (f.eks. BNP, samlet etterspørsel, produksjonsgap, styringsrente, marginal konsumtilbøyelighet, handlingsregelen).
Når du skriver tall, bruk desimalkomma i teksten (f.eks. 0,6).

Temaene i faget (bruk disse id-ene):
${TEMALISTE}`;

const GRAF_INSTRUKS = `GRAFER:
Appen tegner interaktive grafer selv. Du beskriver dem bare som data. Det finnes ferdige grafmaler med riktige formler:
${malKatalog()}

Regler for grafer:
- Bruk en ferdig mal når modellen passer. Velg startverdier (id + verdi) som passer til eksempelet i teksten, ellers kan startverdier være en tom liste. Sett "fri" til null.
- Bruk mal "fri" bare når ingen ferdig mal passer (f.eks. valutamarked, Laffer-kurve, Lorenz-kurve, produksjonsfunksjon). Da fyller du ut "fri":
  - xAkse/yAkse: norsk aksenavn med symbol, f.eks. "Valutakurs (kroner per euro)", og fornuftige min/max.
  - parametre: glidebrytere med kort id (bokstaver), norsk navn, min, max, steg og start.
  - kurver: uttrykk for y som funksjon av x og parameter-id-ene (type "y_av_x"), eller en loddrett linje der uttrykket gir x-verdien (type "loddrett"). Lov i uttrykk: tall med punktum som desimaltegn, x, parameter-id-er, + - * / ^, parenteser, sqrt, ln, exp, min, max. Skriv alltid * for gange.
  - skjaeringer: hvilke kurvepar som har et likevektspunkt som skal markeres.
- "kobling": én setning om hvordan grafen henger sammen med teksten.
- Ikke lag grafer som ikke er relevante.`;

async function kallClaude({ system, innhold, skjema, maksTokens = 32000 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new BrukerFeil('Mangler API-nøkkel. Legg den inn i filen .env (se README).');
  }
  const brukReserve = STØTTER_RESERVE.includes(MODELL);
  const forespørsel = {
    model: MODELL,
    max_tokens: maksTokens,
    system,
    messages: [{ role: 'user', content: innhold }],
    output_config: { effort: INNSATS, format: { type: 'json_schema', schema: skjema } },
    ...(brukReserve ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  };

  let svar;
  try {
    // Strømming hindrer tidsavbrudd på lange svar. finalMessage() venter til hele svaret er ferdig.
    svar = await hentKlient().beta.messages.stream(forespørsel).finalMessage();
  } catch (feil) {
    if (feil instanceof Anthropic.AuthenticationError) throw new BrukerFeil('API-nøkkelen ble avvist. Sjekk at nøkkelen i .env er riktig kopiert.');
    if (feil instanceof Anthropic.PermissionDeniedError) throw new BrukerFeil('API-nøkkelen har ikke tilgang til denne modellen. Prøv en annen modell i .env.');
    if (feil instanceof Anthropic.NotFoundError) throw new BrukerFeil(`Fant ikke modellen «${MODELL}». Sjekk CLAUDE_MODELL i .env.`);
    if (feil instanceof Anthropic.RateLimitError) throw new BrukerFeil('For mange forespørsler eller tom kreditt. Vent litt, eller sjekk kontoen på console.anthropic.com.');
    if (feil instanceof Anthropic.BadRequestError) throw new BrukerFeil(`Claude avviste forespørselen: ${feil.message}`);
    if (feil instanceof Anthropic.APIConnectionError) throw new BrukerFeil('Fikk ikke kontakt med Claude. Sjekk internettforbindelsen.');
    if (feil instanceof Anthropic.APIError) throw new BrukerFeil(`Feil fra Claude API (${feil.status}): ${feil.message}`);
    throw feil;
  }

  if (svar.stop_reason === 'refusal') throw new BrukerFeil('Claude ville ikke svare på denne forespørselen.');
  if (svar.stop_reason === 'max_tokens') throw new BrukerFeil('Svaret ble for langt og ble kuttet. Prøv med færre sider om gangen.');

  const tekstSvar = svar.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return { data: JSON.parse(tekstSvar), bruk: svar.usage };
  } catch {
    throw new BrukerFeil('Claude svarte i et format appen ikke forstod. Prøv igjen.');
  }
}

// ---------- 1. Analyse av sider ----------

export async function analyserSider({ filer, notat }) {
  const innhold = [];
  for (const fil of filer) {
    if (fil.type === 'application/pdf') {
      innhold.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fil.data } });
    } else {
      innhold.push({ type: 'image', source: { type: 'base64', media_type: fil.type, data: fil.data } });
    }
  }
  innhold.push({
    type: 'text',
    text: `Her er ${filer.length === 1 ? 'en side' : `${filer.length} filer`} fra læreboka eller notatene mine i ${FAG_NAVN}.
${notat ? `Min kommentar: ${notat}\n` : ''}
Analyser innholdet og gi:
- lesbar: false hvis du ikke klarer å lese innholdet (da kan resten være kort)
- tittel: kort, beskrivende tittel
- sammendrag: et sammenhengende sammendrag (ca. 150–300 ord) skrevet for å kunne leses høyt. Ikke bruk punktlister, formler med spesialtegn eller forkortelser som er vanskelige å lese høyt.
- hovedpoenger: 3–8 korte hovedpoenger
- temaer: hvilke temaer i faget siden handler om (1–3 stk.)
- begreper: viktige fagbegreper fra siden med enkel forklaring, et konkret eksempel (gjerne fra norsk økonomi) og tema
- grafer: 0–3 interaktive grafer som hjelper meg å forstå stoffet

${GRAF_INSTRUKS}`,
  });
  return kallClaude({ system: FELLES, innhold, skjema: ANALYSE_SKJEMA });
}

// ---------- 2. Oppgaver ----------

export async function lagOppgaver({ kontekst, antall, nivå }) {
  const tekst = `Lag øvingsoppgaver basert på dette stoffet som jeg har lest:

${kontekst}

Lag disse oppgavene (antallet er viktig):
- ${antall.flervalg} flervalgsoppgaver (type "flervalg"): 4 alternativer, riktigAlternativ er indeksen (0–3) til riktig svar. Plasser riktig svar på ulike posisjoner.
- ${antall.regning} korte regneoppgaver (type "regning"): ett tallsvar i fasitTall, enhet (f.eks. "mrd. kr", "%" eller tom), toleranse = hvor mye svaret kan avvike og fortsatt regnes som riktig (f.eks. 0,5 % av svaret, minst avrundingsfeil).
- ${antall.drofting} drøftingsoppgaver (type "drofting") som ligner på eksamen i ${FAG_NAVN} (f.eks. «Drøft hvilke virkninger …», «Gjør rede for … og drøft …»). Gi 3–6 vurderingskriterier.
- ${antall.graf} grafoppgaver (type "graf"): Eleven skal flytte riktig glidebryter i en ferdig grafmal. Beskriv en hendelse i sporsmal, f.eks. «Staten øker offentlige kjøp av varer og tjenester. Flytt riktig kurve.». Fyll ut graf med mal, startverdier, riktigParameter (id-en til parameteren som skal endres) og riktigRetning ("opp" = høyere verdi, "ned" = lavere verdi). Ikke avslør i spørsmålet hvilken parameter som skal flyttes.

Nivå: ${nivå}.
For alle oppgaver: losningsforslag skal forklare løsningen steg for steg (for regning: vis utregningen; for drøfting: et kort modellsvar med de viktigste momentene; for graf: hvorfor denne kurven flyttes og hva som skjer med likevekten).
Felter som ikke gjelder oppgavetypen fylles slik: alternativer [], riktigAlternativ -1, fasitTall 0, enhet "", toleranse 0, vurderingskriterier [], graf null.

Grafmaler som kan brukes i grafoppgaver:
${malKatalog()}`;
  return kallClaude({ system: FELLES, innhold: [{ type: 'text', text: tekst }], skjema: OPPGAVE_SKJEMA });
}

// ---------- 3. Vurdering av drøftingssvar ----------

export async function vurderSvar({ sporsmal, vurderingskriterier, losningsforslag, svar }) {
  const tekst = `Vurder elevens svar på denne drøftingsoppgaven.

OPPGAVE: ${sporsmal}

VURDERINGSKRITERIER:
${(vurderingskriterier || []).map((k) => `- ${k}`).join('\n')}

LØSNINGSFORSLAG (til deg som lærer):
${losningsforslag}

ELEVENS SVAR:
"""
${svar}
"""

Gi:
- tilbakemelding: en kort, oppmuntrende og ærlig helhetsvurdering (3–5 setninger)
- styrker: hva eleven gjør bra
- forbedringer: konkrete tips for å få bedre uttelling på eksamen (f.eks. bruk av begreper, modeller, grafer, drøfting av flere sider, konklusjon)
- karakter: omtrentlig karakter 1–6 slik en sensor ville vurdert svaret ut fra lengde og kvalitet
- modellsvar: et godt eksempel på et svar (ca. 200–350 ord)`;
  return kallClaude({ system: FELLES, innhold: [{ type: 'text', text: tekst }], skjema: VURDERING_SKJEMA, maksTokens: 16000 });
}
