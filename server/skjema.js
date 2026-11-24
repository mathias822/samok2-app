// JSON-skjemaer som tvinger Claude til å svare i et fast format (structured outputs).
// Da kan appen alltid lese svaret uten gjetting.

import { TEMA_IDER } from '../public/js/fag.js';
import { MAL_IDER } from '../public/js/grafmaler.js';

const tekst = { type: 'string' };
const tall = { type: 'number' };
const tekstliste = { type: 'array', items: tekst };
const tema = { type: 'string', enum: TEMA_IDER };

function objekt(properties) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

const startverdier = {
  type: 'array',
  items: objekt({ id: tekst, verdi: tall }),
};

const friGraf = objekt({
  xAkse: objekt({ navn: tekst, min: tall, max: tall }),
  yAkse: objekt({ navn: tekst, min: tall, max: tall }),
  parametre: {
    type: 'array',
    items: objekt({ id: tekst, navn: tekst, min: tall, max: tall, steg: tall, start: tall }),
  },
  kurver: {
    type: 'array',
    items: objekt({ id: tekst, navn: tekst, type: { type: 'string', enum: ['y_av_x', 'loddrett'] }, uttrykk: tekst }),
  },
  skjaeringer: {
    type: 'array',
    items: objekt({ kurve1: tekst, kurve2: tekst, navn: tekst }),
  },
});

const graf = objekt({
  mal: { type: 'string', enum: [...MAL_IDER, 'fri'] },
  tittel: tekst,
  kobling: tekst,
  startverdier,
  fri: { anyOf: [friGraf, { type: 'null' }] },
});

export const ANALYSE_SKJEMA = objekt({
  lesbar: { type: 'boolean' },
  tittel: tekst,
  sammendrag: tekst,
  hovedpoenger: tekstliste,
  temaer: { type: 'array', items: tema },
  begreper: {
    type: 'array',
    items: objekt({ begrep: tekst, forklaring: tekst, eksempel: tekst, tema }),
  },
  grafer: { type: 'array', items: graf },
});

const grafOppgave = objekt({
  mal: { type: 'string', enum: MAL_IDER },
  startverdier,
  riktigParameter: tekst,
  riktigRetning: { type: 'string', enum: ['opp', 'ned'] },
});

export const OPPGAVE_SKJEMA = objekt({
  oppgaver: {
    type: 'array',
    items: objekt({
      type: { type: 'string', enum: ['flervalg', 'regning', 'drofting', 'graf'] },
      tema,
      sporsmal: tekst,
      alternativer: tekstliste,
      riktigAlternativ: { type: 'integer' },
      fasitTall: tall,
      enhet: tekst,
      toleranse: tall,
      losningsforslag: tekst,
      vurderingskriterier: tekstliste,
      graf: { anyOf: [grafOppgave, { type: 'null' }] },
    }),
  },
});

export const VURDERING_SKJEMA = objekt({
  tilbakemelding: tekst,
  styrker: tekstliste,
  forbedringer: tekstliste,
  karakter: { type: 'integer', enum: [1, 2, 3, 4, 5, 6] },
  modellsvar: tekst,
});

export const FORKLAR_SKJEMA = objekt({
  forklaring: tekst,
});
