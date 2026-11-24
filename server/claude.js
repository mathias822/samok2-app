// Alt som har med Claude API å gjøre ligger her.
// API-nøkkelen leses fra .env-filen av serveren og sendes aldri til nettleseren.

import Anthropic from '@anthropic-ai/sdk';
import { ANALYSE_SKJEMA, OPPGAVE_SKJEMA, VURDERING_SKJEMA } from './skjema.js';
import { FELLES, analyseTekst, oppgaveTekst, vurderingTekst } from '../public/js/prompter.js';

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
  innhold.push({ type: 'text', text: analyseTekst(filer.length, notat) });
  return kallClaude({ system: FELLES, innhold, skjema: ANALYSE_SKJEMA });
}

// ---------- 2. Oppgaver ----------

export async function lagOppgaver({ kontekst, antall, nivå }) {
  const tekst = oppgaveTekst(kontekst, antall, nivå);
  return kallClaude({ system: FELLES, innhold: [{ type: 'text', text: tekst }], skjema: OPPGAVE_SKJEMA });
}

// ---------- 3. Vurdering av drøftingssvar ----------

export async function vurderSvar({ sporsmal, vurderingskriterier, losningsforslag, svar }) {
  const tekst = vurderingTekst({ sporsmal, vurderingskriterier, losningsforslag, svar });
  return kallClaude({ system: FELLES, innhold: [{ type: 'text', text: tekst }], skjema: VURDERING_SKJEMA, maksTokens: 16000 });
}
