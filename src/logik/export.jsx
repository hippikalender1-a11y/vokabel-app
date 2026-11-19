import { mitKuerzel, sprachKuerzelFuer } from "../sprache.js";
import { SK, lsDel, lsGet } from "../speicher.js";
import { generiereExportText } from "../importexport.js";
import { schliesseInfo } from "../infoEreignisse.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Export-Aktionen ───────────────────────────────────────────────────────
export function generiereKombiniertenExport(app, ids) {
  const {  } = app;
    return ids.map(id => { const l = lsGet(SK.liste(id)); return l ? generiereExportText(l) : null; })
      .filter(Boolean).join('\n\n');
  }

export async function kopiereListen(app, ids) {
  const { generiereKombiniertenExport, setExportKopiert } = app;
    if (!ids.length) return;
    const text = generiereKombiniertenExport(ids);
    try {
      await navigator.clipboard.writeText(text);
      setExportKopiert(true);
      setTimeout(() => setExportKopiert(false), 2000);
    } catch {}
  }

// Export-Dateien: Endung immer .txt (nimmt jedes Ziel an), Inhalt steht im Namen: "Name - JSON.txt" / "Name - TXT.txt"
export function exportStandardName(app, ids, art) {
  const { listenIndex } = app;
    const basis = ids.length === 1 ? (listenIndex.find(l => l.id === ids[0])?.name || 'Vokabeln') : mitKuerzel(sprachKuerzelFuer(ids), `${ids.length} Listen`, " ");   // 264
    return `${basis} - ${art}`;
  }

export function teileAlsDatei(app, text, dateiname) {
  const {  } = app;
    // iPad/iPhone: Downloads aus der Home-Bildschirm-App kommen oft leer an → Teilen-Menü
    // ("In Dateien sichern", Mail, AirDrop). Als .txt/text/plain, damit alle Ziele die Datei annehmen.
    const istIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (istIOS && navigator.share) {
      const file = new File([text], dateiname.replace(/\.json$/, '.txt'), { type: 'text/plain' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        try { navigator.share({ files: [file], title: dateiname.replace(/\.(json|txt)$/, '') }).catch(() => {}); return; }
        catch { /* weiter mit Download */ }
      }
    }
    // Passender Typ, sonst hängen Browser ".txt" an (".json.txt")
    const typ = dateiname.endsWith('.json') ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
    const url = URL.createObjectURL(new Blob([text], { type: typ }));
    const a = document.createElement('a');
    a.href = url; a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Großzügig warten: manche Browser holen den Inhalt erst nach dem Download-Dialog
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

// TXT-Export und Gesamtsicherung: erst Fenster mit Dateinamen, dann teileAlsDatei
export function oeffneDateiExport(app, ziel, standard) {
  const { setDateiExport, setExportName, setModal } = app; setDateiExport(ziel); setExportName(standard); setModal("datei-export"); }

export function bestaetigeDateiExport(app) {
  const { dateiExport, dateiName, exportName, exportStandardName, generiereKombiniertenExport, setDateiExport, setModal, sicherungStandardName, speichereSicherung, teileAlsDatei } = app;
    const z = dateiExport;
    if (!z) return;
    setModal(null); setDateiExport(null);
    if (z.art === "sicherung") { speichereSicherung(dateiName(exportName, sicherungStandardName())); return; }
    const text = z.ids.length === 1 ? generiereExportText(lsGet(SK.liste(z.ids[0]))) : generiereKombiniertenExport(z.ids);
    teileAlsDatei(text, dateiName(exportName, exportStandardName(z.ids, "TXT")));
  }

// eslint-disable-line react-hooks/exhaustive-deps
export function handleTabWechsel(app, neuerTab) {
  const { listenWahl, ladeTafelListen, aktiverSlot, ansicht, auswahlTafelRef, beendeMultiAuswahl, getSlotEintrag, ladeSlot, ladeSlotStatistik, multiAuswahl, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, setAktiverSlot, setEinstBereich, setEinstUnter, setFarbTab, setGespeicherteVokabelgruppe, setListenWahl, setMultiAuswahl, setMultiStart, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizTabListen, setSessionSlotAktiv, setSlotSektionAufgeklappt, setSlotVorschau, setStatistikVollbild, setTab, sichtbareListen, slotSektionAufgeklappt, slotVorschau, statistikAktiverSlot, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, tab, toggleSlotSektion, zurUebersetzung } = app;
    // 215: schon im Quiz-Tab (Übersicht) – Tab öffnet die Quiz-Auswahl; offen und nichts geändert → wieder zu;
    // geändert (grüner Kopf) → nichts (übernehmen nur über den Kopf)
    if (neuerTab === "quiz" && tab === "quiz" && ansicht === "uebersicht") {
      if (!slotSektionAufgeklappt) { toggleSlotSektion(); return; }
      if (!slotVorschau && !multiAuswahl) toggleSlotSektion();
      return;
    }
    if (slotSektionAufgeklappt && neuerTab !== tab && (tab === "quiz" || tab === "statistik")) {
      const laden = tab === "statistik" ? ladeSlotStatistik : ladeSlot;
      if (multiAuswahl?.length) beendeMultiAuswahl(multiAuswahl, laden);
      else if (slotVorschau) laden(slotVorschau.typ, slotVorschau.id);
      else if (listenWahl?.length) ladeTafelListen(listenWahl);   // 299: offene Listen-Tafel – beim Tabwechsel übernehmen (wie bei den Quiz)
      setMultiAuswahl(null); setSlotVorschau(null); schliesseInfo(); auswahlTafelRef.current = null;
      setSlotSektionAufgeklappt(false);
    }
    if (neuerTab === "einstellungen" && tab !== "einstellungen") { setEinstBereich(null); setEinstUnter(null); setFarbTab(null); }   // 174
    setTab(neuerTab);
    setListenWahl(null);
    setStatistikVollbild(false);
  }

// Statistik: Quiz direkt mit den Vokabeln einer Gruppe (z. B. Negativ) starten.
// Quiz-Tab wird darauf eingestellt (Bereich = diese Vokabeln, ohne Score-Grenze, Gelernte erlaubt,
// ohne Quiz-Pakete, gespeicherte Konfiguration gelöst); Spalten/Abfrage-Modus bleiben wie im Quiz-Tab.
// Passt die Gruppe zur Quiz-Auswahl (gleiche Abfrageart, Listen enthalten), läuft eine einmalige Runde,
// die Auswahl, Konfiguration und Quiz unberührt lässt – sonst wird der Quiz-Tab umgestellt.
export function gruppenQuizPasst(app, g) {
  const { aktiveListeId, quizAbfrageArt, quizTabListen } = app;
    const listen = quizTabListen.length > 0 ? quizTabListen : (aktiveListeId ? [aktiveListeId] : []);
    return g.art === quizAbfrageArt && g.listenIds.every(id => listen.includes(id));
  }

export function starteGruppenQuiz(app, g) {
  const { getKombinierteListe, gruppenQuizPasst, gruppenQuizStartRef, setAktiverSlot, setGespeicherteVokabelgruppe, setGruppenAenderungsDialog, setGruppenQuiz, setGruppenQuizTick, setQuiz, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizGelerntEinschliessen, setQuizReihenfolge, setQuizSchlechtesteMaxScore, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSessionUeberschreibenModal, setSlotSektionAufgeklappt, setStatistikVollbild, setTab, starteQuiz, wechsleQuizArt } = app;
    setGruppenQuiz(null);
    if (gruppenQuizPasst(g)) {
      setStatistikVollbild(false);
      setTab("quiz");
      starteQuiz(true, null, new Set(g.ids));
      return;
    }
    setSessionUeberschreibenModal(false);
    setGruppenAenderungsDialog(false);
    setAktiverSlot(null);
    
    setGespeicherteVokabelgruppe(null);
    lsDel(SK.letzterSlot);
    lsDel(SK.sessionAktiv);
    setSessionSlotAktiv(null);
    setQuizSessionModus("alle");
    setQuizTabListen(g.listenIds);
    setQuizBereichTyp("bereich");
    setQuizCheckboxAuswahl(new Set(g.ids));
    setQuizReihenfolge("schlechteste");
    setQuizSchlechtesteMaxScore("");
    setQuizGelerntEinschliessen(true);
    wechsleQuizArt(g.art, getKombinierteListe(g.listenIds)?.spalten);
    setSlotSektionAufgeklappt(false);
    setQuiz(null);
    setStatistikVollbild(false);
    setTab("quiz");
    gruppenQuizStartRef.current = 2;   // erst nach dem Angleichen der Spalten an die Listen starten
    setGruppenQuizTick(t => t + 1);
  }
