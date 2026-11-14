import { SK, TYPEN, defaultEinstellungen, lsDel, lsGet, lsSet, neueListeObjekt } from "../speicher.js";
import { ORDNER_TIEFE_MAX, ebeneVon, gruppenName, loeseOrdnerDaten, nachOrdnerBaum, ordneRaster, ordnerBereinigen, ordnerPasst, ordnerPfad, ordnerUnter, rasterGroesse, setzeEbene } from "../raster.js";
import { zeigeInfo } from "../infoEreignisse.js";
import { GELERNT_SCHWELLE, SCORE_FELD, STANDARD_PAKET_GROESSE, STANDARD_SESSION_MODUS, ohneHinweis } from "../quiz.jsx";
import { listeSprache, sprachInfo } from "../sprache.js";
import { istSynonymSpalte, synPrompt, synonymeAusAntwort } from "../saetze.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Hilfsfunktionen ───────────────────────────────────────────────────────
// Listen liegen in einem Raster: neue bekommen den ersten freien Platz (Raster wächst bei Bedarf);
// die Reihenfolge des Index folgt dem Raster (zeilenweise) und gilt so in der ganzen App
// 193: mit Listen-Ordnern – jede Ebene (oberste und jeder Ordner) hat ihr eigenes Raster; der Index folgt dem
// Ordner-Baum (Ordner mit ihrem Inhalt an ihrer Stelle). ordner: Listen-Ordner (werden mit gespeichert)
export function speichereIndex(app, idx, einst = lsGet(SK.einstellungen, defaultEinstellungen()), ordner = lsGet(SK.listenOrdner, [])) {
  const { setListenIndex, setListenOrdner, speichereEinst } = app;
    const groesse = rasterGroesse(einst, "listenRaster");
    let data = ordnerBereinigen({ ordner, gespeichert: idx });
    let zeilen = groesse.zeilen;
    for (const oid of [null, ...data.ordner.map(o => o.id)]) {
      const r = ordneRaster(ebeneVon(data, oid), groesse);
      zeilen = Math.max(zeilen, r.zeilen);
      data = setzeEbene(data, r.gespeichert);
    }
    if (zeilen !== groesse.zeilen) speichereEinst({ ...einst, listenRaster: { ...groesse, zeilen } });
    const sortiert = nachOrdnerBaum(data);
    setListenIndex(sortiert); lsSet(SK.listenIndex, sortiert);
    setListenOrdner(data.ordner); lsSet(SK.listenOrdner, data.ordner);
  }

// 193: über zielId verweilen bildet einen Ordner (Eintrag) bzw. legt hinein (Ordner) – geht das mit ids?
export function verweilGeht(app, liste, zielId, ids) {
  const { getSlotsData, listenOrdnerDaten, listenOrdnerOffenRef, slotOrdnerRef } = app;
    if (!zielId || ids.includes(zielId)) return false;
    const data = liste ? listenOrdnerDaten() : getSlotsData();
    const offen = liste ? listenOrdnerOffenRef.current : slotOrdnerRef.current;
    const ordnerIds = new Set((data.ordner || []).map(o => o.id));
    return ordnerIds.has(zielId) ? ids.filter(id => ordnerIds.has(id)).every(id => ordnerPasst(data.ordner, id, zielId))
      : !ids.some(id => ordnerIds.has(id)) && ordnerPfad(data.ordner, offen).length < ORDNER_TIEFE_MAX;
  }

export function listenOrdnerDaten(app) {
  const {  } = app; return { ordner: lsGet(SK.listenOrdner, []), gespeichert: lsGet(SK.listenIndex, []) }; }

export function gruppiereListen(app, ids, ziel) {
  const { legeListenOrdnerAn, listenOrdnerDaten, listenOrdnerOffenRef, setzeListenPlaetze, verschiebeListenInOrdner } = app;
    const data = listenOrdnerDaten(), offen = listenOrdnerOffenRef.current;
    const imZiel = ebeneVon(data, offen).find(e => e.platz && e.platz.z === ziel.z && e.platz.s === ziel.s);
    if (!imZiel || ids.includes(imZiel.id)) { setzeListenPlaetze(ids, ziel); return; }
    if (imZiel.istOrdner) { verschiebeListenInOrdner(ids, imZiel.id); return; }
    const listen = ids.filter(id => data.gespeichert.some(x => x.id === id));
    if (!listen.length || ordnerPfad(data.ordner, offen).length >= ORDNER_TIEFE_MAX) { setzeListenPlaetze(ids, ziel); return; }
    const alle = [imZiel.id, ...listen];
    legeListenOrdnerAn(gruppenName(alle.map(id => data.gespeichert.find(x => x.id === id)?.name || ""), data.ordner.map(o => o.name)), alle);
  }

export function loeseListenOrdnerAuf(app, id) {
  const { listenOrdnerDaten, listenOrdnerOffenRef, setListenOrdnerOffen, speichereListenOrdnerDaten } = app;
    const data = listenOrdnerDaten();
    const eltern = data.ordner.find(x => x.id === id)?.ordner || null;
    speichereListenOrdnerDaten(loeseOrdnerDaten(data, id));
    if (listenOrdnerOffenRef.current && ordnerUnter(data.ordner, id).has(listenOrdnerOffenRef.current)) setListenOrdnerOffen(eltern);
  }

export function benenneListenOrdnerUm(app, id, name) {
  const { listenOrdnerDaten, setOrdnerUmbenennen, speichereListenOrdnerDaten } = app;
    const data = listenOrdnerDaten();
    speichereListenOrdnerDaten({ ...data, ordner: data.ordner.map(o => o.id === id ? { ...o, name: name.trim() || o.name } : o) });
    setOrdnerUmbenennen(null);
  }

// Gezogener Eintrag: ist er markiert, wandert die ganze markierte Gruppe mit.
// Ziel „raus“ / „raus:<id>“: auf einen Ordner im Pfad (oberste Ebene bzw. dieser Ordner); lange genug über einer
// Kachel gehalten: Ordner bilden bzw. hinein
export function legeGezogenAb(app, d, ziel) {
  const { gruppenZielRef, gruppiere, gruppiereListen, listenOrdnerOffenRef, rasterAuswahlRef, setzeListenPlaetze, setzeSlotPlaetze, slotOrdnerRef, verschiebeInOrdner, verschiebeListenInOrdner } = app;
    const gruppe = gruppenZielRef.current === ziel;
    gruppenZielRef.current = null;
    const liste = d.art === "liste";
    const ausw = rasterAuswahlRef.current[liste ? "liste" : "slot"];
    const ids = ausw.includes(d.id) ? ausw : [d.id];
    if (ziel.startsWith("raus")) {
      const zielOrdner = ziel.slice(5) || null;
      if ((liste ? listenOrdnerOffenRef.current : slotOrdnerRef.current) !== zielOrdner) (liste ? verschiebeListenInOrdner : verschiebeInOrdner)(ids, zielOrdner);
      return;
    }
    const [z, sp] = ziel.split("|").map(Number);
    if (gruppe) { (liste ? gruppiereListen : gruppiere)(ids, { z, s: sp }); return; }
    (liste ? setzeListenPlaetze : setzeSlotPlaetze)(ids, { z, s: sp });
  }

// Auswahl-Tafel zeigen bzw. aktualisieren (Inhalt aus dem letzten Render)
export function zeigeAuswahlTafel(app, art) {
  const { auswahlTafel, auswahlTafelDaten, auswahlTafelRef, auswahlTafelStelle } = app;
    const d = auswahlTafelDaten.current[art]?.();
    if (!d) return;
    auswahlTafelRef.current = art;
    const st = auswahlTafelStelle.current;   // sonst bleibt die Stelle des Lang-Drucks (für „🎨 Farbe ändern“)
    zeigeInfo(d.text, st?.x ?? null, st?.y ?? null, d.aktionen, { auswahl: auswahlTafel(art) });
  }

export function auswahlTafel(app, art) {
  const { auswahlTafelRef, auswahlTafelStelle, setListenWahl, setMultiAuswahl } = app;
    return { ohneText: true, zu: behalten => { auswahlTafelRef.current = null; auswahlTafelStelle.current = null; if (!behalten) (art === "liste" ? setListenWahl : setMultiAuswahl)(null); } };
  }

export function listenKopieName(app, name) {
  const { listenIndex } = app;
    const namen = new Set(listenIndex.map(l => l.name.toLowerCase()));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n.toLowerCase())) n = `${name} (Kopie ${i++})`;
    return n;
  }

export function speichereEinst(app, e) {
  const { setEinstellungen } = app; e = { ...e, gelerntSchwelle: GELERNT_SCHWELLE }; setEinstellungen(e); lsSet(SK.einstellungen, e); }

// eslint-disable-line react-hooks/exhaustive-deps
export function wechsleSprache(app, code) {
  const { aktiveListeId, ansicht, einstellungen, quizTabListen, setAktiveListe, setAktiveListeId, setAktiverSlot, setAnsicht, setGespeicherteVokabelgruppe, setListenWahl, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizPaketGroesse, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSlotGeaendert, setSprachMenuOffen, setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikListenIds, speichereEinst, spracheVonListe, statistikAktiverSlot, statistikListenIds, zurUebersetzung } = app;
    setSprachMenuOffen(false);
    speichereEinst({ ...einstellungen, sprache: code });
    if (code === "alle") return;
    const passt = id => spracheVonListe(id) === code;
    // Quiz: Auswahl/Konfiguration mit Listen anderer Sprache zurücksetzen
    if (quizTabListen.some(id => !passt(id))) {
      setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotGeaendert(false); zurUebersetzung();
      lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); setQuizSessionModus(STANDARD_SESSION_MODUS); setQuizPaketGroesse(STANDARD_PAKET_GROESSE);
      setQuizTabListen(quizTabListen.filter(passt));
      setQuizBereichTyp("alle"); setQuizCheckboxAuswahl(new Set());
    }
    // Statistik
    if (statistikListenIds && [...statistikListenIds].some(id => !passt(id))) {
      setStatistikAktiverSlot(null);      const rest = [...statistikListenIds].filter(passt);
      setStatistikListenIds(rest.length ? new Set(rest) : null);
      setStatistikBereichTyp("alle"); setStatistikCheckboxAuswahl(new Set());
    } else if (statistikAktiverSlot) {
      setStatistikAktiverSlot(null);    }
    // Listen-Tab: geöffnete Liste anderer Sprache schließen
    if (aktiveListeId && ansicht === "liste-detail" && !passt(aktiveListeId)) {
      setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null);
    }
    setListenWahl(null);
  }

export function setzeListenSprache(app, code) {
  const { aktiveListe, aktiveListeId, einstellungen, listenIndex, setAktiveListe, speichereEinst, speichereIndex, sprachFilter } = app;
    if (!aktiveListe) return;
    const updated = { ...aktiveListe, sprache: code };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex.map(l => l.id === aktiveListeId ? { ...l, sprache: code } : l));
    // Gefilterte Ansicht folgt der Liste, damit sie nicht verschwindet
    if (sprachFilter !== "alle" && sprachFilter !== code) speichereEinst({ ...einstellungen, sprache: code });
  }

export function importZielOrdner(app) {
  const { importNeuerOrdner, listenOrdnerOffenRef } = app;
    let ordner = lsGet(SK.listenOrdner, []);
    const eltern = listenOrdnerOffenRef.current && ordner.some(o => o.id === listenOrdnerOffenRef.current) ? listenOrdnerOffenRef.current : null;
    const name = (importNeuerOrdner || "").trim();
    if (importNeuerOrdner !== null && name && ordnerPfad(ordner, eltern).length < ORDNER_TIEFE_MAX) {
      const id = `lordner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      ordner = [...ordner, { id, name, ...(eltern ? { ordner: eltern } : {}) }];
      return { ordner, id };
    }
    return { ordner, id: eltern };
  }

export function importOrdnerWahl(app) {
  const { importDateiname, importNeuerOrdner, listenOrdner, listenOrdnerOffen, setImportNeuerOrdner, tt, ttFeld } = app;
    const pfad = ordnerPfad(listenOrdner, listenOrdnerOffen);
    const geht = pfad.length < ORDNER_TIEFE_MAX;
    const vorschlag = () => (importDateiname || "").replace(/\.[^.]*$/, "").replace(/[ _-]*alle[ _-]*listen$/i, "").replace(/_/g, " ").trim() || "Import";
    return (
      <div data-import-ordner style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:12}}>
        <span style={{fontSize:"0.8rem", color:"var(--text2)"}}>📁 {pfad.length ? pfad.map(o => o.name).join(" › ") : "Alle Listen"}</span>
        {geht && <button className={`typ-btn${importNeuerOrdner !== null ? " aktiv" : ""}`} data-import-neuer-ordner={importNeuerOrdner !== null ? "an" : "aus"}
          style={{fontSize:"0.75rem", padding:"4px 10px"}} onClick={() => setImportNeuerOrdner(n => n === null ? vorschlag() : null)}
          {...tt(importNeuerOrdner !== null ? "Doch keinen neuen Ordner anlegen" : "Die Listen in einen neuen Ordner legen (hier)")}>＋ In neuen Ordner</button>}
        {geht && importNeuerOrdner !== null && <input className="inp" data-import-ordner-name value={importNeuerOrdner} onChange={e => setImportNeuerOrdner(e.target.value)}
          placeholder="Name des Ordners" style={{flex:"1 1 140px", minWidth:120, marginBottom:0}} {...ttFeld("Name des neuen Ordners")}/>}
      </div>
    );
  }

export function erstelleListe(app) {
  const { imListenOrdner, listenIndex, modalInput, setModal, setModalFehler, setModalInput, speichereIndex, sprachFilter } = app;
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    const id = "liste_" + Date.now();
    const sprache = sprachFilter === "alle" ? "en" : sprachFilter;
    lsSet(SK.liste(id), { ...neueListeObjekt(id, name), sprache });
    speichereIndex([...listenIndex, { id, name, sprache, ...imListenOrdner() }]);
    setModal(null); setModalInput(""); setModalFehler("");
  }

// Umbenennen/Löschen gelten der Liste aus dem Lang-Druck-Menü, sonst der geöffneten Liste
export function umbenennen(app) {
  const { aktiveListeId, listeMenueId, listenIndex, modalInput, setAktiveListe, setListeMenueId, setModal, setModalFehler, setModalInput, speichereIndex } = app;
    const id = listeMenueId || aktiveListeId;
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    speichereIndex(listenIndex.map(l => l.id === id ? {...l, name} : l));
    const aktuell = lsGet(SK.liste(id));
    if (aktuell) { const u = {...aktuell, name}; lsSet(SK.liste(id), u); if (id === aktiveListeId) setAktiveListe(u); }
    setModal(null); setModalInput(""); setModalFehler(""); setListeMenueId(null);
  }

export function loeschen(app) {
  const { aktiveListeId, listeMenueId, listenIndex, setAktiveListe, setAktiveListeId, setAnsicht, setListeMenueId, setModal, speichereIndex } = app;
    const id = listeMenueId || aktiveListeId;
    localStorage.removeItem(SK.liste(id));
    speichereIndex(listenIndex.filter(l => l.id !== id));
    setModal(null); setListeMenueId(null);
    if (id === aktiveListeId) { setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null); }
  }

// Lernstand einer Liste zurücksetzen (gewählte Arten): Vokabeln gelten danach als nie abgefragt
export function setzeListeZurueck(app) {
  const { aktiveListeId, listeMenueId, listenIndex, setAktiveListe, setListeMenueId, setModal, speichereIndex, zuruecksetzenArten } = app;
    const liste = lsGet(SK.liste(listeMenueId));
    if (liste && zuruecksetzenArten.size > 0) {
      const felder = [...zuruecksetzenArten].map(a => SCORE_FELD[a]);
      const neu = { ...liste, vokabeln: liste.vokabeln.map(v => { const w = { ...v }; felder.forEach(f => delete w[f]); return w; }) };
      lsSet(SK.liste(listeMenueId), neu);
      if (listeMenueId === aktiveListeId) setAktiveListe(neu);
      speichereIndex(listenIndex);   // neu zeichnen (Lernfortschritt in der Übersicht)
    }
    setModal(null); setListeMenueId(null);
  }

// Kopie mit allen Vokabeln und Spalten unter neuem Namen (erster freier Platz im Raster);
// Lernstände starten neu – die Kopie ist eine eigene Liste mit eigenen Vokabeln
export function dupliziereListe(app) {
  const { listeMenueId, listenIndex, modalInput, setListeMenueId, setModal, setModalFehler, setModalInput, speichereIndex } = app;
    const quelle = lsGet(SK.liste(listeMenueId));
    const name = modalInput.trim();
    if (!quelle) { setModal(null); return; }
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    const id = "liste_" + Date.now();
    const sprache = listeSprache(quelle);
    const vokabeln = quelle.vokabeln.map(({ fortschritt, diktatFortschritt, akzentFortschritt, ...v }) => v);   // eslint-disable-line no-unused-vars
    lsSet(SK.liste(id), { ...quelle, id, name, sprache, vokabeln });
    const qOrdner = listenIndex.find(l => l.id === quelle.id)?.ordner;   // Kopie im selben Ordner
    speichereIndex([...listenIndex, { id, name, sprache, ...(qOrdner ? { ordner: qOrdner } : {}) }]);
    setModal(null); setModalInput(""); setModalFehler(""); setListeMenueId(null);
  }

export function speichereSpaltenname(app) {
  const { aktiveListe, aktiveListeId, editSpalteTyp, listenIndex, modalInput, setAktiveListe, setEditSpalteTyp, setModal, setModalInput, speichereIndex } = app;
    if (!editSpalteTyp || !aktiveListe) return;
    const updated = { ...aktiveListe, spalten: { ...aktiveListe.spalten, [editSpalteTyp]: { ...aktiveListe.spalten[editSpalteTyp], name: modalInput.trim() } } };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex); // trigger re-render
    setModal(null); setModalInput(""); setEditSpalteTyp(null);
  }

// Info-Spalte als „Info“ oder „Synonyme“
export function setzeSpaltenArt(app, typ, art) {
  const { aktiveListe, aktiveListeId, listenIndex, setAktiveListe, speichereIndex } = app;
    if (!aktiveListe) return;
    const updated = { ...aktiveListe, spalten: { ...aktiveListe.spalten, [typ]: { ...aktiveListe.spalten[typ], art } } };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex);
  }

// Ziel der Synonyme: vorhandene Synonym-Spalte, sonst eine leere Info-Spalte (wird beim Übernehmen „Synonyme“)
export function synZiel(app, liste) {
  const {  } = app;
    const da = TYPEN.find(x => x.startsWith("i") && liste.spalten[x]?.aktiv && istSynonymSpalte(liste.spalten[x]));
    if (da) return { typ: da, neu: false };
    const frei = TYPEN.find(x => x.startsWith("i") && liste.vokabeln.every(v => !v[x]?.wert));
    return frei ? { typ: frei, neu: true } : null;
  }

export function synPortion(app, listeId) {
  const { einstellungen, synZiel } = app;
    const liste = lsGet(SK.liste(listeId));
    if (!liste) return null;
    const ziel = synZiel(liste);
    const fremd = TYPEN.find(x => x.startsWith("E") && liste.spalten[x]?.aktiv), deutsch = TYPEN.find(x => x.startsWith("D") && liste.spalten[x]?.aktiv);
    const offen = ziel ? liste.vokabeln.filter(v => v[fremd]?.wert && !v[ziel.typ]?.wert) : [];
    const alsDatei = einstellungen.satzWeg === "datei";
    const teil = offen.slice(0, alsDatei ? 2000 : 100);
    const sprachName = sprachInfo(listeSprache(liste)).name;
    return { liste, ziel, offen: offen.length, gesamt: liste.vokabeln.length, teil, alsDatei,
      prompt: synPrompt(sprachName, teil.map(v => `${v.id} // ${ohneHinweis(v[fremd].wert)} // ${ohneHinweis(v[deutsch]?.wert || "")}`), alsDatei) };
  }

export function oeffneSynFenster(app, listeId) {
  const { setModal, setSynFenster } = app; setSynFenster({ listeId, antwort: "", meldung: "" }); setModal("synonyme"); }

export function uebernehmeSynonyme(app, text) {
  const { aktiveListeId, listenIndex, setAktiveListe, setSynFenster, speichereIndex, synFenster, synZiel } = app;
    const f = synFenster;
    if (!f) return;
    const liste = lsGet(SK.liste(f.listeId));
    const ziel = liste && synZiel(liste);
    if (!ziel) { setSynFenster({ ...f, meldung: "Keine freie Info-Spalte für die Synonyme." }); return; }
    const neu = synonymeAusAntwort(typeof text === "string" ? text : f.antwort);
    let n = 0;
    const vokabeln = liste.vokabeln.map(v => { const s = neu[String(v.id)]; if (!s || v[ziel.typ]?.wert) return v; n++; return { ...v, [ziel.typ]: { wert: s, falsch: [] } }; });
    if (n) {
      const spalten = { ...liste.spalten, [ziel.typ]: { ...liste.spalten[ziel.typ], aktiv: true, ...(ziel.neu ? { name: "Synonyme", art: "synonyme" } : {}) } };
      const upd = { ...liste, spalten, vokabeln };
      lsSet(SK.liste(f.listeId), upd);
      if (f.listeId === aktiveListeId) setAktiveListe(upd);
      speichereIndex(listenIndex);
    }
    setSynFenster({ ...f, antwort: "", meldung: n ? `Synonyme für ${n} Vokabeln übernommen.` : "Keine passenden Zeilen gefunden – Format „ID // Synonym1, Synonym2“." });
  }

export function oeffneModal(app, typ, extra) {
  const { aktiveListe, setEditSpalteTyp, setListeMenueId, setModal, setModalFehler, setModalInput, slotNamenVorschlag } = app;
    setListeMenueId(null);
    if (typ === "umbenennen") setModalInput(aktiveListe?.name || "");
    else if (typ === "spalte-umbenennen" && extra) {
      setEditSpalteTyp(extra);
      setModalInput(aktiveListe?.spalten[extra]?.name || "");
    } else if (typ === "slot-speichern") setModalInput(slotNamenVorschlag());
    else setModalInput("");
    setModalFehler(""); setModal(typ);
  }
