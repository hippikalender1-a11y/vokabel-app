import { SK, TYPEN, lsGet, lsSet } from "../speicher.js";
import { generiereButtons } from "../quiz.jsx";
import { parseKolumne } from "../importexport.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

export function schliesseVokabelBearbeiten(app) {
  const { setBearbeiteEingaben, setBearbeiteFalsch, setBearbeiteListe, setBearbeiteNur, setBearbeiteVokabel, setModal } = app; setModal(null); setBearbeiteVokabel(null); setBearbeiteEingaben({}); setBearbeiteNur(null); setBearbeiteFalsch(null); setBearbeiteListe(null); }

export function speichereVokabelBearbeitung(app) {
  const { aktiveListeId, bearbeiteEingaben, bearbeiteFalsch, bearbeiteListe, bearbeiteNur, bearbeiteVokabel, listenIndex, schliesseVokabelBearbeiten, setAktiveListe, setModalFehler, setQuiz, speichereIndex } = app;
    if (!bearbeiteVokabel || !bearbeiteListe) return;
    const liste = lsGet(SK.liste(bearbeiteListe.id)) || bearbeiteListe;
    const nur = bearbeiteNur, falschAlt = bearbeiteFalsch;
    const neuEintrag = !!bearbeiteVokabel.neu;
    const orig = neuEintrag ? null : liste.vokabeln.find(v => v.id === bearbeiteVokabel.id);
    if (!neuEintrag && !orig) { schliesseVokabelBearbeiten(); return; }
    let neu;
    const wert = nur ? (bearbeiteEingaben[nur] || '').trim() : '';
    if (nur) {
      if (falschAlt != null) {
        // falsche Antwort ändern; leer = entfernen
        const alt = orig[nur]?.falsch || [];
        neu = { ...orig, [nur]: { ...orig[nur], falsch: wert ? alt.map(f => f === falschAlt ? wert : f) : alt.filter(f => f !== falschAlt) } };
      } else if (nur.startsWith('i')) {
        // Info darf leer werden (Spalte entfällt)
        neu = { ...orig };
        if (wert) neu[nur] = { ...(orig[nur] || { falsch: [] }), wert }; else delete neu[nur];
      } else {
        if (!wert) { setModalFehler("Das Feld darf nicht leer sein."); return; }
        neu = { ...orig, [nur]: { ...(orig[nur] || { falsch: [] }), wert } };
      }
    } else {
      // Lernstand und nicht angezeigte Spalten bleiben erhalten
      neu = neuEintrag ? { id: liste.naechste_id } : { ...orig };
      TYPEN.filter(t => liste.spalten[t].aktiv).forEach(typ => {
        const raw = (bearbeiteEingaben[typ] || '').trim();
        if (raw) neu[typ] = parseKolumne(raw); else delete neu[typ];
      });
      if (TYPEN.filter(t => !t.startsWith('i') && neu[t]?.wert).length < 2) { setModalFehler("Mindestens zwei Spalten (außer Info) ausfüllen."); return; }
    }
    const neueListe = neuEintrag
      ? { ...liste, naechste_id: liste.naechste_id + 1, vokabeln: [...liste.vokabeln, neu] }
      : { ...liste, vokabeln: liste.vokabeln.map(v => v.id === neu.id ? neu : v) };
    lsSet(SK.liste(liste.id), neueListe);
    if (liste.id === aktiveListeId) setAktiveListe(neueListe);
    // laufende Abfrage: Vokabel dort ebenfalls ändern (auch MC-Knöpfe mit der alten Antwort)
    if (!neuEintrag) setQuiz(q => {
      if (!q) return q;
      const passt = v => (v._listeId ?? q.liste.id) === liste.id && (v._origId ?? v.id) === neu.id;
      const spalten = nur ? { [nur]: neu[nur] } : Object.fromEntries(TYPEN.map(t => [t, neu[t]]));
      const auf = v => passt(v) ? { ...v, ...spalten } : v;
      const vokabeln = q.vokabeln.map(auf);
      const neuQ = { ...q, vokabeln, liste: { ...q.liste, vokabeln: q.liste.vokabeln.map(auf) } };
      // gerade gefragte Vokabel und Spalte: Lösung (und MC-Knöpfe) sofort neu
      const typ = q.modus === "diktat" ? q.diktatSpalte : q.antwortTypen?.[q.antwortTypIndex];
      const akt = vokabeln[q.index];
      if (!passt(akt)) return neuQ;
      // schon beantwortete Spalten dieser Vokabel zeigen den neuen Wert
      if (falschAlt == null && q.vorigeAntworten?.length) neuQ.vorigeAntworten = q.vorigeAntworten.map(v =>
        spalten[v.typ]?.wert ? { ...v, wert: spalten[v.typ].wert.split('/').map(x => x.trim()).join(" / ") } : v);
      if (!typ || !(typ in spalten) || q.modus === "diktat") return neuQ;
      if (falschAlt != null) {
        if (q.mcButtons?.length) neuQ.mcButtons = q.mcButtons.flatMap(b => b.korrekt || b.text !== falschAlt ? [b] : wert ? [{ ...b, text: wert }] : []);
        return neuQ;
      }
      neuQ.antwortTeile = (akt[typ]?.wert || "").split('/').map(x => x.trim());
      if (q.mcButtons?.length && q.phase === "eingabe") { const mc = generiereButtons(vokabeln, akt, typ); neuQ.mcButtons = mc.buttons; neuQ.mcRichtig = mc.richtig; }
      return neuQ;
    });
    speichereIndex(listenIndex);   // neu zeichnen (Anzahl, Lernstand in Listen und Statistik)
    schliesseVokabelBearbeiten();
  }

// 176: Vokabel herausnehmen / wieder abfragen (bleibt in der Liste, wird nirgends abgefragt und zählt nicht im Fortschritt)
export function setzeHerausgenommen(app, listeId, origId, an) {
  const { aktiveListeId, setAktiveListe, setFaelligTick } = app;
    const l = lsGet(SK.liste(listeId));
    if (!l) return;
    const neu = { ...l, vokabeln: l.vokabeln.map(v => { if (v.id !== origId) return v; const n = { ...v }; if (an) n.herausgenommen = true; else delete n.herausgenommen; return n; }) };
    lsSet(SK.liste(listeId), neu);
    if (listeId === aktiveListeId) setAktiveListe(neu);
    setFaelligTick(x => x + 1);
  }

// im Quiz: aktuelle Vokabel herausnehmen – sie fällt aus der Runde, weiter mit der nächsten (ohne Wertung)
export function nimmVokabelHeraus(app) {
  const { flashTimerRef, flashWeiterRef, naechsteVokabelState, quiz, setQuiz, setzeHerausgenommen } = app;
    if (!quiz) return;
    const v = quiz.vokabeln[quiz.index];
    if (!v) return;
    setzeHerausgenommen(v._listeId ?? quiz.liste.id, v._origId ?? v.id, true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashWeiterRef.current = null;
    setQuiz(prev => {
      if (!prev) return prev;
      const vokabeln = prev.vokabeln.filter((x, i) => i < prev.index || x.id !== v.id);
      const liste = { ...prev.liste, vokabeln: prev.liste.vokabeln.map(x => x.id === v.id ? { ...x, herausgenommen: true } : x) };
      const basis = { ...prev, liste, vokabeln, ...(prev.spielBasis ? { spielBasis: prev.spielBasis.filter(x => x.id !== v.id) } : {}),
        vokErgebnis: null, erstbewertung: false, letzteWertung: null, diktatWertung: null, flash: false, karteNeinFlash: false };
      if (prev.modus === "diktat") return prev.index >= vokabeln.length ? { ...basis, phase: "fertig" }
        : { ...basis, eingabe: "", diktatAufgedeckt: 0, diktatVersuche: [], phase: "eingabe", feedback: "" };
      return naechsteVokabelState({ ...basis, index: prev.index - 1 });
    });
  }

export function loescheVokabel(app, vokId) {
  const { aktiveListe, aktiveListeId, setAktiveListe, setBearbeiteVokabel, setModal } = app;
    const neueListe = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.filter(v => v.id !== vokId) };
    lsSet(SK.liste(aktiveListeId), neueListe);
    setAktiveListe(neueListe);
    setModal(null); setBearbeiteVokabel(null);
  }

export function fuehreListenZusammen(app) {
  const { aktiveListe, aktiveListeId, mergeQuelleId, setAktiveListe, setMergeQuelleId, setModal } = app;
    if (!mergeQuelleId || mergeQuelleId === aktiveListeId) return;
    const quelle = lsGet(SK.liste(mergeQuelleId));
    if (!quelle) return;
    const ziel = { ...aktiveListe, spalten: {...aktiveListe.spalten}, vokabeln: [...aktiveListe.vokabeln], naechste_id: aktiveListe.naechste_id };
    TYPEN.forEach(typ => {
      if (!ziel.spalten[typ].aktiv && quelle.spalten[typ].aktiv)
        ziel.spalten[typ] = { name: quelle.spalten[typ].name, aktiv: true };
    });
    quelle.vokabeln.forEach(v => ziel.vokabeln.push({ ...v, id: ziel.naechste_id++ }));
    lsSet(SK.liste(aktiveListeId), ziel);
    setAktiveListe(ziel);
    setModal(null); setMergeQuelleId('');
  }
