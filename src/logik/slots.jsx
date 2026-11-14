import { BLITZ_MS, SK, SLOT_ZU_VERZOEGERUNG, defaultEinstellungen, defaultSlots, formatSlotDatum, lsDel, lsGet, lsSet, neuerSlotId } from "../speicher.js";
import { STANDARD_ANTWORT_MODUS, STANDARD_PAKET_GROESSE, STANDARD_SESSION_MODUS, artBereinigt, artFelderAus, artVonKonfig, istFaellig, slotKonfigArt, slotSFAlle, standardArtEinstellungen } from "../quiz.jsx";
import { ORDNER_TIEFE_MAX, ebeneVon, gruppenName, legeInOrdner, loeseOrdnerDaten, ordneRaster, ordnerBereinigen, ordnerPfad, platziereGruppe, rasterGroesse, setzeEbene } from "../raster.js";
import { schliesseInfo } from "../infoEreignisse.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Quiz-Aktionen ─────────────────────────────────────────────────────────
export function toggleQuizSpalte(app, typ) {
  const { quizFrageTyp, setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizFrageTyp, setQuizInfoTypenSession, setQuizSpalteModus } = app;
    setQuizAusgewaehlt(prev => {
      if (prev.includes(typ)) {
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
        setQuizSpalteModus(p => { const n = {...p}; delete n[typ]; return n; });
        return prev.filter(t => t !== typ);
      }
      return [...prev, typ];
    });
  }

export function toggleSpalteRolle(app, typ, rolle, mehrfach = false) {
  const { leuchte, quizAntwortTypenGeordnet, quizArt, quizFrageTyp, quizInfoTypenSession, setQuizAntwortTypenGeordnet, setQuizFrageTyp, setQuizInfoTypenSession, setQuizSpalteModus } = app;
    if (rolle === "frage") {
      if (quizFrageTyp === typ) { setQuizFrageTyp(""); }
      else {
        setQuizFrageTyp(typ);
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
      }
    } else if (rolle === "antwort") {
      const ist = quizAntwortTypenGeordnet.includes(typ);
      const modusNeu = v => quizArt === "akzente" ? "akzent" : (v && v !== "akzent" ? v : STANDARD_ANTWORT_MODUS);
      // antippen: diese Spalte wird die einzige Antwort; lang drücken (mehrfach): dazu bzw. weg – Reihenfolge ergibt Antwort 1, 2 … (eine bleibt)
      if (!mehrfach) {
        if (ist && quizAntwortTypenGeordnet.length === 1) return;
        leuchte(`rolle:${typ}`, BLITZ_MS / 2);
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
        setQuizAntwortTypenGeordnet([typ]);
        if (!ist) setQuizSpalteModus(p => ({...p, [typ]: modusNeu(p[typ])}));
      } else if (ist) {
        if (quizAntwortTypenGeordnet.length > 1) setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
      } else {
        leuchte(`rolle:${typ}`, BLITZ_MS / 2);
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
        setQuizAntwortTypenGeordnet(p => [...p, typ]);
        setQuizSpalteModus(p => ({...p, [typ]: modusNeu(p[typ])}));
      }
    } else if (rolle === "info") {
      if (quizInfoTypenSession.includes(typ)) {
        setQuizInfoTypenSession(p => p.filter(t => t !== typ));
      } else {
        if (quizFrageTyp === typ) setQuizFrageTyp("");
        setQuizAntwortTypenGeordnet(p => p.filter(t => t !== typ));
        setQuizInfoTypenSession(p => [...p, typ]);
      }
    }
  }

export function toggleInfoSpalte(app, typ) {
  const { setQuizZeigeInfo } = app;
    setQuizZeigeInfo(prev => ({...prev, [typ]: !prev[typ]}));
  }

export function toggleVokCheckbox(app, vokId) {
  const { setQuizCheckboxAuswahl } = app;
    setQuizCheckboxAuswahl(prev => {
      const neu = new Set(prev);
      if (neu.has(vokId)) neu.delete(vokId); else neu.add(vokId);
      return neu;
    });
  }

// ── Slot-Hilfsfunktionen ──────────────────────────────────────────────────
export function getSlotsData(app) {
  const {  } = app; return lsGet(SK.slots, defaultSlots()); }

export function setSlotsData(app, data) {
  const { setSlots } = app; lsSet(SK.slots, data); setSlots(data); }

// Raster: Plätze vergeben und bei Bedarf Zeilen anhängen (Einstellung wird mitgespeichert)
export function rasterEinordnen(app, data, einst = lsGet(SK.einstellungen, defaultEinstellungen())) {
  const { speichereEinst } = app;
    const groesse = rasterGroesse(einst);
    let neu = ordnerBereinigen({ ...data, ordner: data.ordner || [] });   // Verweise auf nicht mehr vorhandene Gruppen lösen
    let zeilen = groesse.zeilen;
    for (const oid of [null, ...neu.ordner.map(o => o.id)]) {
      const r = ordneRaster(ebeneVon(neu, oid), groesse);
      zeilen = Math.max(zeilen, r.zeilen);
      neu = setzeEbene(neu, r.gespeichert);
    }
    if (zeilen !== groesse.zeilen) speichereEinst({ ...einst, slotRaster: { ...groesse, zeilen } });
    return neu;
  }

export function setzeSlotPlaetze(app, ids, ziel) {
  const { getSlotsData, rasterEinordnen, setSlotAuswahl, setSlotsData, slotOrdnerRef, speichereEinst } = app;
    const einst = lsGet(SK.einstellungen, defaultEinstellungen());
    const g = rasterGroesse(einst);
    const einstNeu = ziel.z + ids.length > g.zeilen ? { ...einst, slotRaster: { ...g, zeilen: ziel.z + ids.length } } : einst;
    if (einstNeu !== einst) speichereEinst(einstNeu);
    const data = rasterEinordnen(getSlotsData(), einstNeu);
    const ordnerId = slotOrdnerRef.current;
    const ebene = ebeneVon(data, ordnerId);
    setSlotsData(rasterEinordnen(setzeEbene(data, platziereGruppe(ebene, ids, ziel)), einstNeu));
    setSlotAuswahl([]);
  }

// Quiz in eine Gruppe (oder mit null heraus auf die oberste Ebene); sie kommen dort ans Ende
export function verschiebeInOrdner(app, ids, ordnerId) {
  const { getSlotsData, rasterEinordnen, setInGruppe, setMultiAuswahl, setSlotAuswahl, setSlotSortModus, setSlotsData } = app;
    setSlotsData(rasterEinordnen(legeInOrdner(getSlotsData(), ids, ordnerId)));   // Ordner bleiben bestehen, auch leer (194)
    setMultiAuswahl(null); setSlotSortModus(false); setSlotAuswahl([]); setInGruppe(null);
  }

// Gezogene Quiz auf ein Quiz (neuer Ordner aus allen, an deren Platz) bzw. in einen Ordner
export function gruppiere(app, ids, ziel) {
  const { getSlotsData, legeOrdnerAn, rasterEinordnen, setzeSlotPlaetze, slotOrdnerRef, verschiebeInOrdner } = app;
    const data = rasterEinordnen(getSlotsData());
    const offen = slotOrdnerRef.current;
    const imZiel = ebeneVon(data, offen).find(e => e.platz && e.platz.z === ziel.z && e.platz.s === ziel.s);
    if (!imZiel || ids.includes(imZiel.id)) { setzeSlotPlaetze(ids, ziel); return; }
    if (imZiel.istOrdner) { verschiebeInOrdner(ids, imZiel.id); return; }
    const sessions = ids.filter(id => data.gespeichert.some(x => x.id === id));
    if (!sessions.length || ordnerPfad(data.ordner, offen).length >= ORDNER_TIEFE_MAX) { setzeSlotPlaetze(ids, ziel); return; }
    const alle = [imZiel.id, ...sessions];
    legeOrdnerAn(gruppenName(alle.map(id => data.gespeichert.find(x => x.id === id)?.name || ""), (data.ordner || []).map(o => o.name)), alle);
  }

// Ordner auflösen: Inhalt eine Ebene hinauf (der erste auf den Platz des Ordners)
export function loeseOrdnerAuf(app, id) {
  const { getSlotsData, rasterEinordnen, setSlotOrdner, setSlotsData, slotOrdner } = app;
    const data = rasterEinordnen(getSlotsData());
    const eltern = (data.ordner || []).find(x => x.id === id)?.ordner || null;
    setSlotsData(rasterEinordnen(loeseOrdnerDaten(data, id)));
    if (slotOrdner === id) setSlotOrdner(eltern);
  }

export function benenneOrdnerUm(app, id, name) {
  const { getSlotsData, setOrdnerUmbenennen, setSlotsData } = app;
    const data = getSlotsData();
    setSlotsData({ ...data, ordner: (data.ordner || []).map(o => o.id === id ? { ...o, name: name.trim() || o.name } : o) });
    setOrdnerUmbenennen(null);
  }

// 217: typ "listen" = eine Liste als Quiz (slots.listen[] je Liste: konfiguration, sessionFortschritte, lernStaende);
// Name kommt aus dem Listen-Index, konfiguration erst nach dem ersten Start (vorher Standard-Einstellungen)
export function getSlotEintrag(app, typ, id) {
  const { getSlotsData } = app;
    const data = getSlotsData();
    if (typ === "listen") {
      const l = lsGet(SK.listenIndex, []).find(x => x.id === id);
      if (!l) return null;
      const e = (data.listen || []).find(s => s.id === id) || {};
      return { ...e, id, name: l.name, istListe: true, konfiguration: e.konfiguration || null };
    }
    return data[typ]?.find(s => s.id === id) || null;
  }

// 217: Eintrag einer Liste anlegen (falls noch nicht da) bzw. ändern
export function aendereListenEintrag(app, id, f) {
  const { getSlotsData, setSlotsData } = app;
    const data = getSlotsData();
    const listen = data.listen || [];
    const da = listen.some(x => x.id === id);
    setSlotsData({ ...data, listen: da ? listen.map(x => x.id === id ? f(x) : x) : [...listen, f({ id })] });
  }

export function aktuelleKonfiguration(app, mitVokabeln = true) {
  const { artEinstellungenJetzt, quizAntwortTypenGeordnet, quizArt, quizArtStash, quizAusgewaehlt, quizBereichTyp, quizCheckboxAuswahl, quizDiktatSpalte, quizDiktatUebersetzung, quizFrageTyp, quizInfoTypenSession, quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizSpalteModus, quizTabListen, quizUnbeantwortetZuerst, quizZeigeInfo } = app;
    return {
      ...(mitVokabeln ? {
        listenIds: [...quizTabListen],
        vokabelAuswahl: Array.from(quizCheckboxAuswahl),
        bereichTyp: quizBereichTyp,
      } : {}),
      quizAusgewaehlt, quizFrageTyp, quizAntwortTypenGeordnet,
      quizInfoTypenSession, quizSpalteModus, quizZeigeInfo,
      quizModus, quizBereichTyp,
      quizReihenfolge, quizSchlechtesteMaxScore, quizUnbeantwortetZuerst,
      quizDiktatSpalte, quizDiktatUebersetzung,
      art: quizArt, arten: { ...quizArtStash, [quizArt]: artEinstellungenJetzt() },
    };
  }

export function artEinstellungenJetzt(app) {
  const { quizAntwortTypenGeordnet, quizAusgewaehlt, quizDiktatSpalte, quizDiktatUebersetzung, quizFrageTyp, quizInfoTypenSession, quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizSpalteModus, quizUnbeantwortetZuerst, quizZeigeInfo } = app;
    return { quizAusgewaehlt, quizFrageTyp, quizAntwortTypenGeordnet, quizInfoTypenSession, quizSpalteModus, quizZeigeInfo,
      quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizUnbeantwortetZuerst, quizDiktatSpalte, quizDiktatUebersetzung };
  }

export function wendeArtEinstellungenAn(app, k) {
  const { setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizDiktatSpalte, setQuizDiktatUebersetzung, setQuizFrageTyp, setQuizInfoTypenSession, setQuizModus, setQuizReihenfolge, setQuizSchlechtesteMaxScore, setQuizSpalteModus, setQuizUnbeantwortetZuerst, setQuizZeigeInfo } = app;
    setQuizAusgewaehlt(k.quizAusgewaehlt || []);
    setQuizFrageTyp(k.quizFrageTyp || "");
    setQuizAntwortTypenGeordnet(k.quizAntwortTypenGeordnet || []);
    setQuizInfoTypenSession(k.quizInfoTypenSession || []);
    setQuizSpalteModus(k.quizSpalteModus || {});
    setQuizZeigeInfo(k.quizZeigeInfo || {});
    setQuizModus(k.quizModus || "sequenziell");
    setQuizReihenfolge(k.quizReihenfolge || "zufall");
    setQuizSchlechtesteMaxScore(k.quizSchlechtesteMaxScore ?? "");
    const ubz = k.quizUnbeantwortetZuerst;
    setQuizUnbeantwortetZuerst(ubz != null && typeof ubz === "object" ? ubz : { zufall: !!ubz, schlechteste: false, listennr: !!ubz });
    setQuizDiktatSpalte(k.quizDiktatSpalte || "E1");
    setQuizDiktatUebersetzung(k.quizDiktatUebersetzung !== undefined ? k.quizDiktatUebersetzung : "D1");
  }

// Ü|D|A: Einstellungen der bisherigen Art merken, die der neuen Art laden (oder Standard)
// neues Quiz (ohne geladene Konfiguration) beginnt immer in Übersetzung
export function zurUebersetzung(app) {
  const { quizArt, wechsleQuizArt } = app; if (quizArt !== "uebersetzung") wechsleQuizArt("uebersetzung"); }

export function faelligeSchluessel(app, konfigs) {
  const { FORTSCHRITT_FELD, quizArt } = app;
    const feld = FORTSCHRITT_FELD[quizArt] || "fortschritt", jetzt = Date.now(), erg = new Set();
    konfigs.forEach(k => (k.listenIds || []).forEach(id => {
      const l = lsGet(SK.liste(id));
      const auswahl = k.bereichTyp === "bereich" && (k.vokabelAuswahl || []).length ? new Set(k.vokabelAuswahl) : null;
      l?.vokabeln.forEach(v => { const key = `${id}__${v.id}`; if (!v.herausgenommen && (!auswahl || auswahl.has(key)) && istFaellig(v[feld], jetzt)) erg.add(key); });
    }));
    return [...erg];
  }

// eslint-disable-line react-hooks/exhaustive-deps
export function ladeFaellige(app, keys, ausListe = null) {
  const { aktuelleKonfiguration, applyKonfiguration, ausListeRef, auswahlTafelRef, leuchte, setAktiverSlot, setAnsicht, setGespeicherteVokabelgruppe, setListenWahl, setMultiAuswahl, setSlotSektionAufgeklappt, setSlotVorschau, setTab } = app;
    if (!keys.length) return;
    ausListeRef.current = ausListe;   // 204
    const listenIds = [...new Set(keys.map(x => x.split("__")[0]))];
    applyKonfiguration({ ...aktuelleKonfiguration(false), listenIds, vokabelAuswahl: keys, bereichTyp: "bereich", quizBereichTyp: "bereich" });
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotVorschau(null); setMultiAuswahl(null); setListenWahl(null);
    auswahlTafelRef.current = null; schliesseInfo();
    setTab("quiz"); setAnsicht("uebersicht"); setSlotSektionAufgeklappt(false); leuchte("slotkopf");
  }

export function applyKonfiguration(app, k, art = null) {
  const { getKombinierteListe, listenIndex, setQuizArt, setQuizArtStash, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizHeuteEinschliessen, setQuizTabListen, setStartLeerHinweis, wendeArtEinstellungenAn } = app;
    if (!k) return;
    setQuizHeuteEinschliessen(false);   // 180
    setStartLeerHinweis(false);
    if (k.listenIds && k.listenIds.length > 0) {
      const alleVorhanden = k.listenIds.every(id => listenIndex.some(l => l.id === id));
      if (alleVorhanden) {
        setQuizTabListen(k.listenIds);
        setQuizCheckboxAuswahl(k.vokabelAuswahl && k.vokabelAuswahl.length > 0 ? new Set(k.vokabelAuswahl) : new Set());
      } else {
        setQuizBereichTyp("alle");
        setQuizCheckboxAuswahl(new Set());
      }
    }
    setQuizBereichTyp(k.quizBereichTyp || "alle");
    const artK = artVonKonfig(k);
    const ziel = art || artK;
    const arten = { ...(k.arten || {}), [artK]: artFelderAus(k) };
    const spalten = k.listenIds?.length ? getKombinierteListe(k.listenIds)?.spalten : null;
    wendeArtEinstellungenAn(artBereinigt(ziel, arten[ziel] || standardArtEinstellungen(ziel, spalten), spalten));
    setQuizArtStash(arten);
    setQuizArt(ziel);
  }

// Nach dem Antippen einer Kachel bleibt die Auswahl einen Moment offen, damit man die neu markierte Kachel sieht
export function schliesseSlotsVerzoegert(app) {
  const { leuchte, setSlotSektionAufgeklappt, slotZuTimerRef } = app;
    clearTimeout(slotZuTimerRef.current);
    slotZuTimerRef.current = setTimeout(() => { setSlotSektionAufgeklappt(false); leuchte("slotkopf"); }, SLOT_ZU_VERZOEGERUNG);
  }

export function ladeSlot(app, typ, id, art = null) {
  const { aktiviereSlotFortschritt, applyKonfiguration, ausListeRef, getSlotEintrag, listeAlsQuizVorbereiten, neuImOrdnerRef, schliesseSlotsVerzoegert, setAktiverSlot, setGespeicherteVokabelgruppe, setListenAendern, setListenAuswahlAufgeklappt, setQuizAbfrageModusAufgeklappt, setQuizEinstellungenAufgeklappt, setQuizErstellen, setQuizListeAufgeklappt, setQuizReihenfolgeAufgeklappt, setQuizSessionAufgeklappt, setSlotGeaendert } = app;
    const eintrag = getSlotEintrag(typ, id);
    neuImOrdnerRef.current = null;
    if (!(typ === "listen" && ausListeRef.current?.listeId === id)) ausListeRef.current = null;   // 204: andere Quiz gewählt
    setQuizErstellen(null);   // 217
    if (eintrag && typ === "listen" && !eintrag.konfiguration) { listeAlsQuizVorbereiten(id); return; }   // 217: erstes Mal – Standard
    if (!eintrag || !eintrag.konfiguration) return;
    setListenAendern(false);
    applyKonfiguration(eintrag.konfiguration, art);
    if (typ === 'gespeichert') {
      setGespeicherteVokabelgruppe({ listenIds: eintrag.konfiguration.listenIds || [], vokabelAuswahl: eintrag.konfiguration.vokabelAuswahl || [], bereichTyp: eintrag.konfiguration.bereichTyp || "alle" });
    } else {
      setGespeicherteVokabelgruppe(null);
    }
    setListenAuswahlAufgeklappt(false);
    setQuizListeAufgeklappt(false);
    setQuizAbfrageModusAufgeklappt(false);
    setQuizReihenfolgeAufgeklappt(false);
    setQuizEinstellungenAufgeklappt(false);
    setQuizSessionAufgeklappt(false);
    setAktiverSlot({ typ, id });
    setSlotGeaendert(false);
    if (typ === 'gespeichert') lsSet(SK.letzterSlot, id); else if (typ === "listen") lsSet(SK.letzterSlot, `listen:${id}`); else lsDel(SK.letzterSlot);
    schliesseSlotsVerzoegert();   // nach der Auswahl nur noch die Kopfzeile zeigen
    aktiviereSlotFortschritt(eintrag, typ, id, art || slotKonfigArt(eintrag));
  }

// 217: Liste zum ersten Mal als Quiz – Standard-Einstellungen (wie früher „Quiz starten“), Kopf zeigt die Liste
export function listeAlsQuizVorbereiten(app, id) {
  const { aktiviereSlotFortschritt, getSlotEintrag, initQuizDefaults, schliesseSlotsVerzoegert, setAktiverSlot, setGespeicherteVokabelgruppe, setGruppenAenderungsDialog, setListenAendern, setListenAuswahlAufgeklappt, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizHeuteEinschliessen, setQuizListeAufgeklappt, setQuizPaketGroesse, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSessionUeberschreibenModal, setSlotGeaendert, setStartLeerHinweis } = app;
    const liste = lsGet(SK.liste(id));
    if (!liste) return;
    setSessionUeberschreibenModal(false); setGruppenAenderungsDialog(false);
    setGespeicherteVokabelgruppe(null); setListenAendern(false);
    lsDel(SK.sessionAktiv); setSessionSlotAktiv(null);
    setQuizSessionModus(STANDARD_SESSION_MODUS); setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
    setQuizHeuteEinschliessen(false); setStartLeerHinweis(false);
    setQuizTabListen([id]); setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set());
    setListenAuswahlAufgeklappt(false); setQuizListeAufgeklappt(false);
    initQuizDefaults(liste);
    setAktiverSlot({ typ: "listen", id }); setSlotGeaendert(false);
    lsSet(SK.letzterSlot, `listen:${id}`);
    schliesseSlotsVerzoegert();
    const e = getSlotEintrag("listen", id);
    if (e) aktiviereSlotFortschritt(e, "listen", id, "uebersetzung");
  }

// 217: „Quiz erstellen“ – Quiz-Tab mit dieser Liste (Listenauswahl ausgeblendet), Bereich + Einstellungen wählen;
// der grüne Kopf „＋ Quiz erstellen“ öffnet das Fenster (Name, Ordner)
export function starteQuizErstellen(app, id) {
  const { ausListeRef, handleTabWechsel, initQuizDefaults, setAktiverSlot, setAnsicht, setGespeicherteVokabelgruppe, setListenAendern, setListenAuswahlAufgeklappt, setQuiz, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizErstellen, setQuizListeAufgeklappt, setQuizPaketGroesse, setQuizSessionAufgeklappt, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSlotGeaendert, setSlotSektionAufgeklappt } = app;
    const liste = lsGet(SK.liste(id));
    if (!liste) return;
    setSlotSektionAufgeklappt(false); setQuizSessionAufgeklappt(false);
    handleTabWechsel("quiz"); setQuiz(null); setAnsicht("uebersicht");
    setAktiverSlot(null); setSlotGeaendert(false); setGespeicherteVokabelgruppe(null); setListenAendern(false);
    lsDel(SK.sessionAktiv); setSessionSlotAktiv(null);
    setQuizSessionModus(STANDARD_SESSION_MODUS); setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
    setQuizTabListen([id]); setQuizCheckboxAuswahl(new Set());
    setListenAuswahlAufgeklappt(false);
    initQuizDefaults(liste);
    setQuizBereichTyp("bereich"); setQuizListeAufgeklappt(true);   // nach den Standards: gleich den Bereich wählen
    ausListeRef.current = null;
    setQuizErstellen({ listeId: id });
    window.scrollTo(0, 0);
  }

export function erstelleQuiz(app) {
  const { erstellenFenster, neuImOrdnerRef, setErstellenFenster, setQuizErstellen, setSlotOrdner, speichereAlsGespeichert } = app;
    const f = erstellenFenster;
    if (!f || !f.name.trim()) return;
    neuImOrdnerRef.current = f.ordner || null;
    speichereAlsGespeichert(null, f.name.trim());
    setErstellenFenster(null); setQuizErstellen(null);
    setSlotOrdner(f.ordner || null);
  }

// 217: Einstellungen der Liste merken (beim Start einer Runde)
export function speichereListenKonfig(app, id) {
  const { aendereListenEintrag, aktuelleKonfiguration } = app; const k = aktuelleKonfiguration(); aendereListenEintrag(id, x => ({ ...x, konfiguration: k })); }

// Quiz-Fortschritt der Abfrageart aus dem Slot-Eintrag aktivieren (oder kein Quiz, wenn es keinen gibt)
export function aktiviereSlotFortschritt(app, eintrag, typ, id, art) {
  const { setQuizPaketGroesse, setQuizSessionModus, setSessionSlotAktiv } = app;
    const sf = slotSFAlle(eintrag)[art];
    if (sf) {
      const k = eintrag.konfiguration || {};
      const sessionObj = { slotTyp: typ, slotId: id, art, listenIds: k.listenIds || [], vokabelAuswahl: k.vokabelAuswahl || [], bereichTyp: k.bereichTyp || "alle", abgefragt: sf.abgefragt || [], gesamt: sf.gesamt || 0, paketGroesse: sf.paketGroesse || STANDARD_PAKET_GROESSE, startScores: sf.startScores || {},
        startZeit: sf.startZeit, erst: sf.erst, pakete: sf.pakete };
      lsSet(SK.sessionAktiv, sessionObj);
      setSessionSlotAktiv(sessionObj);
      setQuizSessionModus("pakete");
      setQuizPaketGroesse(sf.paketGroesse || STANDARD_PAKET_GROESSE);
    } else {
      lsDel(SK.sessionAktiv);
      setSessionSlotAktiv(null);
    }
  }

export function ladeSlotStatistik(app, typ, id, art = null) {
  const { getSlotEintrag, schliesseSlotsVerzoegert, setListenAendern, setStatistikAktiverSlot, setStatistikArt, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikListenAufgeklappt, setStatistikListenIds, setStatistikSlotGeleert } = app;
    const eintrag = getSlotEintrag(typ, id);
    if (!eintrag || !eintrag.konfiguration) return;
    setListenAendern(false);
    const k = eintrag.konfiguration;
    if (art) setStatistikArt(art);
    setStatistikListenIds(k.listenIds?.length > 0 ? new Set(k.listenIds) : null);
    setStatistikBereichTyp(k.bereichTyp || "alle");
    setStatistikCheckboxAuswahl(new Set(k.vokabelAuswahl || []));
    setStatistikListenAufgeklappt(false);
    setStatistikEinzelauswahlAufgeklappt(false);
    setStatistikAktiverSlot({ typ, id });
    setStatistikSlotGeleert(false);
    schliesseSlotsVerzoegert();   // nach der Auswahl nur noch die Kopfzeile zeigen (wie im Quiz)
  }

// Abfrage ohne Pakete im Verlauf festhalten (mit Start-Scores für die Statistik).
// Gespeicherte Konfiguration oder unveränderter Verlauf-Eintrag → kein neuer Eintrag.
export function merkeRundeImVerlauf(app, effSlot, startScores) {
  const { aktuelleKonfiguration, erstelleVerlaufEintrag, getSlotEintrag, getSlotsData, setSlotsData } = app;
    if (effSlot?.typ === 'gespeichert') return;
    if (effSlot?.typ === "listen") return;   // 217: Listen erscheinen nicht im Verlauf
    if (effSlot?.typ === 'verlauf') {
      const e = getSlotEintrag('verlauf', effSlot.id);
      if (e && JSON.stringify(e.konfiguration) === JSON.stringify(aktuelleKonfiguration())) {
        const data = getSlotsData();
        setSlotsData({ ...data, verlauf: [{ ...e, timestamp: Date.now(), startScores }, ...data.verlauf.filter(v => v.id !== e.id)] });
        return;
      }
    }
    erstelleVerlaufEintrag({ startScores });
  }

export function erstelleVerlaufEintrag(app, extra = {}) {
  const { aktuelleKonfiguration, getSlotsData, setAktiverSlot, setSlotGeaendert, setSlotsData } = app;
    const id = neuerSlotId('v');
    const neuerEintrag = { id, name: formatSlotDatum(), timestamp: Date.now(), konfiguration: aktuelleKonfiguration(), sessionFortschritt: null, ...extra };
    const data = getSlotsData();
    const neuerVerlauf = [neuerEintrag, ...data.verlauf].slice(0, 10);   // 212
    const updated = { ...data, verlauf: neuerVerlauf };
    setSlotsData(updated);
    setAktiverSlot({ typ: 'verlauf', id });
    setSlotGeaendert(false);
    return id;
  }
