import { SATZ_PORTION, saetzeAusAntwort, saetzeLaden, saetzeSpeichern, satzPrompt } from "../saetze.js";
import { SK, TYPEN, lsGet } from "../speicher.js";
import { listeSprache, sprachInfo } from "../sprache.js";
import { QUIZ_ARTEN, SCORE_FELD, lernProzent, ohneHinweis, statistikSicht, stufenRegeln } from "../quiz.jsx";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Beispielsätze ergänzen: Prompt für die nächste Portion, KI-Antwort einfügen, übernehmen ──
export async function oeffneSatzFenster(app, listeId) {
  const { setListenSaetze, setModal, setSatzFenster } = app;
    setListenSaetze({ listeId, saetze: await saetzeLaden(listeId) });
    setSatzFenster({ listeId, antwort: "", meldung: "" });
    setModal("saetze");
  }

export function satzPortion(app, listeId, saetze, n) {
  const { einstellungen } = app;
    const liste = lsGet(SK.liste(listeId));
    if (!liste) return null;
    const fremd = TYPEN.find(t => t.startsWith("E") && liste.spalten[t]?.aktiv), deutsch = TYPEN.find(t => t.startsWith("D") && liste.spalten[t]?.aktiv);
    const offen = liste.vokabeln.filter(v => v[fremd]?.wert && (saetze[`${listeId}__${v.id}`] || []).length < n);
    const alsDatei = einstellungen.satzWeg === "datei";
    const teil = offen.slice(0, alsDatei ? 2000 : SATZ_PORTION[n] || 30);
    const sprachName = sprachInfo(listeSprache(liste)).name;
    return { liste, offen: offen.length, gesamt: liste.vokabeln.length, teil, alsDatei,
      prompt: satzPrompt(sprachName, teil.map(v => `${v.id} // ${ohneHinweis(v[fremd].wert)} // ${ohneHinweis(v[deutsch]?.wert || "")}`), n, alsDatei) };
  }

export async function uebernehmeSaetze(app, text) {
  const { ladeSatzStand, listenSaetze, satzFenster, setListenSaetze, setSatzFenster } = app;
    const f = satzFenster;
    if (!f) return;
    const neu = saetzeAusAntwort(typeof text === "string" ? text : f.antwort), liste = lsGet(SK.liste(f.listeId));
    const eintraege = {};
    let anzSaetze = 0;
    Object.entries(neu).forEach(([id, liste2]) => {
      if (!liste?.vokabeln.some(v => String(v.id) === id)) return;
      const key = `${f.listeId}__${id}`, alt = listenSaetze.saetze[key] || [];
      const zusammen = [...alt, ...liste2.filter(x => !alt.some(a => a.s === x.s))].slice(0, 10);
      anzSaetze += zusammen.length - alt.length;
      eintraege[key] = zusammen;
    });
    await saetzeSpeichern(eintraege);
    ladeSatzStand();   // 202
    const saetze = await saetzeLaden(f.listeId);
    setListenSaetze({ listeId: f.listeId, saetze });
    setSatzFenster({ ...f, antwort: "", meldung: Object.keys(eintraege).length ? `${anzSaetze} Sätze für ${Object.keys(eintraege).length} Vokabeln übernommen.` : "Keine passenden Zeilen gefunden – Format „ID // Satz // Übersetzung“ mit *Wort*." });
  }

// eslint-disable-line react-hooks/exhaustive-deps
// Menü einer Liste (lang drücken auf die Kachel bzw. auf den Namen im Listenkopf); imKopf: ohne Verschieben/Auswählen
export function oeffneListeDetail(app, id) {
  const { setAktiveListeId, setAnsicht, setListeNurAus, setListenBereich, setTab, vorigerListenBereich } = app;
    setListeNurAus(false);
    setAktiveListeId(id); setTab("listen"); setAnsicht("liste-detail"); window.scrollTo(0, 0); vorigerListenBereich.current = null; setListenBereich(null);
  }

export function listenMenue(app, l, imKopf = false) {
  const { faelligAktion, faelligVonListen, listenKopieName, listenOrdner, oeffneExport, oeffneListeDetail, oeffneSatzFenster, oeffneSynFenster, resetImport, setAnsicht, setImportBestehendId, setImportZielTyp, setInGruppe, setKlammerZiel, setListeMenueId, setListeNurAus, setListenAuswahl, setListenBereich, setListenSortModus, setListenWahl, setMergeQuelleId, setModal, setModalFehler, setModalInput, setTab, setZuruecksetzenArten, sichtbareListen, sprachFilter, starteAufteilen, verschiebeListenInOrdner } = app;
    const gefiltert = sprachFilter !== "alle";
    return [
      { label: "✎ Umbenennen", fn: () => { setListeMenueId(l.id); setModalInput(l.name); setModalFehler(""); setModal("umbenennen"); } },
      { label: "⧉ Duplizieren", fn: () => { setListeMenueId(l.id); setModalInput(listenKopieName(l.name)); setModalFehler(""); setModal("liste-duplizieren"); } },
      { label: "📤 Exportieren", fn: () => oeffneExport([l.id]) },
      ...(() => { const f = faelligVonListen([l.id]); return faelligAktion(f, imKopf ? { listeId: l.id, ziel: "liste" } : { listeId: l.id, ziel: "raster" }); })(),   // 204
      ...(() => { const n = (lsGet(SK.liste(l.id))?.vokabeln || []).filter(v => v.herausgenommen).length;   // 176
        return n ? [{ label: `🚫 Herausgenommene (${n})`, fn: () => { oeffneListeDetail(l.id); setListenBereich("vokabeln"); setListeNurAus(true); } }] : []; })(),
      { label: "✨ Beispielsätze ergänzen", fn: () => oeffneSatzFenster(l.id) },
      { label: "≈ Synonyme ergänzen", fn: () => oeffneSynFenster(l.id) },
      ...(imKopf && sichtbareListen.some(x => x.id !== l.id) ? [{ label: "⇲ Zusammenführen", fn: () => { setMergeQuelleId(''); setModal('liste-zusammenfuehren'); } }] : []),
      { label: "＋ Vokabeln importieren", fn: () => { resetImport(); setImportZielTyp("bestehend"); setImportBestehendId(l.id); setTab("listen"); setAnsicht("import"); } },
      { label: "( ) → Info", fn: () => {
        const ll = lsGet(SK.liste(l.id));
        if (!imKopf) oeffneListeDetail(l.id);
        setKlammerZiel(ll?.spalten.i1?.aktiv && ll?.spalten.i2?.aktiv ? "i2" : "i1"); setModal("klammern");
      } },
      ...(gefiltert || imKopf ? [] : [{ label: "⇄ Verschieben", fn: () => { setListenSortModus(true); setListenAuswahl([l.id]); } }]),
      { label: "📁 In Ordner…", fn: () => setInGruppe({ art: "liste", ids: [l.id], name: "" }) },   // 193
      ...(l.ordner && listenOrdner.some(o => o.id === l.ordner) ? [{ label: "↑ Aus dem Ordner", fn: () => verschiebeListenInOrdner([l.id], listenOrdner.find(o => o.id === l.ordner)?.ordner || null) }] : []),
      ...(imKopf ? [] : [{ label: "☑ Auswählen", behalten: true, fn: () => { setListenSortModus(false); setListenWahl([l.id]); } }]),
      { label: "▦ In mehrere Quiz aufteilen", fn: () => starteAufteilen(l.id) },
      { label: "↺ Lernstand zurücksetzen", fn: () => { setListeMenueId(l.id); setZuruecksetzenArten(new Set(Object.keys(SCORE_FELD))); setModal("liste-zuruecksetzen"); } },
      { label: "🗑 Löschen", gefahr: true, fn: () => { setListeMenueId(l.id); setModal("loeschen"); } },
    ];
  }

// Listen-Übersicht als Raster wie bei den gespeicherten Konfigurationen: Lang-Druck → Menü
// (Umbenennen, Duplizieren, Verschieben, Löschen), Lang-Druck und ziehen → verschieben; belegter Platz: tauschen.
// Mit Sprachfilter rücken die sichtbaren Listen zusammen (Verschieben dann nur unter „Alle“).
// Aktionen für eine Listen-Auswahl (Lang-Druck auf eine Kachel der Auswahl oder auf den Auswahl-Kopf)
export function listenWahlMenue(app, ids) {
  const { faelligAktion, faelligVonListen, listenOrdner, listenOrdnerOffen, oeffneExport, setAuswahlLoeschen, setInGruppe, setListenAuswahl, setListenSortModus, setListenWahl, setVonBis, sprachFilter, verschiebeListenInOrdner } = app;
    return [
      { label: `📤 Exportieren (${ids.length})`, behalten: true, fn: () => oeffneExport(ids) },
      ...(() => { const f = faelligVonListen(ids); return faelligAktion(f); })(),
      ...(sprachFilter !== "alle" ? [] : [{ label: "⇄ Verschieben", fn: () => { setListenWahl(null); setListenSortModus(true); setListenAuswahl(ids); } }]),
      { label: `📁 In Ordner… (${ids.length})`, fn: () => setInGruppe({ art: "liste", ids, name: "" }) },   // 193
      ...(listenOrdnerOffen ? [{ label: `↑ Aus dem Ordner (${ids.length})`, fn: () => verschiebeListenInOrdner(ids, listenOrdner.find(o => o.id === listenOrdnerOffen)?.ordner || null) }] : []),
      { label: `🗑 Löschen (${ids.length})`, gefahr: true, fn: () => setAuswahlLoeschen({ art: "liste", ids }) },
      { label: "↔ Von–Bis", behalten: true, fn: () => setVonBis({ art: "liste", id: ids[ids.length - 1] }) },
      { label: "✕ Auswahl beenden", fn: () => setListenWahl(null) },
    ];
  }

// Chips "Gespeichert" (sortierbar) und "Verlauf" (automatisch, letzte 5) – Quiz- und Statistik-Tab
// Kopfzeile Verlauf & Gespeichert (Quiz- und Statistik-Tab): zu und auf gleich aufgebaut – Name + Ü/D/A;
// aufgeklappt zusätzlich eine Info-Zeile (Listen · Nr. · Anzahl). Langer Druck (Quiz): Speichern.
// Mehrfach-Auswahl übernehmen: mehrere → Multiquiz einstellen, eine → laden, keine → Auswahl beenden
export function beendeMultiAuswahl(app, ids, onLaden) {
  const { setMultiAuswahl, stelleMultiquizEin } = app;
    if (ids.length >= 2) stelleMultiquizEin(ids);
    else { setMultiAuswahl(null); if (ids.length === 1) onLaden("gespeichert", ids[0]); }
  }

// Speichern-Menü des Quiz (lang drücken auf den Quiz-Namen bzw. den Start-Knopf)
export function sessionSpeicherAktionen(app) {
  const { aktiverSlot, getSlotEintrag, ladeSlot, oeffneModal, quizKombiListe, setModal, setModalInput, slotNamenVorschlag, ueberspeichereSession, vokabelgruppeGeaendert } = app;
    if (!quizKombiListe) return null;
    if (vokabelgruppeGeaendert && aktiverSlot?.typ === "gespeichert") {
      const name = getSlotEintrag("gespeichert", aktiverSlot.id)?.name || "";
      return [
        { label: `💾 Überspeichern „${name}“`, fn: ueberspeichereSession },
        { label: "💾 Als neues Quiz speichern", fn: () => { setModalInput(slotNamenVorschlag()); setModal("slot-speichern"); } },
        { label: "↺ Verwerfen", fn: () => ladeSlot(aktiverSlot.typ, aktiverSlot.id) },
      ];
    }
    return [{ label: "💾 Speichern", fn: () => oeffneModal("slot-speichern") }];
  }

// Lernfortschritt je Art (Mini-Kreise) für eine Vokabelmenge; aus = keine passenden Vokabeln
export function lernstandJeArt(app, voks, listeId = null) {
  const { einstellungen } = app;
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    voks = voks.filter(v => !v.herausgenommen);   // 176: zählen nicht mit
    return Object.fromEntries(QUIZ_ARTEN.map(a => {
      const sicht = statistikSicht(voks, a, listeId);
      return [a, { pct: lernProzent(sicht.map(v => v.fortschritt?.score), schwelle), aus: sicht.length === 0 }];
    }));
  }

// 217: Listen als Quiz-Kacheln – antippen fragt die Liste ab, kurz halten wählt nur (Blätter-Modus), Ordner antippen öffnet
export function uebernimmListe(app, id) {
  const { ladeSlot, leuchte, setBlaettern, setSlotVorschau, setSlotVorschauListe } = app;
    setBlaettern(false); setSlotVorschau(null); setSlotVorschauListe(false);
    ladeSlot("listen", id); leuchte("slotkopf");
  }

// Info-Fläche unter dem Quiz-Kopf: immer das Quiz, die oben steht (angetippt, sonst die geladene bzw. die aktuelle Auswahl)
export function infoEintrag(app, statistik) {
  const { aktiverSlot, getSlotEintrag, multiAuswahl, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, sichtbareListen, slotVorschau, statistikAktiverSlot, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, statistikSlotGeleert } = app;
    if (multiAuswahl?.length === 1) return getSlotEintrag("gespeichert", multiAuswahl[0]);   // eine per Lang-Druck gewählt: ihre Info (voller Name)
    if (multiAuswahl?.length) return { id: "_wahl", name: `${multiAuswahl.length} Quiz ausgewählt`,
      multi: multiAuswahl.map(id => ({ id, name: getSlotEintrag("gespeichert", id)?.name || id })) };
    const mitKonfig = e => e?.istListe && !e.konfiguration ? { ...e, konfiguration: { listenIds: [e.id], bereichTyp: "alle" } } : e;   // 217
    if (slotVorschau) return mitKonfig(getSlotEintrag(slotVorschau.typ, slotVorschau.id));
    const slot = statistik ? statistikAktiverSlot : aktiverSlot;
    const e = slot ? mitKonfig(getSlotEintrag(slot.typ, slot.id)) : null;
    if (e) return e;
    if (statistik) return { id: "_auswahl", name: statistikSlotGeleert ? "Leer" : "Neue Auswahl",
      konfiguration: { listenIds: statistikListenIds ? [...statistikListenIds] : sichtbareListen.map(l => l.id), bereichTyp: statistikBereichTyp, vokabelAuswahl: [...statistikCheckboxAuswahl] } };
    return { id: "_auswahl", name: "Neues Quiz", konfiguration: { listenIds: quizTabListen, bereichTyp: quizBereichTyp, vokabelAuswahl: [...quizCheckboxAuswahl] } };
  }

// Nach dem Quiz direkt zur Statistik: mit Quiz → deren Eintrag (ganze Vokabelgruppe),
// sonst genau die Vokabeln dieser Runde
// Nach einer Gruppen-Runde aus der Statistik: zurück in genau diese Statistik (Auswahl, Art, Filter unverändert)
export function zurueckZurStatistik(app) {
  const { setAnsicht, setQuiz, setTab } = app;
    setQuiz(null);
    setAnsicht("uebersicht");
    setTab("statistik");
  }

// Runde verlassen: zurück ins Lernen, in die Statistik (Gruppen-Runde) oder zur Übersicht
export function verlasseRunde(app) {
  const { beendeQuiz, quiz, zurueckZumLernen, zurueckZurStatistik } = app; if (quiz?.ausLernen) zurueckZumLernen(); else if (quiz?.ausStatistik) zurueckZurStatistik(); else beendeQuiz(); }

export function zurueckZumLernen(app) {
  const { naechstesLernPaket, quizStufeRef, setAnsicht, setLernen, setQuiz } = app;
    quizStufeRef.current = null;
    setQuiz(null);
    setAnsicht("uebersicht");
    setLernen(l => l && naechstesLernPaket(l));
  }

export function zurRundenStatistik(app, abschluss) {
  const { aktiveListeId, aktiverSlot, getSlotEintrag, ladeSlotStatistik, quiz, setStatistikAktiverSlot, setStatistikArt, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikFilter, setStatistikListenAufgeklappt, setStatistikListenIds, setStatistikSlotGeleert, setStatistikVollbild, setTab, zurueckZurStatistik } = app;
    const q = quiz;
    if (q?.ausStatistik) { zurueckZurStatistik(); return; }
    abschluss();
    setStatistikListenAufgeklappt(false);
    setStatistikEinzelauswahlAufgeklappt(false);
    setStatistikVollbild(false);
    setStatistikSlotGeleert(false);
    setStatistikFilter(new Set(['negativ', 'nie', 'arbeit', 'gelernt']));
    setStatistikArt(q?.modus === "diktat" ? "diktat" : q?.scoreFeld === "akzentFortschritt" ? "akzente" : "uebersetzung");
    if (q?.istSessionModus && aktiverSlot && getSlotEintrag(aktiverSlot.typ, aktiverSlot.id)) {
      ladeSlotStatistik(aktiverSlot.typ, aktiverSlot.id);
    } else {
      const ids = [...new Set((q?.vokabeln || []).map(v => String(v.id).includes("__") ? String(v.id) : `${aktiveListeId}__${v.id}`))];
      setStatistikAktiverSlot(null);
      setStatistikListenIds(new Set(ids.map(id => id.split("__")[0])));
      setStatistikBereichTyp("bereich");
      setStatistikCheckboxAuswahl(new Set(ids));
    }
    setTab("statistik");
  }

export function brecheQuizAb(app) {
  const { beendeQuiz, quiz, setQuiz, updateSessionSlotFortschritt } = app;
    if (!quiz) { beendeQuiz(); return; }
    if (quiz.istSessionModus) {
      // In der Wiederholung wurde das ganze Paket bereits einmal abgefragt
      const answeredIds = quiz.zuordnung ? [...new Set(quiz.zuordnung.beantwortet || [])] : quiz.wiederholungDurchgang ? (quiz.sessionVokIds || []) : [...new Set(
        (quiz.vokabeln || []).slice(0, quiz.index || 0).map(v => v.id)
      )];
      if (answeredIds.length > 0) updateSessionSlotFortschritt(answeredIds, false);
    }
    const ges = (quiz.quizRichtigAnzahl || 0) + (quiz.quizFalschAnzahl || 0);
    if (ges > 0) {
      setQuiz(prev => ({...prev, phase: "fertig", abgebrochen: true}));
    } else {
      beendeQuiz();
    }
  }

// Regeln der laufenden Runde: Stufe der Einstellungen; Quiz nach dem Lernen ("lernen"): Regeln wie Leicht,
// wie Schwer oder ohne Hilfen (Standard; „Lernen einstellen“), aber nie ein Punktabzug –
// eine einmalige Gelegenheit, den Score zu verbessern
export function quizRegeln(app) {
  const { einstellungen, lernEinstellungen, quizStufeRef } = app;
    if (quizStufeRef.current !== "lernen") return stufenRegeln(einstellungen);
    const qs = lernEinstellungen().quizStufe;
    const r = { ...stufenRegeln({ ...einstellungen, modus: qs === "einfach" ? "einfach" : "schwer" }), falschAbzug: false, aufdeckenAbzug: false };
    return qs === "ohne" ? { ...r, akzentHervorheben: false, akzentZaehler: false, akzenteTolerant: false } : r;
  }
