import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { zeigeInfo, schliesseInfo, schalteInfoModus, setzeFarbeImMenue } from "./infoEreignisse.js";
import { F, FARB_BASIS, FARB_ROLLEN, FARB_VORLAGEN, TEIL_EIGENSCHAFT, elementCSS, elementName, elementSchluessel, farbVariablen, farbeZuHex, farbenAus, fv, hervorgehoben, mische, mitFestenSchriften, schemaVon, setzeSystemLeiste, teilName, zufallsFarben, setzeF } from "./farben.js";
import { SPALTEN_TAG, dateiVorschau, findeJsonListen, generiereExportText, generierePrompt, istBinaer, parseKolumne, parseKopfZeile, parseZeile } from "./importexport.js";
import { FarbRad, GelerntSterne, IcoBack, IcoCollapse, IcoDown, IcoExpand, IcoPencil, IcoSpk, IcoSpkOn, IcoUp, IcoX, MiniKreis } from "./komponenten.jsx";
import { ABFRAGE_ART_NAMEN, AKZENTE_FUER_LISTE, AKZENT_HINWEIS, AKZENT_OHNE_ANTEILE, ANTWORT_MODUS_NAMEN, ART_KURZ, BLITZ_SEKUNDEN, FAELLIG_ANTEIL_WAHL, FESTES_ZEICHEN, FORTSCHRITT_BALKEN, GELERNT_SCHWELLE, GRUPPE_BALKEN, LERNEN_STANDARD, LERNEN_TIPPEN, LIGATUR_TEILE, MAX_STUFE, MC_FEHLKLICK_HINWEIS, MODI_REIHENFOLGE, PAKET_ALLE, QUIZ_ARTEN, REKORDE_KEY, SATZ_ARTEN, SATZ_CACHE, SCORE_FELD, STANDARD_ABFRAGE_ZIEL, STANDARD_ANTWORT_GEWICHTE, STANDARD_ANTWORT_MODUS, STANDARD_MAX_SCORE, STANDARD_PAKET_GROESSE, STANDARD_REIHENFOLGE, STANDARD_SESSION_MODUS, STANDARD_UNBEANTWORTET_ZUERST, START_TEXT, STATISTIK_ARTEN, STUFEN_REGELN, WIEDERHOL_TAGE_WAHL, ZUORDNUNG_FARBEN, ZUORDNUNG_SEKUNDEN, ZUORDNUNG_ZEITEN, ZUORDNUNG_ZEITFAKTOR, akzentKacheln, akzentOhneAnteil, akzentVarianten, alternativen, antwortSpaltenFuer, antwortStatus, artBereinigt, artFelderAus, artVonKonfig, artikelInfo, berechneDiktatScore, berechneNeuenScore, clampScore, diktatHint, ersteAlt, faelligAnteil, gelerntScore, generiereButtons, getQuizFeedback, gewichtetWaehlen, hatAkzentWort, hatAkzente, heuteAbgefragt, heuteAnteil, hinweiseAus, istFaellig, istMC, istRichtigeAntwort, istRichtigeEinzeln, istRunde, jubelText, lernLesezeit, lernProzent, loeseSpaltenModusAuf, lueckenPositionen, mischeFaellige, mitHinweis, modiVon, modusErlaubt, negativUmstellen, nrText, ohneAkzent, ohneHinweis, ordneVokabeln, puzzleKacheln, satzFuer, scoreSymbole, slotKonfigArt, slotSFAlle, speichereAkzentScore, speichereDiktatScore, speichereScore, standardArtEinstellungen, statistikSicht, stufenRegeln, stufenUmstellen, tagesSperre, umbruch, vokSprache, wiederholTage, zufallMitSeed, zuordnungEinst, setzeAKZENTE_FUER_LISTE, setzeANTWORT_GEWICHTE } from "./quiz.jsx";
import { AUFTEILEN_GROESSEN, GRUPPE_VERWEILEN_MS, KACHEL_ANHEBEN_MS, KACHEL_AUSWAEHLEN_MS, KACHEL_LASSO_FREI, MISCH_ARTEN, ORDNER_KNOPF, ORDNER_TIEFE_MAX, RASTER_FREI_ZEILEN, SUCHE_LEER, SUCH_SPALTEN, aufteilenGruppen, ebeneVon, ebenenSpalten, eintraegeImOrdner, gruppenName, legeInOrdner, loeseOrdnerDaten, nachOrdnerBaum, nameVergleich, neuerOrdnerIn, ordneEbeneAn, ordneRaster, ordnerBereinigen, ordnerPasst, ordnerPfad, ordnerUnter, platziereGruppe, rasterGroesse, setzeEbene, sucheVokabeln, zahlDe, zielUnter } from "./raster.js";
import { SATZ_ANZAHLEN, SATZ_BEGLEITSATZ, SATZ_PORTION, istSynonymSpalte, listenInhalt, saetzeAusAntwort, saetzeLaden, saetzeSpeichern, satzPrompt, satzStandAlle, synPrompt, synonymeAus, synonymeAusAntwort } from "./saetze.js";
import { APP_VERSION, BLITZ_MS, SICHERUNG_TAGE, SICHERUNG_TAG_MS, SK, SLOT_ZU_VERZOEGERUNG, TYPEN, WAHL_ZU_MS, defaultEinstellungen, defaultSlots, ergaenzeSpalten, erstelleSicherung, formatDatum, formatSlotDatum, formatTag, istSicherung, leseDateiAlsText, listenAusSicherung, lsDel, lsGet, lsSet, neueListeObjekt, neuerSlotId, splitInSeiten, stelleSicherungWiederHer } from "./speicher.js";
import { SPRACHEN, SPRACH_KUERZEL, STIMMEN_PROBE, STIMMEN_WAHL, aeusserung, aktiveStimmen, erkenneSprache, gewaehlteStimme, listeSprache, naechsteStimme, normLang, setzeStimmenWahl, spalteLang, sprachInfo, sprich, sprichAuto, stimmeFuer, stimmeGeschlecht, stimmenFuerSprache, stimmenVarianten, varianteText, vorleseTeile } from "./sprache.js";
import { CSS, CSS_BASIS, setzeCSS } from "./stil.js";
import { ImportAnsicht } from "./bereiche/ImportAnsicht.jsx";
import { QuizTab } from "./bereiche/QuizTab.jsx";
import { ListeDetail } from "./bereiche/ListeDetail.jsx";
import { StatistikTab } from "./bereiche/StatistikTab.jsx";
import { EinstellungenTab } from "./bereiche/EinstellungenTab.jsx";
import { LernenAnsicht } from "./bereiche/LernenAnsicht.jsx";
import { DiktatAnsicht } from "./bereiche/DiktatAnsicht.jsx";
import { AbfrageAnsicht } from "./bereiche/AbfrageAnsicht.jsx";
import { renderAufteilenKasten as renderAufteilenKastenTeil, renderExportArtWahl as renderExportArtWahlTeil, renderKopfFortschritt as renderKopfFortschrittTeil, renderLernBilanz as renderLernBilanzTeil, renderMiniKreise as renderMiniKreiseTeil, renderModusKnoepfe as renderModusKnoepfeTeil, renderRueckblick as renderRueckblickTeil, renderRundenErgebnis as renderRundenErgebnisTeil, renderSessionAuswertung as renderSessionAuswertungTeil, renderSuchleiste as renderSuchleisteTeil, renderVokabelEditor as renderVokabelEditorTeil } from "./bereiche/teile.jsx";
import { gruppenKurz as gruppenKurzTeil, listeOeffnenKopf as listeOeffnenKopfTeil, listenWahlKopf as listenWahlKopfTeil, renderListeInfo as renderListeInfoTeil, renderSlotInfo as renderSlotInfoTeil, renderSlotKopf as renderSlotKopfTeil, renderVollbildKopf as renderVollbildKopfTeil } from "./bereiche/koepfe.jsx";
import { renderFarbschemata as renderFarbschemataTeil } from "./bereiche/farbenAnsicht.jsx";
import { auswahlOrdnerZelle as auswahlOrdnerZelleTeil, listenAuswahlPfad as listenAuswahlPfadTeil, listenNavi as listenNaviTeil, listenRasterPlaetze as listenRasterPlaetzeTeil, ordnerNavi as ordnerNaviTeil, pfadTeile as pfadTeileTeil, quizListenNavi as quizListenNaviTeil, quizListenUmschalter as quizListenUmschalterTeil, renderListenRaster as renderListenRasterTeil, renderQuizListenRaster as renderQuizListenRasterTeil, renderSlotBereiche as renderSlotBereicheTeil, wahlLeiste as wahlLeisteTeil } from "./bereiche/kacheln.jsx";
import { DialogErstellenFenster, DialogGruppenAenderungsDialog, DialogInGruppe, DialogJsonExport, DialogKlammern, DialogLernenEinst, DialogListeZuruecksetzen, DialogListeZusammenfuehren, DialogNeueSession, DialogSaetze, DialogSlotSpeichern, DialogSlotUmbenennen, DialogStimmenHilfe, DialogStufenRegeln, DialogSynonyme, DialogVorlesen, KiPromptAnsicht, StatistikKopf1, StatistikKopf2 } from "./bereiche/dialoge.jsx";

export default function VokabelApp() {
  const [tab, setTab] = useState("quiz");
  const [listenIndex, setListenIndex] = useState([]);
  const [einstellungen, setEinstellungen] = useState(defaultEinstellungen());   // gelerntSchwelle ist fest 3 (157)
  const [schemaBearbeiten, setSchemaBearbeiten] = useState(null);   // id des eigenen Schemas im Editor
  // Farbmodus: Farben direkt am Element ändern (Vorschau bis „Farben übernehmen“)
  const [farbModus, setFarbModus] = useState(false);
  const [tabGleiten, setTabGleiten] = useState(null);   // "links" | "rechts": Tab per Wischen gewechselt – Inhalt gleitet herein
  useEffect(() => { if (!tabGleiten) return; const x = setTimeout(() => setTabGleiten(null), 320); return () => clearTimeout(x); }, [tabGleiten]);
  const [farbVorschau, setFarbVorschau] = useState(null);           // Grundfarben während des Farbmodus
  const [elementVorschau, setElementVorschau] = useState(null);     // Element-Farben während des Farbmodus
  const [farbFeld, setFarbFeld] = useState(null);                   // {gruppen, zeit} nach langem Druck
  const [farbMarke, setFarbMarke] = useState(null);                 // Rechteck des hervorgehobenen Elements
  const [farbName, setFarbName] = useState(null);                   // Name beim Übernehmen einer Vorlage
  const farbModusRef = useRef(false);
  const [farbRad, setFarbRad] = useState(null);
  const [klammerZiel, setKlammerZiel] = useState("i1");                // Aufräum-Werkzeug: Ziel-Info-Spalte                     // {rolle, titel, start, basis, ziel: "vorschau"|schemaId}
  farbModusRef.current = farbModus;
  const [schemaMenueId, setSchemaMenueId] = useState(null);         // Schema für Umbenennen / Löschen
  // Farbschema: Farben je Rolle (CSS-Variablen + F für SVG); vor dem Laden der Einstellungen aus dem Speicher
  const farbSchema = schemaVon(einstellungen.farbschema || einstellungen.eigeneSchemata ? einstellungen : lsGet(SK.einstellungen, {}));
  setzeF(farbenAus(farbModus && farbVorschau ? farbVorschau : farbSchema.farben));
  setzeCSS(farbVariablen(F, farbSchema.dunkel) + CSS_BASIS + elementCSS(farbModus && elementVorschau ? elementVorschau : farbSchema.elemente));
  setzeFarbeImMenue(einstellungen.farbeImMenue !== false && !farbModus);
  setzeANTWORT_GEWICHTE({ ...STANDARD_ANTWORT_GEWICHTE, ...(einstellungen.antwortGewichte || {}) });
  useEffect(() => { setzeSystemLeiste(F.leiste); });
  const [infoModus, setInfoModus] = useState("uebersicht");
  const [ansicht, setAnsicht] = useState("uebersicht");
  const [aktiveListeId, setAktiveListeId] = useState(null);
  const [aktiveListe, setAktiveListe] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState("");
  const [modalMitVokabeln, setModalMitVokabeln] = useState(false);
  const [modalFehler, setModalFehler] = useState("");
  const [jsonExportIds, setJsonExportIds] = useState(null);
  const [exportName, setExportName] = useState("");        // Dateiname im Export-Fenster (ohne .txt)
  const [dateiExport, setDateiExport] = useState(null);    // TXT oder Gesamtsicherung: { art: "txt", ids } | { art: "sicherung" }
  const [jsonExportOptionen, setJsonExportOptionen] = useState({ fortschritt: true, diktatFortschritt: true, akzentFortschritt: true, falsch: true });
  const [editSpalteTyp, setEditSpalteTyp] = useState(null);

  const [bearbeiteVokabel, setBearbeiteVokabel] = useState(null);
  const [bearbeiteEingaben, setBearbeiteEingaben] = useState({});
  const [bearbeiteListe, setBearbeiteListe] = useState(null);   // Liste der bearbeiteten Vokabel (Listen, Statistik, Abfrage)
  const [bearbeiteNur, setBearbeiteNur] = useState(null);       // Abfrage: nur diese Spalte (richtige Antwort), ohne falsche Antworten
  const [bearbeiteFalsch, setBearbeiteFalsch] = useState(null);
  const [neueSessionSchritt, setNeueSessionSchritt] = useState("art");
  const [slotOrdner, setSlotOrdner] = useState(null);            // geöffnete Quiz-Gruppe (Quiz- und Statistik-Tab)
  const slotOrdnerRef = useRef(null); slotOrdnerRef.current = slotOrdner;
  const [listenOrdner, setListenOrdner] = useState(() => lsGet(SK.listenOrdner, []));   // 193: Listen-Ordner
  const [listenOrdnerOffen, setListenOrdnerOffen] = useState(null);                    // geöffneter Listen-Ordner (Listen-Tab und Listenauswahl)
  const listenOrdnerOffenRef = useRef(null); listenOrdnerOffenRef.current = listenOrdnerOffen;
  const [inGruppe, setInGruppe] = useState(null);                // Dialog „In Gruppe…“: { ids, name }
  const [ordnerUmbenennen, setOrdnerUmbenennen] = useState(null); // { id, name }   // Dialog „Neues Quiz aus Listen“: art | liste // Abfrage (MC): diese falsche Antwort der Spalte bearbeiteNur
  const [mergeQuelleId, setMergeQuelleId] = useState("");

  const [importText, setImportText] = useState("");
  const [importDateiname, setImportDateiname] = useState("");
  const [importParsed, setImportParsed] = useState(null);
  const [importMehrfachListen, setImportMehrfachListen] = useState(null);
  const [importJsonData, setImportJsonData] = useState(null);
  const [importNeuerOrdner, setImportNeuerOrdner] = useState(null);   // 195: Name des neuen Ordners für den Import (null = aus)
  const [speicherDauerhaft, setSpeicherDauerhaft] = useState(null);   // navigator.storage.persisted(): null = unbekannt
  const [letzteSicherung, setLetzteSicherung] = useState(() => lsGet(SK.letzteSicherung));
  const [sicherungLaden, setSicherungLaden] = useState(null);         // geladene Gesamtsicherung, wartet auf Bestätigung
  const [sicherungFehler, setSicherungFehler] = useState("");
  const [sicherungSpaeter, setSicherungSpaeter] = useState(() => lsGet(SK.sicherungSpaeter, 0));
  const [importMapping, setImportMapping] = useState({});
  const [importZielTyp, setImportZielTyp] = useState("neu");
  const [importNeuName, setImportNeuName] = useState("");
  const [importBestehendId, setImportBestehendId] = useState("");
  const [importFehler, setImportFehler] = useState("");

  const [quizAusgewaehlt, setQuizAusgewaehlt] = useState(["D1", "E1"]);
  const [quizFrageTyp, setQuizFrageTyp] = useState("D1");
  const [quizAntwortTypenGeordnet, setQuizAntwortTypenGeordnet] = useState(["E1"]);
  // Mehrfach-Auswahl der Antwort-Arten (lang drücken wählt die Art und startet sie, weiteres Antippen nimmt dazu/weg) – für alle Spalten;
  // „Bestätigen“ im Zeilen-Knopf übernimmt und klappt zu
  const [artenMehrfach, setArtenMehrfach] = useState(null);
  const [antwortMehrfach, setAntwortMehrfach] = useState(false);
  const [quizInfoTypenSession, setQuizInfoTypenSession] = useState([]);
  const [quizSpalteModus, setQuizSpalteModus] = useState({ E1: "karte" });
  const [quizZeigeInfo, setQuizZeigeInfo] = useState({ i1: true, i2: true });
  const [quizModus, setQuizModus] = useState("sequenziell");
  const [quizArt, setQuizArt] = useState("uebersetzung");      // Abfrageart: uebersetzung / diktat / akzente (Ü|D|A)
  const [quizArtStash, setQuizArtStash] = useState({});        // Einstellungen der gerade nicht gewählten Arten
  const [quizModusInfoAufgeklappt, setQuizModusInfoAufgeklappt] = useState(false);
  const [quizAbfrageModusAufgeklappt, setQuizAbfrageModusAufgeklappt] = useState(false);
  const [quizReihenfolgeAufgeklappt, setQuizReihenfolgeAufgeklappt] = useState(false);
  const [quizStufeAufgeklappt, setQuizStufeAufgeklappt] = useState(false);   // Stufe: Lernen | Leicht | Schwer + Regeln
  const [quizEinstellungenAufgeklappt, setQuizEinstellungenAufgeklappt] = useState(false);
  const [quizDiktatSpalte, setQuizDiktatSpalte] = useState("E1");
  const [quizDiktatUebersetzung, setQuizDiktatUebersetzung] = useState("D1");
  const [quizListeAufgeklappt, setQuizListeAufgeklappt] = useState(false);
  const [quizCheckboxAuswahl, setQuizCheckboxAuswahl] = useState(new Set());
  const [quizVonBisModus, setQuizVonBisModus] = useState(false);
  const [quizVonBisErster, setQuizVonBisErster] = useState(null);
  const [promptThema, setPromptThema] = useState("");
  const [promptAnzahl, setPromptAnzahl] = useState(20);
  const [promptBeispiele, setPromptBeispiele] = useState(false);
  const [promptFalsch, setPromptFalsch] = useState(3);
  const [promptModus, setPromptModus] = useState("generieren");
  const [promptSynonyme, setPromptSynonyme] = useState(false);
  const [promptKopiert, setPromptKopiert] = useState(false);
  const [promptSprache, setPromptSprache] = useState("en");
  const [letzterPrompt, setLetzterPrompt] = useState("");
  const [exportKopiert, setExportKopiert] = useState(false);
  const [kopierExportIds, setKopierExportIds] = useState(null);   // Export-Fenster „Kopieren“
  const [satzFenster, setSatzFenster] = useState(null);   // { listeId, antwort, meldung }
  const [synFenster, setSynFenster] = useState(null);     // Synonyme ergänzen: { listeId, antwort, meldung }
  const [listenSaetze, setListenSaetze] = useState({ listeId: null, saetze: {} });   // Beispielsätze der geöffneten Liste
  const [statistikSort, setStatistikSort] = useState("score-asc");
  const [statistikArt, setStatistikArt] = useState("uebersetzung");   // uebersetzung / diktat / akzente
  const [statistikFilter, setStatistikFilter] = useState(new Set(['negativ', 'nie', 'arbeit', 'gelernt'])); // Gruppen: negativ / nie / arbeit / gelernt
  const [statistikListenIds, setStatistikListenIds] = useState(null); // null = alle
  const [statistikListenAufgeklappt, setStatistikListenAufgeklappt] = useState(false);
  const [statistikVollbild, setStatistikVollbild] = useState(false);
  const [statistikBereichTyp, setStatistikBereichTyp] = useState("alle");
  const [statistikCheckboxAuswahl, setStatistikCheckboxAuswahl] = useState(new Set());
  const [statistikEinzelauswahlAufgeklappt, setStatistikEinzelauswahlAufgeklappt] = useState(false);
  const [statistikVonBisModus, setStatistikVonBisModus] = useState(false);
  const [statistikVonBisErster, setStatistikVonBisErster] = useState(null);
  // Lang-Druck auf eine Vokabel startet Von–Bis (sie ist der Anfang); die Tafel unten bleibt offen, bis das Ende angetippt ist
  const vonBisTafelRef = useRef(null);   // "quiz" | "statistik" | null
  useEffect(() => {
    const art = vonBisTafelRef.current;
    if ((art === "quiz" && !quizVonBisModus) || (art === "statistik" && !statistikVonBisModus)) { vonBisTafelRef.current = null; schliesseInfo(); }
  }, [quizVonBisModus, statistikVonBisModus]);
  useEffect(() => {
    if (quizVonBisErster == null || !sucheQuiz.text) return;
    setSucheQuiz(x => ({ ...x, text: "", nr: 0 }));
  }, [quizVonBisErster]);
  useEffect(() => {
    if (statistikVonBisErster == null || !sucheStatistik.text) return;
    setSucheStatistik(x => ({ ...x, text: "", nr: 0 }));
  }, [statistikVonBisErster]);
  const [statistikVokauswahlH, setStatistikVokauswahlH] = useState(0);
  const [slots, setSlots] = useState(defaultSlots());          // {verlauf:[], gespeichert:[]}
  const [aktiverSlot, setAktiverSlot] = useState(null);        // {typ:"verlauf"|"gespeichert", id:string} | null
  const [slotGeaendert, setSlotGeaendert] = useState(false);   // ob Einstellungen seit Laden geändert
  const [statistikAktiverSlot, setStatistikAktiverSlot] = useState(null); // separater Slot-Zustand für Statistik-Tab
  const [statistikSlotGeleert, setStatistikSlotGeleert] = useState(false);  // true wenn Slot durch Listen-Wechsel geleert
  const [quizSessionModus, setQuizSessionModus] = useState(STANDARD_SESSION_MODUS);
  const [quizPaketGroesse, setQuizPaketGroesse] = useState(STANDARD_PAKET_GROESSE);
  const [quizSessionAufgeklappt, setQuizSessionAufgeklappt] = useState(false);
  // Gespeicherte Konfiguration geladen: Listen-/Vokabel-Auswahl ausgeblendet – außer nach „Listen/Vokabeln ändern“
  const [listenAendern, setListenAendern] = useState(false);
  const slotSichtbarRef = useRef([]);
  const [, setSprungTick] = useState(0);
  const [faelligTick, setFaelligTick] = useState(0);
  const ausListeRef = useRef(null);       // 204: { listeId, ziel: "liste" | "raster" } – Quiz aus einer Liste gestartet → am Ende dorthin zurück
  // 203: Mindest-Spalten je Ebene – oberste Ebene in den Einstellungen (ebenenSpalten.slot / .liste), Ordner am Ordner (spalten)
  const minSpalten = (art, ordnerId) => {
    if (ordnerId) return ((art === "liste" ? listenOrdner : slots.ordner) || []).find(o => o.id === ordnerId)?.spalten || 1;
    return einstellungen.ebenenSpalten?.[art] || 1;
  };
  function setzeMinSpalten(art, ordnerId, n) {
    if (!ordnerId) { speichereEinst({ ...einstellungen, ebenenSpalten: { ...(einstellungen.ebenenSpalten || {}), [art]: n } }); return; }
    if (art === "liste") { const d = listenOrdnerDaten(); speichereListenOrdnerDaten({ ...d, ordner: d.ordner.map(o => o.id === ordnerId ? { ...o, spalten: n } : o) }); }
    else { const d = getSlotsData(); setSlotsData({ ...d, ordner: (d.ordner || []).map(o => o.id === ordnerId ? { ...o, spalten: n } : o) }); }
  }
  const [spaltenWahl, setSpaltenWahl] = useState(null);
  const [anordnen, setAnordnen] = useState(null);
  const [quizErstellen, setQuizErstellen] = useState(null);       // 217: { listeId } – „Quiz erstellen“ aus einer Liste (Bereich + Einstellungen)
  const [erstellenFenster, setErstellenFenster] = useState(null); // 217: { name, ordner } – Fenster zum Anlegen
  const [auswahlListen, setAuswahlListen] = useState(false);
  // 223: Höhen der feststehenden Zeilen über der Pfad-Zeile (Info-Fläche bzw. Listen-Kopfbereich) – die Pfad-Zeile klebt darunter
  const [slotInfoH, setSlotInfoH] = useState(0);
  const [listenKopfH, setListenKopfH] = useState(0);
  const hoeheBeobachten = setH => { let obs = null; return el => { obs?.disconnect(); obs = null; if (!el) { setH(0); return; } obs = new ResizeObserver(() => setH(el.offsetHeight)); obs.observe(el); setH(el.offsetHeight); }; };
  const slotInfoRefCb = useMemo(() => hoeheBeobachten(setSlotInfoH), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const listenKopfRefCb = useMemo(() => hoeheBeobachten(setListenKopfH), []);   // eslint-disable-line react-hooks/exhaustive-deps       // 217: Quiz-Auswahl zeigt die Listen (Umschalter „Quiz | Listen“)   // 208: { art, ordner } – Fenster „Anordnen“
  // 208: anordnen nach name | datum | lernstand | luecken (Spalten = gewählte bzw. belegte)
  function ordneAn(art, ordnerId, nach) {
    const liste = art === "liste";
    const data = liste ? listenOrdnerDaten() : rasterEinordnen(getSlotsData());
    const ebene = ebeneVon(data, ordnerId);
    const spalten = ebenenSpalten(ebene, false, minSpalten(art, ordnerId));
    const datum = x => liste ? Number(String(x.id).match(/(\d{10,})/)?.[1] || 0) : (x.timestamp || 0);
    const pctListe = id => lernstandJeArt(lsGet(SK.liste(id))?.vokabeln || [], id).uebersetzung.pct || 0;
    const pctSession = x => { const k = x.konfiguration || {};
      let v = (k.listenIds || []).flatMap(id => (lsGet(SK.liste(id))?.vokabeln || []).map(y => ({ ...y, _key: `${id}__${y.id}` })));
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) { const a = new Set(k.vokabelAuswahl); v = v.filter(y => a.has(y._key)); }
      return lernstandJeArt(v).uebersetzung.pct || 0; };
    const pct = x => x.istOrdner
      ? (() => { const e = eintraegeImOrdner(data, x.id); return e.length ? e.reduce((m, y) => m + (liste ? pctListe(y.id) : pctSession(y)), 0) / e.length : 0; })()
      : liste ? pctListe(x.id) : pctSession(x);
    const vergleich = nach === "name" ? nameVergleich
      : nach === "datum" ? (a, b) => (a.istOrdner || b.istOrdner ? nameVergleich(a, b) : datum(a) - datum(b))
      : nach === "lernstand" ? (a, b) => pct(b) - pct(a)
      : null;
    const neu = ordneEbeneAn(data, ordnerId, vergleich, spalten);
    if (liste) speichereListenOrdnerDaten(neu); else setSlotsData(rasterEinordnen(neu));
    setAnordnen(null);
  }   // 203: { art, ordner } – Fenster „Spalten“ (Quiz)
  const [satzStand, setSatzStand] = useState({});   // 202: { listeId: { vokId: Anzahl Sätze } }
  const ladeSatzStand = () => satzStandAlle().then(setSatzStand);
  useEffect(() => { ladeSatzStand(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const neuPlatzRef = useRef(null);       // 199: { ordner, platz } – „＋ Neues Quiz“ auf einem freien Platz begonnen
  const neuListePlatzRef = useRef(null);  // 199: { ordner, platz } – „＋ Neue Liste“ auf einem freien Platz begonnen
  const neuImOrdnerRef = useRef(null);   // „Neues Quiz“ in einer geöffneten Gruppe begonnen → beim Speichern/Aufteilen dort anlegen   // sichtbare Quiz-Kacheln (für „Alle“ in der Mehrfach-Auswahl)
  const [slotVorschau, setSlotVorschau] = useState(null);           // Quiz-Auswahl: angetippte Quiz { typ, id } – Info darunter, laden über den Kopf
  const [slotVorschauListe, setSlotVorschauListe] = useState(false); // … deren Vokabeln als Liste
  // 192: Blätter-Modus – nach einem Lang-Druck wechselt Antippen nur die Kachel; sonst übernimmt Antippen sofort
  // (Quiz laden bzw. Liste öffnen). Endet, wenn die Auswahl zugeht (Übernehmen, Tab-Wechsel, Ordner bleibt).
  const [blaettern, setBlaettern] = useState(false);
  const kachelLangRef = useRef(null);   // (art, id, stufe) – Touch-Lang-Druck ohne Bewegung losgelassen (Gesten-Effekt)
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [infoZu, setInfoZu] = useState(true);   // Info-Fläche: anfangs zu, beim Tab-Wechsel wieder zu (165)
  useEffect(() => { setInfoZu(true); }, [tab]);           // Verlauf (letzte Abfragen) aufgeklappt – selten gebraucht, anfangs zu
  const [multiAuswahl, setMultiAuswahl] = useState(null);
  // lang drücken in der Mehrfach-Auswahl beendet sie: die Auswahl bleibt (grüner Kopf bestätigt, Kontextmenü offen), das nächste Antippen wählt wieder einzeln
  const [wahlBeendet, setWahlBeendet] = useState({ slot: false, liste: false });
  const wahlBeendenRef = useRef(null);
  const wahlUmschaltenRef = useRef(null);
  const [vonBis, setVonBis] = useState(null);   // { art, id }: „↔ Von–Bis“ gewählt – der nächste Lang-Druck wählt alles dazwischen
  const plaetzeRef = useRef({ slot: [], liste: [] });   // sichtbare Kacheln mit Platz (für Von–Bis: spaltenweise)   // Multiquiz: gewählte Kacheln (Reihenfolge = Nummern), null = aus
  const [multiStart, setMultiStart] = useState(null);
  const slotZuTimerRef = useRef(null);   // Auswahl klappt nach dem Laden kurz verzögert zu (neue Kachel sichtbar markiert)       // Verlauf-Id des eben gebildeten Multiquiz – startet nach dem Laden
  const [abfrageZielModus, setAbfrageZielModus] = useState(STANDARD_ABFRAGE_ZIEL);
  const [abfrageZielAnzahl, setAbfrageZielAnzahl] = useState(1);
  const [abfrageZielWiederholung, setAbfrageZielWiederholung] = useState(1);
  const [abfrageZielScore, setAbfrageZielScore] = useState(0);
  const [abfrageZielScoreTyp, setAbfrageZielScoreTyp] = useState("global");
  const [sessionSlotAktiv, setSessionSlotAktiv] = useState(null);
  const [sessionH, setSessionH] = useState(0);
  const [slotH, setSlotH] = useState(0);
  const [listenauswahlHeaderH, setListenauswahlHeaderH] = useState(0);
  const [sessionUeberschreibenModal, setSessionUeberschreibenModal] = useState(false);
  const [loescheSlotNr, setLoescheSlotNr] = useState(null);
  const [slotSektionAufgeklappt, setSlotSektionAufgeklappt] = useState(true);
  const [slotUmbenennen, setSlotUmbenennen] = useState(null);   // {id, name, kopie} – Fenster "Umbenennen" bzw. "Duplizieren"
  const [quizGelerntEinschliessen, setQuizGelerntEinschliessen] = useState(false);
  const [quizHeuteEinschliessen, setQuizHeuteEinschliessen] = useState(false);
  const [startLeerHinweis, setStartLeerHinweis] = useState(false);   // 188: Start-Knopf mit 0 angetippt → Zeile unter den Knöpfen   // 180: vorübergehend (nicht gespeichert; andere Quiz → aus)
  const [gruppenQuiz, setGruppenQuiz] = useState(null);   // {name, art, ids, listenIds} – Rückfrage "Quiz mit dieser Gruppe starten?"
  const gruppenQuizStartRef = useRef(0);                 // >0: nach dem Tab-Wechsel automatisch starten
  const [listenGelerntAusblenden, setListenGelerntAusblenden] = useState(false);
  const [listeNurAus, setListeNurAus] = useState(false);   // 176: Listenansicht zeigt nur die herausgenommenen Vokabeln
  const [updateStatus, setUpdateStatus] = useState(null);
  const [sprachMenuOffen, setSprachMenuOffen] = useState(false);
  const [slotSortModus, setSlotSortModus] = useState(false);   // "Verschieben"-Modus des Rasters
  const [slotDragId, setSlotDragId] = useState(null);         // wird gerade gezogen
  const [slotAuswahl, setSlotAuswahl] = useState([]);         // im Verschieben-Modus markiert (Reihenfolge = Nummern)
  const [slotDragZiel, setSlotDragZiel] = useState(null);     // "z|s" unter dem Finger
  const slotZiehenRef = useRef(null);                         // {id, x, y, aktiv, art: "liste" für das Listen-Raster}
  const [listenSortModus, setListenSortModus] = useState(false);   // "Verschieben"-Modus des Listen-Rasters
  const [listenAuswahl, setListenAuswahl] = useState([]);          // im Verschieben-Modus markiert
  // Auswahl-Modus (Lang-Druck → „☑ Auswählen“): antippen wählt, Lang-Druck zeigt die Aktionen für die Auswahl.
  // Listen: listenWahl; Konfigurationen: multiAuswahl (Reihenfolge = Nummern); null = aus
  const [listenWahl, setListenWahl] = useState(null);
  const [listeVorschau, setListeVorschau] = useState(null);   // Einstellungen › Listen: angetippte Liste (Info oben, öffnen über den grünen Knopf)
  const [auswahlLoeschen, setAuswahlLoeschen] = useState(null);     // { art: "slot" | "liste", ids } wartet auf Bestätigung
  const rasterAuswahlRef = useRef({ slot: [], liste: [] });          // für die Zieh-Logik (Effekte ohne Abhängigkeiten)
  rasterAuswahlRef.current = { slot: slotAuswahl, liste: listenAuswahl, slotWahl: multiAuswahl, listeWahl: listenWahl,
    slotEinzel: slotVorschau?.typ === "gespeichert" ? slotVorschau.id : null, listeEinzel: listeVorschau };
  const [listeMenueId, setListeMenueId] = useState(null);          // Liste aus dem Lang-Druck-Menü (Umbenennen, Duplizieren, Zurücksetzen, Löschen)
  const [zuruecksetzenArten, setZuruecksetzenArten] = useState(new Set(Object.keys(SCORE_FELD)));
  // Liste in mehrere Quiz aufteilen (Quiz-Tab): { listeId, name, groesse, von, bis, restAnhaengen }
  const [aufteilen, setAufteilen] = useState(null);
  // Vokabel-Suche je Stelle: { text, nr (aktueller Treffer), nurTreffer }; Aufteilen: { feld: "von"|"bis", text } oder null
  const [sucheQuiz, setSucheQuiz] = useState(SUCHE_LEER);
  const [sucheStatistik, setSucheStatistik] = useState(SUCHE_LEER);
  const [sucheListe, setSucheListe] = useState(SUCHE_LEER);
  const [aufteilenSuche, setAufteilenSuche] = useState(null);
  const listeDetailKopfRef = useRef(null);
  const [listeDetailKopfH, setListeDetailKopfH] = useState(48);
  const slotGezogenRef = useRef(false);                       // Klick nach dem Ziehen schlucken
  // Auswahl-Tafel (Lang-Druck auf eine Kachel): bleibt unten offen, weitere Kacheln antippen wählt mit aus
  const auswahlTafelRef = useRef(null);                       // "slot" | "liste" solange offen
  const auswahlTafelDaten = useRef({});                       // je Art: () => { text, aktionen } aus dem letzten Render
  const [gruppenZiel, setGruppenZiel] = useState(null);       // "z|s": lange genug darüber gehalten – Loslassen bildet eine Gruppe
  const gruppenZielRef = useRef(null);
  const lassoRef = useRef(null);                              // Lang-Druck auf freie Stelle + ziehen: Kacheln einsammeln
  const [lasso, setLasso] = useState(null);
  const kachelGesteRef = useRef(null);                        // Haltestufen auf einer Kachel (Touch)
  const [angehoben, setAngehoben] = useState(null);           // Id der angehobenen Kachel (bereit zum Ziehen)
  const auswahlTafelStelle = useRef(null);                    // { x, y } für „🎨 Farbe ändern“, wenn die Tafel nach dem Einsammeln aufgeht                   // { art, ids } während des Einsammelns (erst beim Loslassen übernommen – Raster springt nicht)
  // Rückfrage "Abgefragt-Stand löschen?" in der Fortschrittszeile; ohne Antwort nach 6 s wieder weg
  const [sessionResetFrage, setSessionResetFrage] = useState(false);
  const [lernResetFrage, setLernResetFrage] = useState(false);
  useEffect(() => {
    if (!sessionResetFrage) return;
    const t = setTimeout(() => setSessionResetFrage(false), 6000);
    return () => clearTimeout(t);
  }, [sessionResetFrage]);
  const [importSprache, setImportSprache] = useState("en");
  const [gespeicherteVokabelgruppe, setGespeicherteVokabelgruppe] = useState(null);
  const [gruppenAenderungsDialog, setGruppenAenderungsDialog] = useState(false);
  const [quizBereichTyp, setQuizBereichTyp] = useState("alle");
  const [quizReihenfolge, setQuizReihenfolge] = useState(STANDARD_REIHENFOLGE);
  const [quizSchlechtesteMaxScore, setQuizSchlechtesteMaxScore] = useState(STANDARD_MAX_SCORE);
  const [quizUnbeantwortetZuerst, setQuizUnbeantwortetZuerst] = useState(STANDARD_UNBEANTWORTET_ZUERST);
  const [quiz, setQuiz] = useState(null);
  const [lernen, setLernen] = useState(null);
  const quizStufeRef = useRef(null);   // Stufe der laufenden Runde, falls abweichend ("lernen": Quiz nach dem Lernen)   // Lernen-Film: { voks, index, phase 0|1, pausiert, fertig, lauf, zuerst, danach, info, liste }
  const [diktatListeAufgeklappt, setDiktatListeAufgeklappt] = useState(false);
  const [listenBereich, setListenBereich] = useState(null);   // offener Bereich einer Liste: sprache | saetze | spalten | vokabeln
  const vokabelAufgeklappt = listenBereich === "vokabeln";
  const listenZeileRef = useRef(null);
  const [listenZeileH, setListenZeileH] = useState(0);
  const [ansichtSpaltenAn, setAnsichtSpaltenAn] = useState(() => lsGet(SK.ansichtSpalten, {}));
  const [statistikListeZu, setStatistikListeZu] = useState(() => lsGet(SK.statistikListeZu, true) !== false);
  const [diktatManualPlays, setDiktatManualPlays] = useState(0);
  const [quizTabListen, setQuizTabListen] = useState([]);
  const [listenAuswahlAufgeklappt, setListenAuswahlAufgeklappt] = useState(false);   // ohne gewählte Liste öffnet sie der Effekt unten
  const eingabeRef = useRef(null);
  const flashTimerRef = useRef(null);
  const flashWeiterRef = useRef(null);   // was nach der Verzögerung passiert (Antippen beendet sie sofort)
  const akzentBlinkRef = useRef(null);
  const diktatPlayCountRef = useRef(0);
  const fileInputRef = useRef(null);
  const sicherungInputRef = useRef(null);
  const headerRef = useRef(null);
  const listenContainerRef = useRef(null);
  const dropdownImmuneRef = useRef(false);
  const statistikListenHeaderRef = useRef(null);
  const statistikVokauswahlRef = useRef(null);
  const statistikListenContainerRef = useRef(null);
  const statistikEinzelauswahlRef = useRef(null);
  const alleBereichRef = useRef(null);
  const einzelauswahlRef = useRef(null);
  const abfrageModusRef = useRef(null);
  const abfrageModusContainerRef = useRef(null);
  const einstellungenRef = useRef(null);
  const einstellungenContainerRef = useRef(null);
  const reihenfolgeRef = useRef(null);
  const reihenfolgeContainerRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionContainerRef = useRef(null);
  const slotSektionRef = useRef(null);
  const slotContainerRef = useRef(null);
  const listenauswahlHeaderRef = useRef(null);
  const infoHeaderRef = useRef(null);
  const [einstBereich, setEinstBereich] = useState(null);
  const [einstUnter, setEinstUnter] = useState(null);   // offener Knopf der Knopfzeile im Einstellungs-Bereich
  const [farbTab, setFarbTab] = useState(null);   // Einstellungen › Farben: vorlagen | eigene | werkzeuge
  const [stimmenWahl, setStimmenWahlState] = useState(STIMMEN_WAHL);   // Einstellungen › Stimmen
  const [, setStimmenGeladen] = useState(0);
  useEffect(() => {
    const s = window.speechSynthesis; if (!s?.addEventListener) return;
    const neu = () => setStimmenGeladen(n => n + 1);
    s.addEventListener("voiceschanged", neu);
    return () => s.removeEventListener("voiceschanged", neu);
  }, []);
  const aendereStimmen = neu => { setzeStimmenWahl(neu); setStimmenWahlState(neu); };
  function wechsleStimme(text, lang) {
    const v = naechsteStimme(normLang(lang).split("-")[0]);
    setStimmenWahlState(STIMMEN_WAHL);
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    vorleseTeile(text).forEach(x => window.speechSynthesis.speak(aeusserung(x, lang, v)));
  }   // Einstellungen: aufgeklappter Bereich (immer nur einer)
  const infoKontextContainerRef = useRef(null);
  const tooltipTimer = useRef(null);
  const tooltipShown = useRef(false);
  const tooltipStart = useRef(null);   // Fingerposition beim Aufsetzen: kleine Bewegungen brechen den langen Druck nicht ab
  // Erklärtext: Maus = title; Touch = lange drücken → Info-Tafel (bleibt bis Antippen, InfoTafel.jsx);
  // data-info macht das Element im Info-Modus erklärbar
  // aktionen (optional): Lang-Druck bzw. Rechtsklick zeigt die Erklärung mit Menü-Knöpfen darunter
  // opts.langText: anderer Text für den Lang-Druck (z. B. nur der volle Name); opts.beimZeigen(x, y): Rückruf;
  // opts.auswahl: als Auswahl-Tafel zeigen (siehe infoEreignisse.js); opts.eigeneGeste: Touch-Lang-Druck übernimmt die Kachel-Geste
  function tt(text, aktionen, opts = {}) {
    if (!text) return {};
    const langText = opts.langText || text;
    return {
      // Rechtsklick = langer Druck: Menü bzw. Erklärung (mit „🎨 Farbe ändern“)
      // verschachtelt: ein inneres Element mit eigenem Menü hat Vorrang vor dem äußeren (sonst gewinnt wie bisher das äußere)
      onContextMenu(e) { e.preventDefault(); if (e.nativeEvent._ttMenue) return; if (aktionen) e.nativeEvent._ttMenue = true;
        // 171: Android meldet den Lang-Druck zusätzlich als Kontextmenü – bei Kacheln läuft schon die eigene Geste (sonst rein + wieder heraus)
        if (opts.eigeneGeste && (kachelGesteRef.current || lassoRef.current?.aktiv || e.nativeEvent.sourceCapabilities?.firesTouchEvents || e.nativeEvent.pointerType === "touch")) return;
        opts.beimLang?.();
        if (aktionen) opts.beimMenue?.(); zeigeInfo(langText, e.clientX, e.clientY, aktionen, { ...(opts.auswahl ? { auswahl: opts.auswahl } : {}), ...(opts.regler ? { regler: opts.regler() } : {}) }); },
      title: text,
      "data-info": text,
      onTouchStart(e) {
        if (e.nativeEvent._ttMenue) return;
        if (aktionen) e.nativeEvent._ttMenue = true;
        if (opts.eigeneGeste) return;   // Kacheln: Haltestufen (Verschieben / Auswählen) statt Erklärung
        const t = e.touches[0];
        tooltipStart.current = { x: t.clientX, y: t.clientY };
        clearTimeout(tooltipTimer.current);
        tooltipShown.current = false;
        tooltipTimer.current = setTimeout(() => {
          if (slotZiehenRef.current?.aktiv) return;   // beim Verschieben im Raster keine Erklärung einblenden
          if (farbModusRef.current) return;            // Farbmodus: langer Druck öffnet das Farbfeld
          tooltipShown.current = true; opts.beimLang?.(); zeigeInfo(langText, t.clientX, t.clientY, aktionen, { ...(opts.auswahl ? { auswahl: opts.auswahl } : {}), ...(opts.regler ? { regler: opts.regler() } : {}) });
          if (aktionen) opts.beimMenue?.();
          opts.beimZeigen?.(t.clientX, t.clientY);
        }, 500);
      },
      onTouchEnd(e)   { clearTimeout(tooltipTimer.current); if (tooltipShown.current) { e.preventDefault(); tooltipShown.current = false; } },
      onTouchMove(e)  {   // erst ab 10 px Bewegung abbrechen (Finger zittert); Finger zittert nach dem Aufgehen: Tafel bleibt
        const t = e.touches[0], st = tooltipStart.current;
        if (!t || !st || Math.hypot(t.clientX - st.x, t.clientY - st.y) > 10) clearTimeout(tooltipTimer.current);
      },
      onTouchCancel() { clearTimeout(tooltipTimer.current); tooltipShown.current = false; },
    };
  }
  // Eingabefelder/Ziehen: nur Maus-Hinweis + Info-Modus (langes Drücken bleibt Einfügen/Markieren/Ziehen)
  function ttFeld(text) { return text ? { title: text, "data-info": text } : {}; }
  const [headerH, setHeaderH] = useState(104);
  const [alleBereichH, setAlleBereichH] = useState(0);
  const [abfrageModusH, setAbfrageModusH] = useState(0);
  const [reihenfolgeH, setReihenfolgeH] = useState(0);
  const [einstellungenH, setEinstellungenH] = useState(0);
  const [statistikListenHeaderH, setStatistikListenHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Rolladen-Bereiche: Zuklappen beim Weiterscrollen, mit Bremse am Bereichsende ──
  // Ein offener Bereich klappt erst zu, wenn sein Ende sichtbar war und das Scrollen dort
  // angehalten hat ("freigegeben"). Schwung, der unfreigegeben übers Ende hinausläuft,
  // klappt nicht zu, sondern gleitet zurück, bis das Ende wieder unten sichtbar ist.
  const [zuklappHinweis, setZuklappHinweis] = useState(false);
  const zuklappFreiRef = useRef(new Set());
  const kontexteRef = useRef(() => []);
  // Bereich-Modus mit offener Vokabelliste: nur Kopfzeile, „Alle | Bereich“ und die Liste – der Rest des Quiz ist ausgeblendet
  // (früh berechnet: Closures wie kontexteRef lesen es auch nach Renders, die vorzeitig zurückkehren)
  const quizVokMax = tab === "quiz" && quizTabListen.length > 0 && quizListeAufgeklappt && quizBereichTyp === "bereich"
    && !aufteilen && !slotSektionAufgeklappt;
  // sichtbarer Ausschnitt (iOS: mit Tastatur kleiner und ggf. verschoben) – die maximierte Liste liegt fest darin
  const [sichtFenster, setSichtFenster] = useState(null);
  useEffect(() => {
    if (!quizVokMax) { setSichtFenster(null); return; }
    const vv = window.visualViewport;
    const neu = () => setSichtFenster({ top: vv ? vv.offsetTop : 0, h: vv ? vv.height : window.innerHeight });
    window.scrollTo(0, 0);
    neu();
    vv?.addEventListener("resize", neu); vv?.addEventListener("scroll", neu); window.addEventListener("resize", neu);
    return () => { vv?.removeEventListener("resize", neu); vv?.removeEventListener("scroll", neu); window.removeEventListener("resize", neu); };
  }, [quizVokMax]);
  const maxFenster = quizVokMax && sichtFenster;
  const maxSpalte = { left: "max(0px, calc(50% - 300px))", width: "min(100%, 600px)", margin: 0, boxSizing: "border-box" };   // wie .app (max. 600 px, mittig)
  // Listen-Auswahl: ohne gewählte Liste immer offen (rechts nur ein Hinweis statt Knopf)
  const listenOffen = listenAuswahlAufgeklappt || quizTabListen.length === 0;
  // Quiz-Fokus: ein offener Bereich zeigt nur seine Überschrift (klebt unter des Quiz-Leiste) und seinen Inhalt;
  // zu nur über die Überschrift (kein Zuklappen beim Weiterscrollen). Ohne offenen Bereich scrollt alles unter des Quiz-Leiste.
  const quizListenSichtbar = !((aktiverSlot?.typ === "gespeichert" || aktiverSlot?.typ === "listen") && !listenAendern);   // 217 (beim Erstellen bleibt die Vokabel-Auswahl sichtbar)
  const quizFokus = tab !== "quiz" || slotSektionAufgeklappt || quizTabListen.length === 0 || aufteilen ? null
    : quizListenSichtbar && listenOffen ? "listen"
    : quizVokMax ? "einzel"
    : quizAbfrageModusAufgeklappt || quizReihenfolgeAufgeklappt || quizStufeAufgeklappt ? "zeile1"
    : quizSessionAufgeklappt ? "zeile2"
    : !quizListenSichtbar || !listenAendern ? null : "aendern";
  // Offener Bereich: Zeilen darüber bleiben stehen, Zeilen darunter sind ausgeblendet (maximierte Vokabelliste: nur sie)
  const FOKUS_STUFE = { listen: 0, einzel: 1, aendern: 1, zeile1: 2, zeile2: 3 };
  const fokusZeigt = k => !quizFokus || (quizFokus === "einzel" ? k === "einzel" : FOKUS_STUFE[k] <= FOKUS_STUFE[quizFokus]);
  // Zuklappen (Wahl übernommen bzw. „Bestätigen“): der Knopf leuchtet kurz in der Bestätigen-Farbe – nicht, wenn ein anderer Bereich aufgeht
  const offenerKnopf = quizStufeAufgeklappt ? "stufe" : quizAbfrageModusAufgeklappt ? "modus" : quizReihenfolgeAufgeklappt ? "reihenfolge"
    : quizSessionAufgeklappt === "umfang" ? "umfang" : quizSessionAufgeklappt === "ziel" ? "ziel" : null;
  const vorigerKnopfRef = useRef(null);
  // Kurzes Aufleuchten in der Bestätigen-Farbe – schaltet sofort an und aus (keine Überblendung)
  const [blitz, setBlitz] = useState({});
  const blitzTimer = useRef({});
  const leuchte = (k, ms = BLITZ_MS) => {
    clearTimeout(blitzTimer.current[k]);
    setBlitz(b => ({ ...b, [k]: true }));
    blitzTimer.current[k] = setTimeout(() => setBlitz(b => { const n = { ...b }; delete n[k]; return n; }), ms);
  };
  const blitzt = k => blitz[k] ? " leuchten" : "";
  const vorigerListenBereich = useRef(null);
  useEffect(() => {
    const v = vorigerListenBereich.current;
    vorigerListenBereich.current = listenBereich;
    if (v && !listenBereich) leuchte(`lb:${v}`);
  }, [listenBereich]);   // eslint-disable-line react-hooks/exhaustive-deps
  // „Nach oben“: sichtbar, sobald ein Bereich (Fenster oder Vokabel-Scroller) weit nach unten gescrollt ist
  const nachObenRef = useRef(null);
  const [nachOben, setNachOben] = useState(false);
  useEffect(() => {
    const pruefe = e => {
      const el = e.target && e.target.nodeType === 1 ? e.target : null;
      if (el && !el.hasAttribute("data-vok-scroller")) return;
      const ziel = el || window;
      const weit = (el ? el.scrollTop : window.scrollY) > window.innerHeight * 0.8;
      if (weit) nachObenRef.current = ziel;
      else if (nachObenRef.current === ziel) nachObenRef.current = null;
      setNachOben(!!nachObenRef.current);
    };
    document.addEventListener("scroll", pruefe, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", pruefe, { capture: true });
  }, []);
  const springeNachOben = () => {
    const z = nachObenRef.current;
    if (z && z !== window) z.scrollTop = 0; else window.scrollTo({ top: 0, behavior: "instant" });
    nachObenRef.current = null; setNachOben(false);
  };
  useEffect(() => {
    const vorher = vorigerKnopfRef.current;
    vorigerKnopfRef.current = offenerKnopf;
    if (!vorher || offenerKnopf) return;
    leuchte(vorher);
  }, [offenerKnopf]);   // eslint-disable-line react-hooks/exhaustive-deps
  const leuchtet = k => blitz[k] && !offenerKnopf ? " leuchten" : "";
  useEffect(() => { if (tab === "quiz") window.scrollTo(0, 0); }, [quizFokus]);   // Bereich auf/zu: von oben
  kontexteRef.current = () => {
    const q = headerH + slotH + listenauswahlHeaderH;
    return [
      ["slot",      slotContainerRef,            headerH + slotH,                         () => setSlotSektionAufgeklappt(false)],
      ["statListen", statistikListenContainerRef, headerH + slotH,                        () => setStatistikListenAufgeklappt(false)],
      ["statVok",   statistikEinzelauswahlRef,   headerH + slotH + statistikListenHeaderH, () => setStatistikEinzelauswahlAufgeklappt(false)],
      ["info",      infoKontextContainerRef,     infoHeaderRef.current?.getBoundingClientRect().bottom ?? 0, () => setInfoModus("uebersicht"), infoModus !== "uebersicht"],
    ].filter(([, ref, , , offen = true]) => offen && ref.current && ref.current.offsetHeight > 0)
     .map(([key, ref, linie, schliessen]) => ({ key, el: ref.current, linie, schliessen }));
  };
  const haltPruefenRef = useRef(() => {});
  haltPruefenRef.current = () => {
    if (dropdownImmuneRef.current) return;
    const frei = new Set();
    let zurueck = null, hinweis = false;
    for (const k of kontexteRef.current()) {
      const r = k.el.getBoundingClientRect();
      if (r.bottom > window.innerHeight) continue;                 // Ende noch nicht sichtbar
      if (r.bottom > k.linie || zuklappFreiRef.current.has(k.key)) {
        frei.add(k.key);
        if (r.top < k.linie) hinweis = true;                       // langer, gescrollter Bereich
      } else if (zurueck === null) zurueck = r.bottom;             // Schwung zu weit, ohne Freigabe
    }
    if (zurueck !== null) window.scrollBy({ top: zurueck - (window.innerHeight - 96), behavior: "smooth" });
    zuklappFreiRef.current = frei;
    setZuklappHinweis(hinweis);
  };
  function klappeFreieZu() {
    kontexteRef.current().forEach(k => k.schliessen());
    zuklappFreiRef.current = new Set();
    setZuklappHinweis(false);
  }
  useEffect(() => {
    let timer = null;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => haltPruefenRef.current(), 200);
      if (dropdownImmuneRef.current) return;
      kontexteRef.current().forEach(k => {
        if (zuklappFreiRef.current.has(k.key) && k.el.getBoundingClientRect().bottom <= k.linie) k.schliessen();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll); };
  }, []);
  // Beim Auf-/Zuklappen neu prüfen (kurze Bereiche sind sofort freigegeben)
  useEffect(() => {
    const t = setTimeout(() => haltPruefenRef.current(), 350);
    return () => clearTimeout(t);
  }, [tab, slotSektionAufgeklappt, listenAuswahlAufgeklappt, quizListeAufgeklappt, quizAbfrageModusAufgeklappt, quizReihenfolgeAufgeklappt,
      quizEinstellungenAufgeklappt, quizSessionAufgeklappt, statistikListenAufgeklappt, statistikEinzelauswahlAufgeklappt, infoModus]);


  // Aufteilen endet, sobald andere Listen oder eine gespeicherte Konfiguration gewählt werden
  useEffect(() => {
    if (aufteilen && (aktiverSlot || quizTabListen.length !== 1 || quizTabListen[0] !== aufteilen.listeId)) setAufteilen(null);
  }, [aufteilen, aktiverSlot, quizTabListen]);

  // Alle/Bereich-Zeile Höhe messen
  useEffect(() => {
    const el = alleBereichRef.current;
    if (!el) { setAlleBereichH(0); return; }
    const obs = new ResizeObserver(() => setAlleBereichH(el.offsetHeight));
    obs.observe(el);
    setAlleBereichH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length, aktiverSlot, listenAendern, tab, quizFokus]);   // Fokus: Zeile wird neu eingehängt
  // Lernen: aktuelle Seite (Wort bzw. Übersetzung) ggf. vorlesen, danach die eingestellte Pause, dann weiter
  useEffect(() => {
    if (!lernen || lernen.pausiert || lernen.fertig) return;
    const v = lernen.voks[lernen.index];
    if (!v) return;
    const le = lernEinstellungen();
    // Abschnitte: 0 Wort, 1 Übersetzung, 2 Zusatzinfo – danach jeweils Lese-/Vorlesezeit plus Pause
    const spalten = lernen.phase === 0 ? lernen.zuerst : lernen.phase === 1 ? lernen.danach : lernen.info;
    const infoLang = le.infoSprache === "deutsch" ? "de-DE" : vokLang(v, "E1");
    const texte = spalten.filter(t => v[t]?.wert).map(t => [lernen.phase === 2 ? v[t].wert : v[t].wert.split('/')[0].trim(), lernen.phase === 2 ? infoLang : vokLang(v, t)]);
    const pauseS = lernPause(lernen, v);
    const pause = pauseS * 1000;
    const vorlesen = lernen.phase === 0 ? le.vorlesen1 : lernen.phase === 1 ? le.vorlesen2 : le.vorlesen3;
    let timer = null, aus = false;
    const warte = ms => { if (pauseS < LERNEN_TIPPEN) timer = setTimeout(() => { if (!aus) lernenWeiter(); }, ms); };
    if (!(vorlesen && texte.length && window.speechSynthesis)) {
      warte((texte.length ? lernLesezeit(texte.map(x => x[0]).join(" ")) : 0) + pause);
    } else {
      window.speechSynthesis.cancel();
      texte.forEach(([t, l]) => window.speechSynthesis.speak(aeusserung(t, l)));
      // Pause erst nach dem Vorlesen (Sicherung: höchstens 15 s warten)
      const start = Date.now();
      const pruefe = () => { if (aus) return; if (window.speechSynthesis.speaking && Date.now() - start < 15000) timer = setTimeout(pruefe, 150); else warte(pause); };
      timer = setTimeout(pruefe, 300);
    }
    return () => { aus = true; clearTimeout(timer); window.speechSynthesis?.cancel(); };
  }, [lernen?.lauf, lernen?.index, lernen?.phase, lernen?.pausiert, lernen?.fertig]);

  // Statistik auf Akzente, aber die Akzente sind für keine Sprache der Auswahl eingeschaltet → Übersetzung
  useEffect(() => {
    if (statistikArt === "akzente" && !statistikGefilterteVoks.some(v => AKZENTE_FUER_LISTE(v._listeId))) setStatistikArt("uebersetzung");
  }, [statistikArt, statistikListenIds, statistikCheckboxAuswahl, einstellungen.akzenteSprachen]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Akzente für die gewählten Listen ausgeschaltet (oder keine Wörter mit Akzent) → Abfrageart A gibt es nicht
  useEffect(() => {
    if (quizArt !== "akzente" || !quizKombiListe) return;
    if (!quizKombiListe.vokabeln.some(v => hatAkzentWort(v))) wechsleQuizArt("uebersetzung");
  }, [quizArt, quizTabListen, einstellungen.akzenteSprachen]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Lernstand mitschreiben (Lernen schließen = pausieren; „Weiter lernen“ macht an derselben Stelle weiter)
  useEffect(() => {
    if (!lernen?.slot) return;
    const ende = lernen.fertig && lernen.start + lernen.voks.length >= lernen.alle.length;
    setzeLernStand(lernen.slot, lernen.art, ende ? null : { ids: lernen.alle.map(v => v.id), groesse: lernen.groesse, start: lernen.start,
      index: lernen.index, fertig: !!lernen.fertig, quizGemacht: !!lernen.quizGemacht, zeit: Date.now() });
  }, [lernen?.start, lernen?.index, lernen?.fertig, lernen?.quizGemacht]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Multiquiz: erst laden (Einstellungen stehen dann im State), dann ggf. starten
  useEffect(() => {
    if (!multiStart || aktiverSlot?.id !== multiStart.id) return;
    const { id, starten } = multiStart;
    setMultiStart(null);
    // Konfiguration so ablegen, wie der Quiz-Tab sie bildet – sonst legt die Runde einen weiteren Verlauf-Eintrag an
    const data = getSlotsData();
    setSlotsData({ ...data, verlauf: data.verlauf.map(v => v.id === id ? { ...v, konfiguration: aktuelleKonfiguration() } : v) });
    if (starten) starteQuiz(false, { typ: 'verlauf', id });
  }, [multiStart, aktiverSlot]);

  // App-Start: zuletzt gewählte gespeicherte Konfiguration wieder laden (sobald die Listen bekannt sind)
  const letzterSlotGeladenRef = useRef(false);
  useEffect(() => {
    if (letzterSlotGeladenRef.current || listenIndex.length === 0) return;
    letzterSlotGeladenRef.current = true;
    const id = lsGet(SK.letzterSlot);
    if (typeof id === "string" && id.startsWith("listen:")) { if (getSlotEintrag("listen", id.slice(7))) ladeSlot("listen", id.slice(7)); }   // 217
    else if (id && getSlotEintrag('gespeichert', id)) ladeSlot('gespeichert', id);
  }, [listenIndex]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Wechsel der Abfrageart (Übersetzung / Diktat / Akzente) → Quiz-Fortschritt dieser Art laden
  const quizAbfrageArt = quizArt;
  useEffect(() => {
    if (!aktiverSlot) return;
    const s = lsGet(SK.sessionAktiv);
    if (s && (s.art || "uebersetzung") === quizAbfrageArt && s.slotTyp === aktiverSlot.typ && s.slotId === aktiverSlot.id) return;
    const eintrag = getSlotEintrag(aktiverSlot.typ, aktiverSlot.id);
    if (eintrag) aktiviereSlotFortschritt(eintrag, aktiverSlot.typ, aktiverSlot.id, quizAbfrageArt);
  }, [quizAbfrageArt, aktiverSlot]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Abfrage-Modus-Zeile Höhe messen
  useEffect(() => {
    const el = abfrageModusRef.current;
    if (!el) { setAbfrageModusH(0); return; }
    const obs = new ResizeObserver(() => setAbfrageModusH(el.offsetHeight));
    obs.observe(el);
    setAbfrageModusH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length, quizFokus]);

  // Reihenfolge-Zeile Höhe messen
  useEffect(() => {
    const el = reihenfolgeRef.current;
    if (!el) { setReihenfolgeH(0); return; }
    const obs = new ResizeObserver(() => setReihenfolgeH(el.offsetHeight));
    obs.observe(el);
    setReihenfolgeH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Einstellungen-Zeile Höhe messen
  useEffect(() => {
    const el = einstellungenRef.current;
    if (!el) { setEinstellungenH(0); return; }
    const obs = new ResizeObserver(() => setEinstellungenH(el.offsetHeight));
    obs.observe(el);
    setEinstellungenH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length]);

  // Quiz-Zeile Höhe messen
  useEffect(() => {
    const el = sessionRef.current;
    if (!el) { setSessionH(0); return; }
    const obs = new ResizeObserver(() => setSessionH(el.offsetHeight));
    obs.observe(el);
    setSessionH(el.offsetHeight);
    return () => obs.disconnect();
  }, [quizTabListen.length, quizFokus]);

  // Slot-Sektion Header Höhe messen
  useEffect(() => {
    const el = slotSektionRef.current;
    if (!el) { setSlotH(0); return; }
    const obs = new ResizeObserver(() => setSlotH(el.offsetHeight));
    obs.observe(el);
    setSlotH(el.offsetHeight);
    return () => obs.disconnect();
  }, [slots.verlauf.length, slots.gespeichert.length, tab, statistikVollbild]);

  // Listenauswahl-Header Höhe messen
  useEffect(() => {
    const el = listenauswahlHeaderRef.current;
    if (!el) { setListenauswahlHeaderH(0); return; }
    const obs = new ResizeObserver(() => setListenauswahlHeaderH(el.offsetHeight));
    obs.observe(el);
    setListenauswahlHeaderH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, quizTabListen.length, aktiverSlot, listenAendern]);


  // Von-Bis-Modus beenden wenn Einzelauswahl schließt (manuell oder auto)
  useEffect(() => {
    if (!quizListeAufgeklappt) {
      setQuizVonBisModus(false);
      setQuizVonBisErster(null);
    }
  }, [quizListeAufgeklappt]);

  useEffect(() => {
    if (!statistikEinzelauswahlAufgeklappt) {
      setStatistikVonBisModus(false);
      setStatistikVonBisErster(null);
    }
  }, [statistikEinzelauswahlAufgeklappt]);

  useEffect(() => {
    const el = statistikListenHeaderRef.current;
    if (!el) { setStatistikListenHeaderH(0); return; }
    const update = () => setStatistikListenHeaderH(el.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, statistikVollbild]);

  useEffect(() => {
    const el = listeDetailKopfRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setListeDetailKopfH(el.offsetHeight));
    obs.observe(el);
    setListeDetailKopfH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, ansicht]);
  useEffect(() => {
    const el = listenZeileRef.current;
    if (!el) { setListenZeileH(0); return; }
    const obs = new ResizeObserver(() => setListenZeileH(el.offsetHeight));
    obs.observe(el);
    setListenZeileH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, ansicht, aktiveListeId, listenBereich, !!aktiveListe]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSucheListe(x => ({ ...SUCHE_LEER, nurTreffer: x.nurTreffer })); }, [aktiveListeId]);
  useEffect(() => { if (!aufteilen) setAufteilenSuche(null); }, [aufteilen]);

  useEffect(() => {
    const el = statistikVokauswahlRef.current;
    if (!el) { setStatistikVokauswahlH(0); return; }
    const obs = new ResizeObserver(() => setStatistikVokauswahlH(el.offsetHeight));
    obs.observe(el);
    setStatistikVokauswahlH(el.offsetHeight);
    return () => obs.disconnect();
  }, [tab, statistikVollbild]);


  // Browser bitten, den Speicher nicht aufzuräumen (Chrome: bei installierter App meist gewährt)
  useEffect(() => {
    const st = navigator.storage;
    if (!st?.persisted) return;
    st.persisted().then(ja => ja || !st.persist ? ja : st.persist()).then(setSpeicherDauerhaft).catch(() => {});
    if (!lsGet(SK.letzteSicherung) && !lsGet(SK.sicherungBasis)) lsSet(SK.sicherungBasis, Date.now());
  }, []);

  useEffect(() => {
    // Index-Einträge ohne Sprache einmalig aus der Liste übernehmen
    const idx = lsGet(SK.listenIndex, []);
    if (idx.some(l => !l.sprache || !l.platz)) {
      speichereIndex(idx.map(l => l.sprache ? l : { ...l, sprache: listeSprache(lsGet(SK.liste(l.id))) }));
    } else {
      setListenIndex(idx);
    }
    stufenUmstellen(); negativUmstellen();
    setEinstellungen({ ...lsGet(SK.einstellungen, defaultEinstellungen()), gelerntSchwelle: GELERNT_SCHWELLE });
    // Neues Slot-Format laden, ggf. vom alten Format migrieren
    let slotsData = lsGet(SK.slots);
    if (!slotsData) {
      const alt = lsGet(SK.sessionSlots) || [];
      const gespeichert = alt
        .filter(s => s.slot !== 6 && s.konfiguration)
        .map(s => ({
          id: neuerSlotId('g'), name: s.name || `Slot ${s.slot}`,
          timestamp: Date.now(), konfiguration: s.konfiguration,
          sessionFortschritt: s.sessionFortschritt || null,
        }));
      const zuletzt = alt.find(s => s.slot === 6 && s.konfiguration);
      const verlauf = zuletzt ? [{
        id: neuerSlotId('v'), name: formatSlotDatum(),
        timestamp: Date.now(), konfiguration: zuletzt.konfiguration,
        sessionFortschritt: null,
      }] : [];
      slotsData = { verlauf, gespeichert };
      lsSet(SK.slots, slotsData);
    }
    // Raster: Einträge ohne Platz einmalig in bisheriger Reihenfolge zeilenweise verteilen
    if (slotsData.gespeichert.some(x => !x.platz)) { slotsData = rasterEinordnen(slotsData); lsSet(SK.slots, slotsData); }
    setSlots(slotsData);
    const sSlot = lsGet(SK.sessionAktiv);
    if (sSlot) {
      setSessionSlotAktiv(sSlot);
      setQuizSessionModus("pakete");
      setQuizPaketGroesse(sSlot.paketGroesse || STANDARD_PAKET_GROESSE);
      if (sSlot.slotTyp && sSlot.slotId) setAktiverSlot({ typ: sSlot.slotTyp, id: sSlot.slotId });
    }
  }, []);

  useEffect(() => {
    if (aktiveListeId) setAktiveListe(lsGet(SK.liste(aktiveListeId)));
  }, [aktiveListeId, ansicht]);

  useEffect(() => {
    if (ansicht === "quiz" && eingabeRef.current) eingabeRef.current.focus();
  }, [ansicht, quiz?.index, quiz?.phase, quiz?.antwortTypIndex]);

  useEffect(() => {
    if (quizTabListen.length === 0) {
      setListenAuswahlAufgeklappt(true);
      setQuizAbfrageModusAufgeklappt(false);
      setQuizReihenfolgeAufgeklappt(false);
      setQuizEinstellungenAufgeklappt(false);
    }
  }, [quizTabListen.length]);

  // Lang-Druck auf einen Raster-Eintrag und dann ziehen (auch außerhalb des Verschieben-Modus):
  // sobald der Finger sich bewegt, Menü/Erklärung weg, Verschieben-Modus an, Eintrag folgt dem Finger
  useEffect(() => {
    const zelleUnter = t => zielUnter(t.clientX, t.clientY);
    const bewegen = e => {
      const d = slotZiehenRef.current;
      if (!d?.langdruck) return;
      const t = e.touches[0];
      if (!d.aktiv && Math.hypot(t.clientX - d.x, t.clientY - d.y) > 8) {
        d.aktiv = true;
        clearTimeout(tooltipTimer.current); tooltipShown.current = false; schliesseInfo();
        const r = rasterAuswahlRef.current;
        if (d.art === "liste") {
          setListenSortModus(true);
          if (r.listeWahl) { setListenAuswahl(r.listeWahl.includes(d.id) ? r.listeWahl : [...r.listeWahl, d.id]); setListenWahl(null); }
          else if (!r.liste.includes(d.id)) setListenAuswahl([]);
        } else {
          setSlotSortModus(true);
          if (r.slotWahl) { setSlotAuswahl(r.slotWahl.includes(d.id) ? r.slotWahl : [...r.slotWahl, d.id]); setMultiAuswahl(null); }
          else if (!r.slot.includes(d.id)) setSlotAuswahl([]);
        }
        setSlotDragId(d.id);
      }
      if (!d.aktiv) return;
      if (e.cancelable) e.preventDefault();   // Seite nicht scrollen, solange gezogen wird
      setSlotDragZiel(zelleUnter(t));
      if (t.clientY < 90) window.scrollBy(0, -12); else if (t.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const loslassen = e => {
      const d = slotZiehenRef.current;
      if (!d?.langdruck) return;
      slotZiehenRef.current = null;
      if (!d.aktiv) return;   // nur Lang-Druck: Menü bleibt offen
      slotGezogenRef.current = true; setTimeout(() => { slotGezogenRef.current = false; }, 400);   // nur den Klick direkt danach schlucken
      const t = e.changedTouches[0];
      const ziel = e.type === "touchend" && t ? zelleUnter(t) : null;
      setSlotDragId(null); setSlotDragZiel(null);
      if (ziel) legeGezogenAb(d, ziel);
      // per Geste verschoben: Verschieben-Modus wieder aus (über das Menü „⇄ Verschieben“ bleibt er bis „Fertig“)
      if (d.art === "liste") { setListenSortModus(false); setListenAuswahl([]); } else { setSlotSortModus(false); setSlotAuswahl([]); }
    };
    window.addEventListener("touchmove", bewegen, { passive: false });
    window.addEventListener("touchend", loslassen);
    window.addEventListener("touchcancel", loslassen);
    return () => {
      window.removeEventListener("touchmove", bewegen);
      window.removeEventListener("touchend", loslassen);
      window.removeEventListener("touchcancel", loslassen);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Raster verschieben per Ziehen: ab 8 px Bewegung wird gezogen, beim Loslassen auf den Platz darunter
  // (belegt → tauschen). Ohne Bewegung bleibt es ein Antippen (Auswahl) bzw. Lang-Druck (Info).
  useEffect(() => {
    if (!slotSortModus && !listenSortModus) return;
    const zelleUnter = e => zielUnter(e.clientX, e.clientY);
    const bewegen = e => {
      const d = slotZiehenRef.current;
      if (!d || d.langdruck) return;   // Lang-Druck-Zug läuft über die Touch-Verfolgung
      if (!d.aktiv && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
        d.aktiv = true; setSlotDragId(d.id);
        const ausw = rasterAuswahlRef.current[d.art === "liste" ? "liste" : "slot"];
        if (!ausw.includes(d.id)) { setSlotAuswahl([]); setListenAuswahl([]); }
        clearTimeout(tooltipTimer.current); schliesseInfo();   // Lang-Druck-Erklärung weg, sobald gezogen wird
      }
      if (!d.aktiv) return;
      setSlotDragZiel(zelleUnter(e));
      if (e.clientY < 90) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const loslassen = e => {
      const d = slotZiehenRef.current;
      if (d?.langdruck) return;
      slotZiehenRef.current = null;
      if (!d?.aktiv) return;
      slotGezogenRef.current = true; setTimeout(() => { slotGezogenRef.current = false; }, 400);   // nur den Klick direkt danach schlucken
      const ziel = e.type === "pointerup" ? zelleUnter(e) : null;
      setSlotDragId(null); setSlotDragZiel(null);
      if (ziel) legeGezogenAb(d, ziel);
    };
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", loslassen);
    window.addEventListener("pointercancel", loslassen);
    return () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", loslassen);
      window.removeEventListener("pointercancel", loslassen);
    };
  }, [slotSortModus, listenSortModus]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Beim Ziehen über einer anderen Quiz oder Gruppe verweilen: nach 1,2 s bildet Loslassen eine Gruppe
  // (nur auf der obersten Ebene; Gruppen selbst lassen sich nicht in Gruppen legen)
  useEffect(() => {
    gruppenZielRef.current = null; setGruppenZiel(null);
    if (!slotDragId || !slotDragZiel || slotDragZiel.startsWith("raus")) return;
    // 193: auf jeder Ebene; auf einen Ordner: hinein (Ordner nur, wenn sie samt Unterordnern noch passen),
    // auf einen Eintrag: neuer Ordner (nur Einträge, und nur wenn die Ebene noch einen Ordner tragen kann)
    const liste = slotZiehenRef.current?.art === "liste";
    const el = document.querySelector(liste ? `[data-raster-zelle="${slotDragZiel}"]:is([data-liste-id], [data-lordner-id])` : `[data-raster-zelle="${slotDragZiel}"][data-slot-id]`);
    const ausw = rasterAuswahlRef.current[liste ? "liste" : "slot"];
    const ids = ausw.includes(slotDragId) ? ausw : [slotDragId];
    const zielId = el && (liste ? el.dataset.listeId || el.dataset.lordnerId : el.dataset.slotId);
    if (!el || !verweilGeht(liste, zielId, ids)) return;
    const ziel = slotDragZiel;
    const t = setTimeout(() => { gruppenZielRef.current = ziel; setGruppenZiel(ziel); navigator.vibrate?.(30); }, GRUPPE_VERWEILEN_MS);
    return () => clearTimeout(t);
  }, [slotDragZiel, slotDragId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Auswahl-Tafel aktuell halten (Inhalt hängt an der Auswahl); Auswahl beendet → Tafel zu
  useEffect(() => {
    const art = auswahlTafelRef.current;
    if (!art) return;
    if (!(art === "liste" ? listenWahl : multiAuswahl)) { auswahlTafelRef.current = null; auswahlTafelStelle.current = null; schliesseInfo(); return; }
    zeigeAuswahlTafel(art);
  }, [multiAuswahl, listenWahl]);   // eslint-disable-line react-hooks/exhaustive-deps

  // geöffnete Gruppe gibt es nicht mehr (aufgelöst) → zurück auf die oberste Ebene
  useEffect(() => {
    if (slotOrdner && !(slots.ordner || []).some(o => o.id === slotOrdner)) setSlotOrdner(null);
  }, [slots, slotOrdner]);
  // Geladene gespeichertes Quiz im Raster zeigen: beim Öffnen der Auswahl, Laden, Tabwechsel und App-Start
  // öffnet sich ihre Gruppe (bzw. die oberste Ebene) und die Kachel kommt in den Blick; beim Blättern springt nichts
  const rasterSlot = tab === "statistik" ? statistikAktiverSlot : aktiverSlot;
  useEffect(() => { setSlotVorschau(null); setSlotVorschauListe(false); }, [slotSektionAufgeklappt, tab, slotSortModus, slotOrdner, auswahlListen]);
  useEffect(() => { if (multiAuswahl) { setSlotVorschau(null); setSlotVorschauListe(false); } else setWahlBeendet(w => w.slot ? { ...w, slot: false } : w); }, [!!multiAuswahl]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!listenWahl) setWahlBeendet(w => w.liste ? { ...w, liste: false } : w); else setListeVorschau(null); }, [!!listenWahl]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!multiAuswahl && !listenWahl) setVonBis(null); }, [!!multiAuswahl, !!listenWahl]);
  useEffect(() => { setListeVorschau(null); }, [tab, einstBereich, einstUnter, ansicht, listenSortModus]);
  // für die Gesten-Effekte (ohne Abhängigkeiten): Mehrfach-Auswahl beenden und die Tafel (Kontextmenü) zeigen
  // 147: lang drücken nimmt ein Objekt in die Auswahl auf bzw. heraus; die angetippte Einzelauswahl kommt beim ersten Mal mit hinein; leer → keine Auswahl
  wahlUmschaltenRef.current = (art, id) => {
    if (vonBis?.art === art && vonBis.id !== id) {   // Von–Bis: alle Kacheln dazwischen (spaltenweise: eine Spalte nach unten, dann die nächste)
      const reihe = [...plaetzeRef.current[art]].sort((a, b) => a.s - b.s || a.z - b.z).map(x => x.id);
      const [i, j] = [reihe.indexOf(vonBis.id), reihe.indexOf(id)];
      setVonBis(null);
      if (i >= 0 && j >= 0) {
        const bereich = i <= j ? reihe.slice(i, j + 1) : reihe.slice(j, i + 1).reverse();
        const dazu = a => [...(a || []), ...bereich.filter(x => !(a || []).includes(x))];
        auswahlTafelRef.current = art;
        if (art === "liste") setListenWahl(dazu); else setMultiAuswahl(dazu);
        leuchte(art === "liste" ? "wahl" : "slotkopf", BLITZ_MS / 2);
        return;
      }
    }
    const umschalten = a => { const basis = a || []; return basis.includes(id) ? basis.filter(x => x !== id) : [...basis, id]; };
    auswahlTafelRef.current = art;
    const n = umschalten(art === "liste" ? listenWahl : multiAuswahl, art === "liste" ? listeVorschau : slotVorschau?.typ === "gespeichert" ? slotVorschau.id : null);
    if (!n.length) {   // die letzte herausgenommen: Mehrfach-Auswahl endet, diese bleibt als Einzelauswahl stehen
      auswahlTafelRef.current = null; setTimeout(schliesseInfo, 0);   // nach dem Menü, das der Lang-Druck gleich öffnet
      if (art === "liste") { setListenWahl(null); setTimeout(() => setListeVorschau(id), 0); }
      else { setMultiAuswahl(null); setTimeout(() => setSlotVorschau({ typ: "gespeichert", id }), 0); }
    } else if (art === "liste") { setListenSortModus(false); setListenWahl(n); }
    else { setSlotSortModus(false); setMultiAuswahl(n); }
    leuchte(art === "liste" ? `lw:${id}` : `slot:${id}`, BLITZ_MS / 2);
    leuchte(art === "liste" ? "wahl" : "slotkopf", BLITZ_MS / 2);   // der grüne Kopf mit der Anzahl leuchtet mit
  };
  // 192: Blätter-Modus endet, wenn die Auswahl zugeht (Quiz-Auswahl zu, anderer Tab/Bereich)
  useEffect(() => { setBlaettern(false); }, [slotSektionAufgeklappt, tab, einstBereich, einstUnter, ansicht]);
  // 192: übernehmen – ein Quiz laden bzw. die Mehrfach-Auswahl (mehrere → Multiquiz, eine → laden)
  const uebernimmSlots = ids => {
    setBlaettern(false); auswahlTafelRef.current = null; schliesseInfo();
    setSlotVorschau(null); setSlotVorschauListe(false);
    beendeMultiAuswahl(ids, tab === "statistik" ? ladeSlotStatistik : ladeSlot);
    leuchte("slotkopf");
  };
  // 192: Touch-Lang-Druck ohne Bewegung losgelassen: stufe 1 = kurz (Karte nur angehoben), 2 = lang (Mehrfach-Auswahl
  // beginnt bzw. – lief sie schon – Karte dazu und übernehmen), 3 = lang auf eine schon ausgewählte Karte
  kachelLangRef.current = (art, id, stufe, ids) => {
    if (art === "qliste") {   // 217: Liste in der Quiz-Auswahl wählen (Blätter-Modus)
      setBlaettern(true); leuchte(`ql:${id}`, BLITZ_MS / 2); setSlotVorschauListe(false); setSlotVorschau({ typ: "listen", id });
      return;
    }
    const istListe = art === "liste";
    const wahl = istListe ? listenWahl : multiAuswahl;
    if (stufe === 1) {
      if (wahl) { wahlUmschaltenRef.current(art, id); return; }
      setBlaettern(true);
      leuchte(istListe ? `lw:${id}` : `slot:${id}`, BLITZ_MS / 2);
      if (istListe) setListeVorschau(id); else { setSlotVorschauListe(false); setSlotVorschau({ typ: "gespeichert", id }); }
      return;
    }
    if (istListe) { if (stufe === 3) wahlUmschaltenRef.current(art, id); else setBlaettern(true); return; }   // Listen: dazu / heraus wie bisher
    if (ids) { uebernimmSlots(ids); return; }   // Quiz: in laufender Mehrfach-Auswahl übernehmen
    setBlaettern(true);                         // Mehrfach-Auswahl beginnt (Lasso-Ende setzt sie)
  };
  wahlBeendenRef.current = art => { setWahlBeendet(w => ({ ...w, [art]: true })); auswahlTafelRef.current = art; setTimeout(() => zeigeAuswahlTafel(art), 0); };
  useEffect(() => {
    if (!slotSektionAufgeklappt || (tab !== "quiz" && tab !== "statistik") || multiAuswahl || slotSortModus) return;
    // 220: Liste im Kopf → Listen-Auswahl, ihr Ordner offen, Kachel in den Blick
    if (tab === "quiz") setAuswahlListen(rasterSlot?.typ === "listen");
    if (tab === "quiz" && rasterSlot?.typ === "listen") {
      const l = lsGet(SK.listenIndex, []).find(x => x.id === rasterSlot.id);
      if (!l) return;
      const ordner = lsGet(SK.listenOrdner, []);
      setListenOrdnerOffen(l.ordner && ordner.some(o => o.id === l.ordner) ? l.ordner : null);
      const id = rasterSlot.id;
      [60, 350].forEach(ms => setTimeout(() => document.querySelector(`[data-qliste-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), ms));
      return;
    }
    if (rasterSlot?.typ !== "gespeichert") return;
    const data = getSlotsData();
    const e = data.gespeichert.find(x => x.id === rasterSlot.id);
    if (!e) return;
    setSlotOrdner(e.ordner && (data.ordner || []).some(o => o.id === e.ordner) ? e.ordner : null);
    const id = rasterSlot.id;
    [60, 350].forEach(ms => setTimeout(() => document.querySelector(`[data-slot-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), ms));
  }, [slotSektionAufgeklappt, tab, rasterSlot?.typ, rasterSlot?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 175: im Quiz seitlich wischen – nach rechts eine Karte zurück, nach links vorwärts (nicht auf Eingabefeldern und bei Zuordnung)
  const rueckWischRef = useRef(null);
  rueckWischRef.current = rueckblickWischen;
  useEffect(() => {
    if (ansicht !== "quiz") return;
    let st = null;
    const start = e => {
      st = null;
      if (e.touches.length !== 1 || e.target.closest?.("input, textarea, [data-zuordnung], [data-memory]")) return;
      st = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const ende = e => {
      if (!st) return;
      const t = e.changedTouches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
      st = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (e.cancelable) e.preventDefault();
      rueckWischRef.current?.(dx > 0 ? -1 : 1);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", ende, { passive: false });
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", ende); };
  }, [ansicht]);

  // Kachel-Gesten (Touch): sofort wischen scrollt; KACHEL_ANHEBEN_MS halten hebt die Kachel an – ziehen verschiebt
  // (über die Lang-Druck-Verfolgung oben); KACHEL_AUSWAEHLEN_MS halten wählt sie aus – weiterfahren sammelt weitere
  // ein (Lasso), loslassen öffnet die Auswahl-Tafel. Gruppen-Kacheln: nur anheben (ihr Menü kommt über tt).
  useEffect(() => {
    const aus = () => {
      const g = kachelGesteRef.current;
      if (g) { clearTimeout(g.t1); clearTimeout(g.t2); }
      kachelGesteRef.current = null; setAngehoben(null);
    };
    const start = e => {
      aus();
      if (e.touches.length !== 1 || farbModusRef.current) return;
      const el = e.target.closest?.("[data-kachel-geste]");
      if (!el) return;
      const t = e.touches[0];
      const art = el.dataset.kachelGeste;   // "slot" | "liste" | "ordner" | "lordner" (Listen-Ordner, 193)
      const id = art === "liste" ? el.dataset.listeId : art === "lordner" ? el.dataset.lordnerId : art === "qliste" ? el.dataset.qlisteId : el.dataset.slotId;
      const istOrdner = art === "ordner" || art === "lordner" || art === "qliste";   // qliste (217): nur kurz halten, kein Ziehen/Lasso
      const g = { art, id, x: t.clientX, y: t.clientY, stufe: 0, t0: Date.now() };
      g.heben = () => {
        if (g.stufe >= 1) return;
        g.stufe = 1;
        if (el.dataset.kachelZieh === undefined) return;
        slotZiehenRef.current = { ...(art === "liste" || art === "lordner" ? { art: "liste" } : {}), id, x: g.x, y: g.y, aktiv: false, langdruck: true };
        setAngehoben(id);
      };
      g.waehlen = () => {
        if (g.stufe >= 2 || slotZiehenRef.current?.aktiv) return;
        g.heben();   // falls der Anheben-Timer noch nicht lief
        const lassoArt = art === "liste" ? "liste" : "slot";
        const r = rasterAuswahlRef.current;
        // schon ausgewählt: angehoben lassen (Stufe 3) – ziehen verschiebt die ganze Auswahl
        if (slotZiehenRef.current && ((lassoArt === "liste" ? r.listeWahl : r.slotWahl) || []).includes(id)) { g.stufe = 3; navigator.vibrate?.(20); return; }
        g.stufe = 2; slotZiehenRef.current = null; setAngehoben(null); navigator.vibrate?.(20);
        const vorher = lassoArt === "liste" ? r.listeWahl : r.slotWahl;
        g.warWahl = !!vorher;   // 192: lief schon eine Mehrfach-Auswahl? (dann übernimmt Loslassen ohne Bewegung)
        const ids = [...(vorher || [])];   // der erste Lang-Druck ist die erste Kachel (eine vorher angetippte kommt nicht mit)
        if (!ids.includes(id)) ids.push(id);
        lassoRef.current = { art: lassoArt, feld: el.closest("[data-lasso]") || el.parentElement, x: g.x, y: g.y, aktiv: true, ids };
        setLasso({ art: lassoArt, ids });
      };
      g.t1 = setTimeout(g.heben, KACHEL_ANHEBEN_MS);
      if (!istOrdner) g.t2 = setTimeout(g.waehlen, KACHEL_AUSWAEHLEN_MS);
      g.istOrdner = istOrdner;
      kachelGesteRef.current = g;
    };
    const bewegen = e => {
      const g = kachelGesteRef.current;
      if (!g) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - g.x, t.clientY - g.y) <= 8) return;
      g.bewegt = true;
      // Timer können sich verspäten (Browser beschäftigt): maßgeblich ist die gehaltene Zeit
      const gehalten = Date.now() - g.t0;
      if (!g.istOrdner && gehalten >= KACHEL_AUSWAEHLEN_MS) g.waehlen();
      else if (gehalten >= KACHEL_ANHEBEN_MS) g.heben();
      if (g.stufe === 2) { clearTimeout(g.t1); clearTimeout(g.t2); kachelGesteRef.current = g; return; }   // Einsammeln läuft (Lasso)
      if (g.stufe === 0) { aus(); return; }   // sofort gewischt: Seite scrollt
      aus();                                   // angehoben und gezogen: das Verschieben läuft
    };
    const loslassen = e => {
      const g = kachelGesteRef.current;
      if (!g) return;
      if (g.stufe >= 2 && e.cancelable) e.preventDefault();   // kein Klick hinterher (würde die Kachel wieder abwählen)
      // 192: ohne Bewegung losgelassen – kurz (nur angehoben): wählen bzw. dazu/weg; lang: Mehrfach-Auswahl beginnen,
      // in einer laufenden (Quiz) Karte dazu und übernehmen; lang auf eine ausgewählte: übernehmen (Listen: heraus)
      const art = g.art === "liste" ? "liste" : "slot";
      const ruhig = !g.bewegt && !slotZiehenRef.current?.aktiv;
      if (g.art === "qliste" && ruhig && g.stufe >= 1) {   // 217: Liste in der Quiz-Auswahl – kurz halten wählt
        if (e.cancelable) e.preventDefault();
        kachelLangRef.current?.("qliste", g.id, 1);
      } else if (!g.istOrdner && ruhig && g.stufe === 1) {
        if (e.cancelable) e.preventDefault();
        kachelLangRef.current?.(art, g.id, 1);
      } else if (ruhig && g.stufe === 2) {
        const l = lassoRef.current;
        if (g.warWahl && art === "slot" && l) { lassoRef.current = null; setLasso(null); kachelLangRef.current?.(art, g.id, 2, l.ids); }
        else kachelLangRef.current?.(art, g.id, 2);
      } else if (ruhig && g.stufe === 3) {
        const r = rasterAuswahlRef.current;
        kachelLangRef.current?.(art, g.id, 3, art === "slot" ? [...(r.slotWahl || [])] : null);
      }
      if (g.stufe !== 2 && slotZiehenRef.current && !slotZiehenRef.current.aktiv) slotZiehenRef.current = null;   // nur angehoben
      aus();
    };
    // 192: Maus – Kachel gedrückt halten (ab KACHEL_ANHEBEN_MS, ohne Bewegung) wirkt wie kurzes Halten mit dem Finger;
    // der Klick danach wird verschluckt. (Rechtsklick bleibt der Lang-Druck.)
    let maus = null, klickWeg = false;
    const mausAb = e => {
      maus = null;
      if (e.pointerType !== "mouse" || e.button !== 0 || farbModusRef.current) return;
      const el = e.target.closest?.("[data-kachel-geste]");
      if (!el || el.dataset.kachelGeste === "ordner" || el.dataset.kachelGeste === "lordner") return;
      const ga = el.dataset.kachelGeste;
      maus = { art: ga === "liste" || ga === "qliste" ? ga : "slot", id: ga === "liste" ? el.dataset.listeId : ga === "qliste" ? el.dataset.qlisteId : el.dataset.slotId, x: e.clientX, y: e.clientY, t0: Date.now() };
    };
    const mausAuf = e => {
      const m = maus; maus = null;
      if (!m || e.pointerType !== "mouse" || Math.hypot(e.clientX - m.x, e.clientY - m.y) > 8 || slotZiehenRef.current?.aktiv) return;
      if (Date.now() - m.t0 < KACHEL_ANHEBEN_MS) return;
      klickWeg = true; setTimeout(() => { klickWeg = false; }, 400);
      kachelLangRef.current?.(m.art, m.id, 1);
    };
    const klickSchlucken = e => { if (klickWeg) { klickWeg = false; e.stopPropagation(); e.preventDefault(); } };
    document.addEventListener("pointerdown", mausAb, true);
    document.addEventListener("pointerup", mausAuf, true);
    document.addEventListener("click", klickSchlucken, true);
    document.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", bewegen, { passive: true });
    window.addEventListener("touchend", loslassen, { passive: false });
    window.addEventListener("touchcancel", aus);
    return () => {
      document.removeEventListener("pointerdown", mausAb, true);
      document.removeEventListener("pointerup", mausAuf, true);
      document.removeEventListener("click", klickSchlucken, true);
      document.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", bewegen);
      window.removeEventListener("touchend", loslassen);
      window.removeEventListener("touchcancel", aus);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Lang-Druck auf eine freie Stelle im Raster und dann ziehen: jede überstrichene Kachel kommt in die Auswahl
  useEffect(() => {
    const setze = (art, ids) => (art === "liste" ? setListenWahl : setMultiAuswahl)(ids);
    const start = e => {
      if (e.touches.length !== 1) { if (lassoRef.current) clearTimeout(lassoRef.current.timer); lassoRef.current = null; return; }
      if (!KACHEL_LASSO_FREI) return;   // 167: Mehrfach-Auswahl durch Ziehen von einer freien Stelle ist aus (Von–Bis im Menü)
      const feld = e.target.closest?.("[data-lasso]");
      if (!feld || e.target.closest("[data-slot-id], [data-liste-id]")) return;
      const t = e.touches[0];
      const l = { art: feld.dataset.lasso, feld, x: t.clientX, y: t.clientY, aktiv: false, ids: [] };
      l.timer = setTimeout(() => {
        l.aktiv = true; navigator.vibrate?.(15);
        const r = rasterAuswahlRef.current;
        l.ids = [...((l.art === "liste" ? r.listeWahl : r.slotWahl) || [])];
        setLasso({ art: l.art, ids: l.ids });
      }, 500);
      lassoRef.current = l;
    };
    const bewegen = e => {
      const l = lassoRef.current;
      if (!l) return;
      const t = e.touches[0];
      if (!l.aktiv) { if (Math.hypot(t.clientX - l.x, t.clientY - l.y) > 8) { clearTimeout(l.timer); lassoRef.current = null; } return; }
      if (e.cancelable) e.preventDefault();   // Seite nicht scrollen, solange eingesammelt wird
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest(l.art === "liste" ? "[data-liste-id]" : "[data-slot-id]:not([data-ordner-id])");
      const id = el && l.feld.contains(el) ? (l.art === "liste" ? el.dataset.listeId : el.dataset.slotId) : null;
      if (id && !l.ids.includes(id)) { l.ids = [...l.ids, id]; setLasso({ art: l.art, ids: l.ids }); }
      if (t.clientY < 90) window.scrollBy(0, -12); else if (t.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const ende = () => {
      const l = lassoRef.current;
      if (!l) return;
      lassoRef.current = null; clearTimeout(l.timer);
      if (!l.aktiv) return;
      setLasso(null);
      if (!l.ids.length) return;
      auswahlTafelRef.current = l.art;   // die Tafel geht mit der übernommenen Auswahl auf (Effekt)
      auswahlTafelStelle.current = { x: l.x, y: l.y };
      setze(l.art, l.ids);
    };
    document.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", bewegen, { passive: false });
    window.addEventListener("touchend", ende);
    window.addEventListener("touchcancel", ende);
    return () => {
      document.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", bewegen);
      window.removeEventListener("touchend", ende);
      window.removeEventListener("touchcancel", ende);
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const quizListenKey = quizTabListen.join(",");
  // Spalten-Konfiguration an neu gewählte Listen anpassen: Spalten, die dort fehlen,
  // würden sonst alle Vokabeln ausfiltern (0 abfragbar) und sind im UI nicht abwählbar
  useEffect(() => {
    if (quizTabListen.length === 0) return;
    const kombi = getKombinierteListe(quizTabListen);
    if (!kombi) return;
    const aktiv = t => !!kombi.spalten[t]?.aktiv;
    const abfragbar = TYPEN.filter(t => !t.startsWith('i') && aktiv(t));
    if (quizModus === "diktat" && !aktiv(quizDiktatSpalte)) {
      setQuizDiktatSpalte(abfragbar.find(t => t.startsWith('E')) || abfragbar[0] || "E1");
    }
    const fehlt = [...quizAusgewaehlt, quizFrageTyp, ...quizAntwortTypenGeordnet, ...quizInfoTypenSession].some(t => t && !aktiv(t));
    if (!fehlt) return;
    const ausgewaehlt = quizAusgewaehlt.filter(aktiv);
    const frage = aktiv(quizFrageTyp) ? quizFrageTyp : "";
    const antworten = quizAntwortTypenGeordnet.filter(aktiv);
    const nochGueltig = quizModus === "rotierend" ? ausgewaehlt.length >= 2 : !!frage && antworten.length > 0;
    if (nochGueltig) {
      setQuizAusgewaehlt(ausgewaehlt);
      setQuizFrageTyp(frage);
      setQuizAntwortTypenGeordnet(antworten);
      setQuizInfoTypenSession(p => p.filter(aktiv));
      setQuizSpalteModus(p => Object.fromEntries(Object.entries(p).filter(([t]) => aktiv(t))));
    } else {
      // Standard wie initQuizDefaults (nur Spalten)
      const neuAus = abfragbar.includes('E1') && abfragbar.includes('D1') ? ['E1', 'D1'] : abfragbar.slice(0, 2);
      const neuFrage = neuAus.find(t => t.startsWith('D')) || neuAus[0] || '';
      const neuAntw = neuAus.filter(t => t !== neuFrage);
      setQuizAusgewaehlt(neuAus);
      setQuizFrageTyp(neuFrage);
      setQuizAntwortTypenGeordnet(neuAntw);
      setQuizInfoTypenSession([]);
      setQuizSpalteModus(Object.fromEntries(neuAntw.map(t => [t, quizArt === "akzente" ? 'akzent' : 'karte'])));
    }
  }, [quizListenKey, listenIndex]);

  useEffect(() => {
    let geaendert = false;
    const neu = {};
    Object.entries(quizSpalteModus || {}).forEach(([t, m]) => {
      const alt = modiVon(m);
      let ok = alt.filter(x => modusErlaubt(t, x));
      if (ok.length === alt.length) return void (neu[t] = m);   // alles passt – unverändert (auch „nur Akzente“)
      if (!ok.some(x => x !== "akzent")) ok = [STANDARD_ANTWORT_MODUS, ...ok];
      if (ok.length !== alt.length || ok.some((x, i) => x !== alt[i])) geaendert = true;
      neu[t] = ok.length === 1 ? ok[0] : ok;
    });
    if (geaendert) setQuizSpalteModus(neu);
  }, [quizSpalteModus]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Nach der Zwischenkarte "Wiederholung" die erste Frage erneut vorlesen
  const quizWiederholungHinweis = quiz?.phase === "wiederholungHinweis";
  const vorgelesenRef = useRef(null);
  useEffect(() => {
    vorgelesenRef.current = null;
    if (ansicht !== "quiz" || !quiz || quiz.phase !== "eingabe" || quiz.flash) return;
    if (quiz.modus === "diktat") {
      const text = quiz.vokabeln?.[quiz.index]?.[quiz.diktatSpalte]?.wert;
      if (text) sprich(text, vokLang(quiz.vokabeln?.[quiz.index], quiz.diktatSpalte));
      return;
    }
    if (!einstellungen.autoplay) return;
    if (quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] === "hoeren") return;   // „Hören“ liest die Frage selbst vor
    if (!(einstellungen.vorlesen || ["E1"]).includes(quiz.frageTyp)) return;
    const text = quiz.vokabeln?.[quiz.index]?.[quiz.frageTyp]?.wert;
    if (text) sprichAuto(text, vokLang(quiz.vokabeln?.[quiz.index], quiz.frageTyp));
  }, [quiz?.index, quizWiederholungHinweis, ansicht, einstellungen.autoplay]);

  // Listen-Übersicht gibt es nur noch unter Einstellungen › Listen (z. B. nach Import, Löschen, Abbrechen)
  useEffect(() => {
    if (tab === "listen" && ansicht === "uebersicht") { setTab("einstellungen"); setEinstBereich("listen"); }
  }, [tab, ansicht]);

  // Auto-Vorlesen: Antwort beim Aufdecken bzw. im Richtig-Blitz vorlesen (je Spalte nur einmal)
  const antwortGezeigt = !!quiz && quiz.modus !== "diktat" && (quiz.phase === "aufgedeckt" || !!quiz.flash);
  useEffect(() => {
    if (ansicht !== "quiz" || !antwortGezeigt || !einstellungen.autoplay) return;
    const typ = quiz.antwortTypen?.[quiz.antwortTypIndex];
    if (!typ || !(einstellungen.vorlesen || ["E1"]).includes(typ)) return;
    const schluessel = `${quiz.index}|${quiz.antwortTypIndex}`;
    if (vorgelesenRef.current === schluessel) return;
    vorgelesenRef.current = schluessel;
    sprich((quiz.antwortTeile || []).join(" / "), vokLang(quiz.vokabeln?.[quiz.index], typ));
  }, [antwortGezeigt, quiz?.index, quiz?.antwortTypIndex, ansicht, einstellungen.autoplay]);

  useEffect(() => {
    if (ansicht !== "quiz" || !quiz) return;
    if (quiz.phase === "wiederholungHinweis") {
      const weiter = (e) => { if (e.target.closest?.(".modal")) return; if (e.key === "Enter" || e.key === "w" || e.key === "W") { e.preventDefault(); starteWiederholung(); } };
      document.addEventListener("keydown", weiter);
      return () => document.removeEventListener("keydown", weiter);
    }
    const isDiktatWeiter = quiz.modus === "diktat" && (quiz.phase === "richtig" || quiz.phase === "aufgedeckt");
    const isKarteAufgedeckt = quiz.modus !== "diktat" && quiz.phase === "aufgedeckt" &&
      (quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || STANDARD_ANTWORT_MODUS) === "karte";
    if (quiz.phase !== "aufgedeckt" && !isDiktatWeiter) return;
    if (isKarteAufgedeckt) return;
    let active = false;
    const tid = setTimeout(() => { active = true; }, 250);
    const handler = (e) => {
      if (!active || e.target.closest?.(".modal")) return;
      if (e.key === "Enter" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (quiz.modus === "diktat") naechsteDiktatVokabel();
        else naechsteVokabel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => { clearTimeout(tid); document.removeEventListener("keydown", handler); };
  }, [quiz, ansicht]);

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────
  // Listen liegen in einem Raster: neue bekommen den ersten freien Platz (Raster wächst bei Bedarf);
  // die Reihenfolge des Index folgt dem Raster (zeilenweise) und gilt so in der ganzen App
  // 193: mit Listen-Ordnern – jede Ebene (oberste und jeder Ordner) hat ihr eigenes Raster; der Index folgt dem
  // Ordner-Baum (Ordner mit ihrem Inhalt an ihrer Stelle). ordner: Listen-Ordner (werden mit gespeichert)
  function speichereIndex(idx, einst = lsGet(SK.einstellungen, defaultEinstellungen()), ordner = lsGet(SK.listenOrdner, [])) {
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
  function verweilGeht(liste, zielId, ids) {
    if (!zielId || ids.includes(zielId)) return false;
    const data = liste ? listenOrdnerDaten() : getSlotsData();
    const offen = liste ? listenOrdnerOffenRef.current : slotOrdnerRef.current;
    const ordnerIds = new Set((data.ordner || []).map(o => o.id));
    return ordnerIds.has(zielId) ? ids.filter(id => ordnerIds.has(id)).every(id => ordnerPasst(data.ordner, id, zielId))
      : !ids.some(id => ordnerIds.has(id)) && ordnerPfad(data.ordner, offen).length < ORDNER_TIEFE_MAX;
  }
  function listenOrdnerDaten() { return { ordner: lsGet(SK.listenOrdner, []), gespeichert: lsGet(SK.listenIndex, []) }; }
  const speichereListenOrdnerDaten = (d, einst) => speichereIndex(d.gespeichert, einst, d.ordner);
  // Listen (ids) untereinander ab Platz ziel in der geöffneten Ebene; Raster wächst bei Bedarf
  function setzeListenPlaetze(ids, ziel) {
    const einst = lsGet(SK.einstellungen, defaultEinstellungen());
    const g = rasterGroesse(einst, "listenRaster");
    const einstNeu = ziel.z + ids.length > g.zeilen ? { ...einst, listenRaster: { ...g, zeilen: ziel.z + ids.length } } : einst;
    if (einstNeu !== einst) speichereEinst(einstNeu);
    const data = listenOrdnerDaten();
    speichereListenOrdnerDaten(setzeEbene(data, platziereGruppe(ebeneVon(data, listenOrdnerOffenRef.current), ids, ziel)), einstNeu);
    setListenAuswahl([]);
  }
  // 193: Listen-Ordner – wie die Quiz-Ordner
  const listenWahlEnde = () => { setListenWahl(null); setListenSortModus(false); setListenAuswahl([]); setInGruppe(null); };
  function verschiebeListenInOrdner(ids, ziel) { speichereListenOrdnerDaten(legeInOrdner(listenOrdnerDaten(), ids, ziel)); listenWahlEnde(); }
  function legeListenOrdnerAn(name, ids, platz = null, eltern = listenOrdnerOffenRef.current) {
    const data = listenOrdnerDaten();
    if (ordnerPfad(data.ordner, eltern).length >= ORDNER_TIEFE_MAX) return null;
    const id = `lordner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    speichereListenOrdnerDaten(neuerOrdnerIn(data, { id, name, eltern, ids, platz }));
    listenWahlEnde();
    return id;
  }
  function gruppiereListen(ids, ziel) {
    const data = listenOrdnerDaten(), offen = listenOrdnerOffenRef.current;
    const imZiel = ebeneVon(data, offen).find(e => e.platz && e.platz.z === ziel.z && e.platz.s === ziel.s);
    if (!imZiel || ids.includes(imZiel.id)) { setzeListenPlaetze(ids, ziel); return; }
    if (imZiel.istOrdner) { verschiebeListenInOrdner(ids, imZiel.id); return; }
    const listen = ids.filter(id => data.gespeichert.some(x => x.id === id));
    if (!listen.length || ordnerPfad(data.ordner, offen).length >= ORDNER_TIEFE_MAX) { setzeListenPlaetze(ids, ziel); return; }
    const alle = [imZiel.id, ...listen];
    legeListenOrdnerAn(gruppenName(alle.map(id => data.gespeichert.find(x => x.id === id)?.name || ""), data.ordner.map(o => o.name)), alle);
  }
  function loeseListenOrdnerAuf(id) {
    const data = listenOrdnerDaten();
    const eltern = data.ordner.find(x => x.id === id)?.ordner || null;
    speichereListenOrdnerDaten(loeseOrdnerDaten(data, id));
    if (listenOrdnerOffenRef.current && ordnerUnter(data.ordner, id).has(listenOrdnerOffenRef.current)) setListenOrdnerOffen(eltern);
  }
  function benenneListenOrdnerUm(id, name) {
    const data = listenOrdnerDaten();
    speichereListenOrdnerDaten({ ...data, ordner: data.ordner.map(o => o.id === id ? { ...o, name: name.trim() || o.name } : o) });
    setOrdnerUmbenennen(null);
  }
  // Gezogener Eintrag: ist er markiert, wandert die ganze markierte Gruppe mit.
  // Ziel „raus“ / „raus:<id>“: auf einen Ordner im Pfad (oberste Ebene bzw. dieser Ordner); lange genug über einer
  // Kachel gehalten: Ordner bilden bzw. hinein
  function legeGezogenAb(d, ziel) {
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
  function zeigeAuswahlTafel(art) {
    const d = auswahlTafelDaten.current[art]?.();
    if (!d) return;
    auswahlTafelRef.current = art;
    const st = auswahlTafelStelle.current;   // sonst bleibt die Stelle des Lang-Drucks (für „🎨 Farbe ändern“)
    zeigeInfo(d.text, st?.x ?? null, st?.y ?? null, d.aktionen, { auswahl: auswahlTafel(art) });
  }
  function auswahlTafel(art) {
    return { ohneText: true, zu: behalten => { auswahlTafelRef.current = null; auswahlTafelStelle.current = null; if (!behalten) (art === "liste" ? setListenWahl : setMultiAuswahl)(null); } };
  }
  function listenKopieName(name) {
    const namen = new Set(listenIndex.map(l => l.name.toLowerCase()));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n.toLowerCase())) n = `${name} (Kopie ${i++})`;
    return n;
  }
  function speichereEinst(e) { e = { ...e, gelerntSchwelle: GELERNT_SCHWELLE }; setEinstellungen(e); lsSet(SK.einstellungen, e); }

  // Vor allen frühen Render-Rückgaben berechnen: starteQuiz() nutzt den Wert auch
  // vom Paket-Ende-Bildschirm aus (sonst ReferenceError → Button ohne Wirkung)
  const vokabelgruppeGeaendert = (() => {
    if (!aktiverSlot || aktiverSlot.typ !== 'gespeichert' || !gespeicherteVokabelgruppe) return false;
    const { listenIds, vokabelAuswahl, bereichTyp } = gespeicherteVokabelgruppe;
    if (listenIds.length !== quizTabListen.length) return true;
    if (!listenIds.every(id => quizTabListen.includes(id))) return true;
    if (bereichTyp !== quizBereichTyp) return true;
    const savedAuswahl = new Set(vokabelAuswahl || []);
    if (savedAuswahl.size !== quizCheckboxAuswahl.size) return true;
    for (const id of savedAuswahl) { if (!quizCheckboxAuswahl.has(id)) return true; }
    return false;
  })();

  // ── Sprachen-Filter (global) ──────────────────────────────────────────────
  const vorhandeneSprachen = SPRACHEN.filter(s => listenIndex.some(l => listeSprache(l) === s.code));
  // Akzente je Sprache (Einstellungen → Akzente); Standard: nur Französisch
  const akzenteAn = code => einstellungen.akzenteSprachen?.[code] ?? code === "fr";
  setzeAKZENTE_FUER_LISTE(id => !id || id === "combined" || akzenteAn(spracheVonListe(id)));
  // Gewählte Sprache nur wirksam, solange es Listen dieser Sprache gibt
  const sprachFilter = vorhandeneSprachen.some(s => s.code === einstellungen.sprache) ? einstellungen.sprache : "alle";
  const sichtbareListen = sprachFilter === "alle" ? listenIndex : listenIndex.filter(l => listeSprache(l) === sprachFilter);
  // Farben je Sprache: in der Abfrage die Sprache ihrer Listen (nur eine), sonst der Sprachfilter; „standard“ = normales Schema
  const sprachFarbKontext = (() => {
    if (!einstellungen.sprachFarben?.an || farbModus) return null;
    const q = (ansicht === "quiz" && quiz) || (lernen ? { vokabeln: lernen.voks || [] } : null);
    if (q) {
      const ids = new Set((q.vokabeln || []).map(v => v._listeId || q.liste?.id).filter(Boolean));
      const sp = new Set([...ids].map(id => listeSprache(listenIndex.find(l => l.id === id))));
      return sp.size === 1 ? [...sp][0] : null;
    }
    // 168: gewählte Quiz (Vorschau, Mehrfachauswahl, geladene) bestimmt die Farbe – außer „erst im Quiz“
    if (!einstellungen.sprachFarben.erstImQuiz && (tab === "quiz" || tab === "statistik")) {
      const kIds = e => e?.konfiguration?.listenIds || [];
      const eintrag = (typ, id) => (slots[typ] || []).find(s => s.id === id);
      const ids = slotSektionAufgeklappt && multiAuswahl?.length ? multiAuswahl.flatMap(id => kIds(eintrag("gespeichert", id)))
        : slotSektionAufgeklappt && slotVorschau ? kIds(eintrag(slotVorschau.typ, slotVorschau.id))
        : tab === "statistik" ? (statistikListenIds ? [...statistikListenIds] : []) : quizTabListen;
      const sp = new Set(ids.map(id => listenIndex.find(l => l.id === id)).filter(Boolean).map(l => listeSprache(l)));
      if (sp.size === 1) return [...sp][0];
      if (sp.size > 1) return sprachFilter !== "alle" ? sprachFilter : null;   // mehrere Sprachen: normale Farbe
    }
    return sprachFilter !== "alle" ? sprachFilter : null;
  })();
  const sprachSchemaId = sprachFarbKontext ? (einstellungen.sprachFarben.zuordnung?.[sprachFarbKontext] ?? `sprache_${sprachFarbKontext}`) : null;
  const sprachSchema = sprachSchemaId && sprachSchemaId !== "standard"
    ? ((einstellungen.eigeneSchemata || []).find(x => x.id === sprachSchemaId) || FARB_VORLAGEN.find(x => x.id === sprachSchemaId)) : null;
  if (sprachSchema) {
    setzeF(farbenAus(sprachSchema.farben));
    setzeCSS(farbVariablen(F, sprachSchema.dunkel) + CSS_BASIS + elementCSS(sprachSchema.elemente));
  }
  // Zufallsfarben je Abschnitt: neues Zufalls-Schema bei jedem Quiz (bzw. Paket), am Ende und zurück in der Übersicht
  const farbWechselAn = !!einstellungen.farbWechsel && !einstellungen.sprachFarben?.an && !farbModus;
  const abschnitt = ansicht === "quiz" && quiz ? `${quiz.phase === "fertig" || quiz.phase === "spielEnde" ? "ende" : "quiz"}:${quiz.rundeStartZeit || ""}`
    : lernen ? `lernen:${lernen.start ?? ""}:${lernen.groesse ?? ""}` : "uebersicht";
  const [wechselFarben, setWechselFarben] = useState(null);
  useEffect(() => { if (farbWechselAn) setWechselFarben(zufallsFarben()); }, [abschnitt, farbWechselAn]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (farbWechselAn && wechselFarben) {
    setzeF(farbenAus(wechselFarben));
    setzeCSS(farbVariablen(F, false) + CSS_BASIS);
  }
  const sichtbareIds = new Set(sichtbareListen.map(l => l.id));
  // Slot ist sichtbar, wenn alle seine (noch vorhandenen) Listen zur gewählten Sprache gehören
  const slotSichtbar = s => {
    if (sprachFilter === "alle") return true;
    const ids = (s.konfiguration?.listenIds || []).filter(id => listenIndex.some(l => l.id === id));
    return ids.length > 0 && ids.every(id => sichtbareIds.has(id));
  };
  // Flagge vor Listennamen nur, wenn "Alle Sprachen" gewählt und mehrere vorhanden
  const listenFlagge = l => sprachFilter === "alle" && vorhandeneSprachen.length > 1 ? sprachInfo(listeSprache(l)).flagge + " " : "";
  const spracheVonListe = id => listeSprache(listenIndex.find(l => l.id === id));
  // Vorlese-Sprache einer Vokabel (Quiz-Vokabeln tragen _listeId)
  const vokLang = (vok, typ) => spalteLang(typ, vok?._listeId ? spracheVonListe(vok._listeId) : listeSprache(aktiveListe));
  // „Hören“: die Frage beim Erscheinen vorlesen (sie ist verdeckt)
  const hoerFrage = quiz && quiz.phase === "eingabe" && !quiz.flash && quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] === "hoeren"
    ? `${quiz.index}|${quiz.antwortTypIndex}` : null;
  useEffect(() => {
    if (!hoerFrage || !quiz) return;
    const v = quiz.vokabeln[quiz.index];
    const t = setTimeout(() => sprichAuto(v?.[quiz.frageTyp]?.wert || "", vokLang(v, quiz.frageTyp)), 250);
    return () => clearTimeout(t);
  }, [hoerFrage]);   // eslint-disable-line react-hooks/exhaustive-deps

  function wechsleSprache(code) {
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

  function setzeListenSprache(code) {
    if (!aktiveListe) return;
    const updated = { ...aktiveListe, sprache: code };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex.map(l => l.id === aktiveListeId ? { ...l, sprache: code } : l));
    // Gefilterte Ansicht folgt der Liste, damit sie nicht verschwindet
    if (sprachFilter !== "alle" && sprachFilter !== code) speichereEinst({ ...einstellungen, sprache: code });
  }
  const vokabelAnzahl = id => { const l = lsGet(SK.liste(id)); return l ? l.vokabeln.length : 0; };

  // ── Listen-Aktionen ───────────────────────────────────────────────────────
  // 195: neue Listen kommen in den geöffneten Listen-Ordner (bzw. beim Import in einen neuen Ordner darin)
  const imListenOrdner = () => {
    const ordner = listenOrdnerOffenRef.current && listenOrdner.some(o => o.id === listenOrdnerOffenRef.current) ? listenOrdnerOffenRef.current : null;
    const np = neuListePlatzRef.current; neuListePlatzRef.current = null;   // 199: auf den lang gedrückten freien Platz
    return { ...(ordner ? { ordner } : {}), ...(np && (np.ordner || null) === ordner ? { platz: np.platz } : {}) };
  };
  function importZielOrdner() {
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
  function importOrdnerWahl() {
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
  function erstelleListe() {
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
  function umbenennen() {
    const id = listeMenueId || aktiveListeId;
    const name = modalInput.trim();
    if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
    if (listenIndex.some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
    speichereIndex(listenIndex.map(l => l.id === id ? {...l, name} : l));
    const aktuell = lsGet(SK.liste(id));
    if (aktuell) { const u = {...aktuell, name}; lsSet(SK.liste(id), u); if (id === aktiveListeId) setAktiveListe(u); }
    setModal(null); setModalInput(""); setModalFehler(""); setListeMenueId(null);
  }

  function loeschen() {
    const id = listeMenueId || aktiveListeId;
    localStorage.removeItem(SK.liste(id));
    speichereIndex(listenIndex.filter(l => l.id !== id));
    setModal(null); setListeMenueId(null);
    if (id === aktiveListeId) { setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null); }
  }

  // Lernstand einer Liste zurücksetzen (gewählte Arten): Vokabeln gelten danach als nie abgefragt
  function setzeListeZurueck() {
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
  function dupliziereListe() {
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

  function speichereSpaltenname() {
    if (!editSpalteTyp || !aktiveListe) return;
    const updated = { ...aktiveListe, spalten: { ...aktiveListe.spalten, [editSpalteTyp]: { ...aktiveListe.spalten[editSpalteTyp], name: modalInput.trim() } } };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex); // trigger re-render
    setModal(null); setModalInput(""); setEditSpalteTyp(null);
  }

  // Info-Spalte als „Info“ oder „Synonyme“
  function setzeSpaltenArt(typ, art) {
    if (!aktiveListe) return;
    const updated = { ...aktiveListe, spalten: { ...aktiveListe.spalten, [typ]: { ...aktiveListe.spalten[typ], art } } };
    lsSet(SK.liste(aktiveListeId), updated);
    setAktiveListe(updated);
    speichereIndex(listenIndex);
  }
  // Ziel der Synonyme: vorhandene Synonym-Spalte, sonst eine leere Info-Spalte (wird beim Übernehmen „Synonyme“)
  function synZiel(liste) {
    const da = TYPEN.find(x => x.startsWith("i") && liste.spalten[x]?.aktiv && istSynonymSpalte(liste.spalten[x]));
    if (da) return { typ: da, neu: false };
    const frei = TYPEN.find(x => x.startsWith("i") && liste.vokabeln.every(v => !v[x]?.wert));
    return frei ? { typ: frei, neu: true } : null;
  }
  function synPortion(listeId) {
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
  function oeffneSynFenster(listeId) { setSynFenster({ listeId, antwort: "", meldung: "" }); setModal("synonyme"); }
  function uebernehmeSynonyme(text) {
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

  function oeffneModal(typ, extra) {
    setListeMenueId(null);
    if (typ === "umbenennen") setModalInput(aktiveListe?.name || "");
    else if (typ === "spalte-umbenennen" && extra) {
      setEditSpalteTyp(extra);
      setModalInput(aktiveListe?.spalten[extra]?.name || "");
    } else if (typ === "slot-speichern") setModalInput(slotNamenVorschlag());
    else setModalInput("");
    setModalFehler(""); setModal(typ);
  }

  // ── Vokabel-Verwaltung ────────────────────────────────────────────────────
  // Vokabel bearbeiten (vok = null: neue Vokabel) in beliebiger Liste – aus Listen, Statistik oder Abfrage.
  // nur = Spalte: nur deren richtige Antwort (Abfrage), falsche Antworten bleiben unverändert
  function oeffneVokabelBearbeiten(vok, listeId = aktiveListeId, nur = null, falsch = null) {
    const liste = listeId === aktiveListeId && aktiveListe ? aktiveListe : lsGet(SK.liste(listeId));
    if (!liste) return;
    const orig = vok ? liste.vokabeln.find(v => v.id === (vok._origId ?? vok.id)) : null;
    if (vok && !orig) return;
    const eingaben = {};
    if (nur) eingaben[nur] = falsch ?? (orig?.[nur]?.wert || '');
    else TYPEN.filter(t => liste.spalten[t].aktiv).forEach(typ => {
      const z = orig?.[typ];
      eingaben[typ] = z ? z.wert + (z.falsch?.length > 0 ? ' || ' + z.falsch.join(' | ') : '') : '';
    });
    setBearbeiteVokabel(orig || { neu: true });
    setBearbeiteListe(liste);
    setBearbeiteNur(nur);
    setBearbeiteFalsch(falsch);
    setBearbeiteEingaben(eingaben);
    setModalFehler("");
    setModal('vokabel-bearbeiten');
  }
  function schliesseVokabelBearbeiten() { setModal(null); setBearbeiteVokabel(null); setBearbeiteEingaben({}); setBearbeiteNur(null); setBearbeiteFalsch(null); setBearbeiteListe(null); }

  function speichereVokabelBearbeitung() {
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
  function setzeHerausgenommen(listeId, origId, an) {
    const l = lsGet(SK.liste(listeId));
    if (!l) return;
    const neu = { ...l, vokabeln: l.vokabeln.map(v => { if (v.id !== origId) return v; const n = { ...v }; if (an) n.herausgenommen = true; else delete n.herausgenommen; return n; }) };
    lsSet(SK.liste(listeId), neu);
    if (listeId === aktiveListeId) setAktiveListe(neu);
    setFaelligTick(x => x + 1);
  }
  // im Quiz: aktuelle Vokabel herausnehmen – sie fällt aus der Runde, weiter mit der nächsten (ohne Wertung)
  function nimmVokabelHeraus() {
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
  function loescheVokabel(vokId) {
    const neueListe = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.filter(v => v.id !== vokId) };
    lsSet(SK.liste(aktiveListeId), neueListe);
    setAktiveListe(neueListe);
    setModal(null); setBearbeiteVokabel(null);
  }

  function fuehreListenZusammen() {
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

  // ── Export-Aktionen ───────────────────────────────────────────────────────
  function generiereKombiniertenExport(ids) {
    return ids.map(id => { const l = lsGet(SK.liste(id)); return l ? generiereExportText(l) : null; })
      .filter(Boolean).join('\n\n');
  }
  async function kopiereListen(ids) {
    if (!ids.length) return;
    const text = generiereKombiniertenExport(ids);
    try {
      await navigator.clipboard.writeText(text);
      setExportKopiert(true);
      setTimeout(() => setExportKopiert(false), 2000);
    } catch {}
  }

  // Exportieren: ein Fenster mit Art-Wahl JSON | TXT | Kopieren (zuletzt gewählte Art ist vorausgewählt)
  function oeffneExport(ids, art = einstellungen.exportArt || "json") {
    if (!ids.length) return;
    if (art !== einstellungen.exportArt) speichereEinst({ ...einstellungen, exportArt: art });
    setExportKopiert(false);
    if (art === "txt") oeffneDateiExport({ art: "txt", ids }, exportStandardName(ids, "TXT"));
    else if (art === "kopieren") { setKopierExportIds(ids); setModal("kopier-export"); }
    else exportiereAlsJson(ids);
  }
  const exportWas = ids => ids.length === 1 ? (listenIndex.find(l => l.id === ids[0])?.name || "1 Liste")
    : `${ids.length} Listen: ${ids.map(id => listenIndex.find(l => l.id === id)?.name).filter(Boolean).join(", ")}`;
  function renderExportArtWahl(...args) { return renderExportArtWahlTeil({ exportWas, oeffneExport, tt }, ...args); }

  // Export-Dateien: Endung immer .txt (nimmt jedes Ziel an), Inhalt steht im Namen: "Name - JSON.txt" / "Name - TXT.txt"
  function exportStandardName(ids, art) {
    const basis = ids.length === 1 ? (listenIndex.find(l => l.id === ids[0])?.name || 'Vokabeln') : `${ids.length} Listen`;
    return `${basis} - ${art}`;
  }
  // eingegebener Name → Dateiname: Zeichen, die Dateisysteme nicht erlauben, raus; leer → Vorschlag
  const dateiName = (name, standard) => (name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\.(txt|json)$/i, "").trim() || standard) + ".txt";
  const sicherungStandardName = () => `Vokabel-App Sicherung ${new Date().toISOString().slice(0, 10)}`;
  function teileAlsDatei(text, dateiname) {
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
  function oeffneDateiExport(ziel, standard) { setDateiExport(ziel); setExportName(standard); setModal("datei-export"); }
  function bestaetigeDateiExport() {
    const z = dateiExport;
    if (!z) return;
    setModal(null); setDateiExport(null);
    if (z.art === "sicherung") { speichereSicherung(dateiName(exportName, sicherungStandardName())); return; }
    const text = z.ids.length === 1 ? generiereExportText(lsGet(SK.liste(z.ids[0]))) : generiereKombiniertenExport(z.ids);
    teileAlsDatei(text, dateiName(exportName, exportStandardName(z.ids, "TXT")));
  }


  // Stand der Statistik-Auswahl beim Betreten (aus dem Quiz übernommen) – zum Erkennen eigener Änderungen
  const statistikStartRef = useRef(null);
  const statistikStandKey = (listenIds, bereich, auswahl, slot) =>
    JSON.stringify([listenIds === null ? null : [...listenIds].sort(), bereich, bereich === "bereich" ? [...auswahl].sort() : [], slot ? `${slot.typ}|${slot.id}` : null]);

  // 132: Tabs per seitlichem Wischen wechseln (nur in der Tab-Übersicht; nicht vom Rand, nicht auf Reglern/Feldern/Farbkreis,
  // nicht beim Ziehen, Anheben oder Einsammeln von Kacheln) – der neue Tab gleitet von der Seite herein
  const wischRef = useRef({});
  wischRef.current.erlaubt = ansicht === "uebersicht" && !modal && !farbModus && !farbRad && !quizVokMax && !statistikVollbild && !slotSortModus && !listenSortModus;
  wischRef.current.tab = tab === "listen" ? "einstellungen" : tab;
  wischRef.current.wechsel = neu => { handleTabWechsel(neu); window.scrollTo(0, 0); };   // sofort, ohne Gleiten (das ließ die feststehenden Köpfe springen)
  useEffect(() => {
    const TABS = ["statistik", "quiz", "einstellungen"];
    let w = null;
    const quer = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if ((s.overflowX === "auto" || s.overflowX === "scroll") && e.scrollWidth > e.clientWidth + 2) return true; } return false; };
    const start = e => {
      w = null;
      if (e.touches.length !== 1 || !wischRef.current.erlaubt) return;
      const x = e.touches[0];
      if (x.clientX < 24 || x.clientX > window.innerWidth - 24) return;   // Rand: Zurück-Geste des Systems
      const el = e.target;
      if (el.closest?.("input, textarea, select, [data-kein-wischen], [data-info-blase], [data-info-menue], [data-auswahl-tafel]") || quer(el)) return;
      w = { x: x.clientX, y: x.clientY, t: Date.now() };
    };
    const ende = e => {
      const s = w; w = null;
      if (!s || !wischRef.current.erlaubt) return;
      if (slotZiehenRef.current?.aktiv || lassoRef.current?.aktiv || (kachelGesteRef.current?.stufe || 0) >= 1) return;
      const x = e.changedTouches[0], dx = x.clientX - s.x, dy = x.clientY - s.y;
      if (Date.now() - s.t > 800 || Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
      const i = TABS.indexOf(wischRef.current.tab), j = i + (dx < 0 ? 1 : -1);
      if (i < 0 || j < 0 || j >= TABS.length) return;
      wischRef.current.wechsel(TABS[j], dx < 0 ? "links" : "rechts");
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", ende, { passive: true });
    document.addEventListener("touchcancel", () => { w = null; });
    return () => { document.removeEventListener("touchstart", start); document.removeEventListener("touchend", ende); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabWechsel(neuerTab) {
    // 215: schon im Quiz-Tab (Übersicht) – Tab öffnet die Quiz-Auswahl; offen und nichts geändert → wieder zu;
    // geändert (grüner Kopf) → nichts (übernehmen nur über den Kopf)
    if (neuerTab === "quiz" && tab === "quiz" && ansicht === "uebersicht") {
      if (!slotSektionAufgeklappt) { toggleSlotSektion(); return; }
      if (!slotVorschau && !multiAuswahl && !listenAendern) toggleSlotSektion();
      return;
    }
    if (slotSektionAufgeklappt && neuerTab !== tab && (tab === "quiz" || tab === "statistik")) {
      const laden = tab === "statistik" ? ladeSlotStatistik : ladeSlot;
      if (multiAuswahl?.length) beendeMultiAuswahl(multiAuswahl, laden);
      else if (slotVorschau) laden(slotVorschau.typ, slotVorschau.id);
      setMultiAuswahl(null); setSlotVorschau(null); schliesseInfo(); auswahlTafelRef.current = null;
      setSlotSektionAufgeklappt(false);
    }
    if (neuerTab === "statistik" && tab !== "statistik") {
      const listenIds = quizTabListen.length > 0 ? new Set(quizTabListen) : null;
      statistikStartRef.current = statistikStandKey(listenIds, quizBereichTyp, quizCheckboxAuswahl, aktiverSlot);
    }
    if (neuerTab === "statistik") {
      setStatistikListenIds(quizTabListen.length > 0 ? new Set(quizTabListen) : null);
      setStatistikBereichTyp(quizBereichTyp);
      setStatistikCheckboxAuswahl(new Set(quizCheckboxAuswahl));
      setStatistikListenAufgeklappt(false);
      setStatistikEinzelauswahlAufgeklappt(false);
      setStatistikAktiverSlot(aktiverSlot);
      setStatistikSlotGeleert(false);
    }
    // Statistik → Quiz: nur was in der Statistik geändert wurde, ins Quiz übernehmen
    if (neuerTab === "quiz" && tab === "statistik"
        && statistikStandKey(statistikListenIds, statistikBereichTyp, statistikCheckboxAuswahl, statistikAktiverSlot) !== statistikStartRef.current) {
      const s = statistikAktiverSlot;
      if (s && getSlotEintrag(s.typ, s.id)) {
        if (!(aktiverSlot?.typ === s.typ && aktiverSlot?.id === s.id)) { ladeSlot(s.typ, s.id); if (getSlotEintrag(s.typ, s.id)?.multi) setMultiStart({ id: s.id, starten: false }); }
      } else {
        // keine Konfiguration mehr ("Neu" oder Liste geändert) → im Quiz lösen, Quiz ebenfalls
        // (ihr Fortschritt bleibt im gespeicherten Eintrag); Listen-/Vokabelauswahl übernehmen
        if (aktiverSlot) { setAktiverSlot(null); setGespeicherteVokabelgruppe(null); lsDel(SK.letzterSlot); lsDel(SK.sessionAktiv); setSessionSlotAktiv(null); zurUebersetzung(); }
        setQuizTabListen(statistikListenIds === null ? sichtbareListen.map(l => l.id) : [...statistikListenIds]);
        setQuizBereichTyp(statistikBereichTyp);
        setQuizCheckboxAuswahl(new Set(statistikBereichTyp === "bereich" ? statistikCheckboxAuswahl : []));
      }
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
  function gruppenQuizPasst(g) {
    const listen = quizTabListen.length > 0 ? quizTabListen : (aktiveListeId ? [aktiveListeId] : []);
    return g.art === quizAbfrageArt && g.listenIds.every(id => listen.includes(id));
  }
  function starteGruppenQuiz(g) {
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
    setSlotGeaendert(false);
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
  const [gruppenQuizTick, setGruppenQuizTick] = useState(0);
  useEffect(() => {
    if (gruppenQuizStartRef.current === 0 || tab !== "quiz") return;
    if (--gruppenQuizStartRef.current > 0) { setGruppenQuizTick(t => t + 1); return; }
    starteQuiz(true);
    setQuiz(q => q && { ...q, ausStatistik: true });
  }, [gruppenQuizTick]);

  function toggleStatistikListe(id) {
    if (statistikAktiverSlot) { setStatistikAktiverSlot(null); setStatistikSlotGeleert(true); }
    setStatistikListenIds(prev => {
      const currentSet = prev === null
        ? new Set(sichtbareListen.map(l => l.id))
        : new Set(prev);
      if (currentSet.has(id)) {
        currentSet.delete(id);
        // Bereinige Vokabelauswahl wenn Liste abgewählt
        if (statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0) {
          const neueListen = [...currentSet];
          const bereinigte = new Set([...statistikCheckboxAuswahl].filter(vokId =>
            neueListen.some(lId => vokId.startsWith(`${lId}__`))
          ));
          if (bereinigte.size === 0) {
            setStatistikBereichTyp("alle");
            setStatistikCheckboxAuswahl(new Set());
          } else {
            setStatistikCheckboxAuswahl(bereinigte);
          }
        }
      } else {
        currentSet.add(id);
        if (currentSet.size === sichtbareListen.length) return null;
      }
      return currentSet;
    });
  }

  // ── Import-Aktionen ───────────────────────────────────────────────────────
  function resetImport() {
    setImportNeuerOrdner(null); neuListePlatzRef.current = null;
    setImportText(""); setImportDateiname(""); setImportParsed(null);
    setImportMehrfachListen(null); setImportJsonData(null); setImportMapping({});
    setImportZielTyp("neu"); setImportNeuName(""); setImportBestehendId(""); setImportFehler("");
  }

  function autoMappeKolumnen(headerNamen) {
    const VALID = new Set(TYPEN);
    const mapping = {};
    const used = new Set();
    // Pass 1: extract [TYPE] tags from header names (reliable, from our own export)
    headerNamen.forEach((name, idx) => {
      const m = name.match(/\[([EDi][123])\]\s*$/);
      if (m && VALID.has(m[1]) && !used.has(m[1])) {
        mapping[idx] = m[1];
        used.add(m[1]);
      } else {
        mapping[idx] = null;
      }
    });
    // Pass 2 (fallback for files without tags): keyword detection
    if (used.size === 0) {
      const eKeys = SPRACHEN.flatMap(s => s.keys);
      const dKeys = ['deutsch', 'german'];
      let eCount = 0, dCount = 0, iCount = 0;
      headerNamen.forEach((name, idx) => {
        const low = name.toLowerCase().trim();
        if (eKeys.some(k => low.includes(k)) && eCount < 3) mapping[idx] = ['E1','E2','E3'][eCount++];
        else if (dKeys.some(k => low.includes(k)) && dCount < 2) mapping[idx] = ['D1','D2'][dCount++];
        else if (iCount < 2) mapping[idx] = ['i1','i2'][iCount++];
      });
      if (eCount === 0 && dCount === 0) {
        const pos = ['E1','D1','i1','E2','D2','i2','E3'];
        headerNamen.forEach((_, idx) => { mapping[idx] = pos[idx] ?? null; });
      }
    }
    return mapping;
  }

  function analysiereImport() {
    const normiert = importText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Eingefügtes JSON-Backup (z. B. aus der Zwischenablage) direkt als Backup übernehmen
    try {
      const listen = findeJsonListen(normiert);
      if (listen) {
        if (!listen.length) { setImportFehler("Keine Vokabellisten im JSON gefunden."); return; }
        setImportJsonData(listen); setImportText(""); setImportFehler(""); return;
      }
    } catch { setImportFehler(`JSON-Backup ist beschädigt. Anfang: ${dateiVorschau(normiert)}`); return; }
    const alleZeilen = normiert.trim().split('\n').filter(z => z.trim());
    if (alleZeilen.length < 2) {
      setImportFehler(`Nur ${alleZeilen.length} Zeile${alleZeilen.length === 1 ? "" : "n"} erkannt – nötig sind eine Kopfzeile und mindestens eine Vokabel. Anfang: ${dateiVorschau(normiert)}. Dateien bitte über „📄 Datei“ laden.`);
      return;
    }

    // Namenszeile "# Name {fr}" (eigener TXT-Export) → Sprache
    const parseNamensZeile = z => {
      const m = z.slice(2).trim().match(/^(.*?)\s*\{([a-z]{2})\}$/);
      return m && SPRACHEN.some(s => s.code === m[2]) ? { name: m[1], sprache: m[2] } : { name: z.slice(2).trim(), sprache: null };
    };
    const standardSprache = sprachFilter === "alle" ? "en" : sprachFilter;

    const hashIdx = alleZeilen.reduce((acc, z, i) => z.startsWith('# ') ? [...acc, i] : acc, []);
    if (hashIdx.length > 1) {
      const sektionen = hashIdx.map((startIdx, si) => {
        const endIdx = hashIdx[si + 1] ?? alleZeilen.length;
        const sz = alleZeilen.slice(startIdx, endIdx);
        const { name, sprache } = parseNamensZeile(sz[0]);
        const rest = sz.slice(1);
        if (rest.length < 2) return null;
        const header = parseKopfZeile(rest[0]);
        const daten = rest.slice(1).map(parseZeile);
        const mapping = autoMappeKolumnen(header.map(h => h.wert));
        return { name, header, daten, mapping, sprache: sprache || erkenneSprache(header.map(h => h.wert)) };
      }).filter(Boolean);
      if (!sektionen.length) { setImportFehler("Keine gültigen Listen gefunden."); return; }
      setImportSprache(standardSprache);
      setImportMehrfachListen(sektionen);
      setImportParsed(null);
      setImportFehler("");
      return;
    }

    setImportMehrfachListen(null);
    let zeilen = alleZeilen;
    let erkannterName = '';
    let erkannteSprache = null;
    if (zeilen[0].startsWith('# ')) {
      ({ name: erkannterName, sprache: erkannteSprache } = parseNamensZeile(zeilen[0]));
      zeilen = zeilen.slice(1);
      if (zeilen.length < 2) { setImportFehler("Mindestens 2 Zeilen erforderlich."); return; }
    }
    const header = parseKopfZeile(zeilen[0]);
    setImportSprache(erkannteSprache || erkenneSprache(header.map(h => h.wert)) || standardSprache);
    const daten = zeilen.slice(1).map(parseZeile);
    // Mit Spalten-Kennungen (eigener Export) direkt zuordnen, sonst manuell
    const hatTags = header.some(h => SPALTEN_TAG.test(h.wert));
    const mapping = hatTags ? autoMappeKolumnen(header.map(h => h.wert)) : {};
    if (!hatTags) header.forEach((_, i) => { mapping[i] = null; });
    setImportParsed({ header, daten });
    setImportMapping(mapping);
    if (erkannterName && !importNeuName) setImportNeuName(erkannterName);
    setImportFehler("");
  }

  function importiereAlleListen() {
    if (!importMehrfachListen?.length) return;
    const neuerIndex = [...listenIndex];
    const ziel = importZielOrdner();   // 195
    let n = 0;
    for (const s of importMehrfachListen) {
      const abfragbar = Object.values(s.mapping).filter(t => t && !t.startsWith('i'));
      if (abfragbar.length < 2) continue;
      const id = "liste_" + Date.now() + "_" + n;
      const liste = neueListeObjekt(id, s.name || `Import ${n + 1}`);
      liste.sprache = s.sprache || importSprache;
      s.header.forEach((h, i) => {
        const typ = s.mapping[i];
        if (typ) liste.spalten[typ] = { name: h.wert.replace(/\s*\[[EDi][123]\]\s*$/, '').trim(), aktiv: true };
      });
      s.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(s.mapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name, sprache: liste.sprache, ...(ziel.id ? { ordner: ziel.id } : {}) });
      n++;
    }
    speichereIndex(neuerIndex, undefined, ziel.ordner);
    if (ziel.id) setListenOrdnerOffen(ziel.id);
    resetImport();
    setAnsicht("uebersicht");
  }

  function importiereAusJsonDaten() {
    if (!importJsonData?.length) return;
    const neuerIndex = [...listenIndex];
    const ziel = importZielOrdner();   // 195
    importJsonData.forEach((l, i) => {
      const id = "liste_" + Date.now() + "_j" + i;
      const liste = ergaenzeSpalten({ ...l, id, sprache: listeSprache(l) });
      lsSet(SK.liste(id), liste);
      neuerIndex.push({ id, name: liste.name, sprache: liste.sprache, ...(ziel.id ? { ordner: ziel.id } : {}) });
    });
    speichereIndex(neuerIndex, undefined, ziel.ordner);
    if (ziel.id) setListenOrdnerOffen(ziel.id);
    resetImport();
    setAnsicht("uebersicht");
  }

  // Einstellungen: Bereiche mit Kopfzeile, immer nur einer offen; der geöffnete rückt unter die Kopfleiste, falls er oben verschwunden ist
  function schalteEinstBereich(key) {
    const neu = einstBereich === key ? null : key;
    setEinstBereich(neu); setEinstUnter(null);
    if (neu === "info") setInfoModus("uebersicht");
    if (neu) requestAnimationFrame(() => {
      const el = document.querySelector(`[data-einst-kopf="${neu}"]`);
      if (el && el.getBoundingClientRect().top < headerH) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 8 });
    });
  }
  // Knopfzeile im Einstellungs-Bereich: der offene Knopf wird grün (Auswahl: „Bestätigen“, sonst Wert mit ▲) und behält Größe und Platz;
  // sein Inhalt erscheint direkt darunter, der übrige Inhalt des Bereichs ist ausgeblendet. aktion: Knopf ohne Inhalt (z. B. ＋)
  const einstZeile = (zellen, offenK = einstUnter, setze = setEinstUnter, attrs = {}) => (
    <div className="quiz-zeile" data-einst-zeile={einstBereich} style={{top: headerH, marginBottom:12}} {...attrs}>
      {zellen.filter(Boolean).map(z => { const offen = offenK === z.k; return (
        <div key={z.k} className={`quiz-zeile-zelle${offen ? " offen" : ""}${z.schmal ? " schmal" : ""}`}><span className="quiz-zeile-label">{z.label}</span>
          <button data-einst-unter={z.k} {...(z.attrs || {})} className={`quiz-zeile-knopf${offen ? (z.wahl ? " offen bestaetigen-knopf" : " offen") : ""}${offen ? "" : blitzt(`eu:${z.k}`)}`}
            style={z.schmal ? {paddingLeft:14, paddingRight:14} : undefined}
            onClick={z.aktion || (() => { if (offen) leuchte(`eu:${z.k}`); setze(offen ? null : z.k); })}
            {...tt(offen ? (z.wahl ? `Bestätigen – ${z.label} zuklappen` : `${z.label} zuklappen`) : z.hilfe)}>
            {offen ? (z.wahl ? <span data-bestaetigen>Bestätigen</span> : <>{z.text}<span aria-hidden="true" style={{marginLeft:6, fontSize:"0.7em"}}>▲</span></>) : z.text}</button>
        </div>); })}
    </div>
  );
  // Auswahl in einem „Bestätigen“-Bereich: übernehmen, zuklappen, Knopf leuchtet kurz
  const einstWahl = (k, fn) => { fn(); setTimeout(() => { setEinstUnter(null); leuchte(`eu:${k}`); }, WAHL_ZU_MS); };
  const einstKopf = (key, titel, sub) => (
    <button className={`einst-kopf${einstBereich === key ? " offen" : ""}`} data-einst-kopf={key} data-offen={einstBereich === key ? "ja" : "nein"}
      onClick={() => schalteEinstBereich(key)} {...tt(einstBereich === key ? `${titel} zuklappen` : `${titel} aufklappen`)}>
      <span className="einst-kopf-text">{titel}{sub && <span className="einst-kopf-sub">{sub}</span>}</span>
      <span className="einst-kopf-pfeil">{einstBereich === key ? "▾" : "▸"}</span>
    </button>
  );

  // Dialog „Vokabel bearbeiten / Neue Vokabel / Richtige Antwort bearbeiten“ – im Haupt-Bildschirm und über der Abfrage
  function renderVokabelEditor(...args) { return renderVokabelEditorTeil({ aktiveListeId, bearbeiteEingaben, bearbeiteFalsch, bearbeiteListe, bearbeiteNur, bearbeiteVokabel, modal, modalFehler, quiz, schliesseVokabelBearbeiten, setBearbeiteEingaben, setModalFehler, speichereVokabelBearbeitung, tt, ttFeld }, ...args); }

  const renderExportNamensFeld = beiEnter => (
    <div style={{marginBottom:14}}>
      <label className="inp-label">Dateiname</label>
      <div style={{display:"flex", alignItems:"center", gap:6}}>
        <input className="inp" data-export-name value={exportName} onChange={e => setExportName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") beiEnter(); }} onFocus={e => e.target.select()}
          {...ttFeld("Name der Datei – leer lassen für den Vorschlag")} style={{flex:1, minWidth:0}} />
        <span style={{fontSize:"0.85rem", color:"var(--text3)"}}>.txt</span>
      </div>
    </div>
  );

  // Gesamtsicherung als Datei (Vorschlag „Vokabel-App Sicherung JJJJ-MM-TT“, Name änderbar)
  function sichereAlles() { oeffneDateiExport({ art: "sicherung" }, sicherungStandardName()); }
  function speichereSicherung(dateiname) {
    const sich = erstelleSicherung();
    teileAlsDatei(JSON.stringify(sich), dateiname);
    lsSet(SK.letzteSicherung, sich.erstellt); setLetzteSicherung(sich.erstellt);
  }
  async function ladeSicherungsDatei(file) {
    setSicherungFehler(""); setSicherungLaden(null);
    let obj = null;
    try { const t = (await leseDateiAlsText(file)).replace(/^[\uFEFF\u200B\s]+/, ""); obj = JSON.parse(t); } catch { /* unten */ }
    if (istSicherung(obj)) { setSicherungLaden(obj); return; }
    setSicherungFehler(`„${file.name}“ ist keine Gesamtsicherung. Einzelne Listen bitte über Listen → Import laden.`);
  }
  function bestaetigeWiederherstellen(sich) {
    stelleSicherungWiederHer(sich);
    window.location.reload();
  }
  const sicherungTage = einstellungen.sicherungErinnerung ?? 7;
  const sicherungAlt = (() => {
    if (!sicherungTage || !listenIndex.length || Date.now() - sicherungSpaeter < SICHERUNG_TAG_MS) return null;
    const seit = letzteSicherung || lsGet(SK.sicherungBasis);
    if (!seit || Date.now() - seit < sicherungTage * SICHERUNG_TAG_MS) return null;
    return { tage: Math.floor((Date.now() - seit) / SICHERUNG_TAG_MS), nie: !letzteSicherung };
  })();

  function exportiereAlsJson(ids) {
    setJsonExportIds(ids);
    setExportName(exportStandardName(ids, "JSON"));
    setModal("json-export");
  }

  function exportiereAlsJsonBestaetigt() {
    const listen = jsonExportIds.map(id => lsGet(SK.liste(id))).filter(Boolean);
    const gefiltert = listen.map(liste => {
      const l = { ...liste };
      l.vokabeln = liste.vokabeln.map(vok => {
        const v = { ...vok };
        TYPEN.forEach(typ => {
          if (v[typ]) v[typ] = { wert: v[typ].wert, falsch: jsonExportOptionen.falsch ? (v[typ].falsch || []) : [] };
        });
        if (!jsonExportOptionen.fortschritt) delete v.fortschritt;
        if (!jsonExportOptionen.diktatFortschritt) delete v.diktatFortschritt;
        if (!jsonExportOptionen.akzentFortschritt) delete v.akzentFortschritt;
        return v;
      });
      return l;
    });
    const text = JSON.stringify(gefiltert, null, 2);
    const name = dateiName(exportName, exportStandardName(jsonExportIds, "JSON"));
    setModal(null); setJsonExportIds(null);
    teileAlsDatei(text, name);
  }

  function setzeMapping(colIndex, typ) {
    setImportMapping(prev => {
      const war = prev[colIndex];
      const neu = { ...prev };
      Object.keys(neu).forEach(k => { if (neu[k] === typ) neu[k] = null; });
      neu[colIndex] = war === typ ? null : typ;
      return neu;
    });
  }

  function getBestehendeListe() {
    if (!importBestehendId) return null;
    return lsGet(SK.liste(importBestehendId));
  }

  // Gibt die Ziel-Optionen für bestehende Liste zurück:
  // aktive Spalten (by name) + freie Slots (als "Neu: typ")
  function getBestehendZielOptionen(bl) {
    if (!bl) return [];
    return TYPEN.map(typ => ({
      typ,
      label: bl.spalten[typ].aktiv ? bl.spalten[typ].name || typ : null,
      neu: !bl.spalten[typ].aktiv,
    }));
  }

  function fuehreImportDurch() {
    const abfragbar = Object.values(importMapping).filter(t => t && !t.startsWith('i'));
    if (abfragbar.length < 2) { setImportFehler("Mindestens 2 abfragbare Spalten müssen zugewiesen sein."); return; }

    const istBestehend = importZielTyp === "bestehend";
    const bl = istBestehend ? getBestehendeListe() : null;

    function bauVokabeln(liste) {
      importParsed.daten.forEach(zeile => {
        const vok = { id: liste.naechste_id++ };
        Object.entries(importMapping).forEach(([idx, typ]) => {
          if (typ && zeile[Number(idx)]) vok[typ] = { wert: zeile[Number(idx)].wert, falsch: zeile[Number(idx)].falsch };
        });
        liste.vokabeln.push(vok);
      });
    }

    function aktualisiereSpaltennamen(liste) {
      Object.entries(importMapping).forEach(([idx, typ]) => {
        if (!typ) return;
        if (istBestehend && bl && bl.spalten[typ].aktiv) {
          // Bestehende Spalte: Name bleibt
          if (!liste.spalten[typ].aktiv) liste.spalten[typ] = { name: bl.spalten[typ].name, aktiv: true };
        } else {
          // Neue Spalte: Import-Header-Name
          liste.spalten[typ] = { name: importParsed.header[Number(idx)].wert.replace(/\s*\[[EDi][123]\]\s*$/, '').trim(), aktiv: true };
        }
      });
    }

    if (istBestehend) {
      if (!importBestehendId) { setImportFehler("Bitte eine Liste auswählen."); return; }
      const liste = lsGet(SK.liste(importBestehendId));
      if (!liste) { setImportFehler("Liste nicht gefunden."); return; }
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(importBestehendId), liste);
    } else {
      const name = importNeuName.trim();
      if (!name) { setImportFehler("Bitte einen Namen eingeben."); return; }
      if (listenIndex.some(l => l.name.toLowerCase() === name.toLowerCase())) { setImportFehler("Name bereits vorhanden."); return; }
      const id = "liste_" + Date.now();
      const liste = { ...neueListeObjekt(id, name), sprache: importSprache };
      aktualisiereSpaltennamen(liste);
      bauVokabeln(liste);
      lsSet(SK.liste(id), liste);
      speichereIndex([...listenIndex, { id, name, sprache: importSprache, ...imListenOrdner() }]);
    }
    resetImport();
    setAnsicht("uebersicht");
  }

  // ── Quiz-Aktionen ─────────────────────────────────────────────────────────
  function toggleQuizSpalte(typ) {
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

  function toggleSpalteRolle(typ, rolle, mehrfach = false) {
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

  function toggleInfoSpalte(typ) {
    setQuizZeigeInfo(prev => ({...prev, [typ]: !prev[typ]}));
  }

  function toggleVokCheckbox(vokId) {
    setQuizCheckboxAuswahl(prev => {
      const neu = new Set(prev);
      if (neu.has(vokId)) neu.delete(vokId); else neu.add(vokId);
      return neu;
    });
  }

  // ── Slot-Hilfsfunktionen ──────────────────────────────────────────────────

  function getSlotsData() { return lsGet(SK.slots, defaultSlots()); }

  function setSlotsData(data) { lsSet(SK.slots, data); setSlots(data); }

  // Raster: Plätze vergeben und bei Bedarf Zeilen anhängen (Einstellung wird mitgespeichert)
  function rasterEinordnen(data, einst = lsGet(SK.einstellungen, defaultEinstellungen())) {
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
  function setzeSlotPlaetze(ids, ziel) {
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
  function verschiebeInOrdner(ids, ordnerId) {
    setSlotsData(rasterEinordnen(legeInOrdner(getSlotsData(), ids, ordnerId)));   // Ordner bleiben bestehen, auch leer (194)
    setMultiAuswahl(null); setSlotSortModus(false); setSlotAuswahl([]); setInGruppe(null);
  }
  // neuer Ordner (193/194) in der geöffneten Ebene – aus Quiz/Ordnern (nimmt den Platz des ersten ein) oder leer (platz)
  function legeOrdnerAn(name, ids, platz = null, eltern = slotOrdnerRef.current) {
    if (ordnerPfad(getSlotsData().ordner, eltern).length >= ORDNER_TIEFE_MAX) return null;
    const id = neuerSlotId("ordner");
    setSlotsData(rasterEinordnen(neuerOrdnerIn(rasterEinordnen(getSlotsData()), { id, name, eltern, ids, platz })));
    setMultiAuswahl(null); setSlotSortModus(false); setSlotAuswahl([]); setInGruppe(null);
    return id;
  }
  // Gezogene Quiz auf ein Quiz (neuer Ordner aus allen, an deren Platz) bzw. in einen Ordner
  function gruppiere(ids, ziel) {
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
  function loeseOrdnerAuf(id) {
    const data = rasterEinordnen(getSlotsData());
    const eltern = (data.ordner || []).find(x => x.id === id)?.ordner || null;
    setSlotsData(rasterEinordnen(loeseOrdnerDaten(data, id)));
    if (slotOrdner === id) setSlotOrdner(eltern);
  }
  function benenneOrdnerUm(id, name) {
    const data = getSlotsData();
    setSlotsData({ ...data, ordner: (data.ordner || []).map(o => o.id === id ? { ...o, name: name.trim() || o.name } : o) });
    setOrdnerUmbenennen(null);
  }

  // 217: typ "listen" = eine Liste als Quiz (slots.listen[] je Liste: konfiguration, sessionFortschritte, lernStaende);
  // Name kommt aus dem Listen-Index, konfiguration erst nach dem ersten Start (vorher Standard-Einstellungen)
  function getSlotEintrag(typ, id) {
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
  function aendereListenEintrag(id, f) {
    const data = getSlotsData();
    const listen = data.listen || [];
    const da = listen.some(x => x.id === id);
    setSlotsData({ ...data, listen: da ? listen.map(x => x.id === id ? f(x) : x) : [...listen, f({ id })] });
  }

  function aktuelleKonfiguration(mitVokabeln = true) {
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
  function artEinstellungenJetzt() {
    return { quizAusgewaehlt, quizFrageTyp, quizAntwortTypenGeordnet, quizInfoTypenSession, quizSpalteModus, quizZeigeInfo,
      quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizUnbeantwortetZuerst, quizDiktatSpalte, quizDiktatUebersetzung };
  }
  function wendeArtEinstellungenAn(k) {
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
  function zurUebersetzung() { if (quizArt !== "uebersetzung") wechsleQuizArt("uebersetzung"); }
  function wechsleQuizArt(neu, spalten = quizKombiListe?.spalten) {
    if (neu === quizArt) return;
    const stash = { ...quizArtStash, [quizArt]: artEinstellungenJetzt() };
    wendeArtEinstellungenAn(artBereinigt(neu, stash[neu] || standardArtEinstellungen(neu, spalten), spalten));
    setQuizArtStash(stash);
    setQuizArt(neu);
  }

  // art (optional): Konfiguration direkt in dieser Abfrageart laden
  // Fällige Vokabeln (Abfrageart des Quiz-Tabs) einer Menge von Konfigurationen bzw. Listen: Schlüssel „listeId__vokId“
  const FORTSCHRITT_FELD = { uebersetzung: "fortschritt", diktat: "diktatFortschritt", akzente: "akzentFortschritt" };
  function faelligeSchluessel(konfigs) {
    const feld = FORTSCHRITT_FELD[quizArt] || "fortschritt", jetzt = Date.now(), erg = new Set();
    konfigs.forEach(k => (k.listenIds || []).forEach(id => {
      const l = lsGet(SK.liste(id));
      const auswahl = k.bereichTyp === "bereich" && (k.vokabelAuswahl || []).length ? new Set(k.vokabelAuswahl) : null;
      l?.vokabeln.forEach(v => { const key = `${id}__${v.id}`; if (!v.herausgenommen && (!auswahl || auswahl.has(key)) && istFaellig(v[feld], jetzt)) erg.add(key); });
    }));
    return [...erg];
  }
  const faelligVonSlots = ids => faelligeSchluessel(ids.map(id => getSlotEintrag("gespeichert", id)?.konfiguration).filter(Boolean));
  const faelligVonListen = ids => faelligeSchluessel([{ listenIds: ids }]);
  // 170: nichts fällig → inaktiver Knopf als Hinweis (man sieht dort nach)
  const faelligAktion = (keys, ausListe = null) => [keys.length ? { label: `🔁 Fällige wiederholen (${keys.length})`, fn: () => ladeFaellige(keys, ausListe) }
    : { label: "🔁 Keine fälligen Vokabeln", aus: true, fn: () => {} }];
  // fällige Vokabeln über alle sichtbaren Listen (für „🔁 Fällige wiederholen“) – beim Öffnen der Auswahl neu berechnet
  const faelligAlle = useMemo(() => slotSektionAufgeklappt && (tab === "quiz" || tab === "statistik") ? faelligeSchluessel([{ listenIds: sichtbareListen.map(l => l.id) }]) : [],
    [slotSektionAufgeklappt, tab, listenIndex, sprachFilter, quizArt, faelligTick]);   // eslint-disable-line react-hooks/exhaustive-deps
  function ladeFaellige(keys, ausListe = null) {
    if (!keys.length) return;
    ausListeRef.current = ausListe;   // 204
    const listenIds = [...new Set(keys.map(x => x.split("__")[0]))];
    applyKonfiguration({ ...aktuelleKonfiguration(false), listenIds, vokabelAuswahl: keys, bereichTyp: "bereich", quizBereichTyp: "bereich" });
    setAktiverSlot(null); setGespeicherteVokabelgruppe(null); setSlotVorschau(null); setMultiAuswahl(null); setListenWahl(null);
    auswahlTafelRef.current = null; schliesseInfo();
    setTab("quiz"); setAnsicht("uebersicht"); setSlotSektionAufgeklappt(false); leuchte("slotkopf");
  }
  function applyKonfiguration(k, art = null) {
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
  function schliesseSlotsVerzoegert() {
    clearTimeout(slotZuTimerRef.current);
    slotZuTimerRef.current = setTimeout(() => { setSlotSektionAufgeklappt(false); leuchte("slotkopf"); }, SLOT_ZU_VERZOEGERUNG);
  }

  function ladeSlot(typ, id, art = null) {
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
  function listeAlsQuizVorbereiten(id) {
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
  function starteQuizErstellen(id) {
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
  function erstelleQuiz() {
    const f = erstellenFenster;
    if (!f || !f.name.trim()) return;
    neuImOrdnerRef.current = f.ordner || null;
    speichereAlsGespeichert(null, f.name.trim());
    setErstellenFenster(null); setQuizErstellen(null);
    setSlotOrdner(f.ordner || null);
  }
  // 217: Einstellungen der Liste merken (beim Start einer Runde)
  function speichereListenKonfig(id) { const k = aktuelleKonfiguration(); aendereListenEintrag(id, x => ({ ...x, konfiguration: k })); }

  // Quiz-Fortschritt der Abfrageart aus dem Slot-Eintrag aktivieren (oder kein Quiz, wenn es keinen gibt)
  function aktiviereSlotFortschritt(eintrag, typ, id, art) {
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

  function ladeSlotStatistik(typ, id, art = null) {
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
  function merkeRundeImVerlauf(effSlot, startScores) {
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

  function erstelleVerlaufEintrag(extra = {}) {
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

  // ── Lernen: Wort zeigen (ggf. vorlesen), nach einer Pause die Übersetzung, dann die nächste Vokabel ──
  function lernEinstellungen() {
    const e = einstellungen.lernen || {};
    // frühere einzige Pause ("halte") gilt als Pause nach der Info
    return { ...LERNEN_STANDARD, ...(e.halte != null ? { pauseInfo: e.halte } : {}), ...e };
  }
  // Pause nach dem aktuellen Abschnitt (s); ohne Zusatzinfo gilt nach der Übersetzung die längere von Übersetzung/Info
  function lernPause(l, v) {
    const le = lernEinstellungen();
    if (l.phase === 0) return le.pauseWort;
    if (l.phase === 1) return lernInfoZeigen(l, v) ? le.pauseUeb : Math.max(le.pauseUeb, le.pauseInfo);
    return le.pauseInfo;
  }
  function setzeLernEinst(felder) { speichereEinst({ ...einstellungen, lernen: { ...lernEinstellungen(), ...felder } }); }
  // Lernstand je gespeicherter Konfiguration / Verlaufseintrag und Abfrageart (lernStaende), getrennt vom Abfrage-Fortschritt:
  // { ids (ganze Lern-Reihenfolge), groesse, start, index, fertig, quizGemacht, zeit }
  function lernStandVon(slot, art) {
    if (!slot) return null;
    return slots[slot.typ]?.find(x => x.id === slot.id)?.lernStaende?.[art] || null;
  }
  function setzeLernStand(slot, art, stand) {
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
  function starteLernen(alle, groesse, spalten, info, stand = null) {
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
  function lernInfoZeigen(l, v) { return lernEinstellungen().info && l.info.some(t => v?.[t]?.wert); }
  function lernenWeiter() {
    setLernen(l => {
      if (!l || l.fertig) return l;
      if (l.phase === 0 && l.danach.length) return { ...l, phase: 1 };
      if (l.phase === 1 && lernInfoZeigen(l, l.voks[l.index])) return { ...l, phase: 2 };
      if (l.index + 1 >= l.voks.length) return { ...l, fertig: true };
      return { ...l, index: l.index + 1, phase: 0 };
    });
  }
  function lernenVor() { setLernen(l => l && (l.index + 1 >= l.voks.length ? { ...l, fertig: true } : { ...l, index: l.index + 1, phase: 0, lauf: l.lauf + 1 })); }
  function lernenZurueck() { setLernen(l => l && { ...l, index: Math.max(0, l.index - 1), phase: 0, fertig: false, lauf: l.lauf + 1 }); }
  function beendeLernen() { window.speechSynthesis?.cancel(); setLernen(null); klappeUebersichtEin(); }
  // nächstes Paket des Quiz (nach dem letzten: Endbildschirm bleibt)
  function naechstesLernPaket(l) {
    const start = l.start + l.groesse;
    if (start >= l.alle.length) return { ...l, imQuiz: false };
    return { ...l, imQuiz: false, quizGemacht: false, start, voks: l.alle.slice(start, start + l.groesse), index: 0, phase: 0, fertig: false, pausiert: false, lauf: l.lauf + 1 };
  }
  // Quiz mit genau den eben gezeigten Vokabeln – einmal je Paket, ohne Punktabzug; danach das nächste Paket
  function starteLernQuiz() {
    window.speechSynthesis?.cancel();
    const ids = new Set(lernen.voks.map(v => v.id));
    setLernen(l => ({ ...l, imQuiz: true, quizGemacht: true }));
    starteQuiz(true, null, ids, "lernen");
    setQuiz(q => q && { ...q, ausStatistik: false, ausLernen: true });
  }

  // Multiquiz: Vokabeln mehrerer gespeicherter Konfigurationen zusammen, Einstellungen von der ersten
  function multiZusammenstellung(ids) {
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
  // Multiquiz aus gespeicherten Quiz (Einstellungen von Nr. 1 = zuerst gewählt): als Verlauf-Eintrag laden,
  // im Quiz-Tab auf Wunsch gleich starten; im Statistik-Tab zeigt die Statistik alle Vokabeln zusammen
  function stelleMultiquizEin(ids = multiAuswahl || [], starten = false) {
    const m = multiZusammenstellung(ids);
    setMultiAuswahl(null);
    if (!m || !m.anzahl) return;
    const id = neuerSlotId('v');
    const data = getSlotsData();
    setSlotsData({ ...data, verlauf: [{ id, name: formatSlotDatum(), timestamp: Date.now(), konfiguration: m.konfiguration, sessionFortschritt: null, multi: m.teile }, ...data.verlauf].slice(0, 10) });   // 212
    if (tab === "statistik") { ladeSlotStatistik('verlauf', id); return; }
    ladeSlot('verlauf', id);
    setMultiStart({ id, starten });
  }
  const starteMultiquiz = ids => stelleMultiquizEin(ids, true);
  const multiVonSlot = slot => (slot ? getSlotEintrag(slot.typ, slot.id)?.multi : null) || null;

  function speichereAlsGespeichert(id, name) {
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
  function ueberspeichereSession() {
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
  function starteAufteilen(listeId) {
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
  function aufteilenStand(a = aufteilen) {
    const liste = a && lsGet(SK.liste(a.listeId));
    if (!liste) return null;
    const anzahl = liste.vokabeln.length;
    const gruppen = aufteilenGruppen(anzahl, a.von || 1, a.bis || anzahl, a.groesse, a.restAnhaengen);
    const vorhanden = new Set(slots.gespeichert.map(x => x.name));
    const basis = (a.name || "").trim() || liste.name;
    return { liste, anzahl, gruppen: gruppen.map(([v, b]) => {
      const name = `${basis} (${v} - ${b})`;
      return { von: v, bis: b, name, vorhanden: vorhanden.has(name) };
    }) };
  }
  function legeAufteilenAn() {
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
  function dupliziereSlot(id, name) {
    const data = getSlotsData();
    const quelle = data.gespeichert.find(x => x.id === id);
    if (!quelle) return;
    // im selben Ordner wie das Original
    const kopie = { id: neuerSlotId('g'), name, timestamp: Date.now(), konfiguration: JSON.parse(JSON.stringify(quelle.konfiguration)), sessionFortschritt: null,
      ...(quelle.ordner ? { ordner: quelle.ordner } : {}) };
    setSlotsData(rasterEinordnen({ ...data, gespeichert: [...rasterEinordnen(data).gespeichert, kopie] }));
  }
  // freier Name "Name (Kopie)", "Name (Kopie 2)" …
  function kopieName(name) {
    const namen = new Set(slots.gespeichert.map(x => x.name));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n)) n = `${name} (Kopie ${i++})`;
    return n;
  }

  function benenneSlotUm(id, name) {
    const data = getSlotsData();
    setSlotsData({ ...data, gespeichert: data.gespeichert.map(x => x.id === id ? { ...x, name } : x) });
  }

  // Auswahl löschen (nach Rückfrage): Konfigurationen bzw. Listen mit Vokabeln
  function loescheAuswahl() {
    const z = auswahlLoeschen;
    setAuswahlLoeschen(null);
    if (!z) return;
    if (z.art === "slot") { z.ids.forEach(id => loescheSlotEintrag("gespeichert", id)); setMultiAuswahl(null); return; }
    z.ids.forEach(id => lsDel(SK.liste(id)));
    speichereIndex(listenIndex.filter(l => !z.ids.includes(l.id)));
    if (z.ids.includes(aktiveListeId)) { setAnsicht("uebersicht"); setAktiveListeId(null); setAktiveListe(null); }
    setListenWahl(null);
  }

  function loescheSlotEintrag(typ, id) {
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
  function updateSlotSF(typ, id, sf, art) {
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

  function sessionSlotKonflikt() {
    const slot = lsGet(SK.sessionAktiv);
    if (!slot) return false;
    if ((slot.art || "uebersetzung") !== quizAbfrageArt) return true;
    const isSameSlot = aktiverSlot && slot.slotTyp === aktiverSlot.typ && slot.slotId === aktiverSlot.id;
    if (!isSameSlot) return false;
    const slotListenIds = slot.listenIds || [];
    const slotVokAuswahl = new Set(slot.vokabelAuswahl || []);
    if (slotListenIds.length !== quizTabListen.length) return true;
    if (!slotListenIds.every(id => quizTabListen.includes(id))) return true;
    if (slotVokAuswahl.size !== quizCheckboxAuswahl.size) return true;
    for (const id of slotVokAuswahl) { if (!quizCheckboxAuswahl.has(id)) return true; }
    return false;
  }

  function speichereSessionSlotNeu(paketGroesse, gesamtVoks, startScores = {}, forceTyp, forceId) {
    const slotTyp = forceTyp ?? aktiverSlot?.typ ?? null;
    const slotId = forceId ?? aktiverSlot?.id ?? null;
    const art = quizAbfrageArt;
    const sessionObj = { slotTyp, slotId, art, listenIds: [...quizTabListen], vokabelAuswahl: Array.from(quizCheckboxAuswahl), bereichTyp: quizBereichTyp, abgefragt: [], gesamt: gesamtVoks, paketGroesse, startScores,
      startZeit: Date.now(), erst: {}, pakete: 0 };
    lsSet(SK.sessionAktiv, sessionObj);
    setSessionSlotAktiv(sessionObj);
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, sessionSF(sessionObj), art);
    return sessionObj;
  }
  // Teil des Quiz-Objekts, der im Slot-Eintrag je Abfrageart gespeichert wird
  const sessionSF = x => ({ abgefragt: x.abgefragt, gesamt: x.gesamt, paketGroesse: x.paketGroesse, startScores: x.startScores, startZeit: x.startZeit, erst: x.erst, pakete: x.pakete });
  // Neuer Durchlauf einer bestehenden Quiz (nach „Nochmal“ / Durchlauf-Ende): Start-Scores, Startzeit,
  // erste Bewertungen und Paketzahl neu beginnen – für die Quiz-Auswertung am Ende
  function sessionDurchlaufStarten(slot, voks, feld) {
    if (slot.startScores && Object.keys(slot.startScores).length > 0) { setSessionSlotAktiv(slot); return; }
    const neu = { ...slot, startScores: Object.fromEntries(voks.map(v => [v.id, v[feld]?.score ?? null])), startZeit: Date.now(), erst: {}, pakete: 0 };
    lsSet(SK.sessionAktiv, neu);
    setSessionSlotAktiv(neu);
    if (neu.slotTyp && neu.slotId) updateSlotSF(neu.slotTyp, neu.slotId, sessionSF(neu), neu.art || "uebersetzung");
  }
  // Erste Bewertung je Vokabel in dieser Runde: "richtig" | "falsch" | "aufgedeckt"
  function erstAusQuiz(q) {
    if (!q) return {};
    if (q.modus !== "diktat") return q.gewertet || {};
    const erst = {};
    (q.diktatErgebnisse || []).forEach(e => { if (!(e.vokId in erst)) erst[e.vokId] = e.richtig ? "richtig" : "falsch"; });
    return erst;
  }

  function updateSessionSlotFortschritt(neueIds, isDurchlaufEnde) {
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
  function loescheSessionSlot() {
    const sSlot = lsGet(SK.sessionAktiv);
    const { slotTyp, slotId } = sSlot || {};
    lsDel(SK.sessionAktiv);
    setSessionSlotAktiv(null);
    if (slotTyp && slotId) updateSlotSF(slotTyp, slotId, null, sSlot.art || "uebersetzung");
  }

  // "Neu": komplett neu beginnen – Quiz, Listen-/Vokabelauswahl und alle Abfrage-Einstellungen
  function neueQuizKonfiguration() {
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

  function initQuizDefaults(kombiListe) {
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
  function setzeQuizEinstellungenZurueck() {
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

  function getKombinierteListe(listenIds) {
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

  function toggleQuizTabListe(id) {
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

  // Quiz-Tab: immer nur ein Bereich offen – wer einen öffnet, schließt alle anderen
  // aufgeklappter Zeilen-Knopf: oben der Wert (kurz), darunter „Bestätigen“ (antippen klappt zu)
  const offenText = (offen, kurz) => offen ? <span data-bestaetigen>Bestätigen</span> : kurz;
  function schliesseQuizBereiche(ausser) {
    if (ausser !== "slots") { setSlotSektionAufgeklappt(false); setMultiAuswahl(null); }
    if (ausser !== "listen") setListenAuswahlAufgeklappt(false);
    if (ausser !== "einzel") setQuizListeAufgeklappt(false);
    if (ausser !== "modus") setQuizAbfrageModusAufgeklappt(false);
    if (ausser !== "reihenfolge") setQuizReihenfolgeAufgeklappt(false);
    if (ausser !== "stufe") setQuizStufeAufgeklappt(false);
    if (ausser !== "einstellungen") setQuizEinstellungenAufgeklappt(false);
    if (ausser !== "session") setQuizSessionAufgeklappt(false);
  }
  function toggleSessionBereich(art) {
    if (quizSessionAufgeklappt !== art) schliesseQuizBereiche("session");
    setQuizSessionAufgeklappt(v => v === art ? false : art);
  }

  function toggleListenAuswahl() {
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

  function toggleReihenfolge() {
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

  function toggleEinstellungen() {
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

  useEffect(() => { if (!quizAbfrageModusAufgeklappt) { setArtenMehrfach(null); setAntwortMehrfach(false); } }, [quizAbfrageModusAufgeklappt]);
  function toggleAbfrageModus() {
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

  function toggleEinzelauswahl() {
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

  function toggleSlotSektion() {
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

  function toggleStatistikListenAuswahl() {
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

  function toggleStatistikEinzelauswahl() {
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
  function beendeQuiz(einklappen = true) {
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
  function klappeUebersichtEin() {
    schliesseQuizBereiche("slots");
    setSlotSektionAufgeklappt(true);
    setQuizModusInfoAufgeklappt(false);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  // Statistik-Vollbild: Kopfzeile zeigt den Lernfortschritt der EINGEBLENDETEN Gruppen
  function renderVollbildKopf(...args) { return renderVollbildKopfTeil({ einstellungen, statistikArt, statistikFilter, statistikGefilterteVoks, tt }, ...args); }

  // Rundenergebnis im Kasten: Kreisdiagramm richtig/falsch, Zahlen daneben, Lern-Bilanz darunter
  function renderRundenErgebnis(...args) { return renderRundenErgebnisTeil({ renderLernBilanz, tt }, ...args); }

  // Fortschritt des ganzen Quiz während der Abfrage (Kopfzeile): frühere Pakete + Position im aktuellen
  // Paket; in der Wiederholung gilt das Paket als durch. Ohne Pakete: diese Runde.
  function sessionStandImQuiz(q) {
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
  function renderKopfFortschritt(...args) { return renderKopfFortschrittTeil({ sessionStandImQuiz, tt }, ...args); }

  // ── Quiz-Auswertung (zweiter Bildschirm nach „Weiter →“) ──
  // Quiz mit Paketen: alle Vokabeln des Quiz seit Durchlauf-Start; sonst: diese Runde
  function sessionAuswertungDaten(q) {
    const slot = q.istSessionModus ? lsGet(SK.sessionAktiv) : null;
    const feld = q.scoreFeld || (q.modus === "diktat" ? "diktatFortschritt" : "fortschritt");
    const mitSession = !!(slot?.startScores && Object.keys(slot.startScores).length > 0);
    const start = mitSession ? slot.startScores : (q.rundeStartScores || {});
    const vokMap = new Map(q.liste.vokabeln.map(v => [v.id, v]));
    const ids = Object.keys(start).filter(id => feld !== "akzentFortschritt" || hatAkzentWort(vokMap.get(id)));
    const jetztMap = new Map(q.liste.vokabeln.map(v => [v.id, v[feld]?.score ?? null]));
    const jetzt = Object.fromEntries(ids.map(id => [id, jetztMap.has(id) ? jetztMap.get(id) : start[id]]));
    const erstRunde = erstAusQuiz(q);
    const erst = mitSession ? (slot.erst ? { ...slot.erst, ...erstRunde } : null) : erstRunde;
    const ohneAkzent = feld === "akzentFortschritt" ? Object.keys(start).length - ids.length : null;
    return { ids, start, jetzt, erst, ohneAkzent, startZeit: mitSession ? slot.startZeit : q.rundeStartZeit,
      pakete: mitSession ? (slot.pakete != null ? slot.pakete + 1 : null) : 1, mitSession };
  }
  function renderSessionAuswertung(...args) { return renderSessionAuswertungTeil({ einstellungen, ttFeld }, ...args); }
  // ganze Seite des Quiz-Auswertung mit den gewohnten Knöpfen darunter
  function sessionAuswertungSeite(q, knoepfe, schliessen) {
    return (
      <>
        <style>{CSS}</style>{farbModusUI}{farbRadUI}
        <div className="app">
          <div className="topbar">
            <button {...tt("Schließen – zurück zur Übersicht")} className="topbar-back" onClick={schliessen}>Schließen</button>
            <span className="topbar-title">Quiz-Auswertung</span>
            <span className="quiz-fortschritt"/>
          </div>
          <div className="sektion">
            {renderSessionAuswertung(sessionAuswertungDaten(q))}
            {knoepfe}
          </div>
        </div>
      </>
    );
  }
  // Paket-Ende: nächstes Paket wählen; Größen nur unterhalb des Quiz-Rests, beim Rest „Letzte N Vokabeln“
  // 189: offene Vokabeln des Quiz, die heute schon abgefragt wurden – starteQuiz lässt sie aus, also zählen sie am Paket-Ende nicht als Rest
  const heuteGesperrtOffen = (q, schonAbgefragt) => {
    if (quizHeuteEinschliessen || !tagesSperre() || !q.sessionIds) return 0;
    const feld = q.scoreFeld || "fortschritt", ids = new Set(q.sessionIds);
    return (q.liste?.vokabeln || []).filter(v => ids.has(v.id) && !schonAbgefragt.has(v.id) && heuteAbgefragt(v[feld])).length;
  };
  const naechstesPaketUI = (rest, doWeiter, doBeende, gesperrt = 0) => {
    if (rest <= 0 && gesperrt > 0) return (
      <>
        <div className="meldung-info" data-heute-fertig={gesperrt} style={{marginBottom:10, textAlign:"center"}}
          {...tt(`${gesperrt} Vokabeln dieses Quiz wurden heute schon abgefragt und kommen morgen wieder (vor dem Start mit „Heute“ dazunehmbar)`)}>
          ✓ Für heute geschafft · {gesperrt} morgen
        </div>
        <button {...tt("Pause – Fortschritt bleibt gespeichert, morgen mit den übrigen Vokabeln weitermachen")} className="btn btn-primary" style={{width:"100%"}} onClick={() => doBeende(false, true)} data-pause>Pause</button>
      </>
    );
    const groessen = [5,10,15,20,25,30,40,50].filter(n => n < rest);
    const letzte = quizPaketGroesse >= rest;
    const n = Math.min(quizPaketGroesse, rest);
    return (
      <>
        {groessen.length > 0 && (
          <div style={{marginBottom:10}} data-paket-groessen>
            <div style={{fontSize:"0.78rem", color:"var(--text2)", marginBottom:6}}>Nächstes Paket:</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {groessen.map(g => (
                <button {...tt(`Nächstes Paket mit ${g} Vokabeln`)} key={g} className={`typ-btn${quizPaketGroesse===g?" aktiv":""}`}
                  onClick={() => setQuizPaketGroesse(g)}>{g}</button>
              ))}
            </div>
          </div>
        )}
        <button data-naechstes-paket={n} {...tt(letzte ? `Die letzten ${rest} Vokabeln dieses Quiz abfragen` : "Nächstes Paket starten – bereits abgefragte Vokabeln werden übersprungen")}
          className="btn btn-primary" style={{width:"100%", marginBottom:8}} onClick={() => doWeiter(quizPaketGroesse)}>
          {letzte ? `Letzte ${rest} Vokabel${rest !== 1 ? "n" : ""}` : `Nächste ${n} Vokabeln`}
        </button>
        <button {...tt("Pause – Fortschritt bleibt gespeichert, später über das Quiz weitermachen")} className="btn btn-ghost" style={{width:"100%"}} onClick={() => doBeende(false, true)} data-pause>Pause</button>
      </>
    );
  };
  // Sicherungs-Erinnerung (oben in des Quiz-Auswahl)
  const sicherungErinnerungUI = () => sicherungAlt && (
    <div className="meldung-info sicherung-erinnerung" data-sicherung-erinnerung>
      <div>💾 {sicherungAlt.nie ? "Noch keine Sicherung." : `Letzte Sicherung vor ${sicherungAlt.tage} Tagen.`} Der Browser kann gespeicherte Daten löschen – eine Sicherungsdatei schützt Listen, Scores und Farben.</div>
      <div style={{display:"flex", gap:8, marginTop:8}}>
        <button className="btn btn-primary btn-sm" data-sicherung-jetzt onClick={sichereAlles}
          {...tt("Alles in einer Datei sichern: Listen mit Scores, Einstellungen, Farben, gespeicherte Quiz")}>Jetzt sichern</button>
        <button className="btn btn-ghost btn-sm" data-sicherung-spaeter onClick={() => { const t = Date.now(); lsSet(SK.sicherungSpaeter, t); setSicherungSpaeter(t); }}
          {...tt("Erinnerung für einen Tag ausblenden")}>Später</button>
      </div>
    </div>
  );
  // zurück aus Liste/Import zu Einstellungen › Listen
  function zuEinstListen() { setTab("einstellungen"); setEinstBereich("listen"); setAnsicht("uebersicht"); setListenWahl(null); requestAnimationFrame(() => window.scrollTo(0, 0)); }
  const weiterZurAuswertung = (
    <button data-zur-auswertung {...tt("Weiter zur Auswertung des ganzen Quiz: Start und Ende im Vergleich")} className="btn btn-primary" style={{width:"100%", fontSize:"1.05rem"}}
      onClick={() => { setQuiz(q => q && { ...q, sessionAuswertung: true }); window.scrollTo(0, 0); }}>Weiter →</button>
  );

  // Lern-Bilanz am Rundenende: neu gelernte Vokabeln (Gelernt-Schwelle erreicht) bzw. Gratulation
  function renderLernBilanz(...args) { return renderLernBilanzTeil({ einstellungen, tt }, ...args); }

  // Namensvorschlag für gespeicherte Konfigurationen: Sprache(n) + Datum, eindeutig
  // 216: ungespeichertes Quiz aus genau einer Liste – deren Name (Teil der Liste: „· Nr. 1–10“ bzw. „· Auswahl“)
  function einListenName() {
    if (quizTabListen.length !== 1) return null;
    const id = quizTabListen[0], l = listenIndex.find(x => x.id === id);
    if (!l) return null;
    if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      const alle = lsGet(SK.liste(id))?.vokabeln || [];
      const nr = alle.map((v, i) => quizCheckboxAuswahl.has(`${id}__${v.id}`) ? i + 1 : null).filter(Boolean);
      if (nr.length && nr.length < alle.length) return `${l.name} · ${nr[nr.length - 1] - nr[0] + 1 === nr.length ? `Nr. ${nr[0]}–${nr[nr.length - 1]}` : "Auswahl"}`;
    }
    return l.name;
  }
  function slotNamenVorschlag() {
    // Kürzel der Sprache + Tag.Monat, z. B. „Engl 11.11.“
    const sprachen = [...new Set(quizTabListen.map(spracheVonListe))].map(c => SPRACH_KUERZEL[c] || sprachInfo(c).name);
    const multi = multiVonSlot(aktiverSlot);
    const basis = multi ? `Multiquiz: ${multi.map(t => t.name).join(" + ")}`
      : einListenName() || `${sprachen.length ? sprachen.join(" + ") : "Abfrage"} ${(() => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`; })()}`;
    const namen = new Set(slots.gespeichert.map(x => x.name));
    let name = basis, n = 2;
    while (namen.has(name)) name = `${basis} (${n++})`;
    return name;
  }

  // Suchleiste über einer Vokabelliste (Einzelauswahl Quiz/Statistik, Listenansicht): Treffer anspringen (‹ ›, Enter)
  // oder mit „nur Treffer“ filtern. Zeilen tragen data-such-ziel={art} data-such-id={vok.id}.
  // Vokabel-Auswahl: zum Anfang des nächsten zusammenhängenden gewählten Stücks springen (zyklisch)
  const sprungRef = useRef({});
  function auswahlStuecke(voks, auswahl) {
    const anf = [];
    voks.forEach((v, i) => { if (auswahl.has(v.id) && !(i > 0 && auswahl.has(voks[i - 1].id))) anf.push(v.id); });
    return anf;
  }
  function sprungKnopf(art, voks, auswahl) {
    const anf = auswahlStuecke(voks, auswahl);
    if (!anf.length) return null;
    const cur = sprungRef.current[art] ?? -1;
    const naechst = (cur + 1) % anf.length;
    return (
      <button className="btn btn-ghost btn-sm" data-auswahl-sprung={`${naechst + 1}/${anf.length}`} data-auswahl-durchlass style={{padding:"6px 8px"}}
        onClick={() => {
          sprungRef.current[art] = naechst;
          document.querySelector(`[data-such-ziel="${art}"][data-such-id="${window.CSS.escape(String(anf[naechst]))}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          setSprungTick(x => x + 1);
        }}
        {...tt(`Zum Anfang des ${naechst + 1}. gewählten Stücks springen (${anf.length} zusammenhängende Stücke)`)}>⇣ {naechst + 1}/{anf.length}</button>
    );
  }
  function suchInfo(voks, such) {
    const treffer = sucheVokabeln(voks, such.text);
    const nr = Math.min(such.nr, Math.max(0, treffer.length - 1));
    return { treffer, nr, ids: new Set(treffer.map(t => t.id)), aktuell: treffer[nr]?.id, filter: such.nurTreffer && !!such.text.trim() };
  }
  // Hervorhebung einer Zeile: aktueller Treffer kräftig, weitere Treffer zart (linker Rand)
  function suchMarke(info, id) {
    return id === info.aktuell ? { boxShadow:"inset 5px 0 0 var(--gelb)", outline:"2px solid var(--gelb)", outlineOffset:-2 }
      : info.ids.has(id) ? { boxShadow:"inset 5px 0 0 var(--gelb-zart)" } : {};
  }
  function springeZuTreffer(art, id) {
    requestAnimationFrame(() => document.querySelector(`[data-such-ziel="${art}"][data-such-id="${window.CSS.escape(String(id))}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  // Nach einer Aktion in der Vokabelliste (Häkchen, Von–Bis): Tastatur der Suche schließen und die Zeile im Blick halten –
  // verschoben wird nur, wenn sie danach verdeckt oder außerhalb liegt (Tastatur zu, Tafel unten, Liste länger), dann in die Mitte
  function sichtbarHalten(art, id) {
    const el = document.querySelector(`[data-such-ziel="${art}"][data-such-id="${window.CSS.escape(String(id))}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vOben = vv ? vv.offsetTop : 0, vUnten = vOben + (vv ? vv.height : window.innerHeight);
    const scroller = el.closest("[data-vok-scroller]");
    const sr = scroller?.getBoundingClientRect();
    const leiste = document.querySelector(`[data-suchleiste="${art}"]`)?.getBoundingClientRect();
    const tafel = document.querySelector("[data-auswahl-tafel]")?.getBoundingClientRect();
    const oben = Math.max(vOben, sr ? sr.top : vOben, leiste ? leiste.bottom : vOben);
    const unten = Math.min(vUnten, sr ? sr.bottom : vUnten, tafel ? tafel.top : vUnten);
    if (r.top >= oben - 1 && r.bottom <= unten + 1) return;
    const dy = (r.top + r.height / 2) - (oben + unten) / 2;
    (scroller || window).scrollBy({ top: dy, behavior: "smooth" });
  }
  function zeileImBlick(art, id) {
    const f = document.activeElement;
    if (f?.matches?.("[data-such-feld]")) f.blur();
    [0, 150, 400, 800].forEach(ms => setTimeout(() => requestAnimationFrame(() => sichtbarHalten(art, id)), ms));
  }
  // Lang-Druck auf eine Vokabelzeile: Von–Bis mit dieser Vokabel als Anfang
  function vonBisLangDruck(art, vok, nr, w1, w2) {
    const [setModus, setErster] = art === "quiz" ? [setQuizVonBisModus, setQuizVonBisErster] : [setStatistikVonBisModus, setStatistikVonBisErster];
    const abbrechen = () => { vonBisTafelRef.current = null; setModus(false); setErster(null); };
    return tt("Vokabel aus- oder abwählen (bei Von–Bis: Anfang bzw. Ende des Bereichs) – lang drücken: Von–Bis ab hier",
      [{ label: "✕ Von–Bis abbrechen", fn: abbrechen }],
      { auswahl: { zu: () => abbrechen(), ohneText: true },
        beimMenue: () => { vonBisTafelRef.current = art; setModus(true); setErster(vok.id); zeileImBlick(art, vok.id); } });
  }
  function renderSuchleiste(...args) { return renderSuchleisteTeil({ springeZuTreffer, suchInfo, tt, ttFeld }, ...args); }

  // Kasten „In mehrere Quiz aufteilen“ im Quiz-Tab: Name, Gruppengröße, Bereich, Rest, Vorschau
  function renderAufteilenKasten(...args) { return renderAufteilenKastenTeil({ aufteilen, aufteilenStand, aufteilenSuche, setAufteilen, setAufteilenSuche, tt, ttFeld }, ...args); }

  // ── Farbschemata: 6 Vorlagen (nur duplizierbar) + eigene (bearbeiten, umbenennen, löschen) ──
  const eigeneSchemata = einstellungen.eigeneSchemata || [];
  const schemaName = (name) => {
    const namen = new Set([...FARB_VORLAGEN, ...eigeneSchemata].map(x => x.name.toLowerCase()));
    let n = `${name} (Kopie)`, i = 2;
    while (namen.has(n.toLowerCase())) n = `${name} (Kopie ${i++})`;
    return n;
  };
  function dupliziereSchema(sch) {
    const neu = { id: "eigen_" + Date.now(), name: schemaName(sch.name), basis: sch.basis || sch.id, dunkel: !!sch.dunkel, farben: { ...sch.farben }, elemente: { ...(sch.elemente || {}) } };
    speichereEinst({ ...einstellungen, eigeneSchemata: [...eigeneSchemata, neu], farbschema: neu.id });
    setSchemaBearbeiten(neu.id);
  }
  // 🎲 Zufällige Farben: ersetzt das Schema „Zufall“ (umbenannte oder duplizierte bleiben erhalten)
  function zufallsSchema() {
    const farben = zufallsFarben();
    const alt = eigeneSchemata.find(x => x.zufall && x.name === "Zufall");
    const sch = alt ? { ...alt, farben, elemente: {} } : { id: "zufall_" + Date.now(), name: "Zufall", basis: "natur", dunkel: false, zufall: true, farben, elemente: {} };
    speichereEinst({ ...einstellungen, farbschema: sch.id,
      eigeneSchemata: alt ? eigeneSchemata.map(x => x.id === alt.id ? sch : x) : [...eigeneSchemata, sch] });
    if (schemaBearbeiten && schemaBearbeiten !== sch.id) setSchemaBearbeiten(null);
  }
  function aendereEigenesSchema(id, aenderung) {
    speichereEinst({ ...einstellungen, eigeneSchemata: eigeneSchemata.map(x => x.id === id ? { ...x, ...aenderung(x) } : x) });
  }
  function loescheSchema(id) {
    speichereEinst({ ...einstellungen, eigeneSchemata: eigeneSchemata.filter(x => x.id !== id), farbschema: einstellungen.farbschema === id ? "natur" : einstellungen.farbschema });
    if (schemaBearbeiten === id) setSchemaBearbeiten(null);
    setModal(null); setSchemaMenueId(null);
  }
  const vollHex = h => /^#[0-9a-f]{3}$/i.test(h) ? "#" + h.slice(1).split("").map(c => c + c).join("") : h;
  function renderFarbschemata(...args) { return renderFarbschemataTeil({ aendereEigenesSchema, beendeFarbModus, dupliziereSchema, eigeneSchemata, einstZeile, einstellungen, farbModus, farbTab, oeffneFarbRad, schemaBearbeiten, setFarbTab, setModal, setModalFehler, setModalInput, setSchemaBearbeiten, setSchemaMenueId, speichereEinst, starteFarbModus, tt, ttFeld, vorhandeneSprachen, zufallsSchema }, ...args); }

  // ── Aufräum-Werkzeug: Klammerhinweise der Wort-Spalten in eine Info-Spalte verschieben ──
  function klammerAenderungen(liste, ziel) {
    const quellen = TYPEN.filter(t => !t.startsWith("i") && liste.spalten[t]?.aktiv);
    return liste.vokabeln.map(v => {
      const hinweise = quellen.flatMap(t => hinweiseAus(v[t]?.wert));
      if (!hinweise.length) return null;
      const neu = { ...v };
      quellen.forEach(t => { if (v[t]?.wert && hinweiseAus(v[t].wert).length) neu[t] = { ...v[t], wert: ohneHinweis(v[t].wert) }; });
      const alt = v[ziel]?.wert?.trim();
      neu[ziel] = { wert: [alt, ...hinweise].filter(Boolean).join("; "), falsch: v[ziel]?.falsch || [] };
      return { vorher: v, nachher: neu, hinweise };
    }).filter(Boolean);
  }
  function verschiebeKlammern() {
    const aenderungen = klammerAenderungen(aktiveListe, klammerZiel);
    const neuMap = new Map(aenderungen.map(a => [a.vorher.id, a.nachher]));
    const sp = aktiveListe.spalten[klammerZiel];
    const neu = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.map(v => neuMap.get(v.id) || v),
      spalten: { ...aktiveListe.spalten, [klammerZiel]: { ...sp, aktiv: true, name: sp?.name || "Hinweis" } } };
    lsSet(SK.liste(aktiveListe.id), neu); setAktiveListe(neu); speichereIndex(listenIndex);
    setModal(null);
  }

  // ── Farbwähler (Farbkreis): live über CSS-Variablen, ohne die App neu aufzubauen ──
  function oeffneFarbRad(rolle, titel, basis, ziel, el = null) {
    const r = el?.getBoundingClientRect();
    setFarbRad({ rolle, titel, start: vollHex(basis[rolle] || farbenAus(basis)[rolle] || "#000000").toLowerCase(), basis, ziel,
      rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
      oben: !!r && r.top + r.height / 2 > window.innerHeight / 2 });
  }
  // nur diese Element-Art: eigene Regel statt der Rolle
  function oeffneElementFarbRad(schluessel, eigenschaft, titel, el) {
    const r = el?.getBoundingClientRect();
    const cs = el ? getComputedStyle(el) : null;
    const jetzt = elementVorschau?.[schluessel]?.[eigenschaft] || (cs && farbeZuHex(cs.getPropertyValue(eigenschaft))) || "#000000";
    setFarbRad({ rolle: `${schluessel}|${eigenschaft}`, titel, start: vollHex(jetzt).toLowerCase(), element: { schluessel, eigenschaft },
      rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null, oben: !!r && r.top + r.height / 2 > window.innerHeight / 2 });
  }
  const liveElement = text => {
    let st = document.getElementById("farb-element-live");
    if (!st) { st = document.createElement("style"); st.id = "farb-element-live"; document.head.appendChild(st); }
    st.textContent = text;
  };
  const liveFarbe = hex => {
    if (!farbRad) return;
    if (farbRad.element) { liveElement(`${farbRad.element.schluessel}{${farbRad.element.eigenschaft}:${hex} !important}`); return; }
    const f = farbenAus(mitFestenSchriften(farbRad.basis, farbRad.rolle, hex));
    const root = document.documentElement.style;
    Object.entries(f).forEach(([k, v]) => root.setProperty("--" + k, v));
    setzeSystemLeiste(f.leiste);
  };
  const liveEntfernen = () => { const root = document.documentElement.style; Object.keys(F).forEach(k => root.removeProperty("--" + k)); setzeSystemLeiste(F.leiste); liveElement(""); };
  function farbRadAnwenden(hex) {
    const { rolle, ziel } = farbRad;
    const verlauf = [hex, ...(einstellungen.farbVerlauf || []).filter(x => x !== hex)].slice(0, 10);
    if (farbRad.element) {
      const { schluessel, eigenschaft } = farbRad.element;
      setElementVorschau(e => ({ ...(e || {}), [schluessel]: { ...(e?.[schluessel] || {}), [eigenschaft]: hex } }));
      speichereEinst({ ...einstellungen, farbVerlauf: verlauf });
      liveEntfernen(); setFarbRad(null); return;
    }
    if (ziel === "vorschau") { setFarbVorschau(f => mitFestenSchriften(f || farbRad.basis, rolle, hex)); speichereEinst({ ...einstellungen, farbVerlauf: verlauf }); }
    else speichereEinst({ ...einstellungen, farbVerlauf: verlauf,
      eigeneSchemata: eigeneSchemata.map(x => x.id === ziel ? { ...x, farben: mitFestenSchriften(x.farben, rolle, hex) } : x) });
    liveEntfernen(); setFarbRad(null);
  }
  function farbRadAbbrechen() { liveEntfernen(); setFarbRad(null); }
  // Farben des gerade bearbeiteten Schemas (Grundrollen + eigene Element-Farben), ohne Doppelte
  const farbenImSchema = () => {
    const sch = farbRad?.ziel && farbRad.ziel !== "vorschau" ? eigeneSchemata.find(x => x.id === farbRad.ziel) : null;
    const farben = sch ? sch.farben : (farbVorschau || schemaVon(einstellungen).farben);
    const elemente = sch ? sch.elemente : (elementVorschau || schemaVon(einstellungen).elemente);
    const alle = [...Object.values(farben || {}), ...Object.values(elemente || {}).flatMap(p => Object.values(p || {}))];
    return [...new Set(alle.filter(v => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)).map(v => vollHex(v).toLowerCase()))];
  };
  const farbRadUI = farbRad ? createPortal(
    <>
      {farbRad.rect && <div data-farbmodus-ui style={{position:"fixed", left: farbRad.rect.x - 3, top: farbRad.rect.y - 3, width: Math.max(farbRad.rect.w, 6) + 6, height: Math.max(farbRad.rect.h, 6) + 6,
        border:"2.5px dashed var(--falsch)", borderRadius:6, zIndex:10005, pointerEvents:"none", boxShadow:"0 0 0 2px var(--karte)"}}/>}
      <FarbRad key={farbRad.rolle + farbRad.start} titel={farbRad.titel} start={farbRad.start} verlauf={einstellungen.farbVerlauf || []} schema={farbenImSchema()} oben={farbRad.oben}
        beiLive={liveFarbe} beiAnwenden={farbRadAnwenden} beiAbbrechen={farbRadAbbrechen}/>
    </>, document.body) : null;

  // ── Farbmodus ──
  function starteFarbModus() {
    setFarbVorschau({ ...schemaVon(einstellungen).farben });
    setElementVorschau({ ...(schemaVon(einstellungen).elemente || {}) });
    setFarbModus(true); setSchemaBearbeiten(null);
  }
  function beendeFarbModus() { setFarbModus(false); setFarbVorschau(null); setElementVorschau(null); setFarbFeld(null); setFarbMarke(null); setFarbName(null); }
  // eigene Farbe einer Element-Art entfernen → wieder die Rolle
  function entferneElementFarbe(schluessel, eigenschaft) {
    setElementVorschau(e => {
      const p = { ...(e?.[schluessel] || {}) }; delete p[eigenschaft];
      const n = { ...(e || {}) }; if (Object.keys(p).length) n[schluessel] = p; else delete n[schluessel];
      return n;
    });
  }
  // „🎨 Farbe ändern“ aus einem Lang-Druck-Menü: Farbmodus an und gleich das Farbfeld dieser Stelle
  useEffect(() => {
    const hier = e => {
      const { x, y } = e.detail;
      if (!farbModusRef.current) starteFarbModus();
      setTimeout(() => setFarbFeld({ gruppen: farbRollenBei(x, y), zeit: Date.now(), y }), 80);
    };
    window.addEventListener("vokabel-farbe-hier", hier);
    return () => window.removeEventListener("vokabel-farbe-hier", hier);
  });
  function uebernehmeFarben(name = null) {
    const sch = schemaVon(einstellungen);
    if (FARB_VORLAGEN.includes(sch)) {
      if (name === null) { setFarbName(schemaName(sch.name)); setFarbFeld(null); return; }   // Vorlage: erst Namen für die Kopie
      const neu = { id: "eigen_" + Date.now(), name: name.trim() || schemaName(sch.name), basis: sch.id, dunkel: !!sch.dunkel, farben: { ...farbVorschau }, elemente: { ...(elementVorschau || {}) } };
      speichereEinst({ ...einstellungen, eigeneSchemata: [...eigeneSchemata, neu], farbschema: neu.id });
    } else {
      aendereEigenesSchema(sch.id, () => ({ farben: { ...farbVorschau }, elemente: { ...(elementVorschau || {}) } }));
    }
    beendeFarbModus();
  }
  // Farbrollen der Elemente im Umkreis von (x, y): je Element Hintergrund, Schrift, Rahmen bzw. bei Grafik Füllung, Linie
  function farbRollenBei(x, y) {
    const zuHex = farbeZuHex;
    // gleiche Farbe in mehreren Rollen (z. B. Weiß = Karten und Schrift auf Hauptfarbe): je nach Teil die naheliegende Rolle
    const VORZUG = { Schrift: ["auf-haupt", "auf-start", "text-stark", "text", "text2", "text3", "haupt", "falsch", "richtig"],
      Hintergrund: ["karte", "hintergrund", "flaeche", "haupt", "falsch", "gelb"], Füllung: ["karte", "haupt", "haupt-hell", "gelernt", "arbeit", "nie", "negativ"],
      "Ring/Linie": ["haupt-hell", "rahmen", "haupt"], Linie: ["rahmen", "text3", "haupt"], Rahmen: ["rahmen", "haupt", "falsch"] };
    const nachWert = (h, teil) => { if (!h) return null; const alle = Object.keys(F).filter(k => vollHex(F[k]).toLowerCase() === h);
      return (VORZUG[teil] || []).find(k => alle.includes(k)) || alle[0]; };
    const regeln = [];
    for (const sh of document.styleSheets) { try { regeln.push(...[...sh.cssRules].filter(r => r.selectorText)); } catch { /* fremdes Stylesheet */ } }
    const deklariert = (el, props) => {
      const st = el.getAttribute?.("style") || "";
      for (const p of props) { const m = st.match(new RegExp(`(?:^|;)\\s*${p}\\s*:[^;]*var\\(--([\\w-]+)\\)`)); if (m) return m[1]; }
      let gef = null;
      regeln.forEach(r => { let passt = false; try { passt = el.matches(r.selectorText); } catch { /* */ }
        if (passt) props.forEach(p => { const m = r.style.getPropertyValue(p).match(/var\(--([\w-]+)\)/); if (m) gef = m[1]; }); });
      return gef;
    };
    const elemente = new Set();
    for (const [dx, dy] of [[0, 0], [-14, 0], [14, 0], [0, -14], [0, 14], [-10, -10], [10, 10], [-10, 10], [10, -10]])
      document.elementsFromPoint(x + dx, y + dy).forEach(el => { if (!el.closest("[data-farbmodus-ui]") && el !== document.documentElement) elemente.add(el); });
    // kleine Grafiken (Mini-Kreise …): alle Teile mitnehmen – dünne Ringe trifft der Finger sonst kaum
    [...elemente].forEach(el => { const svg = el instanceof SVGElement ? el.ownerSVGElement || el : null;
      if (svg && svg.getBoundingClientRect().width <= 60) svg.querySelectorAll("circle, path, rect, line, polyline, text").forEach(t => elemente.add(t)); });
    const name = el => {
      const eigenerText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").trim();
      const t = el.tagName.toLowerCase();
      const info = el.closest("[data-info]")?.getAttribute("data-info");
      if (t === "body") return "Seite";
      if (["circle", "path", "rect", "line", "polyline", "text"].includes(t)) return `Grafik${info ? " · " + info.split(/[–:]/)[0].trim() : ""}`;
      return (eigenerText || info || el.textContent.trim() || t).slice(0, 34);
    };
    const gruppen = [];
    [...elemente].map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height).forEach(({ el, r }) => {
      const cs = getComputedStyle(el), teile = [];
      const svg = el instanceof SVGElement && el.tagName.toLowerCase() !== "svg";
      // Schrift ohne eigene Regel: von außen geerbte Rolle (z. B. Text im Start-Knopf), wenn die Farbe passt
      const geerbt = h => { for (let pe = el.parentElement, i = 0; pe && i < 4; pe = pe.parentElement, i++) { const r = deklariert(pe, ["color"]); if (r) return F[r] !== undefined && vollHex(F[r]).toLowerCase() === h ? r : null; } return null; };
      const dazu = (teil, wert, props) => { const h = zuHex(wert); if (!h) return; const rolle = (props && deklariert(el, props)) || (teil === "Schrift" && geerbt(h)) || nachWert(h, teil); if (rolle && F[rolle] !== undefined && !teile.some(t => t.rolle === rolle && t.teil === teil)) teile.push({ teil, rolle }); };
      if (svg) {
        if (cs.fill && cs.fill !== "none") dazu(el.tagName.toLowerCase() === "text" ? "Schrift" : "Füllung", cs.fill);
        if (cs.stroke && cs.stroke !== "none") dazu(el.tagName.toLowerCase() === "line" || el.tagName.toLowerCase() === "path" && cs.fill === "none" ? "Linie" : "Ring/Linie", cs.stroke);
      } else {
        dazu("Hintergrund", cs.backgroundColor, ["background", "background-color"]);
        if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) dazu("Schrift", cs.color, ["color"]);
        const seite = ["Top", "Right", "Bottom", "Left"].find(sd => parseFloat(cs[`border${sd}Width`]) > 0 && cs[`border${sd}Style`] !== "none");
        if (seite) dazu("Rahmen", cs[`border${seite}Color`], ["border", "border-color", `border-${seite.toLowerCase()}`, `border-${seite.toLowerCase()}-color`]);
      }
      if (teile.length && gruppen.length < 7) gruppen.push({ name: name(el), titel: elementName(el), el, teile, schluessel: elementSchluessel(el) });
    });
    return gruppen;
  }
  // langer Druck / Rechtsklick im Farbmodus → Farbfeld; Klicks direkt danach (Loslassen) werden verschluckt
  useEffect(() => {
    if (!farbModus) return;
    let timer = null, start = null, offenZeit = 0;
    const oeffne = (x, y) => { offenZeit = Date.now(); setFarbFeld({ gruppen: farbRollenBei(x, y), zeit: offenZeit, y }); setFarbMarke(null); };
    const ui = e => e.target.closest?.("[data-farbmodus-ui]");
    const runter = e => { if (ui(e)) return; const t = e.touches[0]; start = { x: t.clientX, y: t.clientY }; clearTimeout(timer); timer = setTimeout(() => oeffne(start.x, start.y), 500); };
    const bewegt = e => { const t = e.touches[0]; if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) clearTimeout(timer); };
    const hoch = e => { clearTimeout(timer); if (Date.now() - offenZeit < 600 && !ui(e)) e.preventDefault(); };
    const klick = e => { if (!ui(e) && Date.now() - offenZeit < 600) { e.preventDefault(); e.stopPropagation(); } };
    const kontext = e => { if (ui(e)) return; e.preventDefault(); e.stopPropagation(); oeffne(e.clientX, e.clientY); };
    document.addEventListener("touchstart", runter, true);
    document.addEventListener("touchmove", bewegt, true);
    document.addEventListener("touchend", hoch, { capture: true, passive: false });
    document.addEventListener("click", klick, true);
    document.addEventListener("contextmenu", kontext, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("touchstart", runter, true);
      document.removeEventListener("touchmove", bewegt, true);
      document.removeEventListener("touchend", hoch, { capture: true, passive: false });
      document.removeEventListener("click", klick, true);
      document.removeEventListener("contextmenu", kontext, true);
    };
  }, [farbModus]);   // eslint-disable-line react-hooks/exhaustive-deps
  const markiere = el => {
    const r = el.getBoundingClientRect();
    setFarbMarke({ x: r.left, y: r.top, w: Math.max(r.width, 6), h: Math.max(r.height, 6), zeit: Date.now() });
  };
  useEffect(() => {
    if (!farbMarke) return;
    const t = setTimeout(() => setFarbMarke(null), 1400);
    return () => clearTimeout(t);
  }, [farbMarke]);
  const rollenName = rolle => {
    const basis = FARB_BASIS[rolle] || rolle;
    const n = FARB_ROLLEN.find(([k]) => k === basis)?.[1] || basis;
    return FARB_BASIS[rolle] ? `${n} (abgestuft)` : n;
  };
  const farbModusUI = farbModus ? createPortal(
    <div data-farbmodus-ui>
      {farbMarke && !farbRad && <div style={{position:"fixed", left: farbMarke.x - 3, top: farbMarke.y - 3, width: farbMarke.w + 6, height: farbMarke.h + 6,
        border:"2.5px dashed var(--falsch)", borderRadius:6, zIndex:10004, pointerEvents:"none", boxShadow:"0 0 0 2px var(--karte)"}}/>}
      {farbFeld && !farbRad && (() => {
        // gegenüber der angetippten Stelle öffnen, damit das Element sichtbar bleibt; das kleinste Element bleibt markiert
        const oben = (farbFeld.y ?? 0) > window.innerHeight / 2;
        const ziel = farbFeld.gruppen[0]?.el?.getBoundingClientRect();
        return (
        <div className={`farbfeld-hintergrund${oben ? " oben" : ""}`} onClick={() => { if (Date.now() - farbFeld.zeit > 600) setFarbFeld(null); }}>
          {ziel && !farbMarke && <div data-farbfeld-ziel style={{position:"fixed", left: ziel.left - 3, top: ziel.top - 3, width: Math.max(ziel.width, 6) + 6, height: Math.max(ziel.height, 6) + 6,
            border:"2.5px dashed var(--falsch)", borderRadius:6, pointerEvents:"none", boxShadow:"0 0 0 2px var(--karte)"}}/>}
          <div className="farbfeld" data-farbfeld data-farbfeld-seite={oben ? "oben" : "unten"} onClick={e => e.stopPropagation()}>
            <div style={{display:"flex", alignItems:"center", marginBottom:6}}>
              <span style={{flex:1, fontWeight:800, color:"var(--text)"}}>🎨 Farben hier</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setFarbFeld(null)} {...ttFeld("Farbfeld schließen")}>Schließen</button>
            </div>
            {farbFeld.gruppen.length === 0 && <div style={{fontSize:"0.85rem", color:"var(--text2)"}}>Hier wurden keine Farben gefunden.</div>}
            {farbFeld.gruppen.map((g, gi) => (
              <div key={gi} style={{marginBottom:8}}>
                {g.teile.map(t => {
                  const basis = FARB_BASIS[t.rolle] || t.rolle;
                  const eig = TEIL_EIGENSCHAFT[t.teil];
                  const eigen = eig && elementVorschau?.[g.schluessel]?.[eig];
                  const titel = `${g.titel} · ${teilName(g.el, t.teil)}`;
                  const rolleAendern = () => { setFarbMarke(null); oeffneFarbRad(basis, `${rollenName(t.rolle)} – alle Stellen`, farbVorschau || schemaVon(einstellungen).farben, "vorschau", g.el); };
                  return (
                    <div key={t.teil + t.rolle}>
                      <div className="farb-zeile" data-farbfeld-zeile={basis} data-farbfeld-titel={titel} onPointerEnter={() => markiere(g.el)} onClick={rolleAendern}
                        {...ttFeld(`${titel}: ${eigen ? "eigene Farbe dieses Elements" : rollenName(t.rolle)} – antippen ändert die Rolle (alle Stellen)`)}>
                        <span className="farb-tupfer" style={{background: eigen || F[t.rolle]}}/>
                        <span style={{flex:1, minWidth:0, color:"var(--text)"}}>
                          <span style={{display:"block", fontSize:"0.88rem", fontWeight:700}}>{titel}</span>
                          <span className="farb-rolle" style={{display:"block", fontSize:"0.75rem", color:"var(--text2)"}}>{eigen ? <>eigene Farbe <span style={{color:"var(--text3)"}}>– sonst wie: {rollenName(t.rolle)}</span></> : <>gilt auch für: {rollenName(t.rolle)}</>}</span>
                        </span>
                      </div>
                      {eig && (
                        <div style={{display:"flex", gap:6, flexWrap:"wrap", margin:"2px 0 6px 30px"}}>
                          <button className="typ-btn" data-farbfeld-rolle={basis} onClick={rolleAendern}
                            {...ttFeld(`Rolle „${rollenName(t.rolle)}“ ändern – gilt für alle Stellen mit dieser Rolle`)}>Alle Stellen</button>
                          <button className="typ-btn" data-farbfeld-element={`${g.schluessel}|${eig}`}
                            onClick={() => { setFarbMarke(null); oeffneElementFarbRad(g.schluessel, eig, `${titel} – nur dieses Element`, g.el); }}
                            {...ttFeld("Nur diese Element-Art umfärben (alle gleichartigen Stellen), die Rolle bleibt")}>Nur dieses Element</button>
                          {eigen && <button className="typ-btn" data-farbfeld-zurueck={`${g.schluessel}|${eig}`} onClick={() => entferneElementFarbe(g.schluessel, eig)}
                            {...ttFeld(`Eigene Farbe entfernen – wieder „${rollenName(t.rolle)}“`)}>↺ Rolle</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{fontSize:"0.75rem", fontWeight:700, color:"var(--text2)", margin:"4px 0 2px"}}>System</div>
            <div className="farb-zeile" data-farbfeld-zeile="leiste" onClick={() => oeffneFarbRad("leiste", "App-Leiste (System)", farbVorschau || schemaVon(einstellungen).farben, "vorschau")}
              {...ttFeld("Leiste ganz oben (Uhrzeit, Akku) und unten – antippen, um die Farbe zu ändern")}>
              <span className="farb-tupfer" style={{background:"var(--leiste)"}}/>
              <span style={{flex:1, fontSize:"0.85rem", color:"var(--text)"}}><b>App-Leiste</b> · oben und unten (System)</span>
            </div>
          </div>
        </div>
        );
      })()}
      {farbName !== null && (
        <div className="farbfeld-hintergrund">
          <div className="farbfeld" data-farb-name onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:800, color:"var(--text)", marginBottom:6}}>Als eigenes Farbschema speichern</div>
            <div style={{fontSize:"0.8rem", color:"var(--text2)", marginBottom:8}}>Vorlagen bleiben unverändert – deine Farben kommen in eine Kopie.</div>
            <input {...ttFeld("Name des neuen Farbschemas")} className="inp" value={farbName} autoFocus onChange={e => setFarbName(e.target.value)}/>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFarbName(null)} {...tt("Zurück zum Farbmodus")}>Abbrechen</button>
              <button className="btn btn-primary" data-farb-name-speichern onClick={() => uebernehmeFarben(farbName)} {...tt("Farben als neues Schema speichern und den Farbmodus beenden")}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      <div className="farbmodus-leiste">
        <span style={{fontSize:"1rem", alignSelf:"center"}} {...ttFeld("Farbmodus: langer Druck auf ein Element ändert seine Farben")}>🎨</span>
        <button className="btn btn-ghost btn-sm" data-farbmodus-zuruecksetzen onClick={beendeFarbModus} {...ttFeld("Alle Änderungen verwerfen und den Farbmodus beenden")}>Zurücksetzen</button>
        <button className="btn btn-primary btn-sm" data-farbmodus-uebernehmen onClick={() => uebernehmeFarben()} {...ttFeld("Farben speichern und den Farbmodus beenden")}>Farben übernehmen</button>
      </div>
    </div>, document.body) : null;

  // Plätze des Listen-Rasters für die Listenauswahl in Quiz und Statistik: gleiche Spalten und Plätze
  // wie im Listen-Tab (leere Plätze bleiben frei); mit Sprachfilter zusammengerückt
  // 193: die geöffnete Ebene (Listen-Ordner) – Ordner kommen als { istOrdner } mit
  function listenRasterPlaetze(...args) { return listenRasterPlaetzeTeil({ listenIndex, listenOrdner, listenOrdnerOffen, minSpalten, sichtbareListen, sprachFilter }, ...args); }
  // 193: Listenauswahl (Quiz/Statistik) – Pfad über dem Raster (nur, wenn es Listen-Ordner gibt) und Ordner-Kacheln
  function listenAuswahlPfad(...args) { return listenAuswahlPfadTeil({ listenOrdner, listenOrdnerOffen, setListenOrdnerOffen, tt }, ...args); }
  function auswahlOrdnerZelle(...args) { return auswahlOrdnerZelleTeil({ listenIndex, listenOrdner, setListenOrdnerOffen, tt, vokabelAnzahl }, ...args); }

  // ── Beispielsätze ergänzen: Prompt für die nächste Portion, KI-Antwort einfügen, übernehmen ──
  async function oeffneSatzFenster(listeId) {
    setListenSaetze({ listeId, saetze: await saetzeLaden(listeId) });
    setSatzFenster({ listeId, antwort: "", meldung: "" });
    setModal("saetze");
  }
  function satzPortion(listeId, saetze, n) {
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
  async function uebernehmeSaetze(text) {
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
  // Sätze der Listen im Quiz-Tab für die Satz-Antwortarten bereithalten
  useEffect(() => {
    const ids = [...new Set([...quizTabListen, ...(aktiveListeId ? [aktiveListeId] : [])])];
    Promise.all(ids.map(id => saetzeLaden(id))).then(alle => { alle.forEach(x => Object.assign(SATZ_CACHE, x)); });
  }, [quizTabListen.join(), aktiveListeId, listenSaetze]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Sätze der geöffneten Liste laden
  useEffect(() => {
    if (ansicht !== "liste-detail" || !aktiveListeId || listenSaetze.listeId === aktiveListeId) return;
    saetzeLaden(aktiveListeId).then(saetze => setListenSaetze({ listeId: aktiveListeId, saetze }));
  }, [ansicht, aktiveListeId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Menü einer Liste (lang drücken auf die Kachel bzw. auf den Namen im Listenkopf); imKopf: ohne Verschieben/Auswählen
  function oeffneListeDetail(id) {
    setListeNurAus(false);
    setAktiveListeId(id); setTab("listen"); setAnsicht("liste-detail"); window.scrollTo(0, 0); vorigerListenBereich.current = null; setListenBereich(null);
  }
  function listenMenue(l, imKopf = false) {
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
  function listenWahlMenue(ids) {
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
  // Listen-Auswahl: die Knopfzeile oben wird zum grünen Bestätigen-Knopf („☑ n ausgewählt / ✓ Bestätigen“) – antippen beendet die Auswahl
  function listenWahlKopf(...args) { return listenWahlKopfTeil({ blitzt, exportKopiert, headerH, listenWahl, listenWahlMenue, setListenWahl, tt }, ...args); }
  // Einstellungen › Listen: angetippte Liste – Knopfzeile wird grün „‹Name› öffnen“, darunter die Info (wie bei den Quiz)
  function listeOeffnenKopf(...args) { return listeOeffnenKopfTeil({ blitzt, headerH, listenMenue, oeffneListeDetail, setListeVorschau, tt }, ...args); }
  function renderListeInfo(...args) { return renderListeInfoTeil({ einstellungen, gruppenKurz, infoKlapp, infoZu, lernstandJeArt, renderMiniKreise, satzStand, tt }, ...args); }
  // 193: Pfad über den Listen – „Alle Listen › 📁 A › 📁 B“ (gelb), lang drücken: neue Liste / neuer Ordner hier
  function listenNavi(...args) { return listenNaviTeil({ headerH, listenKopfH, listenOrdner, listenOrdnerOffen, pfadTeile, resetImport, setAnordnen, setAnsicht, setInGruppe, setListeVorschau, setListenAuswahl, setListenOrdnerOffen, setListenSortModus, setListenWahl, setTab }, ...args); }
  function renderListenRaster(...args) { return renderListenRasterTeil({ angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, einstellungen, gruppenZiel, lasso, lernstandJeArt, leuchte, listeVorschau, listenAuswahl, listenFlagge, listenIndex, listenMenue, listenOrdner, listenOrdnerOffen, listenSortModus, listenWahl, listenWahlMenue, loeseListenOrdnerAuf, minSpalten, neuListePlatzRef, oeffneListeDetail, plaetzeRef, renderMiniKreise, resetImport, satzStand, setAnsicht, setBlaettern, setInGruppe, setListeVorschau, setListenAuswahl, setListenOrdnerOffen, setListenSortModus, setListenWahl, setOrdnerUmbenennen, setTab, setVonBis, setzeListenPlaetze, sichtbareListen, slotDragId, slotDragZiel, slotGezogenRef, slotZiehenRef, sprachFilter, tt, verschiebeListenInOrdner, verweilGeht, vokabelAnzahl, wahlUmschaltenRef }, ...args); }

  // Chips "Gespeichert" (sortierbar) und "Verlauf" (automatisch, letzte 5) – Quiz- und Statistik-Tab
  // Kopfzeile Verlauf & Gespeichert (Quiz- und Statistik-Tab): zu und auf gleich aufgebaut – Name + Ü/D/A;
  // aufgeklappt zusätzlich eine Info-Zeile (Listen · Nr. · Anzahl). Langer Druck (Quiz): Speichern.
  // Mehrfach-Auswahl übernehmen: mehrere → Multiquiz einstellen, eine → laden, keine → Auswahl beenden
  function beendeMultiAuswahl(ids, onLaden) {
    if (ids.length >= 2) stelleMultiquizEin(ids);
    else { setMultiAuswahl(null); if (ids.length === 1) onLaden("gespeichert", ids[0]); }
  }
  // Speichern-Menü des Quiz (lang drücken auf den Quiz-Namen bzw. den Start-Knopf)
  function sessionSpeicherAktionen() {
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
  function renderSlotKopf(...args) { return renderSlotKopfTeil({ aktiverSlot, auswahlTafelDaten, beendeMultiAuswahl, blitzt, einListenName, getSlotEintrag, headerH, kopieName, ladeSlot, ladeSlotStatistik, lernstandJeArt, leuchte, listenAendern, listenFlagge, listenIndex, multiAuswahl, multiVonSlot, multiZusammenstellung, oeffneListeDetail, quizArt, quizBereichTyp, quizCheckboxAuswahl, quizErstellen, quizKombiListe, quizTabListen, quizVokMax, renderMiniKreise, sessionSpeicherAktionen, setErstellenFenster, setListenAendern, setListenAuswahlAufgeklappt, setLoescheSlotNr, setQuizListeAufgeklappt, setSlotSektionAufgeklappt, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setStatistikArt, sichtbareListen, slotOrdner, slotSektionAufgeklappt, slotSektionRef, slotVorschau, starteQuizErstellen, statistikAktiverSlot, statistikArt, statistikBasisVoks, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, statistikSlotGeleert, toggleSlotSektion, tt, vokabelgruppeGeaendert, vonBis, wechsleQuizArt }, ...args); }

  // Lernfortschritt je Art (Mini-Kreise) für eine Vokabelmenge; aus = keine passenden Vokabeln
  function lernstandJeArt(voks, listeId = null) {
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    voks = voks.filter(v => !v.herausgenommen);   // 176: zählen nicht mit
    return Object.fromEntries(QUIZ_ARTEN.map(a => {
      const sicht = statistikSicht(voks, a, listeId);
      return [a, { pct: lernProzent(sicht.map(v => v.fortschritt?.score), schwelle), aus: sicht.length === 0 }];
    }));
  }
  // Antwortarten einer Spalte: antippen wechselt sofort (die angetippte Art ersetzt die bisherigen); lang drücken › „☑ Mehrere wählen“:
  // dann schaltet antippen dazu/weg, mehrere → je Frage eine nach der Gewichtung; „Bestätigen“ im Zeilen-Knopf beendet die Mehrfach-Auswahl.
  // Akzente: Zusatz, der dazu- bzw. weggeschaltet wird; nur bei Fremdsprachen-Spalten und eingeschalteten Akzenten; mindestens eine Art außer Akzente bleibt an
  function renderModusKnoepfe(...args) { return renderModusKnoepfeTeil({ artenMehrfach, blitzt, einstellungen, leuchte, quizAntwortTypenGeordnet, quizAusgewaehlt, quizModus, quizSpalteModus, quizTabListen, setAntwortMehrfach, setArtenMehrfach, setQuizDiktatSpalte, setQuizSpalteModus, speichereEinst, tt, wechsleQuizArt }, ...args); }

  // Mini-Kreise Ü D A (zum Anzeigen; mit beiKlick zum Umschalten)
  function renderMiniKreise(...args) { return renderMiniKreiseTeil({ ttFeld }, ...args); }

  // Mehrfach-Auswahl bzw. Verschieben: Knöpfe an der Stelle von „＋ Neues Quiz“ / „Alle Listen“ / „＋ Neue Liste“ (gleiche Höhe – die Kacheln bleiben, wo sie sind)
  // geöffnete Gruppe: „← Alle Quiz › 📁 Name“ über dem „Neu“-Knopf
  // Pfad-Zeile über den Kacheln (immer): „Alle Quiz“ bzw. „← Alle Quiz › 📁 Name“; lang drücken: Neues Quiz, Fällige wiederholen;
  // rechts in der Mehrfach-Auswahl „Alle | Keine“, beim Verschieben „Fertig“ – die Zeile bleibt gleich hoch, nichts verrutscht
  // 193: Pfad „← Alle … › 📁 A › 📁 B“ (Quiz und Listen): antippen geht in die Ebene, lang drücken zeigt ihr Menü;
  // Kacheln auf einen Pfad-Teil ziehen legt sie dorthin (zielUnter: data-ordner-zurueck = oben, data-ordner-ziel = Ordner)
  function pfadTeile(...args) { return pfadTeileTeil({ slotDragId, slotDragZiel, tt }, ...args); }
  // 217/222: EIN Umschalt-Knopf in der Pfad-Zeile – zeigt, was im Raster steht („Listen“ bzw. „Quiz“), antippen wechselt;
  // so hoch wie der Pfad (zweizeiliger Pfad → zweizeilig hoher Knopf)
  function quizListenUmschalter(...args) { return quizListenUmschalterTeil({ auswahlListen, setAuswahlListen, setBlaettern, setMultiAuswahl, setSlotVorschau, tt }, ...args); }
  // 217: Pfad über den Listen in der Quiz-Auswahl
  function quizListenNavi(...args) { return quizListenNaviTeil({ headerH, listenOrdner, listenOrdnerOffen, pfadTeile, quizListenUmschalter, setBlaettern, setListenOrdnerOffen, setSlotVorschau, slotH, slotInfoH }, ...args); }
  // 217: Listen als Quiz-Kacheln – antippen fragt die Liste ab, kurz halten wählt nur (Blätter-Modus), Ordner antippen öffnet
  function uebernimmListe(id) {
    setBlaettern(false); setSlotVorschau(null); setSlotVorschauListe(false);
    ladeSlot("listen", id); leuchte("slotkopf");
  }
  function renderQuizListenRaster(...args) { return renderQuizListenRasterTeil({ FORTSCHRITT_FELD, aktiverSlot, auswahlOrdnerZelle, blaettern, blitzt, einstellungen, lernstandJeArt, leuchte, listenFlagge, listenRasterPlaetze, quizArt, setSlotVorschau, setSlotVorschauListe, slotVorschau, tt, uebernimmListe }, ...args); }
  function ordnerNavi(...args) { return ordnerNaviTeil({ einstellungen, faelligAktion, faelligAlle, faelligVonSlots, headerH, minSpalten, multiAuswahl, neuImOrdnerRef, pfadTeile, quizListenUmschalter, setAnordnen, setInGruppe, setModal, setMultiAuswahl, setNeueSessionSchritt, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSpaltenWahl, setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikFilter, setStatistikListenIds, setStatistikSlotGeleert, slotAuswahl, slotH, slotInfoH, slotOrdner, slotSichtbarRef, slotSortModus, slots, speichereEinst, tt }, ...args); }
  function wahlLeiste(...args) { return wahlLeisteTeil({ listenAuswahl, listenSortModus, listenWahl, multiAuswahl, setListenAuswahl, setListenSortModus, setListenWahl, setMultiAuswahl, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotSortModus, sichtbareListen, slotAuswahl, slotSichtbarRef, slotSortModus, tt }, ...args); }
  function renderSlotBereiche(...args) { return renderSlotBereicheTeil({ FORTSCHRITT_FELD, aktiverSlot, angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, chipStil, einstellungen, faelligAktion, faelligVonSlots, gruppenZiel, kopieName, lasso, lernstandJeArt, leuchte, loeseOrdnerAuf, minSpalten, multiAuswahl, multiVonSlot, neuImOrdnerRef, neuPlatzRef, plaetzeRef, quizAbfrageArt, quizArt, renderSlotChip, setAuswahlLoeschen, setBlaettern, setInGruppe, setListenAendern, setLoescheSlotNr, setModal, setMultiAuswahl, setNeueSessionSchritt, setOrdnerUmbenennen, setSlotAuswahl, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setVerlaufOffen, setVonBis, setzeSlotPlaetze, slotAuswahl, slotChipLabel, slotDragId, slotDragZiel, slotGezogenRef, slotOrdner, slotSichtbar, slotSichtbarRef, slotSortModus, slotVorschau, slotZiehenRef, slots, sprachFilter, starteMultiquiz, statistikArt, stelleMultiquizEin, tab, tt, ttFeld, uebernimmSlots, verlaufOffen, verschiebeInOrdner, verweilGeht, wahlUmschaltenRef }, ...args); }

  // Info-Fläche unter dem Quiz-Kopf: immer das Quiz, die oben steht (angetippt, sonst die geladene bzw. die aktuelle Auswahl)
  function infoEintrag(statistik) {
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
  // feststehend unter dem Kopf (Quiz und Vokabel-Liste scrollen darunter hindurch), mit dem Pfeil auf eine Zeile einklappbar (gespeichert);
  // „📋 Vokabeln ansehen“ hängt die enthaltenen Vokabeln mit Listen-Nr. darunter an (Lücken als Trennzeile)
  // Gruppen kurz und einzeilig: „● 112 ✓ · ● 98 in Arbeit · ● 2850 nie · ● 11 ✗“ – der Punkt in der Farbe des Balken-Abschnitts (185)
  function gruppenKurz(...args) { return gruppenKurzTeil({  }, ...args); }
  const infoKlapp = () => { if (!infoZu) setSlotVorschauListe(false); setInfoZu(!infoZu); };   // 219: zuklappen schließt auch die Vokabel-Liste
  function renderSlotInfo(...args) { return renderSlotInfoTeil({ FORTSCHRITT_FELD, einstellungen, getSlotEintrag, gruppenKurz, headerH, infoEintrag, infoKlapp, infoZu, lernstandJeArt, listenIndex, quizArt, renderMiniKreise, setSlotVorschauListe, slotH, slotInfoRefCb, slotVorschauListe, slots, statistikArt, tt }, ...args); }

  // Nach dem Quiz direkt zur Statistik: mit Quiz → deren Eintrag (ganze Vokabelgruppe),
  // sonst genau die Vokabeln dieser Runde
  // Nach einer Gruppen-Runde aus der Statistik: zurück in genau diese Statistik (Auswahl, Art, Filter unverändert)
  function zurueckZurStatistik() {
    setQuiz(null);
    setAnsicht("uebersicht");
    setTab("statistik");
  }

  // Runde verlassen: zurück ins Lernen, in die Statistik (Gruppen-Runde) oder zur Übersicht
  function verlasseRunde() { if (quiz?.ausLernen) zurueckZumLernen(); else if (quiz?.ausStatistik) zurueckZurStatistik(); else beendeQuiz(); }
  function zurueckZumLernen() {
    quizStufeRef.current = null;
    setQuiz(null);
    setAnsicht("uebersicht");
    setLernen(l => l && naechstesLernPaket(l));
  }

  function zurRundenStatistik(abschluss) {
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

  function brecheQuizAb() {
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

  function starteDiktat(force = false, overrideSlot = null, gruppe = null) {
    // gruppe (Set von Vokabel-IDs, Quiz aus der Statistik): einmalige Runde nur mit diesen Vokabeln –
    // Auswahl, Konfiguration und Quiz-Fortschritt bleiben unberührt; schlechteste zuerst, ohne Score-Grenze
    const reihenfolgeQ = gruppe ? "schlechteste" : quizReihenfolge;
    const maxScoreQ = gruppe ? "" : quizSchlechtesteMaxScore;
    const unbeantwortetQ = gruppe ? { schlechteste: true } : quizUnbeantwortetZuerst;
    const kombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : aktiveListe;
    if (!kombiListe) return;
    const isPakete = !gruppe && quizSessionModus === "pakete";
    if (isPakete && quizPaketGroesse == null) return;
    const effSlot = overrideSlot !== null ? overrideSlot : aktiverSlot;
    if (effSlot?.typ === "listen") speichereListenKonfig(effSlot.id);   // 217: Einstellungen der Liste merken
    if (!force && isPakete && sessionSlotAktiv && sessionSlotKonflikt() && effSlot?.typ !== 'gespeichert' && effSlot?.typ !== "listen") {
      setSessionUeberschreibenModal(true); return;
    }
    let voks = kombiListe.vokabeln.filter(v => v[quizDiktatSpalte]);
    if (gruppe) voks = voks.filter(v => gruppe.has(v.id));
    else if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      voks = voks.filter(v => quizCheckboxAuswahl.has(v.id));
    }
    const schwelleDiktat = einstellungen.gelerntSchwelle ?? 0;
    if (!gruppe && !quizGelerntEinschliessen && schwelleDiktat > 0)
      voks = voks.filter(v => gelerntScore(v, true) < schwelleDiktat || istFaellig(v.diktatFortschritt));
    const sessionGesamt = isPakete ? voks.length : 0;
    const sessionIds = isPakete ? voks.map(v => v.id) : null;
    if (isPakete) {
      const existingSlot = lsGet(SK.sessionAktiv);
      const konflikt = existingSlot && sessionSlotKonflikt();
      if (effSlot?.typ === 'gespeichert' || effSlot?.typ === "listen") {   // 217: Liste wie gespeichertes Quiz
        if (!force && vokabelgruppeGeaendert) { setGruppenAenderungsDialog(true); return; }
        if (!existingSlot || konflikt) {
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v.diktatFortschritt?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, effSlot.typ, effSlot.id);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          sessionDurchlaufStarten(existingSlot, voks, "diktatFortschritt");
        }
      } else {
        if (!existingSlot || konflikt || !effSlot || overrideSlot !== null) {
          const verlaufId = overrideSlot?.typ === 'verlauf' ? overrideSlot.id : erstelleVerlaufEintrag();
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v.diktatFortschritt?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'verlauf', verlaufId);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          sessionDurchlaufStarten(existingSlot, voks, "diktatFortschritt");
        }
      }
    }
    if (reihenfolgeQ === "schlechteste" && maxScoreQ !== "" && !isNaN(parseFloat(maxScoreQ))) {
      const threshold = parseFloat(maxScoreQ);
      const gelerntDabei = v => !gruppe && ((quizGelerntEinschliessen && schwelleDiktat > 0 && gelerntScore(v, true) >= schwelleDiktat) || istFaellig(v.diktatFortschritt));
      voks = voks.filter(v => gelerntDabei(v) || (v.diktatFortschritt?.score ?? 0) < threshold);
    }
    if (!gruppe && !quizHeuteEinschliessen && tagesSperre()) voks = voks.filter(v => !heuteAbgefragt(v.diktatFortschritt));   // 180: heute schon abgefragte nicht noch einmal
    voks = ordneVokabeln(voks, "diktatFortschritt", reihenfolgeQ, unbeantwortetQ);
    if (!gruppe) voks = mischeFaellige(voks, "diktatFortschritt");
    if (isPakete) voks = voks.slice(0, quizPaketGroesse);
    if (voks.length === 0) return;
    if (!isPakete && !gruppe) merkeRundeImVerlauf(effSlot, Object.fromEntries(voks.map(v => [v.id, v.fortschritt?.score ?? null])));
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setDiktatListeAufgeklappt(false);
    setDiktatManualPlays(0);
    diktatPlayCountRef.current = 0;
    setQuiz({
      modus: "diktat",
      diktatSpalte: quizDiktatSpalte,
      diktatUeberspalte: quizDiktatUebersetzung,
      liste: kombiListe, vokabeln: voks, index: 0,
      phase: "eingabe", eingabe: "", flash: false,
      diktatAufgedeckt: 0, diktatErgebnisse: [], feedback: "",
      sessionVokIds: isPakete ? voks.map(v => v.id) : null,
      istSessionModus: isPakete,
      ausStatistik: !!gruppe,   // Gruppen-Runde aus der Statistik: danach dorthin zurück
      sessionGesamt, sessionIds, scoreFeld: "diktatFortschritt", rundeStartZeit: Date.now(),
      rundeStartScores: Object.fromEntries(voks.map(v => [v.id, v.diktatFortschritt?.score ?? null])),
    });
    setAnsicht("quiz");
  }

  // Regeln der laufenden Runde: Stufe der Einstellungen; Quiz nach dem Lernen ("lernen"): Regeln wie Leicht,
  // wie Schwer oder ohne Hilfen (Standard; „Lernen einstellen“), aber nie ein Punktabzug –
  // eine einmalige Gelegenheit, den Score zu verbessern
  function quizRegeln() {
    if (quizStufeRef.current !== "lernen") return stufenRegeln(einstellungen);
    const qs = lernEinstellungen().quizStufe;
    const r = { ...stufenRegeln({ ...einstellungen, modus: qs === "einfach" ? "einfach" : "schwer" }), falschAbzug: false, aufdeckenAbzug: false };
    return qs === "ohne" ? { ...r, akzentHervorheben: false, akzentZaehler: false, akzenteTolerant: false } : r;
  }

  // stufe (optional): "lernen" = Quiz nach dem Lernen (nur Verbesserung möglich)
  function starteQuiz(force = false, overrideSlot = null, gruppe = null, stufe = null) {
    quizStufeRef.current = stufe;
    // gruppe (Set von Vokabel-IDs, Quiz aus der Statistik): einmalige Runde nur mit diesen Vokabeln –
    // Auswahl, Konfiguration und Quiz-Fortschritt bleiben unberührt; schlechteste zuerst, ohne Score-Grenze
    const reihenfolgeQ = gruppe ? "schlechteste" : quizReihenfolge;
    const maxScoreQ = gruppe ? "" : quizSchlechtesteMaxScore;
    const unbeantwortetQ = gruppe ? { schlechteste: true } : quizUnbeantwortetZuerst;
    if (quizModus === "diktat") { starteDiktat(force, overrideSlot, gruppe); return; }
    const kombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : aktiveListe;
    if (!kombiListe) return;
    const isPakete = !gruppe && quizSessionModus === "pakete";
    if (isPakete && quizPaketGroesse == null) return;
    const effSlot = overrideSlot !== null ? overrideSlot : aktiverSlot;
    if (effSlot?.typ === "listen") speichereListenKonfig(effSlot.id);   // 217: Einstellungen der Liste merken
    if (!force && isPakete && sessionSlotAktiv && sessionSlotKonflikt() && effSlot?.typ !== 'gespeichert' && effSlot?.typ !== "listen") {
      setSessionUeberschreibenModal(true); return;
    }
    const alleAbfragbar = quizModus === "rotierend"
      ? quizAusgewaehlt
      : [quizFrageTyp, ...quizAntwortTypenGeordnet].filter(Boolean);
    const sitzungsInfoTypen = [
      ...quizInfoTypenSession,
      ...TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv && quizZeigeInfo[t]),
    ];

    let voks = kombiListe.vokabeln.filter(v => !v.herausgenommen && alleAbfragbar.every(t => v[t]));

    if (gruppe) voks = voks.filter(v => gruppe.has(v.id));
    else if (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0) {
      voks = voks.filter(v => quizCheckboxAuswahl.has(v.id));
    }
    // Akzent-Spalten: Wörter ohne Akzent nur auf Wunsch – sonst wird für sie nur die Akzent-Spalte
    // übersprungen; ganz raus nur, wenn keine andere Antwortspalte bleibt. Reine Akzent-Abfrage nutzt den Akzent-Score
    const akzentOhneAuslassen = !quizRegeln().akzentOhneMischen;
    voks = voks.filter(v => antwortSpaltenFuer(v, quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet,
      quizSpalteModus, akzentOhneAuslassen).length > 0);
    const scoreFeld = quizModus !== "rotierend" && quizAntwortTypenGeordnet.length > 0
      && quizAntwortTypenGeordnet.every(t => quizSpalteModus[t] === "akzent") ? "akzentFortschritt" : "fortschritt";
    const gruppeVokIds = voks.map(v => v.id);   // ganze Vokabelgruppe inkl. Gelernter (für Lern-Bilanz)
    const schwelleQ = einstellungen.gelerntSchwelle ?? 0;
    if (!gruppe && !quizGelerntEinschliessen && schwelleQ > 0)
      voks = voks.filter(v => (v[scoreFeld]?.score ?? -Infinity) < schwelleQ || istFaellig(v[scoreFeld]));
    // Score-Grenze (Reihenfolge "schlechteste") gehört zur Quiz-Menge – wie die Anzeige im Quiz-Tab
    // eingeschaltete Gelernte gehören zur Quiz – die Score-Grenzen gelten für sie nicht
    const gelerntDabei = v => !gruppe && ((quizGelerntEinschliessen && schwelleQ > 0 && (v[scoreFeld]?.score ?? -Infinity) >= schwelleQ) || istFaellig(v[scoreFeld]));
    if (reihenfolgeQ === "schlechteste" && maxScoreQ !== "" && !isNaN(parseFloat(maxScoreQ))) {
      const threshold = parseFloat(maxScoreQ);
      voks = voks.filter(v => gelerntDabei(v) || (v[scoreFeld]?.score ?? 0) < threshold);
    }
    // Abfrage-Ziel Score (global): nur Vokabeln unter dem Ziel kommen in die Quiz
    if (!gruppe && abfrageZielModus === "score" && abfrageZielScoreTyp !== "session")
      voks = voks.filter(v => gelerntDabei(v) || (v[scoreFeld]?.score ?? 0) < abfrageZielScore);
    const nurAkzentQ = scoreFeld === "akzentFortschritt";
    if (nurAkzentQ && !gruppe) {
      const laufend = isPakete ? lsGet(SK.sessionAktiv) : null;
      const festeIds = laufend && !sessionSlotKonflikt() && Object.keys(laufend.startScores || {}).length > 0 ? new Set(Object.keys(laufend.startScores)) : null;
      voks = begrenzeOhneAkzent(voks, quizAntwortTypenGeordnet, festeIds);
    }

    const sessionGesamt = isPakete ? voks.length : 0;
    const sessionIds = isPakete ? voks.map(v => v.id) : null;

    if (isPakete) {
      const existingSlot = lsGet(SK.sessionAktiv);
      const konflikt = existingSlot && sessionSlotKonflikt();
      if (effSlot?.typ === 'gespeichert' || effSlot?.typ === "listen") {   // 217: Liste wie gespeichertes Quiz
        if (!force && vokabelgruppeGeaendert) { setGruppenAenderungsDialog(true); return; }
        if (!existingSlot || konflikt) {
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v[scoreFeld]?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, effSlot.typ, effSlot.id);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          sessionDurchlaufStarten(existingSlot, voks, scoreFeld);
        }
      } else {
        if (!existingSlot || konflikt || !effSlot || overrideSlot !== null) {
          const verlaufId = overrideSlot?.typ === 'verlauf' ? overrideSlot.id : erstelleVerlaufEintrag();
          const startScores = {};
          voks.forEach(v => { startScores[v.id] = v[scoreFeld]?.score ?? null; });
          speichereSessionSlotNeu(quizPaketGroesse, voks.length, startScores, 'verlauf', verlaufId);
        } else {
          voks = voks.filter(v => !new Set(existingSlot.abgefragt || []).has(v.id));
          sessionDurchlaufStarten(existingSlot, voks, scoreFeld);
        }
      }
    }

    if (!gruppe && !quizHeuteEinschliessen && tagesSperre()) voks = voks.filter(v => !heuteAbgefragt(v[scoreFeld]));   // 180: heute schon abgefragte nicht noch einmal
    voks = ordneVokabeln(voks, scoreFeld, reihenfolgeQ, unbeantwortetQ);
    if (!gruppe) voks = mischeFaellige(voks, scoreFeld);

    if (nurAkzentQ && quizRegeln().akzentOhneMischen) voks = verteileOhneAkzent(voks, quizAntwortTypenGeordnet);
    if (isPakete) voks = voks.slice(0, quizPaketGroesse);
    if (voks.length === 0) return;
    if (!isPakete && !gruppe) merkeRundeImVerlauf(effSlot, Object.fromEntries(voks.map(v => [v.id, v[scoreFeld]?.score ?? null])));

    function getFA(idx) {
      if (quizModus === "rotierend") {
        const ft = alleAbfragbar[idx % alleAbfragbar.length];
        return { frageTyp: ft, antwortTypen: alleAbfragbar.filter(t => t !== ft) };
      }
      return { frageTyp: quizFrageTyp, antwortTypen: quizAntwortTypenGeordnet };
    }

    const basisFA = getFA(0);   // ungefiltert; je Vokabel werden Akzent-Spalten ohne Akzent ggf. ausgelassen
    const frageTyp = basisFA.frageTyp;
    const antwortTypen = antwortSpaltenFuer(voks[0], basisFA.antwortTypen, quizSpalteModus, akzentOhneAuslassen, true);
    const erstesTeile = voks[0][antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    const spalteModus0 = loeseSpaltenModusAuf(quizSpalteModus, voks[0], frageTyp);
    const ersterModusTyp0 = spalteModus0[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const erstesMC = istMC(ersterModusTyp0)
      ? generiereButtons(voks, voks[0], antwortTypen[0], ersterModusTyp0) : null;

    const startScoresZiel = abfrageZielModus === "score" && abfrageZielScoreTyp === "session"
      ? Object.fromEntries(voks.map(v => [v.id, v[scoreFeld]?.score ?? 0]))
      : null;
    const abfrageZiel = abfrageZielModus !== "anzahl" || abfrageZielAnzahl > 1
      ? { modus: abfrageZielModus, anzahl: abfrageZielAnzahl, wiederholung: abfrageZielWiederholung,
          score: abfrageZielScore, scoreTyp: abfrageZielScoreTyp, runde: 0, startScoresZiel,
          ...(abfrageZielModus === "blitz" ? { sek: BLITZ_SEKUNDEN, ende: Date.now() + BLITZ_SEKUNDEN * 1000 } : {}) }
      : null;

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const neuQuiz = {
      sitzungsInfoTypen, modus: quizModus, spalteModus: spalteModus0, spalteModusBasis: quizSpalteModus,
      liste: kombiListe, vokabeln: voks, index: 0,
      frageTyp, antwortTypen, antwortTypIndex: 0, basisFA, akzentOhneAuslassen,
      phase: "eingabe", eingabe: "", flash: false, infoSichtbar: false, synSichtbar: false, infoSeite: 0,
      antwortTeile: erstesTeile, weitereIndices: [], weiterePos: 0,
      mcButtons: erstesMC?.buttons || [], mcRichtig: erstesMC?.richtig || [],
      vorigeAntworten: [], sessionFalsch: {}, feedback: "", mcWechsel: false,
      aktuelleFehlversuche: 0, falschFlash: false, richtigMap: {}, spaltenErgebnisse: {}, vokErgebnis: null, gewertet: {},
      quizRichtigAnzahl: 0, quizFalschAnzahl: 0,
      sessionVokIds: isPakete ? voks.map(v => v.id) : null,
      istSessionModus: isPakete,
      ausStatistik: !!gruppe,   // Gruppen-Runde aus der Statistik: danach dorthin zurück
      sessionGesamt, sessionIds, abfrageZiel,
      rundeStartScores: Object.fromEntries(voks.map(v => [v.id, v[scoreFeld]?.score ?? null])), rundeStartZeit: Date.now(),
      gruppeVokIds, scoreFeld,
      ...(abfrageZiel?.modus === "blitz" || abfrageZiel?.modus === "serie" ? { spielZaehler: 0, spielBeantwortet: [], spielBasis: voks } : {}),
    };
    // Zuordnung: Runden zu mehreren Vokabeln (Frage-Spalte + Antwort-Spalten, höchstens 4)
    const wechselnd = quizModus === "rotierend";
    const zuoTypen = wechselnd ? alleAbfragbar : quizAntwortTypenGeordnet;
    const mitZuo = !gruppe ? zuoTypen.filter(t => modiVon(quizSpalteModus[t]).some(istRunde)) : [];
    const nurZuordnung = mitZuo.length > 0 && zuoTypen.every(t => modiVon(quizSpalteModus[t]).every(istRunde));
    const rundenArten = mitZuo.length ? modiVon(quizSpalteModus[mitZuo[0]]).filter(istRunde) : [];
    if (mitZuo.length) {
      const ze = zuordnungEinst(einstellungen), r = quizRegeln();
      const grenze = Math.max(3, Math.min(window.innerWidth > 700 ? 12 : 10, Math.floor((window.innerHeight - 250) / 52)));
      const basis = { spalten: (wechselnd ? alleAbfragbar : [quizFrageTyp, ...quizAntwortTypenGeordnet]).slice(0, 4), wechselnd, paare: Math.max(3, Math.min(ze.paare, grenze)), zeit: ze.zeit, sek: ze.sek,
        amEnde: !!r.zuordnungAmEnde, abzug: !!r.zuordnungAbzug, runde: 0, arten: rundenArten };
      if (nurZuordnung) {
        neuQuiz.abfrageZiel = null;
        neuQuiz.zuordnung = { ...basis, queue: voks.map(v => v.id), beantwortet: [] };
        setQuiz(zuordnungRunde(neuQuiz));
      } else setQuiz(mitZuordnungMix({ ...neuQuiz, zuordnungMix: basis }));
    } else setQuiz(neuQuiz);
    setAnsicht("quiz");
  }

  // ── Zuordnung: nächste Runde aus der Warteschlange (nicht beantwortete kommen vorne wieder hinein) ──
  function zuordnungRunde(q) {
    const z = q.zuordnung;
    if (!z.queue.length) return { ...q, phase: "fertig" };
    const art = gewichtetWaehlen(z.arten?.length ? z.arten : ["zuordnung"]);
    const k = Math.min(art === "memory" ? Math.min(z.paare, 8) : z.paare, z.queue.length);
    return zuordnungRundeAus({ ...q, zuordnung: { ...z, queue: z.queue.slice(k) } }, z.queue.slice(0, k), art);
  }
  function zuordnungRundeAus(q, ids, art = "zuordnung") {
    const z = q.zuordnung, k = ids.length;
    const alleSpalten = z.alleSpalten || z.spalten;
    const fremdSp = alleSpalten.find(t => t.startsWith("E"));
    const spalten = art !== "memory" ? alleSpalten : !fremdSp || alleSpalten.slice(0, 2).includes(fremdSp) ? alleSpalten.slice(0, 2) : [alleSpalten[0], fremdSp];
    const vok = id => q.vokabeln.find(v => v.id === id);
    const mische = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    // „wechselnd“: je Zeile zufällig, welche Spalte links steht (bei zwei Spalten: Seiten getauscht oder nicht)
    const n = spalten.length, dreh = Object.fromEntries(ids.map(id => [id, z.wechselnd ? Math.floor(Math.random() * n) : 0]));
    const karten = spalten.map((_, sp) => mische(ids.map(id => { const t = spalten[(sp + dreh[id]) % n]; return { id, typ: t, text: vok(id)?.[t]?.wert || "" }; })));
    // Memory: je Vokabel zwei verdeckte Karten (Frage und Antwort), gemischt
    const mKarten = art === "memory" ? mische(ids.flatMap(id => spalten.map((t, seite) => ({ id, seite, text: vok(id)?.[t]?.wert || "" })))) : null;
    return { ...q, phase: "zuordnung", zuordnung: { ...z, art, alleSpalten, spalten, ids, karten, mKarten, mOffen: [], mZuege: 0, runde: z.runde + 1,
      erledigt: {}, fehler: {}, offen: null, gruppen: [], offeneGruppe: null, blink: null, anzeige: null, zeitBis: art === "memory" ? null : zuordnungZeitBis({ ...z, spalten }, k) } };
  }
  // Memory: zwei Karten aufdecken; Frage + Antwort derselben Vokabel → Paar gefunden (+1), sonst nach kurzer Zeit wieder zu
  function memoryTippe(i) {
    const q = quiz, z = q?.zuordnung;
    if (!z || z.art !== "memory" || z.anzeige || z.mOffen.length >= 2) return;
    const k = z.mKarten[i];
    if (k.id in z.erledigt || z.mOffen.includes(i)) return;
    if (einstellungen.autoplay && z.spalten[k.seite].startsWith("E")) { const v = q.vokabeln.find(x => x.id === k.id); sprich(k.text, vokLang(v, z.spalten[k.seite])); }
    const offen = [...z.mOffen, i];
    if (offen.length < 2) { setQuiz({ ...q, zuordnung: { ...z, mOffen: offen } }); return; }
    const [a, b] = offen.map(x => z.mKarten[x]);
    if (a.id === b.id && a.seite !== b.seite) {
      let neu = zuordnungWerte({ ...q, zuordnung: { ...z, mOffen: [], mZuege: z.mZuege + 1, paarFarbe: { ...(z.paarFarbe || {}), [a.id]: Object.keys(z.paarFarbe || {}).length % ZUORDNUNG_FARBEN.length } } }, a.id, "richtig");
      if (neu.zuordnung.ids.every(id => id in neu.zuordnung.erledigt)) neu = zuordnungRundeEnde(neu);
      setQuiz(neu);
      return;
    }
    setQuiz({ ...q, zuordnung: { ...z, mOffen: offen, mZuege: z.mZuege + 1 } });
    setTimeout(() => setQuiz(prev => prev?.zuordnung?.mOffen?.length === 2 && prev.zuordnung.mOffen[1] === i ? { ...prev, zuordnung: { ...prev.zuordnung, mOffen: [] } } : prev), 1100);
  }
  function mitZuordnungMix(q) {
    if (!q?.zuordnungMix || q.phase !== "eingabe") return q;
    const typen = q.antwortTypen || [];
    const art = typen.map(t => q.spalteModus?.[t]).find(istRunde);
    if (!art) return q;
    const rest = q.vokabeln.length - q.index;
    if (rest < 3) {   // zu wenige für eine Runde: eine andere angehakte Art ziehen
      const sp = { ...q.spalteModus };
      typen.forEach(t => { if (!istRunde(sp[t])) return; const andere = modiVon(q.spalteModusBasis?.[t]).filter(x => !istRunde(x) && x !== "akzent"); sp[t] = andere.length ? gewichtetWaehlen(andere) : STANDARD_ANTWORT_MODUS; });
      const mc = istMC(sp[typen[0]]) ? generiereButtons(q.vokabeln, q.vokabeln[q.index], typen[0], sp[typen[0]]) : null;
      return { ...q, spalteModus: sp, ...(mc ? { mcButtons: mc.buttons, mcRichtig: mc.richtig } : {}) };
    }
    const k = Math.min(art === "memory" ? Math.min(q.zuordnungMix.paare, 8) : q.zuordnungMix.paare, rest);
    const ids = q.vokabeln.slice(q.index, q.index + k).map(v => v.id);
    const spalten = q.zuordnungMix.wechselnd ? q.zuordnungMix.spalten : [q.frageTyp, ...typen].slice(0, 4);
    return zuordnungRundeAus({ ...q, zuordnung: { ...q.zuordnungMix, spalten, alleSpalten: spalten, mix: { start: q.index, ende: q.index + k }, queue: [],
      beantwortet: q.vokabeln.slice(0, q.index).map(v => v.id) } }, ids, art);
  }
  // gemischt, Runde zu Ende: Beantwortete bleiben an ihrer Stelle, offen Gebliebene kommen ans Ende; weiter mit der nächsten Frage
  function zuordnungMixWeiter(q) {
    const z = q.zuordnung, { start, ende } = z.mix;
    const runde = q.vokabeln.slice(start, ende);
    const fertig = runde.filter(v => v.id in z.erledigt), offen = runde.filter(v => !(v.id in z.erledigt));
    const vokabeln = [...q.vokabeln.slice(0, start), ...fertig, ...q.vokabeln.slice(ende), ...offen];
    return naechsteVokabelState({ ...q, vokabeln, index: start + fertig.length - 1, zuordnung: null, phase: "eingabe", vokErgebnis: null, erstbewertung: false });
  }
  function zuordnungZeitBis(z, k) {
    if (z.zeit === "aus") return null;
    const proVok = z.sek * (ZUORDNUNG_ZEITFAKTOR[z.spalten.length] || 1) * 1000;
    return Date.now() + (z.amEnde ? proVok * k : proVok);
  }
  // Ergebnis einer Vokabel speichern (nur vollständig Beantwortetes): richtig +1, falsch nach Regel −1
  function zuordnungWerte(q, id, ergebnis) {
    const lv = q.liste.vokabeln.find(v => v.id === id) || q.vokabeln.find(v => v.id === id);
    const r = quizRegeln();
    const neu = berechneNeuenScore(lv?.fortschritt, ergebnis, r.aufdeckenAbzug ? "schwer" : "einfach", q.zuordnung.abzug);
    const erst = !(id in (q.gewertet || {}));
    return { ...q, liste: speichereScore(q.liste, id, neu),
      gewertet: erst ? { ...(q.gewertet || {}), [id]: ergebnis } : q.gewertet,
      ...(ergebnis === "richtig" ? { richtigMap: { ...(q.richtigMap || {}), [id]: ((q.richtigMap || {})[id] || 0) + 1 } } : {}),
      ...(q.spielZaehler != null && ergebnis === "richtig" ? { spielZaehler: q.spielZaehler + 1 } : {}),
      quizRichtigAnzahl: (q.quizRichtigAnzahl || 0) + (erst && ergebnis === "richtig" ? 1 : 0),
      quizFalschAnzahl: (q.quizFalschAnzahl || 0) + (erst && ergebnis !== "richtig" ? 1 : 0),
      zuordnung: { ...q.zuordnung, erledigt: { ...q.zuordnung.erledigt, [id]: ergebnis }, beantwortet: [...q.zuordnung.beantwortet, id] } };
  }
  // Rundenende: das Ergebnis bleibt stehen (✓ / ✗ je Paar), weiter mit „Weiter →“; „Lösung zeigen“ färbt die richtigen Paare.
  // Nicht Beantwortete kommen in der nächsten Runde wieder
  function zuordnungRundeEnde(q) {
    const z = q.zuordnung;
    const offen = z.ids.filter(id => !(id in z.erledigt));
    return { ...q, zuordnung: { ...z, queue: [...offen, ...z.queue], zeitBis: null, offen: null, offeneGruppe: null, anzeige: "ergebnis" } };
  }
  function zuordnungTippe(s, i) {
    const q = quiz, z = q?.zuordnung;
    if (!z || q.phase !== "zuordnung" || z.anzeige) return;
    const karte = z.karten[s][i];
    if (karte.id in z.erledigt) return;
    const kt = karte.typ || z.spalten[s];
    if (einstellungen.autoplay && kt.startsWith("E")) { const v = q.vokabeln.find(x => x.id === karte.id); sprich(karte.text, vokLang(v, kt)); }
    if (z.amEnde) {
      const nz = zuordnungGruppeTippe(z, s, i);
      const alles = nz.gruppen.length === nz.ids.length && nz.gruppen.every(g => Object.keys(g.wahl).length === nz.spalten.length);
      setQuiz(alles ? zuordnungPruefe({ ...q, zuordnung: nz }) : { ...q, zuordnung: nz });
      return;
    }
    const o = z.offen;
    if (!o) { setQuiz({ ...q, zuordnung: { ...z, offen: { id: karte.id, wahl: { [s]: i }, erst: s } } }); return; }
    if (o.wahl[s] === i) {   // dieselbe Karte nochmal: erste → Gruppe aufheben, sonst nur diese abwählen
      if (s === o.erst) { setQuiz({ ...q, zuordnung: { ...z, offen: null } }); return; }
      const wahl = { ...o.wahl }; delete wahl[s];
      setQuiz({ ...q, zuordnung: { ...z, offen: { ...o, wahl } } }); return;
    }
    if (s === o.erst && Object.keys(o.wahl).length === 1) {   // andere Karte in der Spalte der ersten: neu anfangen, kein Fehlgriff
      setQuiz({ ...q, zuordnung: { ...z, offen: { id: karte.id, wahl: { [s]: i }, erst: s } } }); return;
    }
    if (karte.id !== o.id) {   // Fehlgriff: zählt für die Vokabel der zuerst angetippten Karte
      setQuiz({ ...q, zuordnung: { ...z, fehler: { ...z.fehler, [o.id]: true }, blink: { s, i, t: Date.now() } } });
      setTimeout(() => setQuiz(prev => prev?.zuordnung?.blink?.s === s && prev.zuordnung.blink.i === i ? { ...prev, zuordnung: { ...prev.zuordnung, blink: null } } : prev), 650);
      return;
    }
    const wahl = { ...o.wahl, [s]: i };
    if (Object.keys(wahl).length < z.spalten.length) { setQuiz({ ...q, zuordnung: { ...z, offen: { ...o, wahl } } }); return; }
    // Gruppe vollständig
    let neu = zuordnungWerte({ ...q, zuordnung: { ...z, offen: null, paarFarbe: { ...(z.paarFarbe || {}), [o.id]: Object.keys(z.paarFarbe || {}).length % ZUORDNUNG_FARBEN.length } } },
      o.id, z.fehler[o.id] ? "falsch" : "richtig");
    if (z.zeit !== "aus") neu = { ...neu, zuordnung: { ...neu.zuordnung, zeitBis: zuordnungZeitBis(z, 1) } };
    if (neu.zuordnung.ids.every(id => id in neu.zuordnung.erledigt)) neu = zuordnungRundeEnde(neu);
    setQuiz(neu);
  }
  // „am Ende“: Karten bilden farbige Gruppen in Tipp-Reihenfolge; eingefärbte Karte antippen nimmt sie heraus
  function zuordnungGruppeTippe(z, s, i) {
    let gruppen = z.gruppen.map(g => ({ ...g, wahl: { ...g.wahl } }));
    let offen = z.offeneGruppe;
    const gi = gruppen.findIndex(g => g.wahl[s] === i);
    if (gi >= 0) {
      delete gruppen[gi].wahl[s];
      if (!Object.keys(gruppen[gi].wahl).length) { gruppen.splice(gi, 1); offen = offen === gi ? null : offen != null && offen > gi ? offen - 1 : offen; }
      else { if (gruppen[gi].erst === s) gruppen[gi].erst = Number(Object.keys(gruppen[gi].wahl)[0]); offen = gi; }
      return { ...z, gruppen, offeneGruppe: offen };
    }
    if (offen != null && gruppen[offen]) {
      gruppen[offen].wahl[s] = i;
      const voll = Object.keys(gruppen[offen].wahl).length === z.spalten.length;
      return { ...z, gruppen, offeneGruppe: voll ? null : offen };
    }
    const belegt = new Set(gruppen.map(g => g.farbe));
    const farbe = ZUORDNUNG_FARBEN.findIndex((_, k) => !belegt.has(k));
    gruppen.push({ wahl: { [s]: i }, erst: s, farbe: farbe < 0 ? gruppen.length % ZUORDNUNG_FARBEN.length : farbe });
    return { ...z, gruppen, offeneGruppe: gruppen.length - 1 };
  }
  // „Prüfen“ (oder Zeit abgelaufen bei „am Ende“): nur vollständige Gruppen zählen
  function zuordnungPruefe(q) {
    const z = q.zuordnung;
    let neu = q;
    const ergebnis = {};
    z.gruppen.forEach((g, gi) => {
      if (Object.keys(g.wahl).length !== z.spalten.length) return;
      const ids = Object.entries(g.wahl).map(([sp, k]) => z.karten[sp][k].id);
      const erstId = z.karten[g.erst][g.wahl[g.erst]].id;
      const richtig = ids.every(id => id === ids[0]);
      ergebnis[gi] = richtig;
      if (!(erstId in neu.zuordnung.erledigt)) neu = zuordnungWerte(neu, erstId, richtig ? "richtig" : "falsch");
    });
    neu = { ...neu, zuordnung: { ...neu.zuordnung, geprueft: ergebnis } };
    return zuordnungRundeEnde(neu);
  }
  // Zeit abgelaufen
  useEffect(() => {
    const z = quiz?.zuordnung;
    if (quiz?.phase !== "zuordnung" || !z?.zeitBis || z.anzeige) return;
    const t = setTimeout(() => setQuiz(prev => {
      if (prev?.phase !== "zuordnung" || prev.zuordnung.anzeige || !prev.zuordnung.zeitBis || Date.now() < prev.zuordnung.zeitBis - 30) return prev;
      return prev.zuordnung.amEnde ? zuordnungPruefe(prev) : zuordnungRundeEnde(prev);
    }), Math.max(0, z.zeitBis - Date.now()));
    return () => clearTimeout(t);
  }, [quiz?.phase, quiz?.zuordnung?.zeitBis, quiz?.zuordnung?.anzeige]);   // eslint-disable-line react-hooks/exhaustive-deps


  function getAktVok() {
    if (!quiz) return null;
    const vokId = quiz.vokabeln[quiz.index].id;
    return quiz.liste.vokabeln.find(v => v.id === vokId) || quiz.vokabeln[quiz.index];
  }

  // Berechnet den nächsten Vokabel-State als reines Objekt (kein setQuiz)
  // 175: abgeschlossene Vokabel in den Rückblick (ganze Runde; Zuordnung nicht)
  function mitRueckblick(prev) {
    const v = prev.vokabeln[prev.index];
    const rb = prev.rueckblick || [];
    if (!v || !prev.vokErgebnis || prev.phase === "zuordnung") return { ...prev, letzteWertung: null, versuche: {}, rueckIdx: null };
    const sp = t => prev.liste.spalten[t]?.name || t;
    const eintrag = { art: "quiz", vokId: v.id, frage: { typ: prev.frageTyp, label: sp(prev.frageTyp), wert: v[prev.frageTyp]?.wert || "" },
      antworten: (prev.vorigeAntworten || []).map(a => ({ ...a })), ergebnis: prev.vokErgebnis === "richtig" ? "richtig" : "falsch",
      wertung: prev.letzteWertung || null, zaehlt: prev.erstbewertung !== false };
    return { ...prev, rueckblick: [...rb, eintrag], letzteWertung: null, versuche: {}, rueckIdx: null };
  }
  function naechsteVokabelState(prev) {
    prev = mitRueckblick(prev);
    const sp = prev?.abfrageZiel?.modus, spiel = sp === "blitz" || sp === "serie";
    if (spiel && prev.vokErgebnis) {
      const richtig = prev.vokErgebnis === "richtig", id = prev.vokabeln[prev.index]?.id;
      prev = { ...prev, spielZaehler: (prev.spielZaehler || 0) + (richtig ? 1 : 0), spielBeantwortet: [...new Set([...(prev.spielBeantwortet || []), id])] };
      if (sp === "serie" && !richtig) return spielBeenden(prev);
    }
    if (spiel && prev.index + 1 >= prev.vokabeln.length) {
      const basis = prev.spielBasis || prev.vokabeln, b = [...basis];
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      prev = { ...prev, vokabeln: [...prev.vokabeln, ...b] };
    }
    return mitZuordnungMix(naechsteVokabelState0(prev));
  }
  // Blitzrunde / Serie zu Ende: Rekord je Art und Quiz (bzw. Liste) festhalten
  function spielBeenden(q) {
    const art = q.abfrageZiel?.modus, n = q.spielZaehler || 0;
    const key = `${art}|${aktiverSlot?.typ === "gespeichert" ? aktiverSlot.id : (q.liste?.id || "liste")}`;
    let rekorde = {};
    try { rekorde = JSON.parse(localStorage.getItem(REKORDE_KEY)) || {}; } catch { /* leer */ }
    const alt = rekorde[key] || 0;
    if (n > alt) { rekorde[key] = n; try { localStorage.setItem(REKORDE_KEY, JSON.stringify(rekorde)); } catch { /* egal */ } }
    return { ...q, phase: "spielEnde", spielRekord: { alt, neu: n > alt },
      ...(q.istSessionModus ? { sessionVokIds: q.spielBeantwortet || [] } : {}) };
  }
  // Blitzrunde: Zeit abgelaufen
  useEffect(() => {
    const ende = quiz?.abfrageZiel?.modus === "blitz" ? quiz.abfrageZiel.ende : null;
    if (!ende || quiz.phase === "spielEnde" || quiz.phase === "fertig") return;
    const t = setTimeout(() => setQuiz(prev => prev && prev.abfrageZiel?.modus === "blitz" && prev.phase !== "spielEnde" && prev.phase !== "fertig" ? spielBeenden(prev) : prev),
      Math.max(0, ende - Date.now()));
    return () => clearTimeout(t);
  }, [quiz?.abfrageZiel?.ende, quiz?.phase === "spielEnde"]);   // eslint-disable-line react-hooks/exhaustive-deps
  function naechsteVokabelState0(prev) {
    const naechsterIdx = prev.index + 1;
    const aktVokId = prev.vokabeln[prev.index]?.id;
    const warRichtig = prev.vokErgebnis === "richtig";
    const richtigMap = (prev.abfrageZiel?.modus === "wiederholung" && aktVokId && warRichtig)
      ? { ...(prev.richtigMap || {}), [aktVokId]: ((prev.richtigMap || {})[aktVokId] || 0) + 1 }
      : (prev.richtigMap || {});
    // Auswertung zählt jede Vokabel einmal (erste Bewertung der Runde); Wiederholungen nicht
    const zaehlt = prev.erstbewertung !== false;
    const quizRichtigAnzahl = (prev.quizRichtigAnzahl || 0) + (zaehlt && warRichtig ? 1 : 0);
    const quizFalschAnzahl = (prev.quizFalschAnzahl || 0) + (zaehlt && !warRichtig ? 1 : 0);

    function getFA(voks, idx) {
      const basis = prev.basisFA || { frageTyp: prev.frageTyp, antwortTypen: prev.antwortTypen };
      let fa = { frageTyp: basis.frageTyp, antwortTypen: basis.antwortTypen };
      if (prev.modus === "rotierend") {
        const alle = prev.basisFA ? [basis.frageTyp, ...basis.antwortTypen] : [...basis.antwortTypen, basis.frageTyp];   // = Reihenfolge wie beim Start
        const ft = alle[idx % alle.length];
        fa = { frageTyp: ft, antwortTypen: alle.filter(t => t !== ft) };
      }
      return { frageTyp: fa.frageTyp, antwortTypen: antwortSpaltenFuer(voks[idx], fa.antwortTypen, prev.spalteModusBasis || prev.spalteModus, prev.akzentOhneAuslassen, true) };
    }

    // Baut den State für vokabeln[idx] innerhalb von voks auf
    function starteVokabel(voks, idx, extra = {}) {
      const { frageTyp, antwortTypen } = getFA(voks, idx);
      const vok = voks[idx];
      const teile = vok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
      const sp = prev.spalteModusBasis ? loeseSpaltenModusAuf(prev.spalteModusBasis, vok, frageTyp) : prev.spalteModus;
      const mc = istMC(sp[antwortTypen[0]] || STANDARD_ANTWORT_MODUS) ? generiereButtons(voks, vok, antwortTypen[0], sp[antwortTypen[0]]) : null;
      return { ...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, index: idx,
        vokabeln: voks, frageTyp, antwortTypen, antwortTypIndex: 0,
        phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
        mcButtons: mc?.buttons || [], mcRichtig: mc?.richtig || [],
        vorigeAntworten: [], infoSichtbar: false, synSichtbar: false, infoSeite: 0, feedback: "",
        spalteModus: sp, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false,
        sessionFalsch: {}, ...extra };
    }

    if (naechsterIdx >= prev.vokabeln.length) {
      if (prev.abfrageZiel) {
        const ziel = prev.abfrageZiel;
        // Vor jedem Wiederholungs-Durchgang eine Zwischenkarte "Wiederholung" zeigen
        const wiederholungsStart = () => ({ phase: "wiederholungHinweis", wiederholungDurchgang: (prev.wiederholungDurchgang || 0) + 1 });
        if (ziel.modus === "anzahl" && ziel.runde < ziel.anzahl - 1) {
          const neuVoks = [...prev.vokabeln].sort(() => Math.random() - 0.5);
          return starteVokabel(neuVoks, 0, { abfrageZiel: { ...ziel, runde: ziel.runde + 1 } });
        }
        if (ziel.modus === "wiederholung") {
          const restVoks = prev.vokabeln.filter(v => (richtigMap[v.id] || 0) < ziel.wiederholung);
          if (restVoks.length > 0) {
            const neuVoks = [...restVoks].sort(() => Math.random() - 0.5);
            return starteVokabel(neuVoks, 0, wiederholungsStart());
          }
        }
        if (ziel.modus === "score" && ziel.scoreTyp === "session") {
          const restVoks = prev.vokabeln.filter(v => {
            const liveVok = prev.liste.vokabeln.find(lv => lv.id === v.id);
            const score = liveVok?.[prev.scoreFeld || "fortschritt"]?.score ?? 0;
            if (ziel.scoreTyp === "session") {
              const startScore = (ziel.startScoresZiel || {})[v.id] ?? 0;
              return (score - startScore) < ziel.score;
            }
            return score < ziel.score;
          });
          if (restVoks.length > 0) {
            const neuVoks = [...restVoks].sort(() => Math.random() - 0.5);
            return starteVokabel(neuVoks, 0, wiederholungsStart());
          }
        }
      }
      return {...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, phase: "fertig"};
    }

    const { frageTyp, antwortTypen } = getFA(prev.vokabeln, naechsterIdx);
    const naechsteVok = prev.vokabeln[naechsterIdx];
    const teile = naechsteVok[antwortTypen[0]]?.wert.split('/').map(s => s.trim()) || [];
    // je Vokabel neu auflösen (setzt auch einen MC-Wechsel der vorigen Frage zurück)
    const spalteModus = prev.spalteModusBasis ? loeseSpaltenModusAuf(prev.spalteModusBasis, naechsteVok, frageTyp)
      : prev.mcWechsel ? {...prev.spalteModus, [antwortTypen[0]]: "tippen"} : prev.spalteModus;
    const modusTyp0 = spalteModus[antwortTypen[0]] || STANDARD_ANTWORT_MODUS;
    const mc = istMC(modusTyp0) ? generiereButtons(prev.vokabeln, naechsteVok, antwortTypen[0], modusTyp0) : null;
    return {...prev, richtigMap, quizRichtigAnzahl, quizFalschAnzahl, spaltenErgebnisse: {}, vokErgebnis: null, erstbewertung: null, flash: false, index: naechsterIdx, frageTyp, antwortTypen, antwortTypIndex: 0,
      phase: "eingabe", eingabe: "", antwortTeile: teile, weitereIndices: [], weiterePos: 0,
      mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      vorigeAntworten: [], infoSichtbar: false, synSichtbar: false, infoSeite: 0, feedback: "",
      spalteModus, mcWechsel: false, aktuelleFehlversuche: 0, falschFlash: false};
  }

  // Setzt flash, wartet 500ms, führt dann advanceFn aus
  // Kurze Verzögerung vor der nächsten Vokabel; zwischen mehreren Antworten derselben Frage geht es sofort weiter
  function mitVerzoegerung(quizUpdates, advanceFn, ms) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (sofortWeiter(quiz)) {
      flashWeiterRef.current = null;
      setQuiz(prev => advanceFn({...prev, ...quizUpdates, flash: false, karteNeinFlash: false}));
      return;
    }
    flashWeiterRef.current = advanceFn;
    setQuiz(prev => ({...prev, ...quizUpdates}));
    flashTimerRef.current = setTimeout(beendeVerzoegerung, ms);
  }
  function mitFlash(quizUpdates, advanceFn) {
    mitVerzoegerung({...quizUpdates, flash: true, eingabe: ""}, advanceFn, 1000);
  }
  // Antippen während der Verzögerung: sofort weiter
  function beendeVerzoegerung() {
    const fn = flashWeiterRef.current;
    if (!fn) return;
    flashWeiterRef.current = null;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => prev && (prev.flash || prev.karteNeinFlash) ? fn({...prev, flash: false, karteNeinFlash: false}) : prev);
  }
  // Weitere Antworten derselben Frage offen → ohne Verzögerung weiterfragen
  const sofortWeiter = q => q.antwortTypIndex < q.antwortTypen.length - 1;

  // Aktuelle Spalte abschließen: Antwort (gewusst oder nicht) bleibt oben stehen, dann nächste Spalte bzw. Vokabel
  function weiterNachSpalte(prev, richtig) {
    const typ = prev.antwortTypen[prev.antwortTypIndex];
    const vorigeAntworten = [...prev.vorigeAntworten, {
      typ, wert: prev.antwortTeile.join(" / "), label: prev.liste.spalten[typ]?.name || typ, richtig, eingaben: prev.versuche?.[prev.antwortTypIndex] || [],
    }];
    const naechsterIdx = prev.antwortTypIndex + 1;
    if (naechsterIdx >= prev.antwortTypen.length) return naechsteVokabelState({...prev, vorigeAntworten, richtigAufgedeckt: false});
    const nt = prev.antwortTypen[naechsterIdx];
    const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
    const ntModus = prev.mcWechsel ? "mc" : (prev.spalteModus?.[nt] || STANDARD_ANTWORT_MODUS);
    const mc = istMC(ntModus) ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt, ntModus) : null;
    return {...prev, flash: false, karteNeinFlash: false, phase: "eingabe", eingabe: "", antwortTypIndex: naechsterIdx,
      antwortTeile: teile, mcButtons: mc?.buttons || prev.mcButtons, mcRichtig: mc?.richtig || prev.mcRichtig,
      weitereIndices: [], weiterePos: 0, infoSichtbar: false, richtigAufgedeckt: false,
      aktuelleFehlversuche: 0, falschFlash: false, feedback: "", vorigeAntworten};
  }

  // Score einmal pro Vokabel: Ergebnis je Antwort-Spalte sammeln, nach der letzten
  // Spalte auswerten (alle richtig → richtig, sonst falsch bzw. aufgedeckt)
  // Karten-Spalten, die per „Weiter“ übersprungen wurden, stehen auf „karte“: am Ende gilt ein gemeinsames Urteil (karteUrteil);
  // ist eine andere Spalte schon nicht gewusst, steht das Ergebnis fest; sonst fragt die letzte Spalte „Gewusst / Nicht gewusst“ (karteBewertungOffen)
  function spaltenAbschluss(ergebnis, karteUrteil = null) {
    const spaltenErgebnisse = { ...(quiz.spaltenErgebnisse || {}), [quiz.antwortTypIndex]: ergebnis };
    const letzte = quiz.antwortTypIndex >= quiz.antwortTypen.length - 1;
    if (!letzte || quiz.vokErgebnis) return { spaltenErgebnisse };
    const offen = Object.keys(spaltenErgebnisse).filter(i => spaltenErgebnisse[i] === "karte");
    if (offen.length) {
      if (karteUrteil) offen.forEach(i => { spaltenErgebnisse[i] = karteUrteil; });
      else if (quiz.antwortTypen.every((_, i) => spaltenErgebnisse[i] === "richtig" || spaltenErgebnisse[i] === "karte")) return { spaltenErgebnisse, karteBewertungOffen: true };
      else offen.forEach(i => { spaltenErgebnisse[i] = "richtig"; });
    }
    const alle = quiz.antwortTypen.map((_, i) => spaltenErgebnisse[i] || "aufgedeckt");
    const gesamt = liste => liste.every(e => e === "richtig") ? "richtig" : liste.includes("falsch") ? "falsch" : "aufgedeckt";
    const vokErgebnis = gesamt(alle);
    // Akzent-Spalten zählen nur für den eigenen Akzent-Score – gemischt gezogene Akzente zählen für die Übersetzung
    const istAkzent = i => { const t = quiz.antwortTypen[i]; return quiz.spalteModus?.[t] === "akzent" && !Array.isArray(quiz.spalteModusBasis?.[t]); };
    const normal = alle.filter((_, i) => !istAkzent(i));
    const akzent = alle.filter((_, i) => istAkzent(i));
    const aktVok = getAktVok();
    // Pro Vokabel und Runde zählt nur die erste Bewertung (Wiederholungen sind reines Üben).
    // Ausnahme Abfrage-Ziel "Score": dort muss jede Antwort zählen, sonst endet die Runde nie.
    const erstbewertung = !(aktVok.id in (quiz.gewertet || {}));
    const gewertet = erstbewertung ? { ...(quiz.gewertet || {}), [aktVok.id]: vokErgebnis } : quiz.gewertet;
    if (!erstbewertung && quiz.abfrageZiel?.modus !== "score") return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet, karteBewertungOffen: false };
    let liste = quiz.liste, sessionFalsch = quiz.sessionFalsch, gelerntBlitz = null;
    // 175: Stand vor der Antwort + Ergebnis je Teil – für das nachträgliche Umwerten
    const letzteWertung = { vorher: { fortschritt: aktVok.fortschritt, akzentFortschritt: aktVok.akzentFortschritt },
      normal: normal.length ? gesamt(normal) : null, akzent: akzent.length ? (gesamt(akzent) === "richtig" ? "richtig" : "aufgedeckt") : null,
      modus: quizRegeln().aufdeckenAbzug ? "schwer" : "einfach", falschAbzug: quizRegeln().falschAbzug };
    // Vokabel erreicht mit dieser Antwort die Gelernt-Schwelle → Karte leuchtet kurz auf (Farbe „Gelernt-Effekt“) + Sternenregen
    const schwelle = einstellungen.gelerntSchwelle ?? 0;
    const erreicht = (vorher, nachher) => schwelle > 0 && (vorher?.score ?? -Infinity) < schwelle && (nachher?.score ?? -Infinity) >= schwelle;
    if (normal.length > 0) {
      const erg = gesamt(normal);
      const neuerCount = erg === "falsch" ? (quiz.sessionFalsch[aktVok.id] || 0) + 1 : 0;
      const neu = berechneNeuenScore(aktVok.fortschritt, erg, quizRegeln().aufdeckenAbzug ? "schwer" : "einfach", quizRegeln().falschAbzug);
      liste = speichereScore(liste, aktVok.id, neu);
      if (erreicht(aktVok.fortschritt, neu)) gelerntBlitz = blitzKey(quiz);
      if (erg === "falsch") sessionFalsch = { ...quiz.sessionFalsch, [aktVok.id]: neuerCount };
    }
    if (akzent.length > 0) {
      const neu = berechneDiktatScore(aktVok.akzentFortschritt, gesamt(akzent) === "richtig" ? "richtig" : "aufgedeckt", quizRegeln().falschAbzug);
      liste = speichereAkzentScore(liste, aktVok.id, neu);
      if (erreicht(aktVok.akzentFortschritt, neu)) gelerntBlitz = blitzKey(quiz);
    }
    return { spaltenErgebnisse, vokErgebnis, erstbewertung, gewertet, liste, sessionFalsch, karteBewertungOffen: false, letzteWertung, ...(gelerntBlitz ? { gelerntBlitz } : {}) };
  }

  // Akzent-Abfrage mit Wörtern ohne Akzent: nur so viele ohne Akzent wie eingestellt (Faktor × mit Akzent);
  // bevorzugt die mit schwächstem bzw. noch keinem Akzent-Score, bei Gleichstand zufällig.
  // festeIds: laufende Quiz – dann bleiben genau die Wörter ohne Akzent vom Quiz-Start
  function begrenzeOhneAkzent(voks, antwortTypen, festeIds = null) {
    const anteil = akzentOhneAnteil(einstellungen);
    if (!quizRegeln().akzentOhneMischen || anteil == null) return voks;
    const mitAkz = v => antwortTypen.some(t => hatAkzente(v[t]?.wert));
    const mit = voks.filter(mitAkz);
    const ohne = voks.filter(v => !mitAkz(v));
    const max = Math.round(mit.length * anteil);
    const kandidaten = festeIds ? ohne.filter(v => festeIds.has(v.id))
      : ohne.map(v => [v, Math.random()]).sort((a, b) => ((a[0].akzentFortschritt?.score ?? -Infinity) - (b[0].akzentFortschritt?.score ?? -Infinity)) || a[1] - b[1]).map(x => x[0]);
    const behalten = new Set(kandidaten.slice(0, max).map(v => v.id));
    return voks.filter(v => mitAkz(v) || behalten.has(v.id));
  }
  // Wörter ohne Akzent gleichmäßig zwischen die mit Akzent verteilen (Reihenfolge innerhalb bleibt)
  function verteileOhneAkzent(voks, antwortTypen) {
    const mitAkz = v => antwortTypen.some(t => hatAkzente(v[t]?.wert));
    const mit = voks.filter(mitAkz), ohne = voks.filter(v => !mitAkz(v));
    if (!mit.length || !ohne.length) return voks;
    const n = voks.length, erg = [];
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      if (b < ohne.length && (a >= mit.length || b < Math.round((i + 1) * ohne.length / n))) erg.push(ohne[b++]);
      else erg.push(mit[a++]);
    }
    return erg;
  }

  // Kennung der aktuellen Frage für das Gelernt-Aufleuchten (gilt nur für diese Karte)
  const blitzKey = q => `${q.wiederholungDurchgang || 0}|${q.index}|${q.vokabeln[q.index]?.id}`;

  function pruefeAntwort(eingabeArg) {
    const eingabe = (typeof eingabeArg === "string" ? eingabeArg : quiz?.eingabe || "").trim();
    if (!quiz || !eingabe) return;
    setQuiz(prev => prev ? { ...prev, versuche: { ...(prev.versuche || {}), [prev.antwortTypIndex]: [...(prev.versuche?.[prev.antwortTypIndex] || []), eingabe] } } : prev);   // 175

    // Modus "Einfach": fehlende/falsche Akzente zählen als richtig (mit Hinweis); ebenso, wenn die Akzente der Sprache aus sind
    const vokJetzt = quiz.vokabeln[quiz.index], spalteJetzt = quiz.antwortTypen[quiz.antwortTypIndex];
    const tolerant = quizRegeln().akzenteTolerant || (spalteJetzt?.startsWith("E") && !AKZENTE_FUER_LISTE(vokJetzt?._listeId ?? aktiveListeId));
    let akzentHinweis = false;

    function setzeRichtigAufgedeckt(updates) {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (sofortWeiter(quiz) && !akzentHinweis) { setQuiz(prev => weiterNachSpalte({...prev, ...updates}, true)); return; }
      setQuiz(prev => ({...prev, eingabe: "", phase: "aufgedeckt", flash: false,
        richtigAufgedeckt: true, feedback: akzentHinweis ? AKZENT_HINWEIS : "", falschFlash: false, aktuelleFehlversuche: 0, ...updates}));
    }

    if (quiz.phase === "weitere") {
      const erwartet = quiz.antwortTeile[quiz.weitereIndices[quiz.weiterePos]];
      const treffer = istRichtigeAntwort(eingabe, erwartet, tolerant);
      if (treffer) {
        if (treffer === "akzent") akzentHinweis = true;
        const naechstePos = quiz.weiterePos + 1;
        if (naechstePos >= quiz.weitereIndices.length) {
          // Alle "weitere" erledigt → Lösung zeigen, warten
          setzeRichtigAufgedeckt({});
        } else {
          // Nächstes "weitere" ohne Flash
          setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: akzentHinweis ? AKZENT_HINWEIS : ""}));
        }
      } else {
        setQuiz(prev => ({...prev, eingabe: "", phase: "weitere", feedback: "Nicht ganz – versuch nochmal."}));
      }
      return;
    }

    let matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t) === true);
    if (matchIdx === -1 && tolerant) {
      matchIdx = quiz.antwortTeile.findIndex(t => istRichtigeAntwort(eingabe, t, true));
      if (matchIdx !== -1) akzentHinweis = true;
    }

    if (matchIdx !== -1) {
      const abschluss = { ...spaltenAbschluss("richtig"), treffer: { k: `${quiz.index}|${quiz.antwortTypIndex}`, e: eingabe } };
      const restIndices = quiz.antwortTeile.map((_, i) => i).filter(i => i !== matchIdx);

      if (restIndices.length > 0) {
        // Mehrere Teile (was/were): direkt zu "weitere", Spalte gilt bereits als richtig
        setQuiz(prev => ({...prev, ...abschluss, eingabe: "", phase: "weitere", weitereIndices: restIndices, weiterePos: 0, feedback: akzentHinweis ? AKZENT_HINWEIS : ""}));
      } else {
        // Spalte fertig → Lösung zeigen, warten
        setzeRichtigAufgedeckt(abschluss);
      }
    } else {
      // Synonym statt des gesuchten Worts: kein Fehler, nochmal versuchen
      const synonyme = TYPEN.filter(x => x.startsWith("i") && istSynonymSpalte(quiz.liste.spalten[x])).flatMap(x => synonymeAus(vokJetzt?.[x]?.wert));
      if (synonyme.some(s => istRichtigeEinzeln(eingabe, s, true))) {
        setQuiz(prev => ({...prev, eingabe: "", feedback: "Synonym – gesucht ist ein anderes Wort. Nochmal versuchen."}));
        return;
      }
      const neueFehlversuche = (quiz.aktuelleFehlversuche || 0) + 1;
      if (neueFehlversuche >= 3) {
        // 3. Fehlversuch: Spalte falsch, Lösung automatisch anzeigen
        const abschluss = spaltenAbschluss("falsch");
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, ...abschluss, eingabe: "", phase: "aufgedeckt", flash: false,
          feedback: "", falschFlash: false, aktuelleFehlversuche: 0}));
      } else {
        // 1. oder 2. Fehlversuch: kurz rot aufleuchten, dann zurück
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setQuiz(prev => ({...prev, eingabe: "", falschFlash: true,
          feedback: "Nicht richtig.", aktuelleFehlversuche: neueFehlversuche}));
        flashTimerRef.current = setTimeout(() => {
          setQuiz(prev => ({...prev, falschFlash: false, feedback: ""}));
        }, 1500);
      }
    }
  }

  function klickeButton(idx) {
    if (!quiz || quiz.flash) return;
    const btn = quiz.mcButtons[idx];
    if (!btn || btn.status === "richtig") return;

    if (btn.korrekt) {
      const neueButtons = quiz.mcButtons.map((b, i) => i === idx ? {...b, status: "richtig"} : b);
      const alleGefunden = neueButtons.filter(b => b.korrekt).every(b => b.status === "richtig");

      if (alleGefunden) {
        // Nach einem Fehlklick darf weitergesucht werden – die Spalte zählt aber als nicht gewusst
        const fehlklick = quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] === "falsch";
        const abschluss = spaltenAbschluss(fehlklick ? "falsch" : "richtig");
        if (!fehlklick && sofortWeiter(quiz)) { setQuiz(prev => weiterNachSpalte({...prev, ...abschluss, mcButtons: neueButtons}, true)); return; }
        setQuiz(prev => ({
          ...prev, ...abschluss, mcButtons: neueButtons,
          phase: "aufgedeckt", flash: false, richtigAufgedeckt: !fehlklick,
          feedback: fehlklick ? MC_FEHLKLICK_HINWEIS : "",
        }));
      } else {
        setQuiz(prev => ({...prev, mcButtons: neueButtons}));
      }
    } else {
      setQuiz(prev => ({...prev,
        versuche: { ...(prev.versuche || {}), [prev.antwortTypIndex]: [...(prev.versuche?.[prev.antwortTypIndex] || []), btn.text] },   // 175
        spaltenErgebnisse: { ...(prev.spaltenErgebnisse || {}), [prev.antwortTypIndex]: "falsch" },
        mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "falsch"} : b)}));
      setTimeout(() => {
        setQuiz(prev => ({...prev, mcButtons: prev.mcButtons.map((b, i) => i === idx ? {...b, status: "neutral"} : b)}));
      }, 500);
    }
  }

  function zeigeLosung() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Fehlklick bei Multiple Choice bleibt "falsch", auch wenn danach die Lösung angezeigt wird
    const schonFalsch = quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] === "falsch";
    const abschluss = spaltenAbschluss(schonFalsch ? "falsch" : "aufgedeckt");
    const aktModus = quiz.spalteModus?.[quiz.antwortTypen?.[quiz.antwortTypIndex]] || STANDARD_ANTWORT_MODUS;
    const mcUpd = istMC(aktModus)
      ? { mcButtons: quiz.mcButtons.map(b => b.korrekt ? {...b, status: "richtig"} : b) }
      : {};
    setQuiz(prev => ({...prev, ...abschluss, eingabe: "", flash: false, phase: "aufgedeckt",
      feedback: "", falschFlash: false, aktuelleFehlversuche: 0, ...mcUpd}));
  }

  function ueberspringeWeitere() {
    const naechstePos = quiz.weiterePos + 1;
    if (naechstePos >= quiz.weitereIndices.length) {
      mitFlash({}, prev => weiterNachSpalte(prev, true));
    } else {
      setQuiz(prev => ({...prev, eingabe: "", weiterePos: naechstePos, feedback: ""}));
    }
  }

  function wechsleZuMC() {
    const typ = quiz?.antwortTypen?.[quiz.antwortTypIndex];
    const aktuellerModus = quiz?.spalteModus?.[typ] || STANDARD_ANTWORT_MODUS;
    if (!quiz || !typ || aktuellerModus !== "tippen") return;
    const mc = generiereButtons(quiz.liste.vokabeln, quiz.vokabeln[quiz.index], typ);
    setQuiz(prev => ({
      ...prev, antwortModus: "mc", mcWechsel: true,
      spalteModus: {...prev.spalteModus, [typ]: "mc"},
      mcButtons: mc.buttons, mcRichtig: mc.richtig,
      phase: "eingabe", eingabe: "", feedback: "",
    }));
  }

  // 175: Bewertung einer früheren Karte der Runde ändern (nur richtig ↔ falsch). Score: Stand vor der Antwort wiederherstellen
  // und alle späteren Wertungen derselben Vokabel neu rechnen; Rundenzählung, Wiederholungs-Zähler und Diktat-Ergebnis mitziehen
  function umwerten(i) {
    setQuiz(prev => {
      const rb = [...(prev?.rueckblick || [])], e = rb[i];
      if (!e) return prev;
      const neu = e.ergebnis === "richtig" ? "falsch" : "richtig", ja = neu === "richtig";
      const w0 = e.wertung;
      rb[i] = { ...e, ergebnis: neu, umgewertet: !e.umgewertet,
        antworten: e.antworten.map(a => ({ ...a, richtig: ja })),
        wertung: w0 ? { ...w0, ...(w0.normal != null ? { normal: ja ? "richtig" : "falsch" } : {}), ...(w0.akzent != null ? { akzent: ja ? "richtig" : "aufgedeckt" } : {}),
          ...(w0.diktat != null ? { diktat: ja ? "richtig" : "aufgedeckt" } : {}) } : null };
      let liste = prev.liste, extra = {};
      if (w0) {
        const stand = { ...w0.vorher };
        for (let j = i; j < rb.length; j++) {
          const x = rb[j];
          if (x.vokId !== e.vokId || !x.wertung) continue;
          const w = { ...x.wertung, vorher: { ...x.wertung.vorher, ...stand } };
          rb[j] = { ...x, wertung: w };
          if (w.normal != null) stand.fortschritt = berechneNeuenScore(w.vorher.fortschritt, w.normal, w.modus, w.falschAbzug);
          if (w.akzent != null) stand.akzentFortschritt = berechneDiktatScore(w.vorher.akzentFortschritt, w.akzent, w.falschAbzug);
          if (w.diktat != null) stand.diktatFortschritt = berechneDiktatScore(w.vorher.diktatFortschritt, w.diktat, w.falschAbzug);
        }
        if (w0.normal != null) liste = speichereScore(liste, e.vokId, stand.fortschritt);
        if (w0.akzent != null) liste = speichereAkzentScore(liste, e.vokId, stand.akzentFortschritt);
        if (w0.diktat != null) liste = speichereDiktatScore(liste, e.vokId, stand.diktatFortschritt);
      }
      if (e.zaehlt && e.art === "quiz") {
        extra.quizRichtigAnzahl = Math.max(0, (prev.quizRichtigAnzahl || 0) + (ja ? 1 : -1));
        extra.quizFalschAnzahl = Math.max(0, (prev.quizFalschAnzahl || 0) + (ja ? -1 : 1));
        extra.gewertet = { ...(prev.gewertet || {}), [e.vokId]: neu };
      }
      if (e.art === "diktat" && e.diktatIdx != null && prev.diktatErgebnisse?.[e.diktatIdx])
        extra.diktatErgebnisse = prev.diktatErgebnisse.map((d, k) => k === e.diktatIdx ? { ...d, richtig: ja } : d);
      let vokabeln = prev.vokabeln;
      if (prev.abfrageZiel?.modus === "wiederholung") {
        const rm = { ...(prev.richtigMap || {}) };
        rm[e.vokId] = Math.max(0, (rm[e.vokId] || 0) + (ja ? 1 : -1));
        extra.richtigMap = rm;
        // falsch → richtig: eine noch geplante Wiederholung dieser Vokabel im laufenden Durchgang entfällt
        if (ja && rm[e.vokId] >= prev.abfrageZiel.wiederholung) vokabeln = vokabeln.filter((v, k) => k <= prev.index || v.id !== e.vokId);
      }
      return { ...prev, ...extra, liste, vokabeln, rueckblick: rb };
    });
  }
  // Wischen im Quiz: nach rechts = eine Karte zurück, nach links = vorwärts bis zur aktuellen
  function rueckblickWischen(richtung) {
    setQuiz(prev => {
      const n = prev?.rueckblick?.length || 0;
      if (!n || !["eingabe", "aufgedeckt", "weitere", "richtig"].includes(prev.phase) || prev.flash || prev.karteNeinFlash) return prev;
      const akt = prev.rueckIdx ?? n, ziel = Math.max(0, Math.min(n, akt + richtung));
      return ziel === akt ? prev : { ...prev, rueckIdx: ziel >= n ? null : ziel };
    });
  }
  function renderRueckblick(...args) { return renderRueckblickTeil({ farbModusUI, farbRadUI, quiz, tt, umwerten }, ...args); }
  function naechsteVokabel() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Auch nach falscher/aufgedeckter Spalte die restlichen Spalten abfragen
    flashWeiterRef.current = null;
    if (quiz.phase === "aufgedeckt") {
      setQuiz(prev => weiterNachSpalte(prev, !!prev.richtigAufgedeckt));
    } else {
      setQuiz(prev => naechsteVokabelState(prev));
    }
  }

  // Zwischenkarte "Wiederholung": weiter zu den zu wiederholenden Vokabeln oder direkt zur Auswertung
  function starteWiederholung() {
    setQuiz(prev => prev?.phase === "wiederholungHinweis" ? mitZuordnungMix({...prev, phase: "eingabe"}) : prev);
  }
  function brecheWiederholungAb() {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => prev?.phase === "wiederholungHinweis" || prev?.wiederholungDurchgang
      ? {...prev, phase: "fertig", flash: false} : prev);
  }

  // Akzent-Modus: Auswahl gehört zu genau einer Vokabel-Spalte (Schlüssel), sonst Neustart mit Grundbuchstaben
  function akzentStand(q) {
    const typ = q.antwortTypen[q.antwortTypIndex];
    const vok = q.vokabeln[q.index];
    const key = `${vok?.id}|${q.antwortTypIndex}|${q.abfrageZiel?.runde || 0}|${q.wiederholungDurchgang || 0}`;
    const kacheln = akzentKacheln(ersteAlt(ohneHinweis(vok?.[typ]?.wert || "")));
    const a = q.akzent?.key === key ? q.akzent : null;
    return { key, typ, kacheln, wahl: a ? a.wahl : kacheln.map(k => k.basis), aktiv: a ? a.aktiv : null,
      geprueft: !!a?.geprueft, fehler: !!a?.fehler, blink: a ? a.blink : null, pruefFehler: !!a?.pruefFehler };
  }
  // Kachel braucht einen Akzent bzw. eine Ligatur (die von der Ligatur verbrauchte Kachel nicht)
  const kachelMitAkzent = k => k.richtig !== "" && k.richtig !== k.basis;
  // Fehlgriff: Kachel kurz rot aufleuchten lassen; zählt wie ein Fehlklick bei MC (Vokabel gilt als nicht gewusst)
  function akzentFehlgriff(s, i, extra = {}) {
    if (akzentBlinkRef.current) clearTimeout(akzentBlinkRef.current);
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, aktiv: null, fehler: true, blink: i, pruefFehler: s.pruefFehler, ...extra }}));
    akzentBlinkRef.current = setTimeout(() => {
      setQuiz(prev => prev?.akzent?.key === s.key ? {...prev, akzent: {...prev.akzent, blink: null}} : prev);
    }, 600);
  }
  function waehleAkzentKachel(i) {
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    const k = s.kacheln[i];
    if (s.wahl[i] === k.richtig && kachelMitAkzent(k)) return;   // schon richtig gesetzt
    // Akzent-Buchstaben hervorgehoben → Fehlgriff nur anzeigen, nicht als Fehler werten
    if (!kachelMitAkzent(k)) { akzentFehlgriff(s, i, quizRegeln().akzentHervorheben ? { fehler: s.fehler } : {}); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, fehler: s.fehler, blink: null, pruefFehler: s.pruefFehler, aktiv: s.aktiv === i ? null : i }}));
  }
  function setzeAkzentVariante(v) {
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    const i = s.aktiv;
    if (i == null) return;
    if (v !== s.kacheln[i].richtig) { akzentFehlgriff(s, i); return; }
    const wahl = [...s.wahl];
    wahl[i] = v;
    if (LIGATUR_TEILE[v]) wahl[i + 1] = "";
    // Alle Akzente gefunden → automatisch als Antwort übernehmen (falls in der Stufe eingestellt)
    if (quizRegeln().akzentAutoUebernahme && s.kacheln.every((k, j) => wahl[j] === k.richtig)) { schliesseAkzenteAb({ ...s, wahl }); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl, aktiv: null, fehler: s.fehler, blink: null, pruefFehler: s.pruefFehler }}));
  }
  function schliesseAkzenteAb(s) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const komplett = s.kacheln.every((k, i) => s.wahl[i] === k.richtig);
    const richtig = komplett && !s.fehler;
    const abschluss = spaltenAbschluss(richtig ? "richtig" : "falsch");
    if (richtig && sofortWeiter(quiz)) { setQuiz(prev => weiterNachSpalte({...prev, ...abschluss}, true)); return; }
    setQuiz(prev => ({...prev, ...abschluss, akzent: { key: s.key, wahl: s.wahl, aktiv: null, geprueft: true, fehler: s.fehler, blink: null },
      // richtig gelöst → Karte grün, auch nach Fehlgriff (zählt dann trotzdem als nicht gewusst, Hinweis rot)
      eingabe: "", phase: "aufgedeckt", flash: false, richtigAufgedeckt: komplett,
      feedback: richtig ? "" : komplett ? "Nicht fehlerfrei – richtig gelöst, zählt aber als nicht gewusst."
        : "Nicht ganz – rot markierte Buchstaben fehlen noch.", falschFlash: false, aktuelleFehlversuche: 0}));
  }
  // Prüfen: vollständig → abschließen; sonst fehlende Akzente rot markieren, korrigieren oder Lösung anzeigen
  function pruefeAkzente() {
    if (!quiz || quiz.phase !== "eingabe") return;
    const s = akzentStand(quiz);
    if (s.kacheln.every((k, i) => s.wahl[i] === k.richtig)) { schliesseAkzenteAb(s); return; }
    setQuiz(prev => ({...prev, akzent: { key: s.key, wahl: s.wahl, aktiv: null, fehler: true, blink: null, pruefFehler: true },
      feedback: "Nicht ganz – rot markierte Buchstaben korrigieren oder „Lösung anzeigen“."}));
  }

  function deckeKarteAuf() {
    if (!quiz || quiz.phase !== "eingabe") return;
    const typ = quiz.antwortTypen?.[quiz.antwortTypIndex];
    if ((quiz.spalteModus?.[typ] || STANDARD_ANTWORT_MODUS) !== "karte") return;
    setQuiz(prev => ({...prev, phase: "aufgedeckt", eingabe: "", flash: false, feedback: ""}));
  }

  // Mehrere Spalten: aufgedeckte Karte (nicht die letzte) → „Weiter“ ohne Pause; die nächste Karten-Spalte erscheint gleich aufgedeckt
  function karteWeiter() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashWeiterRef.current = null;
    setQuiz(prev => {
      const n = weiterNachSpalte({ ...prev, spaltenErgebnisse: { ...(prev.spaltenErgebnisse || {}), [prev.antwortTypIndex]: "karte" } }, null);
      const nt = n.antwortTypen?.[n.antwortTypIndex];
      return n.index === prev.index && n.antwortTypIndex === prev.antwortTypIndex + 1 && (n.spalteModus?.[nt] || STANDARD_ANTWORT_MODUS) === "karte"
        ? { ...n, phase: "aufgedeckt" } : n;
    });
  }
  function bewerteKarte(gewusst) {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const urteil = gewusst ? "richtig" : "falsch";
    if (quiz.karteBewertungOffen) {   // letzte Spalte schon beantwortet (z. B. Tastatur): das Urteil gilt für die Karten-Spalten
      const abschluss = spaltenAbschluss(quiz.spaltenErgebnisse?.[quiz.antwortTypIndex] || "richtig", urteil);
      setQuiz(prev => weiterNachSpalte({ ...prev, ...abschluss }, !!prev.richtigAufgedeckt));
      return;
    }
    const abschluss = spaltenAbschluss(urteil, urteil);

    if (gewusst) mitFlash(abschluss, prev => weiterNachSpalte(prev, true));
    else mitVerzoegerung({...abschluss, karteNeinFlash: true}, prev => weiterNachSpalte(prev, false), 800);
  }

  function pruefeDiktatAntwort() {
    if (!quiz || !quiz.eingabe.trim()) return;
    const aktVok = quiz.vokabeln[quiz.index];
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const treffer = istRichtigeAntwort(quiz.eingabe.trim(), wort, quizRegeln().akzenteTolerant || (quiz.diktatSpalte?.startsWith("E") && !AKZENTE_FUER_LISTE(aktVok._listeId ?? aktiveListeId)));
    const diktatVersuche = [...(quiz.diktatVersuche || []), quiz.eingabe.trim()];   // 175
    const diktatWertung = { vorher: { diktatFortschritt: aktVok.diktatFortschritt }, falschAbzug: true };
    if (treffer) {
      const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "richtig");
      const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
      const schwelle = einstellungen.gelerntSchwelle ?? 0;
      const gelerntBlitz = schwelle > 0 && (aktVok.diktatFortschritt?.score ?? -Infinity) < schwelle && neuFortschritt.score >= schwelle ? blitzKey(quiz) : null;
      const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: true };
      setQuiz(prev => ({
        ...prev, liste: neueListe, eingabe: "", phase: "richtig", flash: false, ...(gelerntBlitz ? { gelerntBlitz } : {}),
        diktatVersuche, diktatWertung: { ...diktatWertung, diktat: "richtig" }, diktatIdx: prev.diktatErgebnisse.length,
        diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis], feedback: treffer === "akzent" ? AKZENT_HINWEIS : "",
      }));
    } else {
      setQuiz(prev => ({
        ...prev, eingabe: "", diktatVersuche,
        diktatAufgedeckt: Math.min((prev.diktatAufgedeckt || 0) + 1, ohneHinweis(wort).length),
        feedback: "Nicht richtig – ein Buchstabe mehr aufgedeckt.",
      }));
    }
  }

  function zeigeDiktatLoesung() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const aktVok = quiz.vokabeln[quiz.index];
    const neuFortschritt = berechneDiktatScore(aktVok.diktatFortschritt, "aufgedeckt", quizRegeln().falschAbzug);
    const neueListe = speichereDiktatScore(quiz.liste, aktVok.id, neuFortschritt);
    const wort = aktVok[quiz.diktatSpalte]?.wert || "";
    const diktatWertung = { vorher: { diktatFortschritt: aktVok.diktatFortschritt }, falschAbzug: quizRegeln().falschAbzug, diktat: "aufgedeckt" };   // 175
    const ergebnis = { vokId: aktVok.id, wort, uebersetzung: aktVok[quiz.diktatUeberspalte]?.wert, richtig: false };
    setQuiz(prev => ({
      ...prev, liste: neueListe, eingabe: "", phase: "aufgedeckt", flash: false,
      diktatAufgedeckt: ohneHinweis(wort).length, diktatWertung, diktatIdx: prev.diktatErgebnisse.length,
      diktatErgebnisse: [...prev.diktatErgebnisse, ergebnis],
      feedback: "",
    }));
  }

  function naechsteDiktatVokabel() {
    if (!quiz) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    diktatPlayCountRef.current = 0;
    setDiktatManualPlays(0);
    setQuiz(prev0 => {
      // 175: beantwortete Diktat-Vokabel in den Rückblick
      const v = prev0.vokabeln[prev0.index], w = prev0.diktatWertung;
      const sp = t => prev0.liste.spalten[t]?.name || t;
      const prev = { ...prev0, diktatWertung: null, diktatVersuche: [], rueckIdx: null,
        rueckblick: v && w ? [...(prev0.rueckblick || []), { art: "diktat", vokId: v.id, diktatIdx: prev0.diktatIdx,
          frage: { typ: prev0.diktatUeberspalte, label: sp(prev0.diktatUeberspalte), wert: v[prev0.diktatUeberspalte]?.wert || "" },
          antworten: [{ typ: prev0.diktatSpalte, label: sp(prev0.diktatSpalte), wert: v[prev0.diktatSpalte]?.wert || "", richtig: w.diktat === "richtig", eingaben: prev0.diktatVersuche || [] }],
          ergebnis: w.diktat === "richtig" ? "richtig" : "falsch", wertung: w, zaehlt: true }] : (prev0.rueckblick || []) };
      const naechsterIdx = prev.index + 1;
      if (naechsterIdx >= prev.vokabeln.length) return { ...prev, phase: "fertig" };
      return { ...prev, index: naechsterIdx, eingabe: "", diktatAufgedeckt: 0, phase: "eingabe", feedback: "" };
    });
  }

  function sprichDiktatNochmal(text, lang) {
    if (!window.speechSynthesis) return;
    const langCode = lang.split('-')[0].toLowerCase();
    // Novelty/effects Stimmen aussortieren (iOS/macOS); die gewählte Stimme kommt zuerst
    const alle = aktiveStimmen(langCode).length ? aktiveStimmen(langCode) : stimmenFuerSprache(langCode), gew = gewaehlteStimme(langCode);
    const voices = gew ? [gew, ...alle.filter(v => v !== gew)] : alle;
    diktatPlayCountRef.current += 1;
    setDiktatManualPlays(p => p + 1);
    window.speechSynthesis.cancel();
    // Stimme wechselt alle 2 Plays: 0,0,1,1,2,2,… – immer eine Stimme der richtigen Sprache
    const stimme = voices.length > 1 ? voices[Math.floor(diktatPlayCountRef.current / 2) % voices.length] : null;
    window.speechSynthesis.speak(aeusserung(text.split('/')[0].trim(), lang, stimme));
  }

  function geheZurueck() {
    if (!quiz || quiz.antwortTypIndex <= 0) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setQuiz(prev => {
      const naechsterIdx = prev.antwortTypIndex - 1;
      const nt = prev.antwortTypen[naechsterIdx];
      const teile = prev.vokabeln[prev.index][nt]?.wert.split('/').map(s => s.trim()) || [];
      const mc = prev.antwortModus === "mc"
        ? generiereButtons(prev.vokabeln, prev.vokabeln[prev.index], nt) : null;
      return {
        ...prev, flash: false, phase: "eingabe", eingabe: "",
        antwortTypIndex: naechsterIdx, antwortTeile: teile,
        weitereIndices: [], weiterePos: 0,
        vorigeAntworten: prev.vorigeAntworten.slice(0, -1),
        mcButtons: mc?.buttons || prev.mcButtons,
        mcRichtig: mc?.richtig || prev.mcRichtig,
        feedback: "",
      };
    });
  }

  // ── Render: Diktat ───────────────────────────────────────────────────────
  if (lernen && !lernen.imQuiz) {
    return LernenAnsicht({ beendeLernen, farbModusUI, farbRadUI, lernEinstellungen, lernPause, lernen, lernenVor, lernenWeiter, lernenZurueck, naechstesLernPaket, setLernen, setzeLernEinst, starteLernQuiz, tt, ttFeld, vokLang, wechsleStimme });
  }

  if (ansicht === "quiz" && quiz && quiz.rueckIdx != null && quiz.rueckblick?.[quiz.rueckIdx] && ["eingabe", "aufgedeckt", "weitere", "richtig"].includes(quiz.phase)) return renderRueckblick();   // 175
  if (ansicht === "quiz" && quiz && quiz.modus === "diktat") {
    return DiktatAnsicht({ beendeQuiz, blitzKey, diktatListeAufgeklappt, diktatManualPlays, eingabeRef, farbModusUI, farbRadUI, heuteGesperrtOffen, naechsteDiktatVokabel, naechstesPaketUI, nimmVokabelHeraus, oeffneVokabelBearbeiten, pruefeDiktatAntwort, quiz, renderKopfFortschritt, renderVokabelEditor, sessionAuswertungSeite, setDiktatListeAufgeklappt, setDiktatManualPlays, setQuiz, setQuizPaketGroesse, sprichDiktatNochmal, starteDiktat, tt, ttFeld, updateSessionSlotFortschritt, verlasseRunde, vokLang, weiterZurAuswertung, zeigeDiktatLoesung, zurRundenStatistik, zurueckZumLernen });
  }

  // ── Render: Quiz-Aktiv ────────────────────────────────────────────────────
  if (ansicht === "quiz" && quiz) {
    return AbfrageAnsicht({ aendereStimmen, akzentStand, beendeQuiz, beendeVerzoegerung, bewerteKarte, blitzKey, brecheQuizAb, brecheWiederholungAb, deckeKarteAuf, eingabeRef, einstellungen, farbModusUI, farbRadUI, geheZurueck, getAktVok, heuteGesperrtOffen, kachelMitAkzent, karteWeiter, klickeButton, memoryTippe, naechsteVokabel, naechstesPaketUI, nimmVokabelHeraus, oeffneVokabelBearbeiten, pruefeAkzente, pruefeAntwort, quiz, quizRegeln, renderKopfFortschritt, renderRundenErgebnis, renderVokabelEditor, sessionAuswertungSeite, setQuiz, setQuizPaketGroesse, setzeAkzentVariante, speichereEinst, starteQuiz, starteWiederholung, tt, ttFeld, ueberspringeWeitere, updateSessionSlotFortschritt, verlasseRunde, vokLang, waehleAkzentKachel, wechsleStimme, weiterZurAuswertung, zeigeLosung, zuordnungMixWeiter, zuordnungRunde, zuordnungTippe, zurRundenStatistik, zurueckZumLernen, zurueckZurStatistik });
  }


  // ── Sprach-Buttons (Import, Liste-Detail) ────────────────────────────────
  const renderSprachAuswahl = (wert, onWahl) => (
    <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
      {SPRACHEN.map(s => (
        <button {...tt(`Fremdsprache ${s.name} – bestimmt Vorlese-Stimme und Sprachfilter`)} key={s.code} className={`typ-btn${wert === s.code ? " aktiv" : ""}`}
          onClick={() => onWahl(s.code)}>{s.flagge} {s.name}</button>
      ))}
    </div>
  );

  // ── Slot-Chip Hilfsfunktionen (Quiz-Tab + Statistik-Tab) ─────────────────
  // Verlauf-Chip: Lang-Druck → Erklärung + "Löschen"
  const renderSlotChip = (id, label, onClick, extraStil = {}, typ = "gespeichert") => (
    <button key={id} className={`slot-chip ${typ === "verlauf" ? "verlauf" : "belegt"}${blitzt(`${typ}:${id}`)}`} data-verlauf-id={typ === "verlauf" ? id : undefined}
      style={{...(typ === "verlauf" ? { width: "100%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" } : {}), ...extraStil}}
      onClick={onClick}
      {...tt(`${label} – antippen: auswählen und Infos zeigen; laden mit dem grünen Knopf oben`,
        [{ label: "🗑 Löschen", gefahr: true, fn: () => setLoescheSlotNr({ typ, id }) }], { langText: label })}>
      {label}
    </button>
  );
  const chipStil = (typ, id, slotRef = aktiverSlot) => {
    // das geladene Quiz wird nicht eigens markiert (was oben im Kopf steht, ist ausgewählt); getönt = dort läuft eine angefangene Runde
    const sf = Object.keys(slotSFAlle(getSlotEintrag(typ, id))).length > 0;
    return sf ? {background:"var(--haupt-flaeche)", borderColor:"var(--haupt-zart)", color:"var(--haupt)"} : {};
  };
  // Fortschritt der Abfrageart: beim aktiven Eintrag die gerade eingestellte, sonst die gespeicherte
  const slotChipLabel = (eintrag) => {
    const sf = slotSFAlle(eintrag)[aktiverSlot?.id === eintrag.id ? quizAbfrageArt : slotKonfigArt(eintrag)];
    const kurz = String(eintrag.name || "").replace(/^(\d{2}\.\d{2}\.)\d{2}(\d{2},)/, "$1$2");   // 213: alte Einträge „14.11.2026,“ → „14.11.26,“
    const name = eintrag.multi ? `🧩 ${kurz}` : kurz;
    return sf ? `▶ ${name} · ${(sf.abgefragt||[]).length}/${sf.gesamt||0}` : name;
  };

  // ── Statistik: Berechnungen ───────────────────────────────────────────────
  const statistikAlleListenObjekte = sichtbareListen.map(l => lsGet(SK.liste(l.id))).filter(Boolean);
  const statistikGewaehlteListenObjekte = statistikListenIds === null
    ? statistikAlleListenObjekte
    : statistikAlleListenObjekte.filter(l => statistikListenIds.has(l.id));
  const statistikBasisVoks = statistikGewaehlteListenObjekte.flatMap((l, lRank) =>
    l.vokabeln.map((v, vIdx) => v.herausgenommen ? null : ({...v, id: `${l.id}__${v.id}`, _origId: v.id, _listeId: l.id, _listeName: l.name, _spalten: l.spalten, _listenIndexRank: lRank, _listIndex: vIdx})).filter(Boolean)
  );
  const statistikGefilterteVoks = statistikBereichTyp === "bereich" && statistikCheckboxAuswahl.size > 0
    ? statistikBasisVoks.filter(v => statistikCheckboxAuswahl.has(v.id))
    : statistikBasisVoks;

  // ── Quiz: Berechnungen (auch im Header gebraucht) ────────────────────────
  const quizKombiListe = quizTabListen.length > 0 ? getKombinierteListe(quizTabListen) : null;
  const quizRelevanteTypen = quizModus === "sequenziell"
    ? [quizFrageTyp, ...quizAntwortTypenGeordnet].filter(Boolean)
    : quizAusgewaehlt;
  const quizBasisVoks = quizKombiListe
    ? quizModus === "diktat"
      ? quizKombiListe.vokabeln.filter(v => v[quizDiktatSpalte])
      : quizRelevanteTypen.length >= 2
      ? quizKombiListe.vokabeln.filter(v => quizRelevanteTypen.every(t => v[t]))
      : quizKombiListe.vokabeln
    : [];
  const quizGefilterteVoks = (quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0)
    ? quizBasisVoks.filter(v => quizCheckboxAuswahl.has(v.id))
    : quizBasisVoks;


  // ── Render: Haupt (Tabs immer sichtbar) ──────────────────────────────────
  // Phase 2: alles, was die ausgelagerten Bereiche (src/bereiche/) brauchen
  const app = { abfrageModusContainerRef, abfrageModusRef, abfrageZielAnzahl, abfrageZielModus, abfrageZielScore, abfrageZielScoreTyp, abfrageZielWiederholung, aendereStimmen, aktiveListe, aktiveListeId, aktiverSlot, akzenteAn, alleBereichH, alleBereichRef, ansichtSpaltenAn, antwortMehrfach, artenMehrfach, aufteilen, aufteilenStand, ausListeRef, auswahlListen, auswahlOrdnerZelle, begrenzeOhneAkzent, benenneSlotUm, bestaetigeWiederherstellen, blitzt, dateiName, dupliziereSlot, einstBereich, einstKopf, einstUnter, einstWahl, einstZeile, einstellungen, einzelauswahlRef, erstelleQuiz, erstelleVerlaufEintrag, erstellenFenster, exportiereAlsJsonBestaetigt, fileInputRef, fokusZeigt, fuehreImportDurch, fuehreListenZusammen, getBestehendZielOptionen, getBestehendeListe, getSlotEintrag, handleTabWechsel, headerH, importBestehendId, importDateiname, importFehler, importJsonData, importMapping, importMehrfachListen, importNeuName, importOrdnerWahl, importParsed, importSprache, importText, importZielTyp, importiereAlleListen, importiereAusJsonDaten, inGruppe, infoHeaderRef, infoKontextContainerRef, infoModus, jsonExportIds, jsonExportOptionen, klammerAenderungen, klammerZiel, ladeSicherungsDatei, ladeSlot, legeAufteilenAn, legeListenOrdnerAn, legeOrdnerAn, lernEinstellungen, lernResetFrage, lernStandVon, lernstandJeArt, letzteSicherung, leuchte, leuchtet, listeDetailKopfH, listeMenueId, listeNurAus, listeOeffnenKopf, listeVorschau, listenAendern, listenAuswahlAufgeklappt, listenAuswahlPfad, listenBereich, listenContainerRef, listenFlagge, listenGelerntAusblenden, listenIndex, listenKopfRefCb, listenNavi, listenOffen, listenOrdner, listenOrdnerOffen, listenRasterPlaetze, listenSaetze, listenSortModus, listenWahl, listenWahlKopf, listenZeileH, listenZeileRef, listenauswahlHeaderH, listenauswahlHeaderRef, loescheSessionSlot, maxFenster, maxSpalte, mergeQuelleId, minSpalten, modalInput, neueQuizKonfiguration, neueSessionSchritt, oeffneModal, oeffneSatzFenster, oeffneSynFenster, oeffneVokabelBearbeiten, offenText, ordnerNavi, promptAnzahl, promptBeispiele, promptFalsch, promptModus, promptSprache, promptSynonyme, promptThema, quizAbfrageArt, quizAbfrageModusAufgeklappt, quizAntwortTypenGeordnet, quizArt, quizAusgewaehlt, quizBasisVoks, quizBereichTyp, quizCheckboxAuswahl, quizDiktatSpalte, quizDiktatUebersetzung, quizErstellen, quizFokus, quizFrageTyp, quizGefilterteVoks, quizGelerntEinschliessen, quizHeuteEinschliessen, quizInfoTypenSession, quizKombiListe, quizListeAufgeklappt, quizListenNavi, quizListenSichtbar, quizModus, quizModusInfoAufgeklappt, quizPaketGroesse, quizReihenfolge, quizReihenfolgeAufgeklappt, quizSchlechtesteMaxScore, quizSessionAufgeklappt, quizSessionModus, quizSpalteModus, quizStufeAufgeklappt, quizTabListen, quizUnbeantwortetZuerst, quizVokMax, quizVonBisErster, quizVonBisModus, quizZeigeInfo, reihenfolgeContainerRef, renderAufteilenKasten, renderExportArtWahl, renderExportNamensFeld, renderFarbschemata, renderListeInfo, renderListenRaster, renderModusKnoepfe, renderQuizListenRaster, renderSlotBereiche, renderSlotInfo, renderSlotKopf, renderSprachAuswahl, renderSuchleiste, resetImport, satzFenster, satzPortion, schalteEinstBereich, schliesseQuizBereiche, sessionContainerRef, sessionRef, sessionResetFrage, sessionSlotAktiv, sessionSlotKonflikt, sessionSpeicherAktionen, setAbfrageZielAnzahl, setAbfrageZielModus, setAbfrageZielScore, setAbfrageZielScoreTyp, setAbfrageZielWiederholung, setAnsicht, setAnsichtSpaltenAn, setAufteilen, setBearbeiteVokabel, setErstellenFenster, setFaelligTick, setGruppenAenderungsDialog, setGruppenQuiz, setImportBestehendId, setImportDateiname, setImportFehler, setImportJsonData, setImportMapping, setImportMehrfachListen, setImportNeuName, setImportParsed, setImportSprache, setImportText, setImportZielTyp, setInGruppe, setInfoModus, setJsonExportIds, setJsonExportOptionen, setKlammerZiel, setLernResetFrage, setListeNurAus, setListenBereich, setListenGelerntAusblenden, setMergeQuelleId, setModal, setModalInput, setNeueSessionSchritt, setPromptAnzahl, setPromptBeispiele, setPromptFalsch, setPromptModus, setPromptSprache, setPromptSynonyme, setPromptThema, setQuiz, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizDiktatSpalte, setQuizDiktatUebersetzung, setQuizErstellen, setQuizGelerntEinschliessen, setQuizHeuteEinschliessen, setQuizListeAufgeklappt, setQuizModus, setQuizModusInfoAufgeklappt, setQuizPaketGroesse, setQuizReihenfolge, setQuizReihenfolgeAufgeklappt, setQuizSchlechtesteMaxScore, setQuizSessionAufgeklappt, setQuizSessionModus, setQuizStufeAufgeklappt, setQuizTabListen, setQuizUnbeantwortetZuerst, setQuizVonBisErster, setQuizVonBisModus, setSatzFenster, setSessionResetFrage, setSicherungLaden, setSlotSektionAufgeklappt, setSlotUmbenennen, setSpeicherDauerhaft, setStartLeerHinweis, setStatistikAktiverSlot, setStatistikArt, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikFilter, setStatistikListeZu, setStatistikListenAufgeklappt, setStatistikListenIds, setStatistikSlotGeleert, setStatistikSort, setStatistikVollbild, setStatistikVonBisErster, setStatistikVonBisModus, setSucheListe, setSucheQuiz, setSucheStatistik, setSynFenster, setTab, setUpdateStatus, setZuruecksetzenArten, setzeHerausgenommen, setzeLernEinst, setzeLernStand, setzeListeZurueck, setzeListenSprache, setzeMapping, setzeMinSpalten, setzeSpaltenArt, sichereAlles, sicherungErinnerungUI, sicherungFehler, sicherungInputRef, sicherungLaden, sicherungTage, sichtbareListen, slotContainerRef, slotH, slotNamenVorschlag, slotOrdner, slotSektionAufgeklappt, slotUmbenennen, slots, speicherDauerhaft, speichereAlsGespeichert, speichereEinst, spracheVonListe, sprungKnopf, startLeerHinweis, starteAufteilen, starteLernen, starteQuiz, starteQuizErstellen, statistikAktiverSlot, statistikAlleListenObjekte, statistikArt, statistikBasisVoks, statistikBereichTyp, statistikCheckboxAuswahl, statistikEinzelauswahlAufgeklappt, statistikEinzelauswahlRef, statistikFilter, statistikGefilterteVoks, statistikGewaehlteListenObjekte, statistikListeZu, statistikListenAufgeklappt, statistikListenContainerRef, statistikListenHeaderH, statistikListenHeaderRef, statistikListenIds, statistikSort, statistikVokauswahlH, statistikVokauswahlRef, statistikVollbild, statistikVonBisErster, statistikVonBisModus, stimmenWahl, suchInfo, suchMarke, sucheListe, sucheQuiz, sucheStatistik, synFenster, synPortion, teileAlsDatei, toggleAbfrageModus, toggleEinzelauswahl, toggleInfoSpalte, toggleListenAuswahl, toggleQuizSpalte, toggleQuizTabListe, toggleReihenfolge, toggleSessionBereich, toggleSpalteRolle, toggleStatistikEinzelauswahl, toggleStatistikListe, toggleStatistikListenAuswahl, toggleVokCheckbox, tt, ttFeld, uebernehmeSaetze, uebernehmeSynonyme, ueberspeichereSession, updateStatus, verschiebeInOrdner, verschiebeKlammern, verschiebeListenInOrdner, vokabelAufgeklappt, vonBisLangDruck, vorhandeneSprachen, wahlLeiste, wechsleQuizArt, zeileImBlick, zuruecksetzenArten };
  return (
    <>
      <style>{CSS}</style>{farbModusUI}{farbRadUI}
      <div className={`app${tabGleiten ? ` gleiten-${tabGleiten}` : ""}`} data-tab-gleiten={tabGleiten || undefined}>
        <div ref={headerRef} className="vb-kopf" style={{position:"sticky", top:0, zIndex:10, background:"var(--app-kopf)", ...(quizVokMax ? {display:"none"} : {})}}>
        <div className="topbar" style={{position:"relative"}}>
          <button className="info-schalter" data-info-schalter onClick={schalteInfoModus} title="Info-Modus: Elemente antippen, um sie erklärt zu bekommen">ⓘ</button>
          {statistikVollbild && tab === "statistik" ? renderVollbildKopf() : <span className="topbar-title">Vokabel-Trainer</span>}
          {!statistikVollbild && vorhandeneSprachen.length > 1 && (
            <div style={{position:"absolute", right:12, top:"50%", transform:"translateY(-50%)"}}>
              <button className="toggle-opt aktiv" style={{padding:"4px 10px", fontSize:"0.78rem", borderRadius:14, cursor:"pointer"}}
                onClick={() => setSprachMenuOffen(o => !o)}
                {...tt("Sprache wählen – zeigt nur Listen dieser Sprache")}>
                {sprachFilter === "alle" ? "🌐" : sprachInfo(sprachFilter).flagge}
                <span className="sprach-chip-name"> {sprachFilter === "alle" ? "Alle" : sprachInfo(sprachFilter).name}</span> ▾
              </button>
              {sprachMenuOffen && (<>
                <div style={{position:"fixed", inset:0, zIndex:20}} onClick={() => setSprachMenuOffen(false)}/>
                <div className="karte" style={{position:"absolute", right:0, top:"calc(100% + 6px)", zIndex:21, minWidth:220, marginBottom:0, boxShadow:"0 4px 16px rgba(0,0,0,0.15)"}}>
                  {[{ code:"alle", flagge:"🌐", name:"Alle Sprachen", anzahl: listenIndex.length },
                    ...vorhandeneSprachen.map(s => ({ ...s, anzahl: listenIndex.filter(l => listeSprache(l) === s.code).length }))
                  ].map(s => (
                    <div {...tt(s.code === "alle" ? "Listen aller Sprachen anzeigen" : `Nur Listen auf ${s.name} anzeigen`)} key={s.code} className="karte-zeile" style={{cursor:"pointer", background: sprachFilter === s.code ? "var(--haupt-flaeche)" : undefined}}
                      onClick={() => wechsleSprache(s.code)}>
                      <span style={{fontWeight: sprachFilter === s.code ? 700 : 500}}>{s.flagge} {s.name}</span>
                      <span style={{marginLeft:"auto", color:"var(--text2)", fontSize:"0.8rem"}}>{s.anzahl} Liste{s.anzahl !== 1 ? "n" : ""}</span>
                    </div>
                  ))}
                </div>
              </>)}
            </div>
          )}
          {statistikVollbild && (
            <button onClick={() => setStatistikVollbild(false)}
              style={{position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
                display:"flex", alignItems:"center", background:"none", border:"none",
                cursor:"pointer", color:"var(--haupt)", padding:"6px 8px"}}
              {...tt("Vollbild verlassen")}>
              <IcoCollapse s={18}/>
            </button>
          )}
        </div>
        {!statistikVollbild && <div className="tabs">
          <button {...tt("Lernfortschritt und Scores ansehen")} className={`tab${tab==="statistik"?" aktiv":""}`}
            onClick={() => handleTabWechsel("statistik")}>Statistik</button>
          <button {...tt("Abfrage einstellen und starten")} className={`tab${tab==="quiz"?" aktiv":""}`}
            onClick={() => handleTabWechsel("quiz")}>Quiz</button>
          <button {...tt("Listen, Sicherung, Einstellungen, Info und Anleitung")} className={`tab${tab==="einstellungen" || tab==="listen"?" aktiv":""}`}
            onClick={() => handleTabWechsel("einstellungen")}>Einstellungen</button>
        </div>}
        </div>{/* end sticky header wrapper */}

        {nachOben && !farbModus && !multiAuswahl && !listenWahl && !(ansicht === "quiz" && quiz) && (
          <button className="nach-oben" data-nach-oben onClick={springeNachOben} {...tt("Nach oben – an den Anfang springen")}>↑</button>
        )}
        {/* ── Listen-Header (persistent) ── */}
        {tab === "listen" && ansicht !== "import" && ansicht !== "ki-prompt" && (
          <div ref={listeDetailKopfRef} className="liste-detail-header" style={{top: headerH}}>
            {ansicht === "liste-detail" && aktiveListe ? (
              <>
                {(() => {
                  const sp = sprachInfo(listeSprache(aktiveListe));
                  const saetze = listenSaetze.listeId === aktiveListeId ? listenSaetze.saetze : {};
                  const mit = aktiveListe.vokabeln.filter(v => (saetze[`${aktiveListeId}__${v.id}`] || []).length > 0).length;
                  const n = aktiveListe.vokabeln.length;
                  return (
                    <div style={{flex:1, minWidth:0}}>
                      <button className="toggle-opt aktiv slot-kopf-name eckig" style={{width:"100%", display:"block"}} data-zurueck-listen data-liste-kopf-name onClick={zuEinstListen}
                        {...tt(`${aktiveListe.name} – antippen: zurück zur Listen-Auswahl; lang drücken: Umbenennen, Duplizieren, Exportieren, Zusammenführen …`,
                          listenMenue(listenIndex.find(l => l.id === aktiveListeId) || aktiveListe, true), { langText: aktiveListe.name })}>{aktiveListe.name}</button>
                      <div className="slot-kopf-info" data-liste-kopf-info>{sp.flagge} {sp.name} · {n} Vokabel{n !== 1 ? "n" : ""}{mit ? ` · 💬 ${mit} mit Sätzen` : ""}</div>
                    </div>
                  );
                })()}
              </>
            ) : null}
          </div>
        )}

        {/* ── Import Sub-Header ── */}
        {tab === "listen" && (ansicht === "import" || ansicht === "ki-prompt") && (
          <div className="liste-detail-header"
            style={ansicht === "ki-prompt" ? {cursor:"pointer", top: headerH} : {top: headerH}}
            onClick={ansicht === "ki-prompt" ? () => setAnsicht("import") : undefined}>
            {ansicht === "import" && <button className="btn-icon" data-zurueck-listen onClick={e => { e.stopPropagation(); zuEinstListen(); }} {...tt("Zurück zu Einstellungen › Listen")} style={{padding:"4px 6px", marginRight:2, color:"var(--haupt)"}}><IcoBack s={18}/></button>}
            <span className="liste-detail-header-name">Importieren</span>
            {ansicht === "import" && !importParsed && !importMehrfachListen && !importJsonData && (
              <button {...tt("Eingefügten Text auswerten und Spalten zuordnen")} className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); analysiereImport(); }}>Analysieren</button>
            )}
            {ansicht === "import" && letzterPrompt && (
              <button {...tt("Zuletzt erzeugten KI-Prompt erneut kopieren")} className="btn btn-ghost btn-sm" onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(letzterPrompt)
                  .then(() => { setPromptKopiert(true); setTimeout(() => setPromptKopiert(false), 2000); });
              }}>{promptKopiert ? "✓" : "📋 Prompt"}</button>
            )}
            <button {...tt("KI-Prompt erstellen, um von einer KI eine Vokabelliste erzeugen zu lassen")} className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setPromptSprache(sprachFilter === "alle" ? "en" : sprachFilter); setAnsicht("ki-prompt"); }}>Prompt generieren</button>
          </div>
        )}

        {/* ── KI-Prompt Sub-Header ── */}
        {tab === "listen" && ansicht === "ki-prompt" && (
          <div className="liste-detail-header" style={{top: headerH}}>
            <span className="liste-detail-header-name">KI-Prompt generieren</span>
            <button {...tt("Prompt kopieren – danach in einer KI-App einfügen und die Antwort hier importieren")} className="btn btn-primary btn-sm"
              onClick={() => {
                const text = generierePrompt(promptThema, promptAnzahl, promptFalsch, promptBeispiele, promptSynonyme, promptModus, promptSprache);
                navigator.clipboard.writeText(text)
                  .then(() => {
                    setLetzterPrompt(text);
                    setPromptKopiert(true);
                    setTimeout(() => { setPromptKopiert(false); setAnsicht("import"); }, 1500);
                  });
              }}>
              {promptKopiert ? "✓ Kopiert!" : "Kopieren"}
            </button>
          </div>
        )}

        {/* ── Import Inhalt ── */}
        {tab === "listen" && ansicht === "import" && ImportAnsicht(app)}

        {/* ── KI-Prompt Inhalt ── */}
        {tab === "listen" && ansicht === "ki-prompt" && (
          KiPromptAnsicht(app)
        )}

        {/* ── Quiz-Tab ── */}
        {tab === "quiz" && QuizTab(app)}

        {/* ── Listen-Übersicht: Raster (Größe unter Einstellungen → Listen) ── */}
        {/* ── Listen-Detail ── */}
        {tab === "listen" && ansicht === "liste-detail" && aktiveListe && ListeDetail(app)}
        {/* ── Statistik: Verlauf & Gespeichert Header ── */}
        {tab === "statistik" && (() => {
          if (statistikVollbild) return null;
          return (
            <>
              {renderSlotKopf(true)}
              {slotSektionAufgeklappt && renderSlotInfo(true)}
              <div ref={slotContainerRef} style={{overflow:'clip', paddingTop: slotSektionAufgeklappt ? 12 : 0, paddingBottom: slotSektionAufgeklappt ? 8 : 0}}>
                {slotSektionAufgeklappt && (<>
                  {ordnerNavi({margin:"0 16px 8px"}, true)}
                  {renderSlotBereiche(null, ladeSlotStatistik, statistikAktiverSlot, 16)}
                </>)}
              </div>
            </>
          );
        })()}

        {/* ── Statistik: Listen-Auswahl Header (ausgeblendet bei geladener gespeicherter Konfiguration) ── */}
        {tab === "statistik" && StatistikKopf1(app)}

        {/* ── Statistik: Vokabel-Auswahl Header ── */}
        {tab === "statistik" && StatistikKopf2(app)}

        {/* ── Statistik: Inhalte ── */}
        {tab === "statistik" && StatistikTab(app)}
        {tab === "einstellungen" && (EinstellungenTab(app))}
      </div>

      {/* ── Modals (global) ── */}
      {inGruppe && DialogInGruppe(app)}
      {erstellenFenster && DialogErstellenFenster(app)}
      {anordnen && (
        <div className="overlay" onClick={() => setAnordnen(null)}>
          <div className="modal" data-anordnen-dialog onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Anordnen{anordnen.ordner ? ` – „${((anordnen.art === "liste" ? listenOrdner : slots.ordner) || []).find(o => o.id === anordnen.ordner)?.name || ""}“` : ""}</div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {[["name", "Nach Name", "A–Z, Zahlen der Reihe nach (A1-02 vor A1-10)"], ["datum", "Nach Datum", "älteste zuerst"],
                ["lernstand", "Nach Lernstand", "am meisten gelernt zuerst"], ["luecken", "Lücken schließen", "Reihenfolge bleibt, leere Plätze fallen weg"]].map(([k, titel, sub]) => (
                <button key={k} className="neue-session-wahl" data-anordnen={k} onClick={() => ordneAn(anordnen.art, anordnen.ordner, k)} {...tt(`${titel} – Ordner zuerst, spaltenweise von oben nach unten`)}>
                  <b>{titel}</b><span>{sub}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setAnordnen(null)} {...tt("Schließen, ohne etwas zu ändern")}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
      {spaltenWahl && (
        <div className="overlay" onClick={() => setSpaltenWahl(null)}>
          <div className="modal" data-spalten-dialog onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Spalten{spaltenWahl.ordner ? ` in „${((spaltenWahl.art === "liste" ? listenOrdner : slots.ordner) || []).find(o => o.id === spaltenWahl.ordner)?.name || ""}“` : ""}</div>
            <div className="toggle-btn" data-wahl-bereich style={{display:"flex", width:"100%"}}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={`toggle-opt${minSpalten(spaltenWahl.art, spaltenWahl.ordner) === n ? " aktiv" : ""}`} data-spalten-wahl={n} style={{flex:1}}
                  onClick={() => { setzeMinSpalten(spaltenWahl.art, spaltenWahl.ordner, n); setSpaltenWahl(null); }}
                  {...tt(`Mindestens ${n} Spalte${n > 1 ? "n" : ""} – belegte Spalten können mehr ergeben`)}>{n}</button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSpaltenWahl(null)} {...tt("Schließen, ohne etwas zu ändern")}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
      {ordnerUmbenennen && (
        <div className="overlay" onClick={() => setOrdnerUmbenennen(null)}>
          <div className="modal" data-ordner-umbenennen onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Ordner umbenennen</div>
            <input className="inp" data-ordner-name-feld value={ordnerUmbenennen.name} autoFocus
              onChange={e => setOrdnerUmbenennen(o => ({ ...o, name: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") (ordnerUmbenennen.art === "liste" ? benenneListenOrdnerUm : benenneOrdnerUm)(ordnerUmbenennen.id, ordnerUmbenennen.name); }}
              {...ttFeld("Neuer Name des Ordners")} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOrdnerUmbenennen(null)} {...tt("Schließen, ohne etwas zu ändern")}>Abbrechen</button>
              <button className="btn btn-primary" data-ordner-umbenennen-ok onClick={() => (ordnerUmbenennen.art === "liste" ? benenneListenOrdnerUm : benenneOrdnerUm)(ordnerUmbenennen.id, ordnerUmbenennen.name)} {...tt("Neuen Namen speichern")}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "neue-session" && (
        DialogNeueSession(app)
      )}
      {modal === "neue-liste" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Neue Liste anlegen</div>
            <label className="inp-label">Name der Liste</label>
            <input {...ttFeld("Name der neuen Liste")} className="inp" placeholder="z.B. Irregular Verbs, Unit 5" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && erstelleListe()} />
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Neue leere Liste anlegen")} className="btn btn-primary" onClick={erstelleListe}>Erstellen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "umbenennen" && (aktiveListe || listeMenueId) && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste umbenennen</div>
            <label className="inp-label">Neuer Name</label>
            <input {...ttFeld("Neuer Name der Liste")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && umbenennen()} />
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Neuen Namen speichern")} className="btn btn-primary" onClick={umbenennen}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "liste-zuruecksetzen" && listeMenueId && DialogListeZuruecksetzen(app)}
      {modal === "liste-duplizieren" && listeMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste duplizieren</div>
            <label className="inp-label">Name der Kopie</label>
            <input {...ttFeld("Name der neuen Liste")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }}
              onKeyDown={e => e.key === "Enter" && dupliziereListe()} />
            <div style={{fontSize:"0.78rem", color:"var(--text2)", marginTop:6}}>Die Kopie enthält alle Vokabeln und Spalten – die Lernstände beginnen neu.</div>
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Kopie der Liste anlegen")} className="btn btn-primary" onClick={dupliziereListe}>Duplizieren</button>
            </div>
          </div>
        </div>
      )}
      {modal === "spalte-umbenennen" && aktiveListe && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Spalte umbenennen</div>
            <div style={{fontSize:"0.82rem", color:"var(--text2)", marginBottom:12}}>Typ: {editSpalteTyp}</div>
            <label className="inp-label">Name</label>
            <input {...ttFeld("Neuer Name der Spalte")} className="inp" value={modalInput} autoFocus
              onChange={e => setModalInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && speichereSpaltenname()} />
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Spaltennamen speichern")} className="btn btn-primary" onClick={speichereSpaltenname}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {renderVokabelEditor()}
      {gruppenQuiz && (
        <div className="overlay" onClick={() => setGruppenQuiz(null)}>
          <div className="modal" data-gruppen-quiz onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Quiz starten?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
              {gruppenQuiz.ids.length} Vokabel{gruppenQuiz.ids.length !== 1 ? "n" : ""} aus „{gruppenQuiz.name}“
              ({STATISTIK_ARTEN.find(([a]) => a === gruppenQuiz.art)?.[1]}), schlechteste zuerst.
              {gruppenQuizPasst(gruppenQuiz)
                ? <> Einmalige Runde: {aktiverSlot ? <>„{getSlotEintrag(aktiverSlot.typ, aktiverSlot.id)?.name || "Auswahl"}“</> : "deine Quiz-Auswahl"} und des Quiz-Fortschritt bleiben erhalten, die Scores verbessern sich.</>
                : <> Spalten und Abfrage-Modus wie im Quiz eingestellt; {quizAbfrageArt !== gruppenQuiz.art ? "Abfrageart und Quiz-Auswahl werden" : "die Quiz-Auswahl wird"} dafür umgestellt{aktiverSlot ? ", die gewählte Konfiguration wird gelöst" : ""}.</>}
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne ein Quiz zu starten")} className="btn btn-ghost" onClick={() => setGruppenQuiz(null)}>Abbrechen</button>
              <button {...tt("Quiz mit diesen Vokabeln starten")} className="btn btn-primary" onClick={() => starteGruppenQuiz(gruppenQuiz)}>Starten</button>
            </div>
          </div>
        </div>
      )}
      {modal === "vokabel-loeschen" && bearbeiteVokabel && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Vokabel löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
              Diese Vokabel wird dauerhaft gelöscht. Der Lernfortschritt geht dabei verloren.
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Vokabel endgültig löschen")} className="btn btn-danger" onClick={() => loescheVokabel(bearbeiteVokabel.id)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "liste-zusammenfuehren" && aktiveListe && DialogListeZusammenfuehren(app)}
      {modal === "slot-speichern" && DialogSlotSpeichern(app)}
      {slotUmbenennen && DialogSlotUmbenennen(app)}
      {auswahlLoeschen && (() => {
        const { art, ids } = auswahlLoeschen;
        const namen = ids.map(id => art === "slot" ? getSlotEintrag("gespeichert", id)?.name : listenIndex.find(l => l.id === id)?.name).filter(Boolean);
        const was = art === "slot" ? (ids.length === 1 ? "Konfiguration" : "Konfigurationen") : (ids.length === 1 ? "Liste" : "Listen");
        return (
          <div className="overlay" onClick={() => setAuswahlLoeschen(null)}>
            <div className="modal" data-auswahl-loeschen={art} onClick={e => e.stopPropagation()}>
              <div className="modal-titel">{ids.length} {was} löschen?</div>
              <p style={{fontSize:"0.9rem", color:"var(--text)", lineHeight:1.5, margin:"0 0 8px"}} data-auswahl-namen>{namen.map(n => `„${n}“`).join(", ")}</p>
              <p style={{fontSize:"0.85rem", color:"var(--text2)", lineHeight:1.5}}>
                {art === "slot" ? "Gespeicherte Einstellungen, Quiz- und Lernfortschritt dieser Einträge gehen verloren. Die Listen und Scores bleiben."
                  : "Alle Vokabeln und Scores dieser Listen werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden."}
              </p>
              {art === "liste" && (
                <button className="btn btn-ghost btn-sm" style={{marginBottom:10}} onClick={() => { setAuswahlLoeschen(null); sichereAlles(); }}
                  {...tt("Erst alles in einer Datei sichern; danach kannst du die Auswahl wieder lang drücken und löschen")}>💾 Vorher sichern</button>
              )}
              <div className="modal-actions">
                <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setAuswahlLoeschen(null)}>Abbrechen</button>
                <button {...tt(`${ids.length} ${was} endgültig löschen`)} className="btn btn-danger" data-auswahl-loeschen-ok onClick={loescheAuswahl}>Löschen</button>
              </div>
            </div>
          </div>
        );
      })()}
      {loescheSlotNr !== null && (
        <div className="overlay" onClick={() => setLoescheSlotNr(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Slot löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
              {`"${getSlotEintrag(loescheSlotNr.typ, loescheSlotNr.id)?.name || 'Dieser Eintrag'}" wird dauerhaft gelöscht.`}
              {Object.keys(slotSFAlle(getSlotEintrag(loescheSlotNr.typ, loescheSlotNr.id))).length > 0 ? " Der Quiz-Fortschritt geht verloren." : ""}
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setLoescheSlotNr(null)}>Abbrechen</button>
              <button {...tt("Eintrag endgültig löschen")} className="btn btn-danger" onClick={() => loescheSlotEintrag(loescheSlotNr.typ, loescheSlotNr.id)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {gruppenAenderungsDialog && aktiverSlot?.typ === 'gespeichert' && DialogGruppenAenderungsDialog(app)}
      {sessionUeberschreibenModal && (
        <div className="overlay" onClick={() => setSessionUeberschreibenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Quiz überschreiben?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
              Es gibt bereits ein aktives Quiz mit einer anderen Konfiguration. Soll diese überschrieben werden?
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu starten")} className="btn btn-ghost" onClick={() => setSessionUeberschreibenModal(false)}>Abbrechen</button>
              <button {...tt("Bisherige Quiz verwerfen und neu beginnen")} className="btn btn-primary" onClick={() => { setSessionUeberschreibenModal(false); starteQuiz(true); }}>Neu starten</button>
            </div>
          </div>
        </div>
      )}
      {modal === "lernen-einst" && DialogLernenEinst(app)}
      {modal === "stufen-regeln" && (
        DialogStufenRegeln(app)
      )}
      {modal === "vorlesen" && (
        DialogVorlesen(app)
      )}
      {modal === "klammern" && aktiveListe && DialogKlammern(app)}
      {modal === "schema-umbenennen" && schemaMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Farbschema umbenennen</div>
            <input {...ttFeld("Neuer Name des Farbschemas")} className="inp" value={modalInput} autoFocus
              onChange={e => { setModalInput(e.target.value); setModalFehler(""); }} />
            {modalFehler && <div className="fehler">{modalFehler}</div>}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu ändern")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Neuen Namen speichern")} className="btn btn-primary" onClick={() => {
                const name = modalInput.trim();
                if (!name) { setModalFehler("Bitte einen Namen eingeben."); return; }
                if ([...FARB_VORLAGEN, ...eigeneSchemata].some(x => x.id !== schemaMenueId && x.name.toLowerCase() === name.toLowerCase())) { setModalFehler("Name bereits vorhanden."); return; }
                aendereEigenesSchema(schemaMenueId, () => ({ name })); setModal(null); setSchemaMenueId(null);
              }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {modal === "schema-loeschen" && schemaMenueId && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Farbschema löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>„{eigeneSchemata.find(x => x.id === schemaMenueId)?.name}“ wird gelöscht. Ist es gerade gewählt, gilt danach wieder „Natur“.</p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Farbschema endgültig löschen")} className="btn btn-danger" onClick={() => loescheSchema(schemaMenueId)}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "loeschen" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-titel">Liste löschen?</div>
            <p style={{fontSize:"0.9rem", color:"var(--text2)", lineHeight:1.5}}>
              {listeMenueId ? <>„{listenIndex.find(l => l.id === listeMenueId)?.name}“ wird</> : "Diese Liste wird"} dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
            </p>
            <div className="modal-actions">
              <button {...tt("Schließen, ohne etwas zu löschen")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Liste mit allen Vokabeln endgültig löschen")} className="btn btn-danger" onClick={loeschen}>Löschen</button>
            </div>
          </div>
        </div>
      )}
      {modal === "json-export" && jsonExportIds && (
        DialogJsonExport(app)
      )}

      {modal === "saetze" && satzFenster && DialogSaetze(app)}
      {modal === "synonyme" && synFenster && DialogSynonyme(app)}
      {modal === "stimmen-hilfe" && DialogStimmenHilfe(app)}
      {modal === "kopier-export" && kopierExportIds && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" data-kopier-export onClick={e => e.stopPropagation()}>
            <div className="modal-titel">📤 Exportieren</div>
            {renderExportArtWahl(kopierExportIds, "kopieren")}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu kopieren")} className="btn btn-ghost" onClick={() => setModal(null)}>Abbrechen</button>
              <button {...tt("Vokabeln als Text in die Zwischenablage kopieren")} className="btn btn-primary" data-kopier-export-ok
                onClick={async () => { await kopiereListen(kopierExportIds); setTimeout(() => setModal(m => m === "kopier-export" ? null : m), 800); }}>
                {exportKopiert ? "✓ Kopiert" : "📋 Kopieren"}</button>
            </div>
          </div>
        </div>
      )}
      {modal === "datei-export" && dateiExport && (
        <div className="overlay" onClick={() => { setModal(null); setDateiExport(null); }}>
          <div className="modal" data-datei-export={dateiExport.art} onClick={e => e.stopPropagation()}>
            <div className="modal-titel">{dateiExport.art === "sicherung" ? "Alles sichern" : "📤 Exportieren"}</div>
            {dateiExport.art === "sicherung"
              ? <p style={{fontSize:"0.85rem", color:"var(--text2)", marginBottom:14}}>Listen mit Scores, Einstellungen, Farben und gespeicherte Quiz in einer Datei.</p>
              : renderExportArtWahl(dateiExport.ids, "txt")}
            {renderExportNamensFeld(bestaetigeDateiExport)}
            <div className="modal-actions">
              <button {...tt("Schließen, ohne zu speichern")} className="btn btn-ghost" onClick={() => { setModal(null); setDateiExport(null); }}>Abbrechen</button>
              <button {...tt(dateiExport.art === "sicherung" ? "Sicherungsdatei mit diesem Namen erstellen" : "TXT-Datei mit diesem Namen erstellen")} className="btn btn-primary" data-datei-export-ok
                onClick={bestaetigeDateiExport}>{dateiExport.art === "sicherung" ? "Sichern" : "Exportieren"}</button>
            </div>
          </div>
        </div>
      )}

      {zuklappHinweis && !quiz && (
        <button {...tt("Bereich zuklappen")} onClick={klappeFreieZu}
          style={{position:"fixed", left:"50%", bottom:16, transform:"translateX(-50%)", zIndex:50,
            background:"var(--haupt)", color:"var(--auf-haupt)", border:"none", borderRadius:20, padding:"7px 14px",
            fontSize:"0.75rem", fontWeight:600, fontFamily:"inherit", boxShadow:"0 2px 10px rgba(0,0,0,0.2)", cursor:"pointer", whiteSpace:"nowrap"}}>
          ▲ Weiter ziehen oder hier tippen zum Zuklappen
        </button>
      )}
    </>
  );
}
