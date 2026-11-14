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
import { klappeFreieZu as klappeFreieZuTeil, ordneAn as ordneAnTeil, setzeMinSpalten as setzeMinSpaltenTeil, tt as ttTeil, ttFeld as ttFeldTeil, wechsleStimme as wechsleStimmeTeil } from "./logik/allgemein.jsx";
import { auswahlTafel as auswahlTafelTeil, benenneListenOrdnerUm as benenneListenOrdnerUmTeil, dupliziereListe as dupliziereListeTeil, erstelleListe as erstelleListeTeil, gruppiereListen as gruppiereListenTeil, importOrdnerWahl as importOrdnerWahlTeil, importZielOrdner as importZielOrdnerTeil, legeGezogenAb as legeGezogenAbTeil, listenKopieName as listenKopieNameTeil, listenOrdnerDaten as listenOrdnerDatenTeil, loeschen as loeschenTeil, loeseListenOrdnerAuf as loeseListenOrdnerAufTeil, oeffneModal as oeffneModalTeil, oeffneSynFenster as oeffneSynFensterTeil, setzeListeZurueck as setzeListeZurueckTeil, setzeListenSprache as setzeListenSpracheTeil, setzeSpaltenArt as setzeSpaltenArtTeil, speichereEinst as speichereEinstTeil, speichereIndex as speichereIndexTeil, speichereSpaltenname as speichereSpaltennameTeil, synPortion as synPortionTeil, synZiel as synZielTeil, uebernehmeSynonyme as uebernehmeSynonymeTeil, umbenennen as umbenennenTeil, verweilGeht as verweilGehtTeil, wechsleSprache as wechsleSpracheTeil, zeigeAuswahlTafel as zeigeAuswahlTafelTeil } from "./logik/listen.jsx";
import { fuehreListenZusammen as fuehreListenZusammenTeil, loescheVokabel as loescheVokabelTeil, nimmVokabelHeraus as nimmVokabelHerausTeil, schliesseVokabelBearbeiten as schliesseVokabelBearbeitenTeil, setzeHerausgenommen as setzeHerausgenommenTeil, speichereVokabelBearbeitung as speichereVokabelBearbeitungTeil } from "./logik/vokabeln.jsx";
import { bestaetigeDateiExport as bestaetigeDateiExportTeil, exportStandardName as exportStandardNameTeil, generiereKombiniertenExport as generiereKombiniertenExportTeil, gruppenQuizPasst as gruppenQuizPasstTeil, handleTabWechsel as handleTabWechselTeil, kopiereListen as kopiereListenTeil, oeffneDateiExport as oeffneDateiExportTeil, starteGruppenQuiz as starteGruppenQuizTeil, teileAlsDatei as teileAlsDateiTeil, toggleStatistikListe as toggleStatistikListeTeil } from "./logik/export.jsx";
import { analysiereImport as analysiereImportTeil, autoMappeKolumnen as autoMappeKolumnenTeil, bestaetigeWiederherstellen as bestaetigeWiederherstellenTeil, exportiereAlsJson as exportiereAlsJsonTeil, exportiereAlsJsonBestaetigt as exportiereAlsJsonBestaetigtTeil, fuehreImportDurch as fuehreImportDurchTeil, getBestehendZielOptionen as getBestehendZielOptionenTeil, getBestehendeListe as getBestehendeListeTeil, importiereAlleListen as importiereAlleListenTeil, importiereAusJsonDaten as importiereAusJsonDatenTeil, ladeSicherungsDatei as ladeSicherungsDateiTeil, resetImport as resetImportTeil, schalteEinstBereich as schalteEinstBereichTeil, setzeMapping as setzeMappingTeil, sichereAlles as sichereAllesTeil, speichereSicherung as speichereSicherungTeil } from "./logik/import.jsx";
import { aendereListenEintrag as aendereListenEintragTeil, aktiviereSlotFortschritt as aktiviereSlotFortschrittTeil, aktuelleKonfiguration as aktuelleKonfigurationTeil, applyKonfiguration as applyKonfigurationTeil, artEinstellungenJetzt as artEinstellungenJetztTeil, benenneOrdnerUm as benenneOrdnerUmTeil, erstelleQuiz as erstelleQuizTeil, erstelleVerlaufEintrag as erstelleVerlaufEintragTeil, faelligeSchluessel as faelligeSchluesselTeil, getSlotEintrag as getSlotEintragTeil, getSlotsData as getSlotsDataTeil, gruppiere as gruppiereTeil, ladeFaellige as ladeFaelligeTeil, ladeSlot as ladeSlotTeil, ladeSlotStatistik as ladeSlotStatistikTeil, listeAlsQuizVorbereiten as listeAlsQuizVorbereitenTeil, loeseOrdnerAuf as loeseOrdnerAufTeil, merkeRundeImVerlauf as merkeRundeImVerlaufTeil, rasterEinordnen as rasterEinordnenTeil, schliesseSlotsVerzoegert as schliesseSlotsVerzoegertTeil, setSlotsData as setSlotsDataTeil, setzeSlotPlaetze as setzeSlotPlaetzeTeil, speichereListenKonfig as speichereListenKonfigTeil, starteQuizErstellen as starteQuizErstellenTeil, toggleInfoSpalte as toggleInfoSpalteTeil, toggleQuizSpalte as toggleQuizSpalteTeil, toggleSpalteRolle as toggleSpalteRolleTeil, toggleVokCheckbox as toggleVokCheckboxTeil, verschiebeInOrdner as verschiebeInOrdnerTeil, wendeArtEinstellungenAn as wendeArtEinstellungenAnTeil, zurUebersetzung as zurUebersetzungTeil } from "./logik/slots.jsx";
import { beendeLernen as beendeLernenTeil, beendeQuiz as beendeQuizTeil, benenneSlotUm as benenneSlotUmTeil, dupliziereSlot as dupliziereSlotTeil, erstAusQuiz as erstAusQuizTeil, getKombinierteListe as getKombinierteListeTeil, initQuizDefaults as initQuizDefaultsTeil, klappeUebersichtEin as klappeUebersichtEinTeil, kopieName as kopieNameTeil, legeAufteilenAn as legeAufteilenAnTeil, lernEinstellungen as lernEinstellungenTeil, lernInfoZeigen as lernInfoZeigenTeil, lernPause as lernPauseTeil, lernStandVon as lernStandVonTeil, lernenVor as lernenVorTeil, lernenWeiter as lernenWeiterTeil, lernenZurueck as lernenZurueckTeil, loescheAuswahl as loescheAuswahlTeil, loescheSessionSlot as loescheSessionSlotTeil, loescheSlotEintrag as loescheSlotEintragTeil, multiZusammenstellung as multiZusammenstellungTeil, naechstesLernPaket as naechstesLernPaketTeil, neueQuizKonfiguration as neueQuizKonfigurationTeil, schliesseQuizBereiche as schliesseQuizBereicheTeil, sessionStandImQuiz as sessionStandImQuizTeil, setzeLernEinst as setzeLernEinstTeil, setzeLernStand as setzeLernStandTeil, setzeQuizEinstellungenZurueck as setzeQuizEinstellungenZurueckTeil, speichereAlsGespeichert as speichereAlsGespeichertTeil, starteAufteilen as starteAufteilenTeil, starteLernQuiz as starteLernQuizTeil, starteLernen as starteLernenTeil, toggleAbfrageModus as toggleAbfrageModusTeil, toggleEinstellungen as toggleEinstellungenTeil, toggleEinzelauswahl as toggleEinzelauswahlTeil, toggleListenAuswahl as toggleListenAuswahlTeil, toggleQuizTabListe as toggleQuizTabListeTeil, toggleReihenfolge as toggleReihenfolgeTeil, toggleSessionBereich as toggleSessionBereichTeil, toggleSlotSektion as toggleSlotSektionTeil, toggleStatistikEinzelauswahl as toggleStatistikEinzelauswahlTeil, toggleStatistikListenAuswahl as toggleStatistikListenAuswahlTeil, ueberspeichereSession as ueberspeichereSessionTeil, updateSessionSlotFortschritt as updateSessionSlotFortschrittTeil, updateSlotSF as updateSlotSFTeil } from "./logik/lernenSessions.jsx";
import { auswahlStuecke as auswahlStueckeTeil, einListenName as einListenNameTeil, sessionAuswertungDaten as sessionAuswertungDatenTeil, sessionAuswertungSeite as sessionAuswertungSeiteTeil, sichtbarHalten as sichtbarHaltenTeil, slotNamenVorschlag as slotNamenVorschlagTeil, springeZuTreffer as springeZuTrefferTeil, sprungKnopf as sprungKnopfTeil, suchInfo as suchInfoTeil, suchMarke as suchMarkeTeil, vonBisLangDruck as vonBisLangDruckTeil, zeileImBlick as zeileImBlickTeil, zuEinstListen as zuEinstListenTeil } from "./logik/auswertung.jsx";
import { aendereEigenesSchema as aendereEigenesSchemaTeil, beendeFarbModus as beendeFarbModusTeil, dupliziereSchema as dupliziereSchemaTeil, entferneElementFarbe as entferneElementFarbeTeil, farbRadAbbrechen as farbRadAbbrechenTeil, farbRadAnwenden as farbRadAnwendenTeil, farbRollenBei as farbRollenBeiTeil, klammerAenderungen as klammerAenderungenTeil, loescheSchema as loescheSchemaTeil, oeffneElementFarbRad as oeffneElementFarbRadTeil, oeffneFarbRad as oeffneFarbRadTeil, starteFarbModus as starteFarbModusTeil, uebernehmeFarben as uebernehmeFarbenTeil, verschiebeKlammern as verschiebeKlammernTeil, zufallsSchema as zufallsSchemaTeil } from "./logik/farbmodus.jsx";
import { beendeMultiAuswahl as beendeMultiAuswahlTeil, brecheQuizAb as brecheQuizAbTeil, infoEintrag as infoEintragTeil, lernstandJeArt as lernstandJeArtTeil, listenMenue as listenMenueTeil, listenWahlMenue as listenWahlMenueTeil, oeffneListeDetail as oeffneListeDetailTeil, oeffneSatzFenster as oeffneSatzFensterTeil, quizRegeln as quizRegelnTeil, satzPortion as satzPortionTeil, sessionSpeicherAktionen as sessionSpeicherAktionenTeil, uebernehmeSaetze as uebernehmeSaetzeTeil, uebernimmListe as uebernimmListeTeil, verlasseRunde as verlasseRundeTeil, zurRundenStatistik as zurRundenStatistikTeil, zurueckZumLernen as zurueckZumLernenTeil, zurueckZurStatistik as zurueckZurStatistikTeil } from "./logik/quizStart.jsx";
import { akzentFehlgriff as akzentFehlgriffTeil, akzentStand as akzentStandTeil, beendeVerzoegerung as beendeVerzoegerungTeil, begrenzeOhneAkzent as begrenzeOhneAkzentTeil, bewerteKarte as bewerteKarteTeil, brecheWiederholungAb as brecheWiederholungAbTeil, deckeKarteAuf as deckeKarteAufTeil, geheZurueck as geheZurueckTeil, getAktVok as getAktVokTeil, karteWeiter as karteWeiterTeil, klickeButton as klickeButtonTeil, memoryTippe as memoryTippeTeil, mitFlash as mitFlashTeil, mitRueckblick as mitRueckblickTeil, mitVerzoegerung as mitVerzoegerungTeil, mitZuordnungMix as mitZuordnungMixTeil, naechsteDiktatVokabel as naechsteDiktatVokabelTeil, naechsteVokabel as naechsteVokabelTeil, naechsteVokabelState as naechsteVokabelStateTeil, naechsteVokabelState0 as naechsteVokabelState0Teil, pruefeAkzente as pruefeAkzenteTeil, pruefeAntwort as pruefeAntwortTeil, pruefeDiktatAntwort as pruefeDiktatAntwortTeil, rueckblickWischen as rueckblickWischenTeil, schliesseAkzenteAb as schliesseAkzenteAbTeil, setzeAkzentVariante as setzeAkzentVarianteTeil, spaltenAbschluss as spaltenAbschlussTeil, spielBeenden as spielBeendenTeil, sprichDiktatNochmal as sprichDiktatNochmalTeil, starteWiederholung as starteWiederholungTeil, ueberspringeWeitere as ueberspringeWeitereTeil, umwerten as umwertenTeil, verteileOhneAkzent as verteileOhneAkzentTeil, waehleAkzentKachel as waehleAkzentKachelTeil, wechsleZuMC as wechsleZuMCTeil, weiterNachSpalte as weiterNachSpalteTeil, zeigeDiktatLoesung as zeigeDiktatLoesungTeil, zeigeLosung as zeigeLosungTeil, zuordnungGruppeTippe as zuordnungGruppeTippeTeil, zuordnungMixWeiter as zuordnungMixWeiterTeil, zuordnungPruefe as zuordnungPruefeTeil, zuordnungRunde as zuordnungRundeTeil, zuordnungRundeAus as zuordnungRundeAusTeil, zuordnungRundeEnde as zuordnungRundeEndeTeil, zuordnungTippe as zuordnungTippeTeil, zuordnungWerte as zuordnungWerteTeil, zuordnungZeitBis as zuordnungZeitBisTeil } from "./logik/abfrage.jsx";

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
  function setzeMinSpalten(...args) { return setzeMinSpaltenTeil({ einstellungen, getSlotsData, listenOrdnerDaten, setSlotsData, speichereEinst, speichereListenOrdnerDaten }, ...args); }
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
  function ordneAn(...args) { return ordneAnTeil({ getSlotsData, lernstandJeArt, listenOrdnerDaten, minSpalten, rasterEinordnen, setAnordnen, setSlotsData, speichereListenOrdnerDaten }, ...args); }   // 203: { art, ordner } – Fenster „Spalten“ (Quiz)
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
  function wechsleStimme(...args) { return wechsleStimmeTeil({ setStimmenWahlState }, ...args); }   // Einstellungen: aufgeklappter Bereich (immer nur einer)
  const infoKontextContainerRef = useRef(null);
  const tooltipTimer = useRef(null);
  const tooltipShown = useRef(false);
  const tooltipStart = useRef(null);   // Fingerposition beim Aufsetzen: kleine Bewegungen brechen den langen Druck nicht ab
  // Erklärtext: Maus = title; Touch = lange drücken → Info-Tafel (bleibt bis Antippen, InfoTafel.jsx);
  // data-info macht das Element im Info-Modus erklärbar
  // aktionen (optional): Lang-Druck bzw. Rechtsklick zeigt die Erklärung mit Menü-Knöpfen darunter
  // opts.langText: anderer Text für den Lang-Druck (z. B. nur der volle Name); opts.beimZeigen(x, y): Rückruf;
  // opts.auswahl: als Auswahl-Tafel zeigen (siehe infoEreignisse.js); opts.eigeneGeste: Touch-Lang-Druck übernimmt die Kachel-Geste
  function tt(...args) { return ttTeil({ farbModusRef, kachelGesteRef, lassoRef, slotZiehenRef, tooltipShown, tooltipStart, tooltipTimer }, ...args); }
  // Eingabefelder/Ziehen: nur Maus-Hinweis + Info-Modus (langes Drücken bleibt Einfügen/Markieren/Ziehen)
  function ttFeld(...args) { return ttFeldTeil({  }, ...args); }
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
  function klappeFreieZu(...args) { return klappeFreieZuTeil({ kontexteRef, setZuklappHinweis, zuklappFreiRef }, ...args); }
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
  function speichereIndex(...args) { return speichereIndexTeil({ setListenIndex, setListenOrdner, speichereEinst }, ...args); }
  // 193: über zielId verweilen bildet einen Ordner (Eintrag) bzw. legt hinein (Ordner) – geht das mit ids?
  function verweilGeht(...args) { return verweilGehtTeil({ getSlotsData, listenOrdnerDaten, listenOrdnerOffenRef, slotOrdnerRef }, ...args); }
  function listenOrdnerDaten(...args) { return listenOrdnerDatenTeil({  }, ...args); }
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
  function gruppiereListen(...args) { return gruppiereListenTeil({ legeListenOrdnerAn, listenOrdnerDaten, listenOrdnerOffenRef, setzeListenPlaetze, verschiebeListenInOrdner }, ...args); }
  function loeseListenOrdnerAuf(...args) { return loeseListenOrdnerAufTeil({ listenOrdnerDaten, listenOrdnerOffenRef, setListenOrdnerOffen, speichereListenOrdnerDaten }, ...args); }
  function benenneListenOrdnerUm(...args) { return benenneListenOrdnerUmTeil({ listenOrdnerDaten, setOrdnerUmbenennen, speichereListenOrdnerDaten }, ...args); }
  // Gezogener Eintrag: ist er markiert, wandert die ganze markierte Gruppe mit.
  // Ziel „raus“ / „raus:<id>“: auf einen Ordner im Pfad (oberste Ebene bzw. dieser Ordner); lange genug über einer
  // Kachel gehalten: Ordner bilden bzw. hinein
  function legeGezogenAb(...args) { return legeGezogenAbTeil({ gruppenZielRef, gruppiere, gruppiereListen, listenOrdnerOffenRef, rasterAuswahlRef, setzeListenPlaetze, setzeSlotPlaetze, slotOrdnerRef, verschiebeInOrdner, verschiebeListenInOrdner }, ...args); }
  // Auswahl-Tafel zeigen bzw. aktualisieren (Inhalt aus dem letzten Render)
  function zeigeAuswahlTafel(...args) { return zeigeAuswahlTafelTeil({ auswahlTafel, auswahlTafelDaten, auswahlTafelRef, auswahlTafelStelle }, ...args); }
  function auswahlTafel(...args) { return auswahlTafelTeil({ auswahlTafelRef, auswahlTafelStelle, setListenWahl, setMultiAuswahl }, ...args); }
  function listenKopieName(...args) { return listenKopieNameTeil({ listenIndex }, ...args); }
  function speichereEinst(...args) { return speichereEinstTeil({ setEinstellungen }, ...args); }

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

  function wechsleSprache(...args) { return wechsleSpracheTeil({ aktiveListeId, ansicht, einstellungen, quizTabListen, setAktiveListe, setAktiveListeId, setAktiverSlot, setAnsicht, setGespeicherteVokabelgruppe, setListenWahl, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizPaketGroesse, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSlotGeaendert, setSprachMenuOffen, setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikListenIds, speichereEinst, spracheVonListe, statistikAktiverSlot, statistikListenIds, zurUebersetzung }, ...args); }

  function setzeListenSprache(...args) { return setzeListenSpracheTeil({ aktiveListe, aktiveListeId, einstellungen, listenIndex, setAktiveListe, speichereEinst, speichereIndex, sprachFilter }, ...args); }
  const vokabelAnzahl = id => { const l = lsGet(SK.liste(id)); return l ? l.vokabeln.length : 0; };

  // ── Listen-Aktionen ───────────────────────────────────────────────────────
  // 195: neue Listen kommen in den geöffneten Listen-Ordner (bzw. beim Import in einen neuen Ordner darin)
  const imListenOrdner = () => {
    const ordner = listenOrdnerOffenRef.current && listenOrdner.some(o => o.id === listenOrdnerOffenRef.current) ? listenOrdnerOffenRef.current : null;
    const np = neuListePlatzRef.current; neuListePlatzRef.current = null;   // 199: auf den lang gedrückten freien Platz
    return { ...(ordner ? { ordner } : {}), ...(np && (np.ordner || null) === ordner ? { platz: np.platz } : {}) };
  };
  function importZielOrdner(...args) { return importZielOrdnerTeil({ importNeuerOrdner, listenOrdnerOffenRef }, ...args); }
  function importOrdnerWahl(...args) { return importOrdnerWahlTeil({ importDateiname, importNeuerOrdner, listenOrdner, listenOrdnerOffen, setImportNeuerOrdner, tt, ttFeld }, ...args); }
  function erstelleListe(...args) { return erstelleListeTeil({ imListenOrdner, listenIndex, modalInput, setModal, setModalFehler, setModalInput, speichereIndex, sprachFilter }, ...args); }

  // Umbenennen/Löschen gelten der Liste aus dem Lang-Druck-Menü, sonst der geöffneten Liste
  function umbenennen(...args) { return umbenennenTeil({ aktiveListeId, listeMenueId, listenIndex, modalInput, setAktiveListe, setListeMenueId, setModal, setModalFehler, setModalInput, speichereIndex }, ...args); }

  function loeschen(...args) { return loeschenTeil({ aktiveListeId, listeMenueId, listenIndex, setAktiveListe, setAktiveListeId, setAnsicht, setListeMenueId, setModal, speichereIndex }, ...args); }

  // Lernstand einer Liste zurücksetzen (gewählte Arten): Vokabeln gelten danach als nie abgefragt
  function setzeListeZurueck(...args) { return setzeListeZurueckTeil({ aktiveListeId, listeMenueId, listenIndex, setAktiveListe, setListeMenueId, setModal, speichereIndex, zuruecksetzenArten }, ...args); }

  // Kopie mit allen Vokabeln und Spalten unter neuem Namen (erster freier Platz im Raster);
  // Lernstände starten neu – die Kopie ist eine eigene Liste mit eigenen Vokabeln
  function dupliziereListe(...args) { return dupliziereListeTeil({ listeMenueId, listenIndex, modalInput, setListeMenueId, setModal, setModalFehler, setModalInput, speichereIndex }, ...args); }

  function speichereSpaltenname(...args) { return speichereSpaltennameTeil({ aktiveListe, aktiveListeId, editSpalteTyp, listenIndex, modalInput, setAktiveListe, setEditSpalteTyp, setModal, setModalInput, speichereIndex }, ...args); }

  // Info-Spalte als „Info“ oder „Synonyme“
  function setzeSpaltenArt(...args) { return setzeSpaltenArtTeil({ aktiveListe, aktiveListeId, listenIndex, setAktiveListe, speichereIndex }, ...args); }
  // Ziel der Synonyme: vorhandene Synonym-Spalte, sonst eine leere Info-Spalte (wird beim Übernehmen „Synonyme“)
  function synZiel(...args) { return synZielTeil({  }, ...args); }
  function synPortion(...args) { return synPortionTeil({ einstellungen, synZiel }, ...args); }
  function oeffneSynFenster(...args) { return oeffneSynFensterTeil({ setModal, setSynFenster }, ...args); }
  function uebernehmeSynonyme(...args) { return uebernehmeSynonymeTeil({ aktiveListeId, listenIndex, setAktiveListe, setSynFenster, speichereIndex, synFenster, synZiel }, ...args); }

  function oeffneModal(...args) { return oeffneModalTeil({ aktiveListe, setEditSpalteTyp, setListeMenueId, setModal, setModalFehler, setModalInput, slotNamenVorschlag }, ...args); }

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
  function schliesseVokabelBearbeiten(...args) { return schliesseVokabelBearbeitenTeil({ setBearbeiteEingaben, setBearbeiteFalsch, setBearbeiteListe, setBearbeiteNur, setBearbeiteVokabel, setModal }, ...args); }

  function speichereVokabelBearbeitung(...args) { return speichereVokabelBearbeitungTeil({ aktiveListeId, bearbeiteEingaben, bearbeiteFalsch, bearbeiteListe, bearbeiteNur, bearbeiteVokabel, listenIndex, schliesseVokabelBearbeiten, setAktiveListe, setModalFehler, setQuiz, speichereIndex }, ...args); }

  // 176: Vokabel herausnehmen / wieder abfragen (bleibt in der Liste, wird nirgends abgefragt und zählt nicht im Fortschritt)
  function setzeHerausgenommen(...args) { return setzeHerausgenommenTeil({ aktiveListeId, setAktiveListe, setFaelligTick }, ...args); }
  // im Quiz: aktuelle Vokabel herausnehmen – sie fällt aus der Runde, weiter mit der nächsten (ohne Wertung)
  function nimmVokabelHeraus(...args) { return nimmVokabelHerausTeil({ flashTimerRef, flashWeiterRef, naechsteVokabelState, quiz, setQuiz, setzeHerausgenommen }, ...args); }
  function loescheVokabel(...args) { return loescheVokabelTeil({ aktiveListe, aktiveListeId, setAktiveListe, setBearbeiteVokabel, setModal }, ...args); }

  function fuehreListenZusammen(...args) { return fuehreListenZusammenTeil({ aktiveListe, aktiveListeId, mergeQuelleId, setAktiveListe, setMergeQuelleId, setModal }, ...args); }

  // ── Export-Aktionen ───────────────────────────────────────────────────────
  function generiereKombiniertenExport(...args) { return generiereKombiniertenExportTeil({  }, ...args); }
  function kopiereListen(...args) { return kopiereListenTeil({ generiereKombiniertenExport, setExportKopiert }, ...args); }

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
  function exportStandardName(...args) { return exportStandardNameTeil({ listenIndex }, ...args); }
  // eingegebener Name → Dateiname: Zeichen, die Dateisysteme nicht erlauben, raus; leer → Vorschlag
  const dateiName = (name, standard) => (name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\.(txt|json)$/i, "").trim() || standard) + ".txt";
  const sicherungStandardName = () => `Vokabel-App Sicherung ${new Date().toISOString().slice(0, 10)}`;
  function teileAlsDatei(...args) { return teileAlsDateiTeil({  }, ...args); }
  // TXT-Export und Gesamtsicherung: erst Fenster mit Dateinamen, dann teileAlsDatei
  function oeffneDateiExport(...args) { return oeffneDateiExportTeil({ setDateiExport, setExportName, setModal }, ...args); }
  function bestaetigeDateiExport(...args) { return bestaetigeDateiExportTeil({ dateiExport, dateiName, exportName, exportStandardName, generiereKombiniertenExport, setDateiExport, setModal, sicherungStandardName, speichereSicherung, teileAlsDatei }, ...args); }


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

  function handleTabWechsel(...args) { return handleTabWechselTeil({ aktiverSlot, ansicht, auswahlTafelRef, beendeMultiAuswahl, getSlotEintrag, ladeSlot, ladeSlotStatistik, listenAendern, multiAuswahl, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, setAktiverSlot, setEinstBereich, setEinstUnter, setFarbTab, setGespeicherteVokabelgruppe, setListenWahl, setMultiAuswahl, setMultiStart, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizTabListen, setSessionSlotAktiv, setSlotSektionAufgeklappt, setSlotVorschau, setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikListenAufgeklappt, setStatistikListenIds, setStatistikSlotGeleert, setStatistikVollbild, setTab, sichtbareListen, slotSektionAufgeklappt, slotVorschau, statistikAktiverSlot, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, statistikStandKey, statistikStartRef, tab, toggleSlotSektion, zurUebersetzung }, ...args); }

  // Statistik: Quiz direkt mit den Vokabeln einer Gruppe (z. B. Negativ) starten.
  // Quiz-Tab wird darauf eingestellt (Bereich = diese Vokabeln, ohne Score-Grenze, Gelernte erlaubt,
  // ohne Quiz-Pakete, gespeicherte Konfiguration gelöst); Spalten/Abfrage-Modus bleiben wie im Quiz-Tab.
  // Passt die Gruppe zur Quiz-Auswahl (gleiche Abfrageart, Listen enthalten), läuft eine einmalige Runde,
  // die Auswahl, Konfiguration und Quiz unberührt lässt – sonst wird der Quiz-Tab umgestellt.
  function gruppenQuizPasst(...args) { return gruppenQuizPasstTeil({ aktiveListeId, quizAbfrageArt, quizTabListen }, ...args); }
  function starteGruppenQuiz(...args) { return starteGruppenQuizTeil({ getKombinierteListe, gruppenQuizPasst, gruppenQuizStartRef, setAktiverSlot, setGespeicherteVokabelgruppe, setGruppenAenderungsDialog, setGruppenQuiz, setGruppenQuizTick, setQuiz, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizGelerntEinschliessen, setQuizReihenfolge, setQuizSchlechtesteMaxScore, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSessionUeberschreibenModal, setSlotGeaendert, setSlotSektionAufgeklappt, setStatistikVollbild, setTab, starteQuiz, wechsleQuizArt }, ...args); }
  const [gruppenQuizTick, setGruppenQuizTick] = useState(0);
  useEffect(() => {
    if (gruppenQuizStartRef.current === 0 || tab !== "quiz") return;
    if (--gruppenQuizStartRef.current > 0) { setGruppenQuizTick(t => t + 1); return; }
    starteQuiz(true);
    setQuiz(q => q && { ...q, ausStatistik: true });
  }, [gruppenQuizTick]);

  function toggleStatistikListe(...args) { return toggleStatistikListeTeil({ setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikListenIds, setStatistikSlotGeleert, sichtbareListen, statistikAktiverSlot, statistikBereichTyp, statistikCheckboxAuswahl }, ...args); }

  // ── Import-Aktionen ───────────────────────────────────────────────────────
  function resetImport(...args) { return resetImportTeil({ neuListePlatzRef, setImportBestehendId, setImportDateiname, setImportFehler, setImportJsonData, setImportMapping, setImportMehrfachListen, setImportNeuName, setImportNeuerOrdner, setImportParsed, setImportText, setImportZielTyp }, ...args); }

  function autoMappeKolumnen(...args) { return autoMappeKolumnenTeil({  }, ...args); }

  function analysiereImport(...args) { return analysiereImportTeil({ autoMappeKolumnen, importNeuName, importText, setImportFehler, setImportJsonData, setImportMapping, setImportMehrfachListen, setImportNeuName, setImportParsed, setImportSprache, setImportText, sprachFilter }, ...args); }

  function importiereAlleListen(...args) { return importiereAlleListenTeil({ importMehrfachListen, importSprache, importZielOrdner, listenIndex, resetImport, setAnsicht, setListenOrdnerOffen, speichereIndex }, ...args); }

  function importiereAusJsonDaten(...args) { return importiereAusJsonDatenTeil({ importJsonData, importZielOrdner, listenIndex, resetImport, setAnsicht, setListenOrdnerOffen, speichereIndex }, ...args); }

  // Einstellungen: Bereiche mit Kopfzeile, immer nur einer offen; der geöffnete rückt unter die Kopfleiste, falls er oben verschwunden ist
  function schalteEinstBereich(...args) { return schalteEinstBereichTeil({ einstBereich, headerH, setEinstBereich, setEinstUnter, setInfoModus }, ...args); }
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
  function sichereAlles(...args) { return sichereAllesTeil({ oeffneDateiExport, sicherungStandardName }, ...args); }
  function speichereSicherung(...args) { return speichereSicherungTeil({ setLetzteSicherung, teileAlsDatei }, ...args); }
  function ladeSicherungsDatei(...args) { return ladeSicherungsDateiTeil({ setSicherungFehler, setSicherungLaden }, ...args); }
  function bestaetigeWiederherstellen(...args) { return bestaetigeWiederherstellenTeil({  }, ...args); }
  const sicherungTage = einstellungen.sicherungErinnerung ?? 7;
  const sicherungAlt = (() => {
    if (!sicherungTage || !listenIndex.length || Date.now() - sicherungSpaeter < SICHERUNG_TAG_MS) return null;
    const seit = letzteSicherung || lsGet(SK.sicherungBasis);
    if (!seit || Date.now() - seit < sicherungTage * SICHERUNG_TAG_MS) return null;
    return { tage: Math.floor((Date.now() - seit) / SICHERUNG_TAG_MS), nie: !letzteSicherung };
  })();

  function exportiereAlsJson(...args) { return exportiereAlsJsonTeil({ exportStandardName, setExportName, setJsonExportIds, setModal }, ...args); }

  function exportiereAlsJsonBestaetigt(...args) { return exportiereAlsJsonBestaetigtTeil({ dateiName, exportName, exportStandardName, jsonExportIds, jsonExportOptionen, setJsonExportIds, setModal, teileAlsDatei }, ...args); }

  function setzeMapping(...args) { return setzeMappingTeil({ setImportMapping }, ...args); }

  function getBestehendeListe(...args) { return getBestehendeListeTeil({ importBestehendId }, ...args); }

  // Gibt die Ziel-Optionen für bestehende Liste zurück:
  // aktive Spalten (by name) + freie Slots (als "Neu: typ")
  function getBestehendZielOptionen(...args) { return getBestehendZielOptionenTeil({  }, ...args); }

  function fuehreImportDurch(...args) { return fuehreImportDurchTeil({ getBestehendeListe, imListenOrdner, importBestehendId, importMapping, importNeuName, importParsed, importSprache, importZielTyp, listenIndex, resetImport, setAnsicht, setImportFehler, speichereIndex }, ...args); }

  // ── Quiz-Aktionen ─────────────────────────────────────────────────────────
  function toggleQuizSpalte(...args) { return toggleQuizSpalteTeil({ quizFrageTyp, setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizFrageTyp, setQuizInfoTypenSession, setQuizSpalteModus }, ...args); }

  function toggleSpalteRolle(...args) { return toggleSpalteRolleTeil({ leuchte, quizAntwortTypenGeordnet, quizArt, quizFrageTyp, quizInfoTypenSession, setQuizAntwortTypenGeordnet, setQuizFrageTyp, setQuizInfoTypenSession, setQuizSpalteModus }, ...args); }

  function toggleInfoSpalte(...args) { return toggleInfoSpalteTeil({ setQuizZeigeInfo }, ...args); }

  function toggleVokCheckbox(...args) { return toggleVokCheckboxTeil({ setQuizCheckboxAuswahl }, ...args); }

  // ── Slot-Hilfsfunktionen ──────────────────────────────────────────────────

  function getSlotsData(...args) { return getSlotsDataTeil({  }, ...args); }

  function setSlotsData(...args) { return setSlotsDataTeil({ setSlots }, ...args); }

  // Raster: Plätze vergeben und bei Bedarf Zeilen anhängen (Einstellung wird mitgespeichert)
  function rasterEinordnen(...args) { return rasterEinordnenTeil({ speichereEinst }, ...args); }
  function setzeSlotPlaetze(...args) { return setzeSlotPlaetzeTeil({ getSlotsData, rasterEinordnen, setSlotAuswahl, setSlotsData, slotOrdnerRef, speichereEinst }, ...args); }
  // Quiz in eine Gruppe (oder mit null heraus auf die oberste Ebene); sie kommen dort ans Ende
  function verschiebeInOrdner(...args) { return verschiebeInOrdnerTeil({ getSlotsData, rasterEinordnen, setInGruppe, setMultiAuswahl, setSlotAuswahl, setSlotSortModus, setSlotsData }, ...args); }
  // neuer Ordner (193/194) in der geöffneten Ebene – aus Quiz/Ordnern (nimmt den Platz des ersten ein) oder leer (platz)
  function legeOrdnerAn(name, ids, platz = null, eltern = slotOrdnerRef.current) {
    if (ordnerPfad(getSlotsData().ordner, eltern).length >= ORDNER_TIEFE_MAX) return null;
    const id = neuerSlotId("ordner");
    setSlotsData(rasterEinordnen(neuerOrdnerIn(rasterEinordnen(getSlotsData()), { id, name, eltern, ids, platz })));
    setMultiAuswahl(null); setSlotSortModus(false); setSlotAuswahl([]); setInGruppe(null);
    return id;
  }
  // Gezogene Quiz auf ein Quiz (neuer Ordner aus allen, an deren Platz) bzw. in einen Ordner
  function gruppiere(...args) { return gruppiereTeil({ getSlotsData, legeOrdnerAn, rasterEinordnen, setzeSlotPlaetze, slotOrdnerRef, verschiebeInOrdner }, ...args); }
  // Ordner auflösen: Inhalt eine Ebene hinauf (der erste auf den Platz des Ordners)
  function loeseOrdnerAuf(...args) { return loeseOrdnerAufTeil({ getSlotsData, rasterEinordnen, setSlotOrdner, setSlotsData, slotOrdner }, ...args); }
  function benenneOrdnerUm(...args) { return benenneOrdnerUmTeil({ getSlotsData, setOrdnerUmbenennen, setSlotsData }, ...args); }

  // 217: typ "listen" = eine Liste als Quiz (slots.listen[] je Liste: konfiguration, sessionFortschritte, lernStaende);
  // Name kommt aus dem Listen-Index, konfiguration erst nach dem ersten Start (vorher Standard-Einstellungen)
  function getSlotEintrag(...args) { return getSlotEintragTeil({ getSlotsData }, ...args); }
  // 217: Eintrag einer Liste anlegen (falls noch nicht da) bzw. ändern
  function aendereListenEintrag(...args) { return aendereListenEintragTeil({ getSlotsData, setSlotsData }, ...args); }

  function aktuelleKonfiguration(...args) { return aktuelleKonfigurationTeil({ artEinstellungenJetzt, quizAntwortTypenGeordnet, quizArt, quizArtStash, quizAusgewaehlt, quizBereichTyp, quizCheckboxAuswahl, quizDiktatSpalte, quizDiktatUebersetzung, quizFrageTyp, quizInfoTypenSession, quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizSpalteModus, quizTabListen, quizUnbeantwortetZuerst, quizZeigeInfo }, ...args); }
  function artEinstellungenJetzt(...args) { return artEinstellungenJetztTeil({ quizAntwortTypenGeordnet, quizAusgewaehlt, quizDiktatSpalte, quizDiktatUebersetzung, quizFrageTyp, quizInfoTypenSession, quizModus, quizReihenfolge, quizSchlechtesteMaxScore, quizSpalteModus, quizUnbeantwortetZuerst, quizZeigeInfo }, ...args); }
  function wendeArtEinstellungenAn(...args) { return wendeArtEinstellungenAnTeil({ setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizDiktatSpalte, setQuizDiktatUebersetzung, setQuizFrageTyp, setQuizInfoTypenSession, setQuizModus, setQuizReihenfolge, setQuizSchlechtesteMaxScore, setQuizSpalteModus, setQuizUnbeantwortetZuerst, setQuizZeigeInfo }, ...args); }
  // Ü|D|A: Einstellungen der bisherigen Art merken, die der neuen Art laden (oder Standard)
  // neues Quiz (ohne geladene Konfiguration) beginnt immer in Übersetzung
  function zurUebersetzung(...args) { return zurUebersetzungTeil({ quizArt, wechsleQuizArt }, ...args); }
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
  function faelligeSchluessel(...args) { return faelligeSchluesselTeil({ FORTSCHRITT_FELD, quizArt }, ...args); }
  const faelligVonSlots = ids => faelligeSchluessel(ids.map(id => getSlotEintrag("gespeichert", id)?.konfiguration).filter(Boolean));
  const faelligVonListen = ids => faelligeSchluessel([{ listenIds: ids }]);
  // 170: nichts fällig → inaktiver Knopf als Hinweis (man sieht dort nach)
  const faelligAktion = (keys, ausListe = null) => [keys.length ? { label: `🔁 Fällige wiederholen (${keys.length})`, fn: () => ladeFaellige(keys, ausListe) }
    : { label: "🔁 Keine fälligen Vokabeln", aus: true, fn: () => {} }];
  // fällige Vokabeln über alle sichtbaren Listen (für „🔁 Fällige wiederholen“) – beim Öffnen der Auswahl neu berechnet
  const faelligAlle = useMemo(() => slotSektionAufgeklappt && (tab === "quiz" || tab === "statistik") ? faelligeSchluessel([{ listenIds: sichtbareListen.map(l => l.id) }]) : [],
    [slotSektionAufgeklappt, tab, listenIndex, sprachFilter, quizArt, faelligTick]);   // eslint-disable-line react-hooks/exhaustive-deps
  function ladeFaellige(...args) { return ladeFaelligeTeil({ aktuelleKonfiguration, applyKonfiguration, ausListeRef, auswahlTafelRef, leuchte, setAktiverSlot, setAnsicht, setGespeicherteVokabelgruppe, setListenWahl, setMultiAuswahl, setSlotSektionAufgeklappt, setSlotVorschau, setTab }, ...args); }
  function applyKonfiguration(...args) { return applyKonfigurationTeil({ getKombinierteListe, listenIndex, setQuizArt, setQuizArtStash, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizHeuteEinschliessen, setQuizTabListen, setStartLeerHinweis, wendeArtEinstellungenAn }, ...args); }

  // Nach dem Antippen einer Kachel bleibt die Auswahl einen Moment offen, damit man die neu markierte Kachel sieht
  function schliesseSlotsVerzoegert(...args) { return schliesseSlotsVerzoegertTeil({ leuchte, setSlotSektionAufgeklappt, slotZuTimerRef }, ...args); }

  function ladeSlot(...args) { return ladeSlotTeil({ aktiviereSlotFortschritt, applyKonfiguration, ausListeRef, getSlotEintrag, listeAlsQuizVorbereiten, neuImOrdnerRef, schliesseSlotsVerzoegert, setAktiverSlot, setGespeicherteVokabelgruppe, setListenAendern, setListenAuswahlAufgeklappt, setQuizAbfrageModusAufgeklappt, setQuizEinstellungenAufgeklappt, setQuizErstellen, setQuizListeAufgeklappt, setQuizReihenfolgeAufgeklappt, setQuizSessionAufgeklappt, setSlotGeaendert }, ...args); }
  // 217: Liste zum ersten Mal als Quiz – Standard-Einstellungen (wie früher „Quiz starten“), Kopf zeigt die Liste
  function listeAlsQuizVorbereiten(...args) { return listeAlsQuizVorbereitenTeil({ aktiviereSlotFortschritt, getSlotEintrag, initQuizDefaults, schliesseSlotsVerzoegert, setAktiverSlot, setGespeicherteVokabelgruppe, setGruppenAenderungsDialog, setListenAendern, setListenAuswahlAufgeklappt, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizHeuteEinschliessen, setQuizListeAufgeklappt, setQuizPaketGroesse, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSessionUeberschreibenModal, setSlotGeaendert, setStartLeerHinweis }, ...args); }
  // 217: „Quiz erstellen“ – Quiz-Tab mit dieser Liste (Listenauswahl ausgeblendet), Bereich + Einstellungen wählen;
  // der grüne Kopf „＋ Quiz erstellen“ öffnet das Fenster (Name, Ordner)
  function starteQuizErstellen(...args) { return starteQuizErstellenTeil({ ausListeRef, handleTabWechsel, initQuizDefaults, setAktiverSlot, setAnsicht, setGespeicherteVokabelgruppe, setListenAendern, setListenAuswahlAufgeklappt, setQuiz, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizErstellen, setQuizListeAufgeklappt, setQuizPaketGroesse, setQuizSessionAufgeklappt, setQuizSessionModus, setQuizTabListen, setSessionSlotAktiv, setSlotGeaendert, setSlotSektionAufgeklappt }, ...args); }
  function erstelleQuiz(...args) { return erstelleQuizTeil({ erstellenFenster, neuImOrdnerRef, setErstellenFenster, setQuizErstellen, setSlotOrdner, speichereAlsGespeichert }, ...args); }
  // 217: Einstellungen der Liste merken (beim Start einer Runde)
  function speichereListenKonfig(...args) { return speichereListenKonfigTeil({ aendereListenEintrag, aktuelleKonfiguration }, ...args); }

  // Quiz-Fortschritt der Abfrageart aus dem Slot-Eintrag aktivieren (oder kein Quiz, wenn es keinen gibt)
  function aktiviereSlotFortschritt(...args) { return aktiviereSlotFortschrittTeil({ setQuizPaketGroesse, setQuizSessionModus, setSessionSlotAktiv }, ...args); }

  function ladeSlotStatistik(...args) { return ladeSlotStatistikTeil({ getSlotEintrag, schliesseSlotsVerzoegert, setListenAendern, setStatistikAktiverSlot, setStatistikArt, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikListenAufgeklappt, setStatistikListenIds, setStatistikSlotGeleert }, ...args); }

  // Abfrage ohne Pakete im Verlauf festhalten (mit Start-Scores für die Statistik).
  // Gespeicherte Konfiguration oder unveränderter Verlauf-Eintrag → kein neuer Eintrag.
  function merkeRundeImVerlauf(...args) { return merkeRundeImVerlaufTeil({ aktuelleKonfiguration, erstelleVerlaufEintrag, getSlotEintrag, getSlotsData, setSlotsData }, ...args); }

  function erstelleVerlaufEintrag(...args) { return erstelleVerlaufEintragTeil({ aktuelleKonfiguration, getSlotsData, setAktiverSlot, setSlotGeaendert, setSlotsData }, ...args); }

  // ── Lernen: Wort zeigen (ggf. vorlesen), nach einer Pause die Übersetzung, dann die nächste Vokabel ──
  function lernEinstellungen(...args) { return lernEinstellungenTeil({ einstellungen }, ...args); }
  // Pause nach dem aktuellen Abschnitt (s); ohne Zusatzinfo gilt nach der Übersetzung die längere von Übersetzung/Info
  function lernPause(...args) { return lernPauseTeil({ lernEinstellungen, lernInfoZeigen }, ...args); }
  function setzeLernEinst(...args) { return setzeLernEinstTeil({ einstellungen, lernEinstellungen, speichereEinst }, ...args); }
  // Lernstand je gespeicherter Konfiguration / Verlaufseintrag und Abfrageart (lernStaende), getrennt vom Abfrage-Fortschritt:
  // { ids (ganze Lern-Reihenfolge), groesse, start, index, fertig, quizGemacht, zeit }
  function lernStandVon(...args) { return lernStandVonTeil({ slots }, ...args); }
  function setzeLernStand(...args) { return setzeLernStandTeil({ aendereListenEintrag, getSlotsData, setSlotsData }, ...args); }
  // alle: ganze Quiz in Abfrage-Reihenfolge; groesse: Paketgröße (null = alle auf einmal);
  // stand: gespeicherter Lernstand → Reihenfolge und Stelle von damals (fehlende Vokabeln fallen weg)
  function starteLernen(...args) { return starteLernenTeil({ aktiverSlot, erstelleVerlaufEintrag, lernEinstellungen, quizAbfrageArt, quizKombiListe, setLernResetFrage, setLernen }, ...args); }
  // Zusatzinfo dieser Vokabel zeigen? (Schalter auf dem Lernbildschirm, nur wenn es Info-Text gibt)
  function lernInfoZeigen(...args) { return lernInfoZeigenTeil({ lernEinstellungen }, ...args); }
  function lernenWeiter(...args) { return lernenWeiterTeil({ lernInfoZeigen, setLernen }, ...args); }
  function lernenVor(...args) { return lernenVorTeil({ setLernen }, ...args); }
  function lernenZurueck(...args) { return lernenZurueckTeil({ setLernen }, ...args); }
  function beendeLernen(...args) { return beendeLernenTeil({ klappeUebersichtEin, setLernen }, ...args); }
  // nächstes Paket des Quiz (nach dem letzten: Endbildschirm bleibt)
  function naechstesLernPaket(...args) { return naechstesLernPaketTeil({  }, ...args); }
  // Quiz mit genau den eben gezeigten Vokabeln – einmal je Paket, ohne Punktabzug; danach das nächste Paket
  function starteLernQuiz(...args) { return starteLernQuizTeil({ lernen, setLernen, setQuiz, starteQuiz }, ...args); }

  // Multiquiz: Vokabeln mehrerer gespeicherter Konfigurationen zusammen, Einstellungen von der ersten
  function multiZusammenstellung(...args) { return multiZusammenstellungTeil({ getSlotsData, listenIndex }, ...args); }
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

  function speichereAlsGespeichert(...args) { return speichereAlsGespeichertTeil({ aktiverSlot, aktuelleKonfiguration, getSlotsData, multiVonSlot, neuImOrdnerRef, neuPlatzRef, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, rasterEinordnen, setAktiverSlot, setGespeicherteVokabelgruppe, setListenAendern, setSlotGeaendert, setSlotsData }, ...args); }

  // Geänderte Vokabelauswahl in die geladene gespeichertes Quiz übernehmen. Ihr Quiz-Fortschritt (je Abfrageart)
  // passt sich an: „abgefragt“ behält nur Vokabeln im neuen Bereich, neue zählen als noch nicht abgefragt
  function ueberspeichereSession(...args) { return ueberspeichereSessionTeil({ aktiverSlot, getKombinierteListe, getSlotEintrag, getSlotsData, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, setSessionSlotAktiv, setSlotsData, speichereAlsGespeichert }, ...args); }

  // ── Liste in mehrere Quiz aufteilen: Quiz-Tab mit dieser Liste, alle Einstellungen wie gewohnt,
  // dann je Gruppe eine gespeicherte Konfiguration „Name (21 - 40)“ ──
  function starteAufteilen(...args) { return starteAufteilenTeil({ setAktiverSlot, setAufteilen, setGespeicherteVokabelgruppe, setListenAuswahlAufgeklappt, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizListeAufgeklappt, setQuizTabListen, setQuizVonBisErster, setQuizVonBisModus, setSlotGeaendert, setSlotSektionAufgeklappt, setTab, zurUebersetzung }, ...args); }
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
  function legeAufteilenAn(...args) { return legeAufteilenAnTeil({ aktuelleKonfiguration, aufteilen, aufteilenStand, getSlotsData, neuImOrdnerRef, rasterEinordnen, setAufteilen, setSlotOrdner, setSlotSektionAufgeklappt, setSlotsData }, ...args); }

  // Kopie einer gespeicherten Konfiguration unter neuem Namen: gleiche Einstellungen,
  // eigener (leerer) Quiz-Fortschritt, erster freier Platz im Raster
  function dupliziereSlot(...args) { return dupliziereSlotTeil({ getSlotsData, rasterEinordnen, setSlotsData }, ...args); }
  // freier Name "Name (Kopie)", "Name (Kopie 2)" …
  function kopieName(...args) { return kopieNameTeil({ slots }, ...args); }

  function benenneSlotUm(...args) { return benenneSlotUmTeil({ getSlotsData, setSlotsData }, ...args); }

  // Auswahl löschen (nach Rückfrage): Konfigurationen bzw. Listen mit Vokabeln
  function loescheAuswahl(...args) { return loescheAuswahlTeil({ aktiveListeId, auswahlLoeschen, listenIndex, loescheSlotEintrag, setAktiveListe, setAktiveListeId, setAnsicht, setAuswahlLoeschen, setListenWahl, setMultiAuswahl, speichereIndex }, ...args); }

  function loescheSlotEintrag(...args) { return loescheSlotEintragTeil({ aktiverSlot, getSlotsData, setAktiverSlot, setLoescheSlotNr, setSessionSlotAktiv, setSlotGeaendert, setSlotsData, zurUebersetzung }, ...args); }

  // Quiz-Fortschritt je Abfrageart (Übersetzung / Diktat / Akzente) getrennt im Slot-Eintrag
  function updateSlotSF(...args) { return updateSlotSFTeil({ aendereListenEintrag, getSlotsData, setSlotsData }, ...args); }

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
  function erstAusQuiz(...args) { return erstAusQuizTeil({  }, ...args); }

  function updateSessionSlotFortschritt(...args) { return updateSessionSlotFortschrittTeil({ erstAusQuiz, quiz, sessionSF, setSessionSlotAktiv, updateSlotSF }, ...args); }

  // Löscht nur den Fortschritt der aktuellen Abfrageart; die anderen Arten bleiben im Slot erhalten
  function loescheSessionSlot(...args) { return loescheSessionSlotTeil({ setSessionSlotAktiv, updateSlotSF }, ...args); }

  // "Neu": komplett neu beginnen – Quiz, Listen-/Vokabelauswahl und alle Abfrage-Einstellungen
  function neueQuizKonfiguration(...args) { return neueQuizKonfigurationTeil({ setAktiverSlot, setGespeicherteVokabelgruppe, setListenAendern, setListenAuswahlAufgeklappt, setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizDiktatSpalte, setQuizFrageTyp, setQuizInfoTypenSession, setQuizPaketGroesse, setQuizSessionModus, setQuizSpalteModus, setQuizTabListen, setQuizZeigeInfo, setSessionSlotAktiv, setSlotGeaendert, setSlotSektionAufgeklappt, setzeQuizEinstellungenZurueck }, ...args); }

  function initQuizDefaults(...args) { return initQuizDefaultsTeil({ aktiveListe, setQuizAntwortTypenGeordnet, setQuizAusgewaehlt, setQuizFrageTyp, setQuizInfoTypenSession, setQuizSpalteModus, setQuizZeigeInfo, setzeQuizEinstellungenZurueck }, ...args); }

  // Abfrage-Einstellungen ohne Spalten auf Standard (Quiz-Start aus Liste, "Neu")
  function setzeQuizEinstellungenZurueck(...args) { return setzeQuizEinstellungenZurueckTeil({ setAbfrageZielAnzahl, setAbfrageZielModus, setAbfrageZielScore, setAbfrageZielScoreTyp, setAbfrageZielWiederholung, setQuizArt, setQuizArtStash, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizGelerntEinschliessen, setQuizHeuteEinschliessen, setQuizListeAufgeklappt, setQuizModus, setQuizReihenfolge, setQuizSchlechtesteMaxScore, setQuizUnbeantwortetZuerst, setQuizVonBisErster, setQuizVonBisModus }, ...args); }

  function getKombinierteListe(...args) { return getKombinierteListeTeil({  }, ...args); }

  function toggleQuizTabListe(...args) { return toggleQuizTabListeTeil({ leuchte, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizTabListen }, ...args); }

  // Quiz-Tab: immer nur ein Bereich offen – wer einen öffnet, schließt alle anderen
  // aufgeklappter Zeilen-Knopf: oben der Wert (kurz), darunter „Bestätigen“ (antippen klappt zu)
  const offenText = (offen, kurz) => offen ? <span data-bestaetigen>Bestätigen</span> : kurz;
  function schliesseQuizBereiche(...args) { return schliesseQuizBereicheTeil({ setListenAuswahlAufgeklappt, setMultiAuswahl, setQuizAbfrageModusAufgeklappt, setQuizEinstellungenAufgeklappt, setQuizListeAufgeklappt, setQuizReihenfolgeAufgeklappt, setQuizSessionAufgeklappt, setQuizStufeAufgeklappt, setSlotSektionAufgeklappt }, ...args); }
  function toggleSessionBereich(...args) { return toggleSessionBereichTeil({ quizSessionAufgeklappt, schliesseQuizBereiche, setQuizSessionAufgeklappt }, ...args); }

  function toggleListenAuswahl(...args) { return toggleListenAuswahlTeil({ dropdownImmuneRef, headerH, leuchte, listenAuswahlAufgeklappt, listenContainerRef, listenauswahlHeaderH, schliesseQuizBereiche, setListenAuswahlAufgeklappt, slotH }, ...args); }

  function toggleReihenfolge(...args) { return toggleReihenfolgeTeil({ abfrageModusH, alleBereichH, dropdownImmuneRef, headerH, listenauswahlHeaderH, quizReihenfolgeAufgeklappt, reihenfolgeContainerRef, schliesseQuizBereiche, setQuizReihenfolgeAufgeklappt, slotH }, ...args); }

  function toggleEinstellungen(...args) { return toggleEinstellungenTeil({ abfrageModusH, alleBereichH, dropdownImmuneRef, einstellungenContainerRef, einstellungenH, headerH, listenauswahlHeaderH, quizEinstellungenAufgeklappt, reihenfolgeH, schliesseQuizBereiche, setQuizEinstellungenAufgeklappt, slotH }, ...args); }

  useEffect(() => { if (!quizAbfrageModusAufgeklappt) { setArtenMehrfach(null); setAntwortMehrfach(false); } }, [quizAbfrageModusAufgeklappt]);
  function toggleAbfrageModus(...args) { return toggleAbfrageModusTeil({ abfrageModusContainerRef, abfrageModusH, alleBereichH, dropdownImmuneRef, headerH, listenauswahlHeaderH, quizAbfrageModusAufgeklappt, schliesseQuizBereiche, setQuizAbfrageModusAufgeklappt, slotH }, ...args); }

  function toggleEinzelauswahl(...args) { return toggleEinzelauswahlTeil({ alleBereichH, dropdownImmuneRef, einzelauswahlRef, headerH, listenauswahlHeaderH, quizListeAufgeklappt, schliesseQuizBereiche, setQuizListeAufgeklappt, slotH }, ...args); }

  function toggleSlotSektion(...args) { return toggleSlotSektionTeil({ aktiverSlot, dropdownImmuneRef, headerH, leuchte, schliesseQuizBereiche, setAuswahlListen, setMultiAuswahl, setSlotAuswahl, setSlotSektionAufgeklappt, setSlotSortModus, slotContainerRef, slotH, slotSektionAufgeklappt, slotZuTimerRef, tab }, ...args); }

  function toggleStatistikListenAuswahl(...args) { return toggleStatistikListenAuswahlTeil({ dropdownImmuneRef, headerH, setStatistikListenAufgeklappt, slotH, statistikListenAufgeklappt, statistikListenContainerRef }, ...args); }

  function toggleStatistikEinzelauswahl(...args) { return toggleStatistikEinzelauswahlTeil({ dropdownImmuneRef, headerH, setStatistikEinzelauswahlAufgeklappt, slotH, statistikEinzelauswahlAufgeklappt, statistikEinzelauswahlRef, statistikListenHeaderH, statistikVokauswahlH }, ...args); }

  // zurück zur Übersicht – eingeklappt (alle Bereiche zu bis auf die Quiz-Auswahl (190), nach oben); nur „Pause“ lässt
  // die Bereiche, wie sie waren
  function beendeQuiz(...args) { return beendeQuizTeil({ ausListeRef, klappeUebersichtEin, listenIndex, oeffneListeDetail, setAnsicht, setListeVorschau, setListenOrdnerOffen, setQuiz, setTab, zuEinstListen }, ...args); }
  function klappeUebersichtEin(...args) { return klappeUebersichtEinTeil({ schliesseQuizBereiche, setQuizModusInfoAufgeklappt, setSlotSektionAufgeklappt }, ...args); }

  // Statistik-Vollbild: Kopfzeile zeigt den Lernfortschritt der EINGEBLENDETEN Gruppen
  function renderVollbildKopf(...args) { return renderVollbildKopfTeil({ einstellungen, statistikArt, statistikFilter, statistikGefilterteVoks, tt }, ...args); }

  // Rundenergebnis im Kasten: Kreisdiagramm richtig/falsch, Zahlen daneben, Lern-Bilanz darunter
  function renderRundenErgebnis(...args) { return renderRundenErgebnisTeil({ renderLernBilanz, tt }, ...args); }

  // Fortschritt des ganzen Quiz während der Abfrage (Kopfzeile): frühere Pakete + Position im aktuellen
  // Paket; in der Wiederholung gilt das Paket als durch. Ohne Pakete: diese Runde.
  function sessionStandImQuiz(...args) { return sessionStandImQuizTeil({  }, ...args); }
  function renderKopfFortschritt(...args) { return renderKopfFortschrittTeil({ sessionStandImQuiz, tt }, ...args); }

  // ── Quiz-Auswertung (zweiter Bildschirm nach „Weiter →“) ──
  // Quiz mit Paketen: alle Vokabeln des Quiz seit Durchlauf-Start; sonst: diese Runde
  function sessionAuswertungDaten(...args) { return sessionAuswertungDatenTeil({ erstAusQuiz }, ...args); }
  function renderSessionAuswertung(...args) { return renderSessionAuswertungTeil({ einstellungen, ttFeld }, ...args); }
  // ganze Seite des Quiz-Auswertung mit den gewohnten Knöpfen darunter
  function sessionAuswertungSeite(...args) { return sessionAuswertungSeiteTeil({ farbModusUI, farbRadUI, renderSessionAuswertung, sessionAuswertungDaten, tt }, ...args); }
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
  function zuEinstListen(...args) { return zuEinstListenTeil({ setAnsicht, setEinstBereich, setListenWahl, setTab }, ...args); }
  const weiterZurAuswertung = (
    <button data-zur-auswertung {...tt("Weiter zur Auswertung des ganzen Quiz: Start und Ende im Vergleich")} className="btn btn-primary" style={{width:"100%", fontSize:"1.05rem"}}
      onClick={() => { setQuiz(q => q && { ...q, sessionAuswertung: true }); window.scrollTo(0, 0); }}>Weiter →</button>
  );

  // Lern-Bilanz am Rundenende: neu gelernte Vokabeln (Gelernt-Schwelle erreicht) bzw. Gratulation
  function renderLernBilanz(...args) { return renderLernBilanzTeil({ einstellungen, tt }, ...args); }

  // Namensvorschlag für gespeicherte Konfigurationen: Sprache(n) + Datum, eindeutig
  // 216: ungespeichertes Quiz aus genau einer Liste – deren Name (Teil der Liste: „· Nr. 1–10“ bzw. „· Auswahl“)
  function einListenName(...args) { return einListenNameTeil({ listenIndex, quizBereichTyp, quizCheckboxAuswahl, quizTabListen }, ...args); }
  function slotNamenVorschlag(...args) { return slotNamenVorschlagTeil({ aktiverSlot, einListenName, multiVonSlot, quizTabListen, slots, spracheVonListe }, ...args); }

  // Suchleiste über einer Vokabelliste (Einzelauswahl Quiz/Statistik, Listenansicht): Treffer anspringen (‹ ›, Enter)
  // oder mit „nur Treffer“ filtern. Zeilen tragen data-such-ziel={art} data-such-id={vok.id}.
  // Vokabel-Auswahl: zum Anfang des nächsten zusammenhängenden gewählten Stücks springen (zyklisch)
  const sprungRef = useRef({});
  function auswahlStuecke(...args) { return auswahlStueckeTeil({  }, ...args); }
  function sprungKnopf(...args) { return sprungKnopfTeil({ auswahlStuecke, setSprungTick, sprungRef, tt }, ...args); }
  function suchInfo(...args) { return suchInfoTeil({  }, ...args); }
  // Hervorhebung einer Zeile: aktueller Treffer kräftig, weitere Treffer zart (linker Rand)
  function suchMarke(...args) { return suchMarkeTeil({  }, ...args); }
  function springeZuTreffer(...args) { return springeZuTrefferTeil({  }, ...args); }
  // Nach einer Aktion in der Vokabelliste (Häkchen, Von–Bis): Tastatur der Suche schließen und die Zeile im Blick halten –
  // verschoben wird nur, wenn sie danach verdeckt oder außerhalb liegt (Tastatur zu, Tafel unten, Liste länger), dann in die Mitte
  function sichtbarHalten(...args) { return sichtbarHaltenTeil({  }, ...args); }
  function zeileImBlick(...args) { return zeileImBlickTeil({ sichtbarHalten }, ...args); }
  // Lang-Druck auf eine Vokabelzeile: Von–Bis mit dieser Vokabel als Anfang
  function vonBisLangDruck(...args) { return vonBisLangDruckTeil({ setQuizVonBisErster, setQuizVonBisModus, setStatistikVonBisErster, setStatistikVonBisModus, tt, vonBisTafelRef, zeileImBlick }, ...args); }
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
  function dupliziereSchema(...args) { return dupliziereSchemaTeil({ eigeneSchemata, einstellungen, schemaName, setSchemaBearbeiten, speichereEinst }, ...args); }
  // 🎲 Zufällige Farben: ersetzt das Schema „Zufall“ (umbenannte oder duplizierte bleiben erhalten)
  function zufallsSchema(...args) { return zufallsSchemaTeil({ eigeneSchemata, einstellungen, schemaBearbeiten, setSchemaBearbeiten, speichereEinst }, ...args); }
  function aendereEigenesSchema(...args) { return aendereEigenesSchemaTeil({ eigeneSchemata, einstellungen, speichereEinst }, ...args); }
  function loescheSchema(...args) { return loescheSchemaTeil({ eigeneSchemata, einstellungen, schemaBearbeiten, setModal, setSchemaBearbeiten, setSchemaMenueId, speichereEinst }, ...args); }
  const vollHex = h => /^#[0-9a-f]{3}$/i.test(h) ? "#" + h.slice(1).split("").map(c => c + c).join("") : h;
  function renderFarbschemata(...args) { return renderFarbschemataTeil({ aendereEigenesSchema, beendeFarbModus, dupliziereSchema, eigeneSchemata, einstZeile, einstellungen, farbModus, farbTab, oeffneFarbRad, schemaBearbeiten, setFarbTab, setModal, setModalFehler, setModalInput, setSchemaBearbeiten, setSchemaMenueId, speichereEinst, starteFarbModus, tt, ttFeld, vorhandeneSprachen, zufallsSchema }, ...args); }

  // ── Aufräum-Werkzeug: Klammerhinweise der Wort-Spalten in eine Info-Spalte verschieben ──
  function klammerAenderungen(...args) { return klammerAenderungenTeil({  }, ...args); }
  function verschiebeKlammern(...args) { return verschiebeKlammernTeil({ aktiveListe, klammerAenderungen, klammerZiel, listenIndex, setAktiveListe, setModal, speichereIndex }, ...args); }

  // ── Farbwähler (Farbkreis): live über CSS-Variablen, ohne die App neu aufzubauen ──
  function oeffneFarbRad(...args) { return oeffneFarbRadTeil({ setFarbRad, vollHex }, ...args); }
  // nur diese Element-Art: eigene Regel statt der Rolle
  function oeffneElementFarbRad(...args) { return oeffneElementFarbRadTeil({ elementVorschau, setFarbRad, vollHex }, ...args); }
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
  function farbRadAnwenden(...args) { return farbRadAnwendenTeil({ eigeneSchemata, einstellungen, farbRad, liveEntfernen, setElementVorschau, setFarbRad, setFarbVorschau, speichereEinst }, ...args); }
  function farbRadAbbrechen(...args) { return farbRadAbbrechenTeil({ liveEntfernen, setFarbRad }, ...args); }
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
  function starteFarbModus(...args) { return starteFarbModusTeil({ einstellungen, setElementVorschau, setFarbModus, setFarbVorschau, setSchemaBearbeiten }, ...args); }
  function beendeFarbModus(...args) { return beendeFarbModusTeil({ setElementVorschau, setFarbFeld, setFarbMarke, setFarbModus, setFarbName, setFarbVorschau }, ...args); }
  // eigene Farbe einer Element-Art entfernen → wieder die Rolle
  function entferneElementFarbe(...args) { return entferneElementFarbeTeil({ setElementVorschau }, ...args); }
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
  function uebernehmeFarben(...args) { return uebernehmeFarbenTeil({ aendereEigenesSchema, beendeFarbModus, eigeneSchemata, einstellungen, elementVorschau, farbVorschau, schemaName, setFarbFeld, setFarbName, speichereEinst }, ...args); }
  // Farbrollen der Elemente im Umkreis von (x, y): je Element Hintergrund, Schrift, Rahmen bzw. bei Grafik Füllung, Linie
  function farbRollenBei(...args) { return farbRollenBeiTeil({ vollHex }, ...args); }
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
  function oeffneSatzFenster(...args) { return oeffneSatzFensterTeil({ setListenSaetze, setModal, setSatzFenster }, ...args); }
  function satzPortion(...args) { return satzPortionTeil({ einstellungen }, ...args); }
  function uebernehmeSaetze(...args) { return uebernehmeSaetzeTeil({ ladeSatzStand, listenSaetze, satzFenster, setListenSaetze, setSatzFenster }, ...args); }
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
  function oeffneListeDetail(...args) { return oeffneListeDetailTeil({ setAktiveListeId, setAnsicht, setListeNurAus, setListenBereich, setTab, vorigerListenBereich }, ...args); }
  function listenMenue(...args) { return listenMenueTeil({ faelligAktion, faelligVonListen, listenKopieName, listenOrdner, oeffneExport, oeffneListeDetail, oeffneSatzFenster, oeffneSynFenster, resetImport, setAnsicht, setImportBestehendId, setImportZielTyp, setInGruppe, setKlammerZiel, setListeMenueId, setListeNurAus, setListenAuswahl, setListenBereich, setListenSortModus, setListenWahl, setMergeQuelleId, setModal, setModalFehler, setModalInput, setTab, setZuruecksetzenArten, sichtbareListen, sprachFilter, starteAufteilen, verschiebeListenInOrdner }, ...args); }

  // Listen-Übersicht als Raster wie bei den gespeicherten Konfigurationen: Lang-Druck → Menü
  // (Umbenennen, Duplizieren, Verschieben, Löschen), Lang-Druck und ziehen → verschieben; belegter Platz: tauschen.
  // Mit Sprachfilter rücken die sichtbaren Listen zusammen (Verschieben dann nur unter „Alle“).
  // Aktionen für eine Listen-Auswahl (Lang-Druck auf eine Kachel der Auswahl oder auf den Auswahl-Kopf)
  function listenWahlMenue(...args) { return listenWahlMenueTeil({ faelligAktion, faelligVonListen, listenOrdner, listenOrdnerOffen, oeffneExport, setAuswahlLoeschen, setInGruppe, setListenAuswahl, setListenSortModus, setListenWahl, setVonBis, sprachFilter, verschiebeListenInOrdner }, ...args); }
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
  function beendeMultiAuswahl(...args) { return beendeMultiAuswahlTeil({ setMultiAuswahl, stelleMultiquizEin }, ...args); }
  // Speichern-Menü des Quiz (lang drücken auf den Quiz-Namen bzw. den Start-Knopf)
  function sessionSpeicherAktionen(...args) { return sessionSpeicherAktionenTeil({ aktiverSlot, getSlotEintrag, ladeSlot, oeffneModal, quizKombiListe, setModal, setModalInput, slotNamenVorschlag, ueberspeichereSession, vokabelgruppeGeaendert }, ...args); }
  function renderSlotKopf(...args) { return renderSlotKopfTeil({ aktiverSlot, auswahlTafelDaten, beendeMultiAuswahl, blitzt, einListenName, getSlotEintrag, headerH, kopieName, ladeSlot, ladeSlotStatistik, lernstandJeArt, leuchte, listenAendern, listenFlagge, listenIndex, multiAuswahl, multiVonSlot, multiZusammenstellung, oeffneListeDetail, quizArt, quizBereichTyp, quizCheckboxAuswahl, quizErstellen, quizKombiListe, quizTabListen, quizVokMax, renderMiniKreise, sessionSpeicherAktionen, setErstellenFenster, setListenAendern, setListenAuswahlAufgeklappt, setLoescheSlotNr, setQuizListeAufgeklappt, setSlotSektionAufgeklappt, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setStatistikArt, sichtbareListen, slotOrdner, slotSektionAufgeklappt, slotSektionRef, slotVorschau, starteQuizErstellen, statistikAktiverSlot, statistikArt, statistikBasisVoks, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, statistikSlotGeleert, toggleSlotSektion, tt, vokabelgruppeGeaendert, vonBis, wechsleQuizArt }, ...args); }

  // Lernfortschritt je Art (Mini-Kreise) für eine Vokabelmenge; aus = keine passenden Vokabeln
  function lernstandJeArt(...args) { return lernstandJeArtTeil({ einstellungen }, ...args); }
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
  function uebernimmListe(...args) { return uebernimmListeTeil({ ladeSlot, leuchte, setBlaettern, setSlotVorschau, setSlotVorschauListe }, ...args); }
  function renderQuizListenRaster(...args) { return renderQuizListenRasterTeil({ FORTSCHRITT_FELD, aktiverSlot, auswahlOrdnerZelle, blaettern, blitzt, einstellungen, lernstandJeArt, leuchte, listenFlagge, listenRasterPlaetze, quizArt, setSlotVorschau, setSlotVorschauListe, slotVorschau, tt, uebernimmListe }, ...args); }
  function ordnerNavi(...args) { return ordnerNaviTeil({ einstellungen, faelligAktion, faelligAlle, faelligVonSlots, headerH, minSpalten, multiAuswahl, neuImOrdnerRef, pfadTeile, quizListenUmschalter, setAnordnen, setInGruppe, setModal, setMultiAuswahl, setNeueSessionSchritt, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSpaltenWahl, setStatistikAktiverSlot, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikFilter, setStatistikListenIds, setStatistikSlotGeleert, slotAuswahl, slotH, slotInfoH, slotOrdner, slotSichtbarRef, slotSortModus, slots, speichereEinst, tt }, ...args); }
  function wahlLeiste(...args) { return wahlLeisteTeil({ listenAuswahl, listenSortModus, listenWahl, multiAuswahl, setListenAuswahl, setListenSortModus, setListenWahl, setMultiAuswahl, setSlotAuswahl, setSlotDragId, setSlotDragZiel, setSlotSortModus, sichtbareListen, slotAuswahl, slotSichtbarRef, slotSortModus, tt }, ...args); }
  function renderSlotBereiche(...args) { return renderSlotBereicheTeil({ FORTSCHRITT_FELD, aktiverSlot, angehoben, auswahlTafel, auswahlTafelDaten, auswahlTafelRef, blaettern, blitzt, chipStil, einstellungen, faelligAktion, faelligVonSlots, gruppenZiel, kopieName, lasso, lernstandJeArt, leuchte, loeseOrdnerAuf, minSpalten, multiAuswahl, multiVonSlot, neuImOrdnerRef, neuPlatzRef, plaetzeRef, quizAbfrageArt, quizArt, renderSlotChip, setAuswahlLoeschen, setBlaettern, setInGruppe, setListenAendern, setLoescheSlotNr, setModal, setMultiAuswahl, setNeueSessionSchritt, setOrdnerUmbenennen, setSlotAuswahl, setSlotOrdner, setSlotSektionAufgeklappt, setSlotSortModus, setSlotUmbenennen, setSlotVorschau, setSlotVorschauListe, setVerlaufOffen, setVonBis, setzeSlotPlaetze, slotAuswahl, slotChipLabel, slotDragId, slotDragZiel, slotGezogenRef, slotOrdner, slotSichtbar, slotSichtbarRef, slotSortModus, slotVorschau, slotZiehenRef, slots, sprachFilter, starteMultiquiz, statistikArt, stelleMultiquizEin, tab, tt, ttFeld, uebernimmSlots, verlaufOffen, verschiebeInOrdner, verweilGeht, wahlUmschaltenRef }, ...args); }

  // Info-Fläche unter dem Quiz-Kopf: immer das Quiz, die oben steht (angetippt, sonst die geladene bzw. die aktuelle Auswahl)
  function infoEintrag(...args) { return infoEintragTeil({ aktiverSlot, getSlotEintrag, multiAuswahl, quizBereichTyp, quizCheckboxAuswahl, quizTabListen, sichtbareListen, slotVorschau, statistikAktiverSlot, statistikBereichTyp, statistikCheckboxAuswahl, statistikListenIds, statistikSlotGeleert }, ...args); }
  // feststehend unter dem Kopf (Quiz und Vokabel-Liste scrollen darunter hindurch), mit dem Pfeil auf eine Zeile einklappbar (gespeichert);
  // „📋 Vokabeln ansehen“ hängt die enthaltenen Vokabeln mit Listen-Nr. darunter an (Lücken als Trennzeile)
  // Gruppen kurz und einzeilig: „● 112 ✓ · ● 98 in Arbeit · ● 2850 nie · ● 11 ✗“ – der Punkt in der Farbe des Balken-Abschnitts (185)
  function gruppenKurz(...args) { return gruppenKurzTeil({  }, ...args); }
  const infoKlapp = () => { if (!infoZu) setSlotVorschauListe(false); setInfoZu(!infoZu); };   // 219: zuklappen schließt auch die Vokabel-Liste
  function renderSlotInfo(...args) { return renderSlotInfoTeil({ FORTSCHRITT_FELD, einstellungen, getSlotEintrag, gruppenKurz, headerH, infoEintrag, infoKlapp, infoZu, lernstandJeArt, listenIndex, quizArt, renderMiniKreise, setSlotVorschauListe, slotH, slotInfoRefCb, slotVorschauListe, slots, statistikArt, tt }, ...args); }

  // Nach dem Quiz direkt zur Statistik: mit Quiz → deren Eintrag (ganze Vokabelgruppe),
  // sonst genau die Vokabeln dieser Runde
  // Nach einer Gruppen-Runde aus der Statistik: zurück in genau diese Statistik (Auswahl, Art, Filter unverändert)
  function zurueckZurStatistik(...args) { return zurueckZurStatistikTeil({ setAnsicht, setQuiz, setTab }, ...args); }

  // Runde verlassen: zurück ins Lernen, in die Statistik (Gruppen-Runde) oder zur Übersicht
  function verlasseRunde(...args) { return verlasseRundeTeil({ beendeQuiz, quiz, zurueckZumLernen, zurueckZurStatistik }, ...args); }
  function zurueckZumLernen(...args) { return zurueckZumLernenTeil({ naechstesLernPaket, quizStufeRef, setAnsicht, setLernen, setQuiz }, ...args); }

  function zurRundenStatistik(...args) { return zurRundenStatistikTeil({ aktiveListeId, aktiverSlot, getSlotEintrag, ladeSlotStatistik, quiz, setStatistikAktiverSlot, setStatistikArt, setStatistikBereichTyp, setStatistikCheckboxAuswahl, setStatistikEinzelauswahlAufgeklappt, setStatistikFilter, setStatistikListenAufgeklappt, setStatistikListenIds, setStatistikSlotGeleert, setStatistikVollbild, setTab, zurueckZurStatistik }, ...args); }

  function brecheQuizAb(...args) { return brecheQuizAbTeil({ beendeQuiz, quiz, setQuiz, updateSessionSlotFortschritt }, ...args); }

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
  function quizRegeln(...args) { return quizRegelnTeil({ einstellungen, lernEinstellungen, quizStufeRef }, ...args); }

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
  function zuordnungRunde(...args) { return zuordnungRundeTeil({ zuordnungRundeAus }, ...args); }
  function zuordnungRundeAus(...args) { return zuordnungRundeAusTeil({ zuordnungZeitBis }, ...args); }
  // Memory: zwei Karten aufdecken; Frage + Antwort derselben Vokabel → Paar gefunden (+1), sonst nach kurzer Zeit wieder zu
  function memoryTippe(...args) { return memoryTippeTeil({ einstellungen, quiz, setQuiz, vokLang, zuordnungRundeEnde, zuordnungWerte }, ...args); }
  function mitZuordnungMix(...args) { return mitZuordnungMixTeil({ zuordnungRundeAus }, ...args); }
  // gemischt, Runde zu Ende: Beantwortete bleiben an ihrer Stelle, offen Gebliebene kommen ans Ende; weiter mit der nächsten Frage
  function zuordnungMixWeiter(...args) { return zuordnungMixWeiterTeil({ naechsteVokabelState }, ...args); }
  function zuordnungZeitBis(...args) { return zuordnungZeitBisTeil({  }, ...args); }
  // Ergebnis einer Vokabel speichern (nur vollständig Beantwortetes): richtig +1, falsch nach Regel −1
  function zuordnungWerte(...args) { return zuordnungWerteTeil({ quizRegeln }, ...args); }
  // Rundenende: das Ergebnis bleibt stehen (✓ / ✗ je Paar), weiter mit „Weiter →“; „Lösung zeigen“ färbt die richtigen Paare.
  // Nicht Beantwortete kommen in der nächsten Runde wieder
  function zuordnungRundeEnde(...args) { return zuordnungRundeEndeTeil({  }, ...args); }
  function zuordnungTippe(...args) { return zuordnungTippeTeil({ einstellungen, quiz, setQuiz, vokLang, zuordnungGruppeTippe, zuordnungPruefe, zuordnungRundeEnde, zuordnungWerte, zuordnungZeitBis }, ...args); }
  // „am Ende“: Karten bilden farbige Gruppen in Tipp-Reihenfolge; eingefärbte Karte antippen nimmt sie heraus
  function zuordnungGruppeTippe(...args) { return zuordnungGruppeTippeTeil({  }, ...args); }
  // „Prüfen“ (oder Zeit abgelaufen bei „am Ende“): nur vollständige Gruppen zählen
  function zuordnungPruefe(...args) { return zuordnungPruefeTeil({ zuordnungRundeEnde, zuordnungWerte }, ...args); }
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


  function getAktVok(...args) { return getAktVokTeil({ quiz }, ...args); }

  // Berechnet den nächsten Vokabel-State als reines Objekt (kein setQuiz)
  // 175: abgeschlossene Vokabel in den Rückblick (ganze Runde; Zuordnung nicht)
  function mitRueckblick(...args) { return mitRueckblickTeil({  }, ...args); }
  function naechsteVokabelState(...args) { return naechsteVokabelStateTeil({ mitRueckblick, mitZuordnungMix, naechsteVokabelState0, spielBeenden }, ...args); }
  // Blitzrunde / Serie zu Ende: Rekord je Art und Quiz (bzw. Liste) festhalten
  function spielBeenden(...args) { return spielBeendenTeil({ aktiverSlot }, ...args); }
  // Blitzrunde: Zeit abgelaufen
  useEffect(() => {
    const ende = quiz?.abfrageZiel?.modus === "blitz" ? quiz.abfrageZiel.ende : null;
    if (!ende || quiz.phase === "spielEnde" || quiz.phase === "fertig") return;
    const t = setTimeout(() => setQuiz(prev => prev && prev.abfrageZiel?.modus === "blitz" && prev.phase !== "spielEnde" && prev.phase !== "fertig" ? spielBeenden(prev) : prev),
      Math.max(0, ende - Date.now()));
    return () => clearTimeout(t);
  }, [quiz?.abfrageZiel?.ende, quiz?.phase === "spielEnde"]);   // eslint-disable-line react-hooks/exhaustive-deps
  function naechsteVokabelState0(...args) { return naechsteVokabelState0Teil({  }, ...args); }

  // Setzt flash, wartet 500ms, führt dann advanceFn aus
  // Kurze Verzögerung vor der nächsten Vokabel; zwischen mehreren Antworten derselben Frage geht es sofort weiter
  function mitVerzoegerung(...args) { return mitVerzoegerungTeil({ beendeVerzoegerung, flashTimerRef, flashWeiterRef, quiz, setQuiz, sofortWeiter }, ...args); }
  function mitFlash(...args) { return mitFlashTeil({ mitVerzoegerung }, ...args); }
  // Antippen während der Verzögerung: sofort weiter
  function beendeVerzoegerung(...args) { return beendeVerzoegerungTeil({ flashTimerRef, flashWeiterRef, setQuiz }, ...args); }
  // Weitere Antworten derselben Frage offen → ohne Verzögerung weiterfragen
  const sofortWeiter = q => q.antwortTypIndex < q.antwortTypen.length - 1;

  // Aktuelle Spalte abschließen: Antwort (gewusst oder nicht) bleibt oben stehen, dann nächste Spalte bzw. Vokabel
  function weiterNachSpalte(...args) { return weiterNachSpalteTeil({ naechsteVokabelState }, ...args); }

  // Score einmal pro Vokabel: Ergebnis je Antwort-Spalte sammeln, nach der letzten
  // Spalte auswerten (alle richtig → richtig, sonst falsch bzw. aufgedeckt)
  // Karten-Spalten, die per „Weiter“ übersprungen wurden, stehen auf „karte“: am Ende gilt ein gemeinsames Urteil (karteUrteil);
  // ist eine andere Spalte schon nicht gewusst, steht das Ergebnis fest; sonst fragt die letzte Spalte „Gewusst / Nicht gewusst“ (karteBewertungOffen)
  function spaltenAbschluss(...args) { return spaltenAbschlussTeil({ blitzKey, einstellungen, getAktVok, quiz, quizRegeln }, ...args); }

  // Akzent-Abfrage mit Wörtern ohne Akzent: nur so viele ohne Akzent wie eingestellt (Faktor × mit Akzent);
  // bevorzugt die mit schwächstem bzw. noch keinem Akzent-Score, bei Gleichstand zufällig.
  // festeIds: laufende Quiz – dann bleiben genau die Wörter ohne Akzent vom Quiz-Start
  function begrenzeOhneAkzent(...args) { return begrenzeOhneAkzentTeil({ einstellungen, quizRegeln }, ...args); }
  // Wörter ohne Akzent gleichmäßig zwischen die mit Akzent verteilen (Reihenfolge innerhalb bleibt)
  function verteileOhneAkzent(...args) { return verteileOhneAkzentTeil({  }, ...args); }

  // Kennung der aktuellen Frage für das Gelernt-Aufleuchten (gilt nur für diese Karte)
  const blitzKey = q => `${q.wiederholungDurchgang || 0}|${q.index}|${q.vokabeln[q.index]?.id}`;

  function pruefeAntwort(...args) { return pruefeAntwortTeil({ aktiveListeId, flashTimerRef, quiz, quizRegeln, setQuiz, sofortWeiter, spaltenAbschluss, weiterNachSpalte }, ...args); }

  function klickeButton(...args) { return klickeButtonTeil({ quiz, setQuiz, sofortWeiter, spaltenAbschluss, weiterNachSpalte }, ...args); }

  function zeigeLosung(...args) { return zeigeLosungTeil({ flashTimerRef, quiz, setQuiz, spaltenAbschluss }, ...args); }

  function ueberspringeWeitere(...args) { return ueberspringeWeitereTeil({ mitFlash, quiz, setQuiz, weiterNachSpalte }, ...args); }

  function wechsleZuMC(...args) { return wechsleZuMCTeil({ quiz, setQuiz }, ...args); }

  // 175: Bewertung einer früheren Karte der Runde ändern (nur richtig ↔ falsch). Score: Stand vor der Antwort wiederherstellen
  // und alle späteren Wertungen derselben Vokabel neu rechnen; Rundenzählung, Wiederholungs-Zähler und Diktat-Ergebnis mitziehen
  function umwerten(...args) { return umwertenTeil({ setQuiz }, ...args); }
  // Wischen im Quiz: nach rechts = eine Karte zurück, nach links = vorwärts bis zur aktuellen
  function rueckblickWischen(...args) { return rueckblickWischenTeil({ setQuiz }, ...args); }
  function renderRueckblick(...args) { return renderRueckblickTeil({ farbModusUI, farbRadUI, quiz, tt, umwerten }, ...args); }
  function naechsteVokabel(...args) { return naechsteVokabelTeil({ flashTimerRef, flashWeiterRef, naechsteVokabelState, quiz, setQuiz, weiterNachSpalte }, ...args); }

  // Zwischenkarte "Wiederholung": weiter zu den zu wiederholenden Vokabeln oder direkt zur Auswertung
  function starteWiederholung(...args) { return starteWiederholungTeil({ mitZuordnungMix, setQuiz }, ...args); }
  function brecheWiederholungAb(...args) { return brecheWiederholungAbTeil({ flashTimerRef, setQuiz }, ...args); }

  // Akzent-Modus: Auswahl gehört zu genau einer Vokabel-Spalte (Schlüssel), sonst Neustart mit Grundbuchstaben
  function akzentStand(...args) { return akzentStandTeil({  }, ...args); }
  // Kachel braucht einen Akzent bzw. eine Ligatur (die von der Ligatur verbrauchte Kachel nicht)
  const kachelMitAkzent = k => k.richtig !== "" && k.richtig !== k.basis;
  // Fehlgriff: Kachel kurz rot aufleuchten lassen; zählt wie ein Fehlklick bei MC (Vokabel gilt als nicht gewusst)
  function akzentFehlgriff(...args) { return akzentFehlgriffTeil({ akzentBlinkRef, setQuiz }, ...args); }
  function waehleAkzentKachel(...args) { return waehleAkzentKachelTeil({ akzentFehlgriff, akzentStand, kachelMitAkzent, quiz, quizRegeln, setQuiz }, ...args); }
  function setzeAkzentVariante(...args) { return setzeAkzentVarianteTeil({ akzentFehlgriff, akzentStand, quiz, quizRegeln, schliesseAkzenteAb, setQuiz }, ...args); }
  function schliesseAkzenteAb(...args) { return schliesseAkzenteAbTeil({ flashTimerRef, quiz, setQuiz, sofortWeiter, spaltenAbschluss, weiterNachSpalte }, ...args); }
  // Prüfen: vollständig → abschließen; sonst fehlende Akzente rot markieren, korrigieren oder Lösung anzeigen
  function pruefeAkzente(...args) { return pruefeAkzenteTeil({ akzentStand, quiz, schliesseAkzenteAb, setQuiz }, ...args); }

  function deckeKarteAuf(...args) { return deckeKarteAufTeil({ quiz, setQuiz }, ...args); }

  // Mehrere Spalten: aufgedeckte Karte (nicht die letzte) → „Weiter“ ohne Pause; die nächste Karten-Spalte erscheint gleich aufgedeckt
  function karteWeiter(...args) { return karteWeiterTeil({ flashTimerRef, flashWeiterRef, quiz, setQuiz, weiterNachSpalte }, ...args); }
  function bewerteKarte(...args) { return bewerteKarteTeil({ flashTimerRef, mitFlash, mitVerzoegerung, quiz, setQuiz, spaltenAbschluss, weiterNachSpalte }, ...args); }

  function pruefeDiktatAntwort(...args) { return pruefeDiktatAntwortTeil({ aktiveListeId, blitzKey, einstellungen, quiz, quizRegeln, setQuiz }, ...args); }

  function zeigeDiktatLoesung(...args) { return zeigeDiktatLoesungTeil({ flashTimerRef, quiz, quizRegeln, setQuiz }, ...args); }

  function naechsteDiktatVokabel(...args) { return naechsteDiktatVokabelTeil({ diktatPlayCountRef, flashTimerRef, quiz, setDiktatManualPlays, setQuiz }, ...args); }

  function sprichDiktatNochmal(...args) { return sprichDiktatNochmalTeil({ diktatPlayCountRef, setDiktatManualPlays }, ...args); }

  function geheZurueck(...args) { return geheZurueckTeil({ flashTimerRef, quiz, setQuiz }, ...args); }

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
