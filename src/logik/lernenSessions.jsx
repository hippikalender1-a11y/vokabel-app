import { LERNEN_STANDARD, STANDARD_ABFRAGE_ZIEL, STANDARD_MAX_SCORE, STANDARD_PAKET_GROESSE, STANDARD_REIHENFOLGE, STANDARD_SESSION_MODUS, STANDARD_UNBEANTWORTET_ZUERST, slotSFAlle } from "../quiz.jsx";
import { SK, TYPEN, lsDel, lsGet, lsSet, neuerSlotId } from "../speicher.js";
import { ORDNER_TIEFE_MAX, ordnerPfad } from "../raster.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Lernen: Wort zeigen (ggf. vorlesen), nach einer Pause die Übersetzung, dann die nächste Vokabel ──
export function lernEinstellungen(app) {
  const { einstellungen } = app;
    const e = einstellungen.lernen || {};
    // frühere einzige Pause ("halte") gilt als Pause nach der Info
    return { ...LERNEN_STANDARD, ...(e.halte != null ? { pauseInfo: e.halte } : {}), ...e };
  }

// Pause nach dem aktuellen Abschnitt (s); ohne Zusatzinfo gilt nach der Übersetzung die längere von Übersetzung/Info
export function lernPause(app, l, v) {
  const { lernEinstellungen, lernInfoZeigen } = app;
    const le = lernEinstellungen();
    if (l.phase === 0) return le.pauseWort;
    if (l.phase === 1) return lernInfoZeigen(l, v) ? le.pauseUeb : Math.max(le.pauseUeb, le.pauseInfo);
    return le.pauseInfo;
  }

export function setzeLernEinst(app, felder) {
  const { einstellungen, lernEinstellungen, speichereEinst } = app; speichereEinst({ ...einstellungen, lernen: { ...lernEinstellungen(), ...felder } }); }

// Lernstand je gespeicherter Konfiguration / Verlaufseintrag und Abfrageart (lernStaende), getrennt vom Abfrage-Fortschritt:
// { ids (ganze Lern-Reihenfolge), groesse, start, index, fertig, quizGemacht, zeit }
export function lernStandVon(app, slot, art) {
  const { slots } = app;
    if (!slot) return null;
    return slots[slot.typ]?.find(x => x.id === slot.id)?.lernStaende?.[art] || null;
  }

export function setzeLernStand(app, slot, art, stand) {
  const { aendereListenEintrag, getSlotsData, setSlotsData } = app;
    if (slot?.typ === "listen" && !(getSlotsData().listen || []).some(x => x.id === slot.id)) aendereListenEintrag(slot.id, x => x);   // 217
    const data = getSlotsData();
    if (!slot || !data[slot.typ]?.some(x => x.id === slot.id)) return;
    setSlotsData({ ...data, [slot.typ]: data[slot.typ].map(x => {
      if (x.id !== slot.id) return x;
      const alle = { ...(x.lernStaende || {}) };
      if (stand) alle[art] = stand; else delete alle[art];
      return { ...x, lernStaende: alle };
    }) });
  }

// alle: ganze Quiz in Abfrage-Reihenfolge; groesse: Paketgröße (null = alle auf einmal);
// stand: gespeicherter Lernstand → Reihenfolge und Stelle von damals (fehlende Vokabeln fallen weg)
export function starteLernen(app, alle, groesse, spalten, info, stand = null) {
  const { aktiverSlot, erstelleVerlaufEintrag, lernEinstellungen, quizAbfrageArt, quizKombiListe, setLernResetFrage, setLernen } = app;
    if (!alle.length || !spalten.length) return;
    let start = 0, index = 0, fertig = false, quizGemacht = false;
    if (stand) {
      const nachId = new Map((quizKombiListe?.vokabeln || []).map(v => [v.id, v]));
      const damals = stand.ids.map(id => nachId.get(id)).filter(Boolean);
      if (damals.length) {
        alle = damals; groesse = stand.groesse;
        start = Math.min(stand.start, Math.max(0, alle.length - 1));
        ({ index, fertig, quizGemacht } = stand);
      }
    }
    const g = groesse || alle.length;
    const voks = alle.slice(start, start + g);
    index = Math.min(index || 0, voks.length - 1);
    const le = lernEinstellungen();
    const fremd = spalten.filter(t => t.startsWith("E")), deutsch = spalten.filter(t => !t.startsWith("E"));
    let zuerst = le.zuerst === "deutsch" ? deutsch : fremd, danach = le.zuerst === "deutsch" ? fremd : deutsch;
    if (!zuerst.length || !danach.length) { zuerst = spalten.slice(0, 1); danach = spalten.slice(1); }
    // ohne gewählte Konfiguration: Verlaufseintrag anlegen, damit der Lernstand einen Platz hat
    const slot = aktiverSlot || { typ: "verlauf", id: erstelleVerlaufEintrag() };
    setLernResetFrage(false);
    setLernen({ alle, groesse: g, start, voks, index, phase: 0, pausiert: false, fertig: !!fertig, quizGemacht: !!quizGemacht, lauf: 0, zuerst, danach, info,
      liste: quizKombiListe, slot, art: quizAbfrageArt });
    window.scrollTo(0, 0);
  }

// Zusatzinfo dieser Vokabel zeigen? (Schalter auf dem Lernbildschirm, nur wenn es Info-Text gibt)
export function lernInfoZeigen(app, l, v) {
  const { lernEinstellungen } = app; return lernEinstellungen().info && l.info.some(t => v?.[t]?.wert); }

export function lernenWeiter(app) {
  const { lernInfoZeigen, setLernen } = app;
    setLernen(l => {
      if (!l || l.fertig) return l;
      if (l.phase === 0 && l.danach.length) return { ...l, phase: 1 };
      if (l.phase === 1 && lernInfoZeigen(l, l.voks[l.index])) return { ...l, phase: 2 };
      if (l.index + 1 >= l.voks.length) return { ...l, fertig: true };
      return { ...l, index: l.index + 1, phase: 0 };
    });
  }

export function lernenVor(app) {
  const { setLernen } = app; setLernen(l => l && (l.index + 1 >= l.voks.length ? { ...l, fertig: true } : { ...l, index: l.index + 1, phase: 0, lauf: l.lauf + 1 })); }

export function lernenZurueck(app) {
  const { setLernen } = app; setLernen(l => l && { ...l, index: Math.max(0, l.index - 1), phase: 0, fertig: false, lauf: l.lauf + 1 }); }

export function beendeLernen(app) {
  const { klappeUebersichtEin, setLernen } = app; window.speechSynthesis?.cancel(); setLernen(null); klappeUebersichtEin(); }

// nächstes Paket des Quiz (nach dem letzten: Endbildschirm bleibt)
export function naechstesLernPaket(app, l) {
  const {  } = app;
    const start = l.start + l.groesse;
    if (start >= l.alle.length) return { ...l, imQuiz: false };
    return { ...l, imQuiz: false, quizGemacht: false, start, voks: l.alle.slice(start, start + l.groesse), index: 0, phase: 0, fertig: false, pausiert: false, lauf: l.lauf + 1 };
  }

// Quiz mit genau den eben gezeigten Vokabeln – einmal je Paket, ohne Punktabzug; danach das nächste Paket
export function starteLernQuiz(app) {
  const { lernen, setLernen, setQuiz, starteQuiz } = app;
    window.speechSynthesis?.cancel();
    const ids = new Set(lernen.voks.map(v => v.id));
    setLernen(l => ({ ...l, imQuiz: true, quizGemacht: true }));
    starteQuiz(true, null, ids, "lernen");
    setQuiz(q => q && { ...q, ausStatistik: false, ausLernen: true });
  }

// Multiquiz: Vokabeln mehrerer gespeicherter Konfigurationen zusammen, Einstellungen von der ersten
export function multiZusammenstellung(app, ids) {
  const { getSlotsData, listenIndex } = app;
    const data = getSlotsData();
    const teile = ids.map(id => data.gespeichert.find(x => x.id === id)).filter(Boolean);
    if (!teile.length) return null;
    const listenIds = [], keys = new Set(), vorhanden = new Set();
    for (const t of teile) {
      const k = t.konfiguration || {};
      const ids2 = (k.listenIds || []).filter(id => listenIndex.some(l => l.id === id));
      for (const id of ids2) {
        if (!listenIds.includes(id)) { listenIds.push(id); (lsGet(SK.liste(id))?.vokabeln || []).forEach(v => vorhanden.add(`${id}__${v.id}`)); }
      }
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) k.vokabelAuswahl.forEach(v => keys.add(v));
      else ids2.forEach(id => (lsGet(SK.liste(id))?.vokabeln || []).forEach(v => keys.add(`${id}__${v.id}`)));
    }
    const vokabelAuswahl = [...keys].filter(k => vorhanden.has(k));
    return { konfiguration: { ...teile[0].konfiguration, listenIds, vokabelAuswahl, bereichTyp: "bereich", quizBereichTyp: "bereich" },
      anzahl: vokabelAuswahl.length, teile: teile.map(t => ({ id: t.id, name: t.name })) };
  }

export function speichereAlsGespeichert(app, id, name) {
  const { aktiverSlot, aktuelleKonfiguration, getSlotsData, multiVonSlot, neuImOrdnerRef, neuPlatzRef, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, rasterEinordnen, setAktiverSlot, setGespeicherteVokabelgruppe, setListenAendern, setSlotGeaendert, setSlotsData } = app;
    const data = getSlotsData();
    const konfiguration = aktuelleKonfiguration();
    const multi = multiVonSlot(aktiverSlot);
    let updated;
    if (id) {
      updated = { ...data, gespeichert: data.gespeichert.map(s => s.id === id ? (({ multi: _m, ...rest }) => ({ ...rest, name, konfiguration, ...(multi ? { multi } : {}) }))(s) : s) };
    } else {
      const newId = neuerSlotId('g');
      const imOrdner = !multi && neuImOrdnerRef.current && (data.ordner || []).some(o => o.id === neuImOrdnerRef.current) ? neuImOrdnerRef.current : null;
      neuImOrdnerRef.current = null;
      const np = neuPlatzRef.current; neuPlatzRef.current = null;   // 199: auf den lang gedrückten freien Platz
      const platz = !multi && np && (np.ordner || null) === (imOrdner || null) ? np.platz : null;
      const neuerEintrag = { id: newId, name, timestamp: Date.now(), konfiguration, sessionFortschritt: null, ...(multi ? { multi } : {}), ...(imOrdner ? { ordner: imOrdner } : {}), ...(platz ? { platz } : {}) };
      // bestehende Plätze festhalten, der neue Eintrag kommt auf den ersten freien Platz (Raster wächst automatisch)
      updated = rasterEinordnen({ ...data, gespeichert: [...rasterEinordnen(data).gespeichert, neuerEintrag] });
      id = newId;
    }
    setSlotsData(updated);
    setAktiverSlot({ typ: 'gespeichert', id });
    setListenAendern(false);
    lsSet(SK.letzterSlot, id);
    setSlotGeaendert(false);
    setGespeicherteVokabelgruppe({ listenIds: [...quizTabListen], vokabelAuswahl: Array.from(quizCheckboxAuswahl), bereichTyp: quizBereichTyp });
  }

// Geänderte Vokabelauswahl in die geladene gespeichertes Quiz übernehmen. Ihr Quiz-Fortschritt (je Abfrageart)
// passt sich an: „abgefragt“ behält nur Vokabeln im neuen Bereich, neue zählen als noch nicht abgefragt
export function ueberspeichereSession(app) {
  const { aktiverSlot, getKombinierteListe, getSlotEintrag, getSlotsData, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, setSessionSlotAktiv, setSlotsData, speichereAlsGespeichert } = app;
    if (aktiverSlot?.typ !== 'gespeichert') return;
    const id = aktiverSlot.id;
    const name = getSlotEintrag('gespeichert', id)?.name || id;
    let ids = (quizTabListen.length ? getKombinierteListe(quizTabListen)?.vokabeln || [] : []).map(v => v.id);
    if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size) ids = ids.filter(x => quizCheckboxAuswahl.has(x));
    const imBereich = new Set(ids);
    const anpassen = sf => ({ ...sf, abgefragt: (sf.abgefragt || []).filter(x => imBereich.has(x)), gesamt: ids.length });
    speichereAlsGespeichert(id, name);
    const data = getSlotsData();
    setSlotsData({ ...data, gespeichert: data.gespeichert.map(x => {
      if (x.id !== id) return x;
      const { sessionFortschritt: _alt, ...rest } = x;   // eslint-disable-line no-unused-vars
      return { ...rest, sessionFortschritte: Object.fromEntries(Object.entries(slotSFAlle(x)).map(([a, sf]) => [a, anpassen(sf)])) };
    }) });
    const sa = lsGet(SK.sessionAktiv);
    if (sa && sa.slotTyp === 'gespeichert' && sa.slotId === id) {
      const neu = { ...anpassen(sa), slotTyp: sa.slotTyp, slotId: sa.slotId, art: sa.art, listenIds: [...quizTabListen], vokabelAuswahl: [...quizCheckboxAuswahl], bereichTyp: quizBereichTyp };
      lsSet(SK.sessionAktiv, neu); setSessionSlotAktiv(neu);
    }
  }

// ── Liste in mehrere Quiz aufteilen: Quiz-Tab mit dieser Liste, alle Einstellungen wie gewohnt,
// dann je Gruppe eine gespeicherte Konfiguration „Name (21 - 40)“ ──
export function starteAufteilen(app, listeId) {
  const { setAktiverSlot, setAufteilen, setGespeicherteVokabelgruppe, setListenAuswahlAufgeklappt, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizListeAufgeklappt, setQuizTabListen, setQuizVonBisErster, setQuizVonBisModus, setSlotGeaendert, setSlotSektionAufgeklappt, setTab, zurUebersetzung } = app;
    const liste = lsGet(SK.liste(listeId));
    if (!liste) return;
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false); lsDel(SK.letzterSlot); zurUebersetzung();
    setQuizTabListen([listeId]);
    setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set()); setQuizListeAufgeklappt(false);
    setQuizVonBisModus(false); setQuizVonBisErster(null);
    setSlotSektionAufgeklappt(false); setListenAuswahlAufgeklappt(false);
    setAufteilen({ listeId, name: liste.name, groesse: 20, von: 1, bis: liste.vokabeln.length, restAnhaengen: false, gruppe: true });
    setTab("quiz");
    window.scrollTo(0, 0);
  }

export function legeAufteilenAn(app) {
  const { aktuelleKonfiguration, aufteilen, aufteilenStand, getSlotsData, neuImOrdnerRef, rasterEinordnen, setAufteilen, setSlotOrdner, setSlotSektionAufgeklappt, setSlotsData } = app;
    const stand = aufteilenStand();
    if (!stand) return;
    const neu = stand.gruppen.filter(g => !g.vorhanden);
    const data = rasterEinordnen(getSlotsData());
    const basisKonfig = aktuelleKonfiguration(false);
    const eintraege = neu.map((g, i) => ({
      id: neuerSlotId('g'), name: g.name, timestamp: Date.now() + i, sessionFortschritt: null,   // Platz: untereinander (Raster)
      konfiguration: { ...basisKonfig, listenIds: [aufteilen.listeId], bereichTyp: "bereich", quizBereichTyp: "bereich",
        vokabelAuswahl: stand.liste.vokabeln.slice(g.von - 1, g.bis).map(v => `${aufteilen.listeId}__${v.id}`) },
    }));
    // „In Gruppe zusammenfassen“: Gruppe mit dem Namen (vorhandene gleichen Namens wird ergänzt)
    let ordnerId = null, ordner = data.ordner || [];
    // 193: im geöffneten Ordner begonnen → der neue Ordner kommt dort hinein (solange er noch passt)
    const eltern = neuImOrdnerRef.current && ordner.some(o => o.id === neuImOrdnerRef.current) && ordnerPfad(ordner, neuImOrdnerRef.current).length < ORDNER_TIEFE_MAX ? neuImOrdnerRef.current : null;
    if (aufteilen.gruppe !== false && eintraege.length > 0) {
      const name = (aufteilen.name || "").trim() || stand.liste.name;
      ordnerId = ordner.find(o => o.name === name && (o.ordner || null) === eltern)?.id || neuerSlotId("ordner");
      if (!ordner.some(o => o.id === ordnerId)) ordner = [...ordner, { id: ordnerId, name, ...(eltern ? { ordner: eltern } : {}) }];
      eintraege.forEach(e => { e.ordner = ordnerId; });
    } else if (neuImOrdnerRef.current && ordner.some(o => o.id === neuImOrdnerRef.current)) {
      ordnerId = neuImOrdnerRef.current;   // in der geöffneten Gruppe begonnen → dort anlegen
      eintraege.forEach(e => { e.ordner = ordnerId; });
    }
    neuImOrdnerRef.current = null;
    setSlotsData(rasterEinordnen({ ...data, ordner, gespeichert: [...data.gespeichert, ...eintraege] }));
    setAufteilen(null);
    if (ordnerId) setSlotOrdner(ordnerId);
    setSlotSektionAufgeklappt(true);
    window.scrollTo(0, 0);
  }

// Kopie einer gespeicherten Konfiguration unter neuem Namen: gleiche Einstellungen,
// eigener (leerer) Quiz-Fortschritt, erster freier Platz im Raster
export function dupliziereSlot(app, id, name) {
  const { getSlotsData, rasterEinordnen, setSlotsData } = app;
    const data = getSlotsData();
    const quelle = data.gespeichert.find(x => x.id === id);
    if (!quelle) return;
    // im selben Ordner wie das Original
    const kopie = { id: neuerSlotId('g'), name, timestamp: Date.now(), konfiguration: JSON.parse(JSON.stringify(quelle.konfiguration)), sessionFortschritt: null,
      ...(quelle.ordner ? { ordner: quelle.ordner } : {}) };
    setSlotsData(rasterEinordnen({ ...data, gespeichert: [...rasterEinordnen(data).gespeichert, kopie] }));
  }

// freier Name "Name (Kopie)", "Name (Kopie 2)" …
export function kopieName(app, name) {
  const { slots } = app;
    const namen = new Set(slots.gespeichert.map(x => x.name));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n)) n = `${name} (Kopie ${i++})`;
    return n;
  }

export function benenneSlotUm(app, id, name) {
  const { getSlotsData, setSlotsData } = app;
    const data = getSlotsData();
    setSlotsData({ ...data, gespeichert: data.gespeichert.map(x => x.id === id ? { ...x, name } : x) });
  }

// Auswahl löschen (nach Rückfrage): Konfigurationen bzw. Listen mit Vokabeln
export function loescheAuswahl(app) {
  const { aktiveListeId, auswahlLoeschen, listenIndex, loescheSlotEintrag, setAktiveListe, setAktiveListeId, setAnsicht, setAuswahlLoeschen, setListenWahl, setMultiAuswahl, speichereIndex } = app;
    const z = auswahlLoeschen;
    setAuswahlLoeschen(null);
    if (!z) return;
    if (z.art === "slot") { z.ids.forEach(id => loescheSlotEintrag("gespeichert", id)); setMultiAuswahl(null); return; }
    z.ids.forEach(id => lsDel(SK.liste(id)));
    speichereIndex(listenIndex.filter(l => !z.ids.includes(l.id)));
    if (z.ids.includes(aktiveListeId)) { setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null); }
    setListenWahl(null);
  }

export function loescheSlotEintrag(app, typ, id) {
  const { aktiverSlot, getSlotsData, setAktiverSlot, setLoescheSlotNr, setSessionSlotAktiv, setSlotGeaendert, setSlotsData, zurUebersetzung } = app;
    const data = getSlotsData();
    const updated = { ...data, [typ]: data[typ].filter(s => s.id !== id) };   // die Gruppe bleibt, auch leer
    setSlotsData(updated);
    if (lsGet(SK.letzterSlot) === id) lsDel(SK.letzterSlot);
    if (aktiverSlot?.typ === typ && aktiverSlot?.id === id) {
      setAktiverSlot(null); zurUebersetzung();
      setSlotGeaendert(false);
      lsDel(SK.sessionAktiv);
      setSessionSlotAktiv(null);
    }
    setLoescheSlotNr(null);
  }

// Quiz-Fortschritt je Abfrageart (Übersetzung / Diktat / Akzente) getrennt im Slot-Eintrag
export function updateSlotSF(app, typ, id, sf, art) {
  const { aendereListenEintrag, getSlotsData, setSlotsData } = app;
    if (typ === "listen" && !(getSlotsData().listen || []).some(x => x.id === id)) aendereListenEintrag(id, x => x);   // 217
    const data = getSlotsData();
    const updated = { ...data, [typ]: data[typ].map(s => {
      if (s.id !== id) return s;
      const alle = { ...slotSFAlle(s) };
      if (sf) alle[art] = sf; else delete alle[art];
      const { sessionFortschritt: _alt, ...rest } = s;   // altes Einzel-Format ablösen
      return { ...rest, sessionFortschritte: alle };
    }) };
    setSlotsData(updated);
  }

// Erste Bewertung je Vokabel in dieser Runde: "richtig" | "falsch" | "aufgedeckt"
export function erstAusQuiz(app, q) {
  const {  } = app;
    if (!q) return {};
    if (q.modus !== "diktat") return q.gewertet || {};
    const erst = {};
    (q.diktatErgebnisse || []).forEach(e => { if (!(e.vokId in erst)) erst[e.vokId] = e.richtig ? "richtig" : "falsch"; });
    return erst;
  }

export function updateSessionSlotFortschritt(app, neueIds, isDurchlaufEnde) {
  const { erstAusQuiz, quiz, sessionSF, setSessionSlotAktiv, updateSlotSF } = app;
    const slot = lsGet(SK.sessionAktiv);
    if (!slot) return;
    const neuAbgefragt = isDurchlaufEnde ? [] : [...new Set([...(slot.abgefragt || []), ...neueIds])];
    // Durchlauf-Ende: Auswertungsdaten zurücksetzen (der nächste Durchlauf beginnt mit neuen Start-Scores)
    const updated = isDurchlaufEnde
      ? { ...slot, abgefragt: [], startScores: {}, startZeit: null, erst: {}, pakete: 0 }
      : { ...slot, abgefragt: neuAbgefragt,
          ...(slot.erst ? { erst: { ...slot.erst, ...erstAusQuiz(quiz) } } : {}),
          ...(slot.pakete != null ? { pakete: slot.pakete + 1 } : {}) };
    lsSet(SK.sessionAktiv, updated);
    setSessionSlotAktiv(updated);
    const { slotTyp, slotId } = slot;
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, sessionSF(updated), slot.art || "uebersetzung");
  }

// Löscht nur den Fortschritt der aktuellen Abfrageart; die anderen Arten bleiben im Slot erhalten
export function loescheSessionSlot(app) {
  const { setSessionSlotAktiv, updateSlotSF } = app;
    const sSlot = lsGet(SK.sessionAktiv);
    const { slotTyp, slotId } = sSlot || {};
    lsDel(SK.sessionAktiv);
    setSessionSlotAktiv(null);
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, null, sSlot.art || "uebersetzung");
  }

// "Neu": komplett neu beginnen – Quiz, Listen-/Vokabelauswahl und alle Abfrage-Einstellungen
export function neueQuizKonfiguration(app) {
  const { setAktiverSlot, setGespeicherteVokabelgruppe, setListenAendern, setListenAuswahlAufgeklappt, setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizDiktatSpalte, setQuizFrageTyp, setQuizInfoTypenSession, setQuizPaketGroesse, setQuizSessionModus, setQuizSpalteModus, setQuizTabListen, setQuizZeigeInfo, setSessionSlotAktiv, setSlotGeaendert, setSlotSektionAufgeklappt, setzeQuizEinstellungenZurueck } = app;
    setListenAendern(false);
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false);
    lsDel(SK.letzterSlot);
    lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); setQuizSessionModus(STANDARD_SESSION_MODUS); setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
    setQuizTabListen([]);
    // Spalten wie beim App-Start; passen sich bei der Listenauswahl automatisch an
    setQuizAusgewaehlt(["D1", "E1"]); setQuizFrageTyp("D1"); setQuizAntwortTypenGeordnet(["E1"]);
    setQuizInfoTypenSession([]); setQuizSpalteModus({ E1: "karte" }); setQuizZeigeInfo({ i1: true, i2: true });
    setQuizDiktatSpalte("E1");
    setzeQuizEinstellungenZurueck();
    setSlotSektionAufgeklappt(false);
    setListenAuswahlAufgeklappt(true);
  }

export function initQuizDefaults(app, kombiListe) {
  const { aktiveListe, setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizFrageTyp, setQuizInfoTypenSession, setQuizSpalteModus, setQuizZeigeInfo, setzeQuizEinstellungenZurueck } = app;
    const liste = kombiListe || aktiveListe;
    if (!liste) return;
    const abfragbar = TYPEN.filter(t => !t.startsWith('i') && liste.spalten[t].aktiv);
    const infoVerfuegbar = TYPEN.filter(t => t.startsWith('i') && liste.spalten[t].aktiv);
    const ausgewaehlt = (abfragbar.includes('E1') && abfragbar.includes('D1'))
      ? ['E1', 'D1'] : abfragbar.slice(0, 2);
    const frageTyp = ausgewaehlt.find(t => t.startsWith('D')) || ausgewaehlt[0] || '';
    const antwortTypen = ausgewaehlt.filter(t => t !== frageTyp);
    const spalteModus = {};
    antwortTypen.forEach(t => { spalteModus[t] = 'karte'; });
    const zeigeInfo = {};
    infoVerfuegbar.forEach(t => { zeigeInfo[t] = true; });
    setQuizAusgewaehlt(ausgewaehlt);
    setQuizFrageTyp(frageTyp);
    setQuizAntwortTypenGeordnet(antwortTypen);
    setQuizInfoTypenSession([]);
    setQuizSpalteModus(spalteModus);
    setQuizZeigeInfo(zeigeInfo);
    setzeQuizEinstellungenZurueck();
  }

// Abfrage-Einstellungen ohne Spalten auf Standard (Quiz-Start aus Liste, "Neu")
export function setzeQuizEinstellungenZurueck(app) {
  const { setAbfrageZielAnzahl, setAbfrageZielModus, setAbfrageZielScore, setAbfrageZielScoreTyp, setAbfrageZielWiederholung, setQuizArt, setQuizArtStash, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizGelerntEinschliessen, setQuizHeuteEinschliessen, setQuizListeAufgeklappt, setQuizModus, setQuizReihenfolge, setQuizSchlechtesteMaxScore, setQuizUnbeantwortetZuerst, setQuizVonBisErster, setQuizVonBisModus } = app;
    setQuizModus('sequenziell');
    setQuizArt("uebersetzung"); setQuizArtStash({});
    setQuizBereichTyp('alle');
    setQuizReihenfolge(STANDARD_REIHENFOLGE);
    setQuizSchlechtesteMaxScore(STANDARD_MAX_SCORE);
    setQuizUnbeantwortetZuerst(STANDARD_UNBEANTWORTET_ZUERST);
    setQuizCheckboxAuswahl(new Set());
    setQuizListeAufgeklappt(false);
    setQuizVonBisModus(false);
    setQuizVonBisErster(null);
    setAbfrageZielModus(STANDARD_ABFRAGE_ZIEL);
    setAbfrageZielAnzahl(1);
    setAbfrageZielWiederholung(1);
    setAbfrageZielScore(0);
    setAbfrageZielScoreTyp("global");
    setQuizGelerntEinschliessen(false);
    setQuizHeuteEinschliessen(false);
  }

export function getKombinierteListe(app, listenIds) {
  const {  } = app;
    const listen = listenIds.map(id => lsGet(SK.liste(id))).filter(Boolean);
    if (listen.length === 0) return null;
    const spalten = {};
    TYPEN.forEach(typ => {
      const aktiv = listen.filter(l => l.spalten[typ].aktiv);
      if (aktiv.length > 0) {
        const namen = [...new Set(aktiv.map(l => l.spalten[typ].name).filter(Boolean))];
        spalten[typ] = { aktiv: true, name: namen.join(' / ') };
      } else {
        spalten[typ] = { aktiv: false, name: '' };
      }
    });
    const vokabeln = listen.flatMap(l =>
      l.vokabeln.filter(v => !v.herausgenommen).map(v => ({ ...v, id: `${l.id}__${v.id}`, _listeId: l.id, _origId: v.id }))   // 176
    );
    return { id: 'combined', name: listen.map(l => l.name).join(' + '), spalten, naechste_id: 0, vokabeln };
  }

export function toggleQuizTabListe(app, id) {
  const { leuchte, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizTabListen } = app;
    if (!quizTabListen.includes(id)) leuchte(`liste:${id}`);
    setQuizTabListen(prev => {
      const neueListen = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
        const bereinigte = new Set([...quizCheckboxAuswahl].filter(vokId =>
          neueListen.some(lId => vokId.startsWith(`${lId}__`))
        ));
        if (bereinigte.size === 0) {
          setQuizBereichTyp("alle");
          setQuizCheckboxAuswahl(new Set());
        } else {
          setQuizCheckboxAuswahl(bereinigte);
        }
      }
      return neueListen;
    });
  }

export function schliesseQuizBereiche(app, ausser) {
  const { setListenAuswahlAufgeklappt, setMultiAuswahl, setQuizAbfrageModusAufgeklappt, setQuizEinstellungenAufgeklappt, setQuizListeAufgeklappt, setQuizReihenfolgeAufgeklappt, setQuizSessionAufgeklappt, setQuizStufeAufgeklappt, setSlotSektionAufgeklappt } = app;
    if (ausser !== "slots") { setSlotSektionAufgeklappt(false); setMultiAuswahl(null); }
    if (ausser !== "listen") setListenAuswahlAufgeklappt(false);
    if (ausser !== "einzel") setQuizListeAufgeklappt(false);
    if (ausser !== "modus") setQuizAbfrageModusAufgeklappt(false);
    if (ausser !== "reihenfolge") setQuizReihenfolgeAufgeklappt(false);
    if (ausser !== "stufe") setQuizStufeAufgeklappt(false);
    if (ausser !== "einstellungen") setQuizEinstellungenAufgeklappt(false);
    if (ausser !== "session") setQuizSessionAufgeklappt(false);
  }

export function toggleSessionBereich(app, art) {
  const { quizSessionAufgeklappt, schliesseQuizBereiche, setQuizSessionAufgeklappt } = app;
    if (quizSessionAufgeklappt !== art) schliesseQuizBereiche("session");
    setQuizSessionAufgeklappt(v => v === art ? false : art);
  }

export function toggleListenAuswahl(app) {
  const { dropdownImmuneRef, headerH, leuchte, listenAuswahlAufgeklappt, listenContainerRef, listenauswahlHeaderH, schliesseQuizBereiche, setListenAuswahlAufgeklappt, slotH } = app;
    const opening = !listenAuswahlAufgeklappt;
    if (opening) schliesseQuizBereiche("listen");
    else leuchte("listenkopf");
    setListenAuswahlAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = listenContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH + slotH + listenauswahlHeaderH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH - slotH - listenauswahlHeaderH), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleReihenfolge(app) {
  const { abfrageModusH, alleBereichH, dropdownImmuneRef, headerH, listenauswahlHeaderH, quizReihenfolgeAufgeklappt, reihenfolgeContainerRef, schliesseQuizBereiche, setQuizReihenfolgeAufgeklappt, slotH } = app;
    const opening = !quizReihenfolgeAufgeklappt;
    if (opening) schliesseQuizBereiche("reihenfolge");
    setQuizReihenfolgeAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = reihenfolgeContainerRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleEinstellungen(app) {
  const { abfrageModusH, alleBereichH, dropdownImmuneRef, einstellungenContainerRef, einstellungenH, headerH, listenauswahlHeaderH, quizEinstellungenAufgeklappt, reihenfolgeH, schliesseQuizBereiche, setQuizEinstellungenAufgeklappt, slotH } = app;
    const opening = !quizEinstellungenAufgeklappt;
    if (opening) schliesseQuizBereiche("einstellungen");
    setQuizEinstellungenAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = einstellungenContainerRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH + reihenfolgeH + einstellungenH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleAbfrageModus(app) {
  const { abfrageModusContainerRef, abfrageModusH, alleBereichH, dropdownImmuneRef, headerH, listenauswahlHeaderH, quizAbfrageModusAufgeklappt, schliesseQuizBereiche, setQuizAbfrageModusAufgeklappt, slotH } = app;
    const opening = !quizAbfrageModusAufgeklappt;
    if (opening) schliesseQuizBereiche("modus");
    setQuizAbfrageModusAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = abfrageModusContainerRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH + abfrageModusH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleEinzelauswahl(app) {
  const { alleBereichH, dropdownImmuneRef, einzelauswahlRef, headerH, listenauswahlHeaderH, quizListeAufgeklappt, schliesseQuizBereiche, setQuizListeAufgeklappt, slotH } = app;
    const opening = !quizListeAufgeklappt;
    if (opening) schliesseQuizBereiche("einzel");
    setQuizListeAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = einzelauswahlRef.current;
        if (!el) return;
        const target = headerH + slotH + listenauswahlHeaderH + alleBereichH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleSlotSektion(app) {
  const { aktiverSlot, dropdownImmuneRef, headerH, leuchte, schliesseQuizBereiche, setAuswahlListen, setMultiAuswahl, setSlotAuswahl, setSlotSektionAufgeklappt, setSlotSortModus, slotContainerRef, slotH, slotSektionAufgeklappt, slotZuTimerRef, tab } = app;
    const opening = !slotSektionAufgeklappt;
    if (opening) setAuswahlListen(tab === "quiz" && aktiverSlot?.typ === "listen");   // 217: Listen-Kopf → Listen-Auswahl
    clearTimeout(slotZuTimerRef.current);
    if (opening && tab === "quiz") schliesseQuizBereiche("slots");
    if (!opening) leuchte("slotkopf");
    setSlotSektionAufgeklappt(v => !v);
    setSlotSortModus(false); setSlotAuswahl([]); setMultiAuswahl(null);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = slotContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH + slotH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH - slotH), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleStatistikListenAuswahl(app) {
  const { dropdownImmuneRef, headerH, setStatistikListenAufgeklappt, slotH, statistikListenAufgeklappt, statistikListenContainerRef } = app;
    const opening = !statistikListenAufgeklappt;
    setStatistikListenAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = statistikListenContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < headerH + slotH) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - headerH - slotH), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

export function toggleStatistikEinzelauswahl(app) {
  const { dropdownImmuneRef, headerH, setStatistikEinzelauswahlAufgeklappt, slotH, statistikEinzelauswahlAufgeklappt, statistikEinzelauswahlRef, statistikListenHeaderH, statistikVokauswahlH } = app;
    const opening = !statistikEinzelauswahlAufgeklappt;
    setStatistikEinzelauswahlAufgeklappt(v => !v);
    if (opening) {
      dropdownImmuneRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = statistikEinzelauswahlRef.current;
        if (!el) return;
        const target = headerH + slotH + statistikListenHeaderH + statistikVokauswahlH;
        const rect = el.getBoundingClientRect();
        if (rect.top < target) {
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - target), behavior: 'instant' });
        }
        setTimeout(() => { dropdownImmuneRef.current = false; }, 150);
      }));
    }
  }

// zurück zur Übersicht – eingeklappt (alle Bereiche zu bis auf die Quiz-Auswahl (190), nach oben); nur „Pause“ lässt
// die Bereiche, wie sie waren
export function beendeQuiz(app, einklappen = true) {
  const { ausListeRef, klappeUebersichtEin, listenIndex, oeffneListeDetail, setAnsicht, setListeVorschau, setListenOrdnerOffen, setQuiz, setTab, zuEinstListen } = app;
    setQuiz(null);
    // 204: aus einer Liste gestartet → zurück dorthin (geöffnete Liste bzw. Listen-Raster mit der Liste gewählt); „Pause“ nicht
    const al = einklappen ? ausListeRef.current : null;
    if (al && listenIndex.some(l => l.id === al.listeId)) {
      ausListeRef.current = null;
      if (al.ziel === "liste") { oeffneListeDetail(al.listeId); return; }
      setListenOrdnerOffen(listenIndex.find(l => l.id === al.listeId)?.ordner || null);
      zuEinstListen();
      setTimeout(() => { setListeVorschau(al.listeId); document.querySelector(`[data-liste-id="${al.listeId}"]`)?.scrollIntoView({ block: "center" }); }, 0);
      return;
    }
    setTab("quiz");
    setAnsicht("uebersicht");
    if (einklappen) klappeUebersichtEin();
  }

export function klappeUebersichtEin(app) {
  const { schliesseQuizBereiche, setQuizModusInfoAufgeklappt, setSlotSektionAufgeklappt } = app;
    schliesseQuizBereiche("slots");
    setSlotSektionAufgeklappt(true);
    setQuizModusInfoAufgeklappt(false);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

// Fortschritt des ganzen Quiz während der Abfrage (Kopfzeile): frühere Pakete + Position im aktuellen
// Paket; in der Wiederholung gilt das Paket als durch. Ohne Pakete: diese Runde.
export function sessionStandImQuiz(app, q) {
  const {  } = app;
    const imPaket = q.wiederholungDurchgang ? (q.sessionVokIds || q.vokabeln).length : q.index;
    if (q.istSessionModus) {
      const slot = lsGet(SK.sessionAktiv);
      const vorher = (slot?.abgefragt || []).filter(id => !(q.sessionVokIds || []).includes(id)).length;
      // Gesamtzahl vom Quiz-Start (später gelernte Vokabeln fallen sonst aus der Zählung)
      const startAnzahl = Object.keys(slot?.startScores || {}).length;
      return { erledigt: vorher + imPaket, gesamt: Math.max(startAnzahl, q.sessionGesamt || 0) };
    }
    const gesamt = Object.keys(q.rundeStartScores || {}).length || q.vokabeln.length;
    return { erledigt: q.wiederholungDurchgang ? gesamt : q.index, gesamt };
  }
