// Eksempelsvar: brukes i demo-modus (uten API-nøkkel) og for «Prøv med en eksempelside».
// Slås på automatisk når det ikke finnes noen API-nøkkel, eller med DEMO=1 i .env.

export function demoAnalyse() {
  return {
    lesbar: true,
    tittel: 'Demo: Den keynesianske modellen og finanspolitikk',
    sammendrag:
      'Dette er et eksempel fra demo-modus. Siden handler om hvordan samlet etterspørsel bestemmer produksjonen i økonomien på kort sikt. ' +
      'I den keynesianske modellen er BNP lik summen av privat konsum, realinvesteringer, offentlig kjøp av varer og tjenester og eksport, minus import. ' +
      'Konsumet avhenger av disponibel inntekt, og hvor mye av en ekstra krone som går til konsum, kalles den marginale konsumtilbøyeligheten. ' +
      'Når staten øker sine kjøp, øker inntektene til husholdningene, som igjen bruker mer penger. Slik får vi en multiplikatoreffekt, der BNP øker mer enn den første økningen i offentlige kjøp. ' +
      'Import virker som en lekkasje, fordi en del av etterspørselen går til produksjon i andre land. Derfor er multiplikatoren mindre i en åpen økonomi som den norske.',
    hovedpoenger: [
      'På kort sikt bestemmes BNP av samlet etterspørsel: Y = C + I + G + X − Q.',
      'Privat konsum avhenger av disponibel inntekt (Y − T).',
      'Multiplikatoren viser hvor mye BNP endres når den autonome etterspørselen endres med én krone.',
      'Høy importtilbøyelighet gir en mindre multiplikator.',
      'Ekspansiv finanspolitikk betyr økte offentlige utgifter eller lavere skatter.',
    ],
    temaer: ['makromodell', 'finanspolitikk'],
    begreper: [
      { begrep: 'Marginal konsumtilbøyelighet', forklaring: 'Hvor stor del av en ekstra krone i disponibel inntekt som brukes til konsum.', eksempel: 'Hvis du får 100 kr mer og bruker 60 kr, er den marginale konsumtilbøyeligheten 0,6.', tema: 'makromodell' },
      { begrep: 'Multiplikator', forklaring: 'Tallet som viser hvor mye BNP endres når en autonom etterspørselskomponent (f.eks. G) endres med én enhet.', eksempel: 'Med multiplikator 1,67 gir 10 mrd. kr økte offentlige kjøp ca. 16,7 mrd. kr høyere BNP.', tema: 'makromodell' },
      { begrep: 'Ekspansiv finanspolitikk', forklaring: 'Når staten øker utgiftene eller senker skattene for å øke samlet etterspørsel.', eksempel: 'Under koronapandemien brukte Norge mer oljepenger for å holde aktiviteten oppe.', tema: 'finanspolitikk' },
      { begrep: 'Disponibel inntekt', forklaring: 'Inntekten husholdningene har igjen etter skatt, og som de kan bruke til konsum eller sparing.', eksempel: 'Lønn på 500 000 kr minus 150 000 kr i skatt gir 350 000 kr i disponibel inntekt.', tema: 'makromodell' },
    ],
    grafer: [
      { mal: 'keynes-kryss', tittel: 'Multiplikatoreffekten', kobling: 'Viser hvordan økte offentlige kjøp (G) øker BNP gjennom multiplikatoren.', startverdier: [], fri: null },
      { mal: 'ad-as', tittel: 'Finanspolitikk i AD-AS-modellen', kobling: 'Ekspansiv finanspolitikk forskyver AD mot høyre.', startverdier: [{ id: 'A', verdi: 140 }], fri: null },
      {
        mal: 'fri', tittel: 'Valutamarkedet (fri graf)', kobling: 'Eksempel på en graf Claude beskriver med egne likninger.', startverdier: [],
        fri: {
          xAkse: { navn: 'Mengde euro (mrd.)', min: 0, max: 100 },
          yAkse: { navn: 'Valutakurs (kroner per euro)', min: 0, max: 20 },
          parametre: [
            { id: 'e', navn: 'Etterspørsel etter euro (f.eks. import)', min: 10, max: 20, steg: 0.5, start: 15 },
            { id: 's', navn: 'Tilbud av euro (f.eks. eksport)', min: 0, max: 10, steg: 0.5, start: 5 },
          ],
          kurver: [
            { id: 'D', navn: 'Etterspørsel etter euro', type: 'y_av_x', uttrykk: 'e - 0.1*x' },
            { id: 'S', navn: 'Tilbud av euro', type: 'y_av_x', uttrykk: 's + 0.1*x' },
          ],
          skjaeringer: [{ kurve1: 'D', kurve2: 'S', navn: 'Likevektskurs' }],
        },
      },
    ],
  };
}

export function demoOppgaver(antall) {
  const mal = [
    { type: 'flervalg', tema: 'makromodell', sporsmal: 'Hva skjer med multiplikatoren hvis den marginale importtilbøyeligheten øker?', alternativer: ['Den øker', 'Den blir mindre', 'Den er uendret', 'Den blir negativ'], riktigAlternativ: 1, fasitTall: 0, enhet: '', toleranse: 0, losningsforslag: 'Multiplikatoren er 1/(1 − c + q). Når q øker, blir nevneren større og multiplikatoren mindre. Mer av etterspørselen lekker ut til utlandet.', vurderingskriterier: [], graf: null },
    { type: 'flervalg', tema: 'finanspolitikk', sporsmal: 'Hvilket tiltak er et eksempel på kontraktiv finanspolitikk?', alternativer: ['Lavere styringsrente', 'Økte offentlige investeringer', 'Økt merverdiavgift', 'Lavere inntektsskatt'], riktigAlternativ: 2, fasitTall: 0, enhet: '', toleranse: 0, losningsforslag: 'Høyere skatter (som økt merverdiavgift) reduserer etterspørselen og er kontraktiv finanspolitikk. Styringsrenten er pengepolitikk.', vurderingskriterier: [], graf: null },
    { type: 'regning', tema: 'makromodell', sporsmal: 'Den marginale konsumtilbøyeligheten er 0,6 og den marginale importtilbøyeligheten er 0,2. Staten øker offentlige kjøp med 30 mrd. kr. Hvor mye øker BNP?', alternativer: [], riktigAlternativ: -1, fasitTall: 50, enhet: 'mrd. kr', toleranse: 0.5, losningsforslag: 'Multiplikator = 1/(1 − 0,6 + 0,2) = 1/0,6 ≈ 1,67. ΔY = 1,67 · 30 = 50 mrd. kr.', vurderingskriterier: [], graf: null },
    { type: 'drofting', tema: 'finanspolitikk', sporsmal: 'Drøft hvordan økt bruk av oljepenger over statsbudsjettet kan påvirke norsk økonomi på kort og lang sikt.', alternativer: [], riktigAlternativ: -1, fasitTall: 0, enhet: '', toleranse: 0, losningsforslag: 'Kort sikt: økt etterspørsel, høyere BNP og lavere ledighet via multiplikatoren, men risiko for press i økonomien og høyere inflasjon, som kan gi renteøkning og sterkere krone. Lang sikt: handlingsregelen, fordeling mellom generasjoner, konkurranseutsatt sektor og omstilling.', vurderingskriterier: ['Bruker den keynesianske modellen/multiplikatoren', 'Skiller mellom kort og lang sikt', 'Drøfter inflasjon og rente', 'Nevner handlingsregelen', 'Har en begrunnet konklusjon'], graf: null },
    { type: 'graf', tema: 'finanspolitikk', sporsmal: 'Regjeringen vedtar å øke offentlige kjøp av varer og tjenester. Flytt riktig glidebryter for å vise hva som skjer.', alternativer: [], riktigAlternativ: -1, fasitTall: 0, enhet: '', toleranse: 0, losningsforslag: 'Økte offentlige kjøp (G) forskyver SE-kurven opp. Den nye likevekten gir høyere BNP, og økningen er multiplikatoren ganger økningen i G.', vurderingskriterier: [], graf: { mal: 'keynes-kryss', startverdier: [], riktigParameter: 'G', riktigRetning: 'opp' } },
    { type: 'graf', tema: 'marked', sporsmal: 'Prisen på en viktig innsatsfaktor stiger kraftig. Flytt riktig glidebryter for å vise hva som skjer i markedet.', alternativer: [], riktigAlternativ: -1, fasitTall: 0, enhet: '', toleranse: 0, losningsforslag: 'Høyere kostnader forskyver tilbudskurven oppover/mot venstre. Prisen øker og omsatt mengde faller.', vurderingskriterier: [], graf: { mal: 'tilbud-ettersporsel', startverdier: [], riktigParameter: 'c', riktigRetning: 'opp' } },
  ];
  const ut = [];
  for (const type of ['flervalg', 'regning', 'drofting', 'graf']) {
    const av = mal.filter((o) => o.type === type);
    for (let i = 0; i < (antall[type] || 0); i++) ut.push(av[i % av.length]);
  }
  return { oppgaver: ut };
}

export function demoVurdering(svar) {
  const ord = svar.trim().split(/\s+/).filter(Boolean).length;
  return {
    tilbakemelding: `Dette er en demo-vurdering, så innholdet i svaret ditt er ikke lest. Svaret ditt er på ${ord} ord. Med en API-nøkkel vurderer Claude svaret ditt mot kriteriene.`,
    styrker: ['Du har levert et svar (demo).'],
    forbedringer: ['Bruk fagbegreper og modeller aktivt.', 'Drøft flere sider av saken og avslutt med en konklusjon.'],
    karakter: ord > 250 ? 4 : ord > 100 ? 3 : 2,
    modellsvar: 'I demo-modus finnes det ikke noe modellsvar. Se løsningsforslaget under oppgaven.',
  };
}
