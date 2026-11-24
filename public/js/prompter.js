// Instruksjonene (promptene) til Claude. Brukes både av backenden (server/claude.js)
// og av nettsideversjonen på claude.ai, slik at begge gir like svar.

import { TEMAER, FAG_NAVN } from './fag.js';
import { malKatalog } from './grafmaler.js';

const TEMALISTE = TEMAER.map((t) => `- ${t.id}: ${t.navn}`).join('\n');

export const FELLES = `Du er en erfaren og tålmodig lærer i faget ${FAG_NAVN} på videregående skole i Norge (læreplan LK20).
Du hjelper en elev med å forstå faget. Skriv alltid på norsk bokmål, med et enkelt og presist språk som en elev på vg2/vg3 forstår.
Bruk faglig korrekte norske økonomiske begreper (f.eks. BNP, samlet etterspørsel, produksjonsgap, styringsrente, marginal konsumtilbøyelighet, handlingsregelen).
Når du skriver tall, bruk desimalkomma i teksten (f.eks. 0,6).

Temaene i faget (bruk disse id-ene):
${TEMALISTE}`;

export const GRAF_INSTRUKS = `GRAFER:
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


export function analyseTekst(antallFiler, notat) {
  return `Her er ${antallFiler === 1 ? 'en side' : `${antallFiler} filer`} fra læreboka eller notatene mine i ${FAG_NAVN}.
${notat ? `Min kommentar: ${notat}\n` : ''}
Analyser innholdet og gi:
- lesbar: false hvis du ikke klarer å lese innholdet (da kan resten være kort)
- tittel: kort, beskrivende tittel
- sammendrag: et sammenhengende sammendrag (ca. 150–300 ord) skrevet for å kunne leses høyt. Ikke bruk punktlister, formler med spesialtegn eller forkortelser som er vanskelige å lese høyt.
- hovedpoenger: 3–8 korte hovedpoenger
- temaer: hvilke temaer i faget siden handler om (1–3 stk.)
- begreper: viktige fagbegreper fra siden med enkel forklaring, et konkret eksempel (gjerne fra norsk økonomi) og tema
- grafer: 0–3 interaktive grafer som hjelper meg å forstå stoffet

${GRAF_INSTRUKS}`;
}

export function oppgaveTekst(kontekst, antall, nivå) {
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
  return tekst;
}

export function vurderingTekst({ sporsmal, vurderingskriterier, losningsforslag, svar }) {
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
  return tekst;
}
