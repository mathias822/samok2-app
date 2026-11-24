// Temaer i Samfunnsøkonomi 2 (LK20).
// Listen er en praktisk inndeling av faget basert på læreplanen, ikke ordrette kompetansemål.
// Filen brukes både av nettleseren og av backenden (server.js).

export const FAG_NAVN = 'Samfunnsøkonomi 2';

export const TEMAER = [
  { id: 'modeller', navn: 'Økonomiske modeller og tenkemåter' },
  { id: 'marked', navn: 'Markeder, tilbud og etterspørsel' },
  { id: 'nasjonalregnskap', navn: 'Nasjonalregnskap og BNP' },
  { id: 'konjunkturer', navn: 'Konjunkturer og produksjonsgap' },
  { id: 'makromodell', navn: 'Keynesiansk modell og multiplikator' },
  { id: 'finanspolitikk', navn: 'Finanspolitikk og statsbudsjett' },
  { id: 'penger', navn: 'Penger, banker og kreditt' },
  { id: 'pengepolitikk', navn: 'Pengepolitikk, rente og Norges Bank' },
  { id: 'inflasjon', navn: 'Inflasjon og prisstabilitet' },
  { id: 'arbeidsmarked', navn: 'Arbeidsmarked og arbeidsledighet' },
  { id: 'handel', navn: 'Internasjonal handel og globalisering' },
  { id: 'valuta', navn: 'Valuta og valutakurs' },
  { id: 'vekst', navn: 'Økonomisk vekst og produktivitet' },
  { id: 'fordeling', navn: 'Fordeling, velferd og skatt' },
  { id: 'barekraft', navn: 'Bærekraft, miljø og klima' },
  { id: 'norsk_okonomi', navn: 'Norsk økonomi, petroleum og handlingsregelen' },
  { id: 'kriser', navn: 'Finanskriser og økonomisk ustabilitet' },
];

export const TEMA_IDER = TEMAER.map((t) => t.id);

export function temaNavn(id) {
  return TEMAER.find((t) => t.id === id)?.navn ?? id;
}
