// Høytlesning.
//
// Appen snakker med en «talemotor» gjennom fire funksjoner: les, pause, fortsett, stopp.
// I dag brukes nettleserens innebygde tale (Web Speech API).
// Vil du senere bruke en bedre taletjeneste (f.eks. en sky-tjeneste med naturlige norske stemmer),
// lager du en ny klasse med de samme funksjonene og bytter den inn nederst i filen
// (se README, avsnittet «Bytte til bedre stemme»).

class NettleserTale {
  constructor() {
    this.navn = 'Nettleserens innebygde stemme';
    this.biter = [];
    this.indeks = 0;
    this.hastighet = 1;
    this.stemmeNavn = null;
    this.vedEndring = () => {};
    this.status = 'stoppet'; // stoppet | spiller | pause
    this.generasjon = 0; // økes ved stopp/omstart, slik at gamle hendelser fra nettleseren ignoreres
  }

  støttes() {
    return 'speechSynthesis' in window;
  }

  stemmer() {
    if (!this.støttes()) return [];
    const alle = speechSynthesis.getVoices();
    const norske = alle.filter((v) => /^(nb|no|nn)([-_]|$)/i.test(v.lang));
    return norske.length ? norske : alle.filter((v) => /^(da|sv)/i.test(v.lang));
  }

  velgStemme() {
    const stemmer = this.stemmer();
    return stemmer.find((v) => v.name === this.stemmeNavn)
      || stemmer.find((v) => /natural|online/i.test(v.name))
      || stemmer[0]
      || null;
  }

  // Lange tekster deles i setninger. Noen nettlesere stopper midt i lange avsnitt ellers.
  delOpp(tekst) {
    const setninger = tekst.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*\s*/g) || [tekst];
    const biter = [];
    let nå = '';
    for (const s of setninger) {
      if ((nå + s).length > 220 && nå) { biter.push(nå); nå = ''; }
      nå += s;
    }
    if (nå.trim()) biter.push(nå);
    return biter;
  }

  les(tekst) {
    if (!this.støttes()) { alert('Nettleseren din støtter ikke høytlesning. Prøv Microsoft Edge eller Google Chrome.'); return; }
    this.stopp();
    this.biter = this.delOpp(tekst);
    this.indeks = 0;
    this.status = 'spiller';
    this.vedEndring();
    this.lesNeste();
  }

  lesNeste() {
    if (this.status === 'stoppet') return;
    if (this.indeks >= this.biter.length) { this.status = 'stoppet'; this.vedEndring(); return; }
    const ytring = new SpeechSynthesisUtterance(this.biter[this.indeks]);
    const stemme = this.velgStemme();
    if (stemme) { ytring.voice = stemme; ytring.lang = stemme.lang; } else ytring.lang = 'nb-NO';
    ytring.rate = this.hastighet;
    const gen = this.generasjon;
    const ferdig = () => { if (gen !== this.generasjon) return; this.indeks++; this.lesNeste(); };
    ytring.onend = ferdig;
    ytring.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') ferdig(); };
    speechSynthesis.speak(ytring);
  }

  pause() {
    if (this.status !== 'spiller') return;
    speechSynthesis.pause();
    this.status = 'pause';
    this.vedEndring();
  }

  fortsett() {
    if (this.status !== 'pause') return;
    this.status = 'spiller';
    speechSynthesis.resume();
    // Noen nettlesere fortsetter ikke etter pause – da starter vi gjeldende setning på nytt.
    setTimeout(() => {
      if (this.status === 'spiller' && !speechSynthesis.speaking) { this.generasjon++; this.lesNeste(); }
    }, 300);
    this.vedEndring();
  }

  stopp() {
    this.generasjon++;
    this.status = 'stoppet';
    if (this.støttes()) speechSynthesis.cancel();
    this.vedEndring();
  }

  settHastighet(h) {
    this.hastighet = h;
    // Ny hastighet gjelder fra neste setning. Hvis vi spiller, starter vi setningen på nytt med ny fart.
    if (this.status === 'spiller') {
      this.generasjon++;
      speechSynthesis.cancel();
      setTimeout(() => this.lesNeste(), 50);
    }
  }

  settStemme(navn) {
    this.stemmeNavn = navn;
  }
}

// ---- Her velges talemotoren. Bytt ut denne linjen for å koble på en annen tjeneste. ----
export const tale = new NettleserTale();
