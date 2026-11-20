import { Fragment } from "react";
import { ANTWORT_MODUS_NAMEN, MODI_REIHENFOLGE, PAKET_ALLE, QUIZ_ARTEN, START_TEXT, antwortSpaltenFuer, gelerntScore, hatAkzente, heuteAbgefragt, istFaellig, modiVon, ordneVokabeln, stufenRegeln, tagesSperre, nurArtikel, schalterGruppe, imFilter, langStufeVon } from "../quiz.jsx";
import { IcoDown, IcoUp, IcoX } from "../komponenten.jsx";
import { SymWdh } from "../symbole.jsx";
import { SK, TYPEN, WAHL_ZU_MS, blinke, lsGet } from "../speicher.js";
import { SPRACH_KUERZEL, sprachInfo } from "../sprache.js";
import { farbeImMenueAn, farbeHier } from "../infoEreignisse.js";

// Phase 2 (Aufteilung): Bereich aus dem Haupt-return von App.jsx (tab === "quiz")
// app = Zustände, Setter und Funktionen der Komponente (siehe „const app“ in App.jsx)
export function QuizTab(app) {
  const { umfangAuf, setUmfangAuf, vokAuswahlZurTafel, schalterZeileZu, setSchalterZeileZu, quizGrund, setQuizGrund, quizNegativ, setQuizNegativ, faelligJeSprache, faelligePool, quizFaellig, setQuizFaellig, starteNurFaellige, istPaketQuiz, abfrageModusContainerRef, abfrageModusRef, abfrageZielAnzahl, abfrageZielModus, abfrageZielScore, abfrageZielScoreTyp, abfrageZielWiederholung, aktiverSlot, alleBereichH, alleBereichRef, antwortMehrfach, artenMehrfach, aufteilen, aufteilenStand, auswahlListen, auswahlOrdnerZelle, begrenzeOhneAkzent, blitzt, einstellungen, einzelauswahlRef, fokusZeigt, headerH, ladeSlot, legeAufteilenAn, lernEinstellungen, lernResetFrage, lernStandVon, lernstandJeArt, leuchte, leuchtet, listenAuswahlPfad, listenContainerRef, listenFlagge, listenIndex, listenNavi, listenOrdner, listenRasterPlaetze, listenSortModus, listenWahl, listenauswahlHeaderH, listenauswahlHeaderRef, loescheSessionSlot, maxFenster, maxSpalte, offenText, ordnerNavi, quizAbfrageArt, quizAbfrageModusAufgeklappt, quizAntwortTypenGeordnet, quizArt, quizAusgewaehlt, quizBasisVoks, quizBereichTyp, quizCheckboxAuswahl, quizDiktatSpalte, quizDiktatUebersetzung, quizFokus, quizFrageTyp, quizGefilterteVoks, quizGelerntEinschliessen, quizHeuteEinschliessen, quizInfoTypenSession, quizKombiListe, quizListeAufgeklappt, quizModus, quizModusInfoAufgeklappt, quizPaketGroesse, quizReihenfolge, quizReihenfolgeAufgeklappt, quizSchlechtesteMaxScore, quizSessionAufgeklappt, quizSessionModus, quizSpalteModus, quizStufeAufgeklappt, quizTabListen, quizUnbeantwortetZuerst, quizVokMax, quizVonBisErster, quizVonBisModus, quizZeigeInfo, reihenfolgeContainerRef, renderAufteilenKasten, renderListeInfo, renderListenRaster, renderModusKnoepfe, renderSlotBereiche, renderSlotInfo, renderSlotKopf, renderSuchleiste, resetImport, schliesseQuizBereiche, sessionContainerRef, sessionRef, sessionResetFrage, sessionSlotAktiv, sessionSlotKonflikt, sessionSpeicherAktionen, setAbfrageZielAnzahl, setAbfrageZielModus, setAbfrageZielScore, setAbfrageZielScoreTyp, setAbfrageZielWiederholung, setAnsicht, setAufteilen, setLernResetFrage, setModal, setQuizBereichTyp, setQuizCheckboxAuswahl, setQuizDiktatSpalte, setQuizDiktatUebersetzung, setQuizGelerntEinschliessen, setQuizHeuteEinschliessen, setQuizListeAufgeklappt, setQuizModus, setQuizModusInfoAufgeklappt, setQuizPaketGroesse, setQuizReihenfolge, setQuizReihenfolgeAufgeklappt, setQuizSchlechtesteMaxScore, setQuizSessionAufgeklappt, setQuizSessionModus, setQuizStufeAufgeklappt, setQuizTabListen, setQuizUnbeantwortetZuerst, setQuizVonBisErster, setQuizVonBisModus, setSessionResetFrage, setStartLeerHinweis, setSucheQuiz, setTab, setzeLernStand, sicherungErinnerungUI, sichtbareListen, slotContainerRef, slotH, slotSektionAufgeklappt, slotVorschau, speichereEinst, spracheVonListe, sprungKnopf, startLeerHinweis, starteLernen, starteQuiz, suchInfo, suchMarke, sucheQuiz, toggleAbfrageModus, toggleEinzelauswahl, toggleInfoSpalte, toggleQuizSpalte, toggleQuizTabListe, toggleReihenfolge, toggleSessionBereich, toggleSpalteRolle, toggleVokCheckbox, tt, ttFeld, vonBisLangDruck, wahlLeiste, wechsleQuizArt, zeileImBlick } = app;
  return (
(() => {
          const kombiListe = quizKombiListe;
          const basisVoks = quizBasisVoks;
          const gefilterteVoks = quizGefilterteVoks;
          const abfragbar = kombiListe ? TYPEN.filter(t => !t.startsWith('i') && kombiListe.spalten[t].aktiv) : [];
          const infoSpalten = kombiListe ? TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv) : [];
          const kannStarten = kombiListe && (quizModus === "rotierend"
            ? quizAusgewaehlt.length >= 2
            : quizModus === "diktat"
            ? !!kombiListe.spalten[quizDiktatSpalte]?.aktiv
            : quizFrageTyp && quizAntwortTypenGeordnet.length >= 1);
          const isPakete = quizSessionModus === "pakete";
          const sessionHatFortschritt = isPakete && sessionSlotAktiv && !sessionSlotKonflikt();
          // Akzent-Modus (wie starteQuiz): nur Wörter mit Akzent, reine Akzent-Abfrage nutzt den Akzent-Score
          const akzentSpalten = quizModus === "diktat" ? [] : (quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet)
            .filter(t => t.startsWith('E') && quizSpalteModus[t] === "akzent");
          const nurAkzent = quizModus === "sequenziell" && quizAntwortTypenGeordnet.length > 0
            && quizAntwortTypenGeordnet.every(t => quizSpalteModus[t] === "akzent");
          // Zählt Vokabeln mit mindestens einer abzufragenden Spalte (= größte Anzahl je Antwortspalte)
          // 257: Spalten nur mit „Artikel“ – Wörter ohne Artikel fallen dort weg (wie bei Akzenten)
          const akzentAuslassen = akzentSpalten.length > 0 && !stufenRegeln(einstellungen).akzentOhneMischen;
          const artikelNurDa = quizModus !== "diktat" && (quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet).some(t => nurArtikel(quizSpalteModus[t]));
          const akzentVoks = akzentAuslassen || artikelNurDa
            ? gefilterteVoks.filter(v => antwortSpaltenFuer(v, quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet,
              quizSpalteModus, akzentAuslassen).length > 0) : gefilterteVoks;
          // Score-Filter (nur schlechteste-Modus) → Basis für Reihenfolge-Header; eingeschaltete Gelernte bleiben dabei
          const feldVon = v => nurAkzent ? v.akzentFortschritt : quizModus === "diktat" ? v.diktatFortschritt : v.fortschritt;
          const gelerntDabei = v => quizGelerntEinschliessen && (einstellungen.gelerntSchwelle ?? 0) > 0
            && (nurAkzent ? (v.akzentFortschritt?.score ?? -Infinity) : gelerntScore(v, quizModus === "diktat")) >= einstellungen.gelerntSchwelle;
          // 267: Fällige getrennt von den neuen Vokabeln (Schalter „🔁 Fällige“); Pool auch bei „aus“ für die Anzeige
          const faelligMoeglich = quizModus !== "diktat" && !nurAkzent && (einstellungen.gelerntSchwelle ?? 0) > 0;
          // 310/313: eigene Fällige (der Auswahl) und fremde (außerhalb, Knopf „Langzeitgedächtnis“)
          const fp = faelligMoeglich ? faelligePool(akzentVoks) : { eigene: [], fremde: [] };
          const langStufe = langStufeVon(quizGelerntEinschliessen, quizFaellig.an);
          const fremdeAn = quizFaellig.modus === "sprache";
          const faelligeAlle = [...fp.eigene, ...(fremdeAn ? fp.fremde : [])];   // „Nur Fällige“
          const eigeneIds = new Set(fp.eigene.map(v => v.id));
          const faelligIdsQ = langStufe === "faellig" ? eigeneIds : new Set();   // Stufe „Fällige“: getrennt; sonst bei den Gelernten
          let reihenfolgeVoks = akzentVoks.filter(v => !faelligIdsQ.has(v.id));   // 240: keine Score-Grenze mehr bei „schlechteste zuerst“
          const schwelle = einstellungen.gelerntSchwelle ?? 0;
          const istDiktat = quizModus === "diktat";
          const startScore = v => nurAkzent ? (v.akzentFortschritt?.score ?? -Infinity) : gelerntScore(v, istDiktat);
          // 274: Schalter-Gruppen ohne Doppelungen (fällig > heute > gelernt > negativ > Vokabeln)
          const heuteSperre = tagesSperre();
          // 310: fällig > heute > gelernt > negativ > nie bzw. schon abgefragt
          const gruppenAnz = { nie: 0, abgefragt: 0, negativ: 0, gelernt: 0, heute: 0 };
          akzentVoks.forEach(v => { if (eigeneIds.has(v.id)) return; const g = schalterGruppe(feldVon(v), schwelle, false, heuteSperre);
            gruppenAnz[g === "grund" ? (feldVon(v) ? "abgefragt" : "nie") : g]++; });
          const eigeneFAnz = fp.eigene.length;
          const gelernteAnzahl = langStufe === "gelernt" ? 0 : gruppenAnz.gelernt + (langStufe === "faellig" ? 0 : eigeneFAnz);   // nicht dabei (Hinweis)
          // Quiz-Menge: Auswahl-Stufe, Gelernte; heute abgefragte bleiben in ihrer Gruppe (für später) bzw. kommen mit „Heute“ dazu
          reihenfolgeVoks = reihenfolgeVoks.filter(v => imFilter(feldVon(v), schwelle, quizGrund, quizGelerntEinschliessen) || (quizHeuteEinschliessen && heuteSperre && heuteAbgefragt(feldVon(v))));
          if (!istDiktat && abfrageZielModus === "score" && abfrageZielScoreTyp !== "session")
            reihenfolgeVoks = reihenfolgeVoks.filter(v => gelerntDabei(v) || ((nurAkzent ? v.akzentFortschritt : v.fortschritt)?.score ?? 0) < abfrageZielScore);
          if (nurAkzent) {
            const laufend = isPakete && sessionSlotAktiv && !sessionSlotKonflikt() ? sessionSlotAktiv : null;
            reihenfolgeVoks = begrenzeOhneAkzent(reihenfolgeVoks, quizAntwortTypenGeordnet,
              laufend && Object.keys(laufend.startScores || {}).length > 0 ? new Set(Object.keys(laufend.startScores)) : null);
          }
          const ohneAkzentAnzahl = nurAkzent && stufenRegeln(einstellungen).akzentOhneMischen
            ? reihenfolgeVoks.filter(v => !quizAntwortTypenGeordnet.some(t => hatAkzente(v[t]?.wert))).length : null;
          const verfuegbarReihenfolge = reihenfolgeVoks.length;
          // Pakete/Quiz-Filter → nur für Quiz-Button
          let verfuegbar;
          // Anzahl-Kette: Vokabel-Auswahl → mit Akzent (Abfrage-Modus) → nach Schwierigkeits-Regel (Einstellungen)
          // → Quiz (ohne Gelernte / Score-Grenze) → Fortschritt (davon abgefragt) → Start-Knopf (nächstes Paket)
          const mitAkzentAnzahl = akzentSpalten.length > 0
            ? gefilterteVoks.filter(v => akzentSpalten.some(t => hatAkzente(v[t]?.wert))).length : null;
          const sessionAnzahl = verfuegbarReihenfolge;
          let sessionAbgefragtAnzahl = 0;
          // 180: heute schon abgefragte zählen nicht (außer „+ heute“)
          const heuteBasis = sessionHatFortschritt ? reihenfolgeVoks.filter(v => !new Set(sessionSlotAktiv.abgefragt || []).has(v.id)) : reihenfolgeVoks;
          const heuteAnzahl = tagesSperre() ? heuteBasis.filter(v => heuteAbgefragt(feldVon(v))).length : 0;
          const ohneHeute = n => quizHeuteEinschliessen ? n : n - heuteAnzahl;
          if (sessionHatFortschritt) {
            const bereitsAbgefragt = new Set(sessionSlotAktiv.abgefragt || []);
            const restVoks = reihenfolgeVoks.filter(v => !bereitsAbgefragt.has(v.id));
            sessionAbgefragtAnzahl = sessionAnzahl - restVoks.length;
            verfuegbar = quizPaketGroesse != null ? Math.min(quizPaketGroesse, ohneHeute(restVoks.length)) : 0;
          } else if (isPakete) {
            verfuegbar = quizPaketGroesse != null ? Math.min(quizPaketGroesse, ohneHeute(verfuegbarReihenfolge)) : 0;
          } else {
            verfuegbar = ohneHeute(verfuegbarReihenfolge);
          }
          // Zeile "Abfrage-Modus": Art der Abfrage (Karte, MC, Tastatur, Akzente bzw. Diktat)
          const modusSpalten = quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet;
          const antwortArten = MODI_REIHENFOLGE.filter(m => modusSpalten.some(t => modiVon(quizSpalteModus[t]).includes(m))).map(m => ANTWORT_MODUS_NAMEN[m]);
          const gemischt = !istDiktat && modusSpalten.some(t => modiVon(quizSpalteModus[t]).length > 1);
          // Beschriftung über „Art der Antwort“: Sprache der Frage – Sprache der ersten Antwort-Spalte (wechselnd: ⇄)
          const spracheKurz = typ => !typ ? null : typ.startsWith("D") ? "Deu" : typ.startsWith("E") ? (SPRACH_KUERZEL[spracheVonListe(quizTabListen[0])] || sprachInfo(spracheVonListe(quizTabListen[0])).name) : null;
          const frageAntwortLabel = istDiktat ? "Diktat" : quizModus === "rotierend"
            ? (() => { const s = [...new Set(quizAusgewaehlt.map(spracheKurz).filter(Boolean))]; return s.length >= 2 ? `${s[0]} ⇄ ${s[1]}` : "wechselnd"; })()
            : quizFrageTyp && quizAntwortTypenGeordnet[0] ? `${spracheKurz(quizFrageTyp)} – ${spracheKurz(quizAntwortTypenGeordnet[0])}` : "Frage – Antwort";
          const abfrageModusName = istDiktat ? "Diktat"
            : [quizModus === "rotierend" && "wechselnd", antwortArten.join(" + ") || (quizModus !== "rotierend" && "Frage – Antwort")].filter(Boolean).join(" · ");
          const alleAbgefragt = sessionHatFortschritt && sessionAbgefragtAnzahl >= sessionAnzahl;
          // Lernen: die noch offenen Vokabeln des Quiz, paketweise (ohne Score, ohne Quiz-Fortschritt)
          const lernAktiv = !!einstellungen.lernen?.aktiv;
          const lernVokabeln = () => {
            const ab = sessionHatFortschritt ? new Set(sessionSlotAktiv.abgefragt || []) : null;
            let v = reihenfolgeVoks.filter(x => !ab?.has(x.id));
            if (!v.length) v = reihenfolgeVoks;
            return ordneVokabeln(v, istDiktat ? "diktatFortschritt" : nurAkzent ? "akzentFortschritt" : "fortschritt", quizReihenfolge, quizUnbeantwortetZuerst);
          };
          const lernSpalten = (istDiktat ? [quizDiktatSpalte, quizDiktatUebersetzung] : quizModus === "rotierend" ? quizAusgewaehlt : [quizFrageTyp, ...quizAntwortTypenGeordnet]).filter(Boolean);
          const lernInfo = kombiListe ? [...quizInfoTypenSession, ...TYPEN.filter(t => t.startsWith('i') && kombiListe.spalten[t].aktiv && quizZeigeInfo[t])] : [];
          const lernAnzahl = lernAktiv ? lernVokabeln().length : 0;
          const lernStand = lernAktiv ? lernStandVon(aktiverSlot, quizAbfrageArt) : null;
          const lernGesamt = lernStand ? lernStand.ids.length : 0;
          const lernAngesehen = lernStand ? Math.min(lernGesamt, lernStand.start + (lernStand.fertig ? Math.min(lernStand.groesse, lernGesamt - lernStand.start) : lernStand.index)) : 0;
          // Start-Knopf: was in des laufenden Quiz noch übrig ist (die Paketgröße steht auf dem Umfang-Knopf)
          // 188: Titel und Knopf-Zahl ohne die heute gesperrten (Fortschritt-Feld zählt sie weiter zur Quiz)
          // 255: Gesamtzahl der Anzeige = was mit den Schaltern (Gelernte, heute) abgefragt würde, dazu das in diesem Durchlauf
          // schon Abgefragte; Start-Knopf = Gesamt − Fortschritt
          const anzeigeGesamt = Math.max(sessionAbgefragtAnzahl, sessionAnzahl - (quizHeuteEinschliessen ? 0 : heuteAnzahl));
          const titelAnzahl = Math.max(0, anzeigeGesamt);
          const startRest = isPakete ? Math.max(0, anzeigeGesamt - sessionAbgefragtAnzahl) : verfuegbar;
          const sessionPct = anzeigeGesamt > 0 ? Math.round(sessionAbgefragtAnzahl / anzeigeGesamt * 100) : 0;
          // 267: Fällige kommen hinzu – Ziel bezogen auf die neuen (im laufenden Quiz fest), davon schon abgefragt, noch offen
          // 273: auch ausgeschaltet zeigt der Knopf, wie viele dazukämen
          const eigeneDazu = langStufe === "faellig" ? eigeneFAnz : 0;
          const fremdeWenn = Math.min(fp.fremde.length, Math.round(anzeigeGesamt * quizFaellig.anteil / 100));   // 313: Anteil nur für die fremden
          const fZiel = !faelligMoeglich ? 0 : langStufe === "faellig" && sessionHatFortschritt && sessionSlotAktiv.faelligZiel != null ? sessionSlotAktiv.faelligZiel   // im laufenden Quiz fest
            : eigeneDazu + (fremdeAn ? fremdeWenn : 0);
          const fGemacht = sessionHatFortschritt ? (sessionSlotAktiv.faelligIds || []).length : 0;
          const fRest = Math.max(0, Math.min(faelligeAlle.length, fZiel - fGemacht));
          const startbar = verfuegbar + (isPakete ? fRest : 0) > 0;
          const sprachKurz = [...new Set(quizTabListen.map(spracheVonListe))].map(c => SPRACH_KUERZEL[c] || sprachInfo(c).name).join(" + ");
          // 283: gesperrt statt disabled – Antippen lässt den Knopf nur kurz aufleuchten
          const gesperrtAttr = g => g ? { "aria-disabled": true, "data-gesperrt": "" } : {};
          // 313: Langzeitgedächtnis – fällige außerhalb der Auswahl (andere Listen derselben Sprache, übrige der Liste) dazu; lang: Anteil
          const langzeitKnopf = (
            <div className="quiz-zeile-zelle"><span className="quiz-zeile-label">{quizFaellig.anteil} % Langzeitgedächtnis</span>
            <button className={`quiz-zeile-knopf${fremdeAn && faelligMoeglich ? " an" : ""}`} data-langzeit={fremdeAn ? "an" : "aus"} data-faellig-modus={quizFaellig.modus} data-faellig-anteil-quiz={quizFaellig.anteil}
              data-langzeit-n={fp.fremde.length} {...gesperrtAttr(!faelligMoeglich)}
              onClick={e => { if (!faelligMoeglich) { blinke(e.currentTarget); return; } schliesseQuizBereiche(null); setQuizFaellig(f => ({ ...f, modus: f.modus === "sprache" ? "quiz" : "sprache" })); setStartLeerHinweis(false); }}
              {...tt(`Langzeitgedächtnis: fällige Vokabeln außerhalb der Auswahl (andere Listen ${sprachKurz || "der Sprache"}) – ${fremdeAn ? `${quizFaellig.anteil} % zusätzlich zu den übrigen, jetzt ${fp.fremde.length} fällig; antippen schaltet aus` : `aus – ${fp.fremde.length} wären fällig; antippen schaltet ein`}; lang drücken: Anteil`,
                null, { langText: "🔁 Langzeitgedächtnis",
                  zusatz: () => { const akt = new Set(quizTabListen.map(spracheVonListe)), z = faelligJeSprache();
                    return z.length ? <div data-faellig-sprachen>Jetzt fällig: {z.map((x, i) => <Fragment key={x.code}>{i ? " · " : ""}<span data-faellig-sprache={x.code} data-n={x.n}
                      style={akt.has(x.code) ? { fontWeight: 800, textDecoration: "underline" } : { opacity: 0.85 }}>{x.kurz} {x.n}</span></Fragment>)}</div> : null; },
                  regler: () => ({ label: "Anteil (zusätzlich zu den übrigen)", min: 5, max: 100, step: 5, wert: quizFaellig.anteil, format: v => `${v} %`,
                    aendern: v => setQuizFaellig(f => ({ ...f, anteil: v, modus: "sprache" })) }) })}>
              {fremdeAn && faelligMoeglich ? <>+ <SymWdh/> {fremdeWenn}</> : <><SymWdh/> {faelligMoeglich ? fp.fremde.length : 0}</>}
            </button></div>
          );
          // 311: Anzahl je Runde – lang auf den Start-Knopf (Raster in der Tafel)
          const umfangText = isPakete && quizPaketGroesse != null && quizPaketGroesse < PAKET_ALLE ? `Je ${quizPaketGroesse}` : "Alle";
          const umfangTipp = "; lang drücken: Anzahl je Runde (alle oder in Paketen)";

          return (
            <>
              <div className="sektion" data-quiz-ansicht={slotSektionAufgeklappt ? "auswahl" : "einstellungen"} style={{paddingTop:0, paddingBottom:0}}
                data-quiz-fokus={quizFokus || ""} data-quiz-offen={quizFokus === "zeile1" ? (quizStufeAufgeklappt ? "stufe" : quizAbfrageModusAufgeklappt ? "modus" : "reihenfolge") : quizFokus === "zeile2" ? String(quizSessionAufgeklappt) : quizFokus || ""}>
                {/* VERLAUF + GESPEICHERT – Kopfzeile (zu/auf gleich) + aufklappbares Raster */}
                {(() => {
                  return (
                    <>
                      {renderSlotKopf(false)}
                      {slotSektionAufgeklappt && (() => {
                        // Listen-Ansicht: Mehrfach-Auswahl bzw. gewählte Liste (225) zeigen die Listen-Info (Inhalt, Sätze, Synonyme)
                        const ids = auswahlListen ? (listenWahl?.length ? listenWahl : slotVorschau?.typ === "listen" ? [slotVorschau.id] : null) : null;
                        const ls = (ids || []).map(id => listenIndex.find(x => x.id === id)).filter(Boolean);
                        return auswahlListen ? null : renderSlotInfo(false);   // 329: Listen-Auswahl ohne Info-Sektion
                      })()}
                      {/* Aufklappbarer Chips-Bereich */}
                      {listenIndex.length === 0 && (
                        <div className="meldung-info" data-keine-listen style={{marginTop:12}}>
                          <div>Noch keine Listen.</div>
                          <button className="btn btn-primary btn-sm" style={{marginTop:8}} data-liste-importieren onClick={() => { resetImport(); setTab("listen"); setAnsicht("import"); }}
                            {...tt("Zu Einstellungen › Listen: Liste importieren oder neu anlegen")}>Liste importieren</button>
                        </div>
                      )}
                      <div ref={slotContainerRef} style={{overflow:'clip', paddingTop: slotSektionAufgeklappt ? 12 : 0, paddingBottom: slotSektionAufgeklappt ? 8 : 0, margin:"0 -8px", paddingLeft:8, paddingRight:8}}>
                        {slotSektionAufgeklappt && sicherungErinnerungUI()}
                        {slotSektionAufgeklappt && (auswahlListen ? listenNavi() : ordnerNavi())}
                        {slotSektionAufgeklappt && auswahlListen && listenSortModus && wahlLeiste("liste")}
                        {slotSektionAufgeklappt && (auswahlListen ? (sichtbareListen.length === 0 && listenOrdner.length === 0
                          ? <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.</div></div> : renderListenRaster())
                          : renderSlotBereiche(null, ladeSlot, aktiverSlot))}
                      </div>
                    </>
                  );
                })()}

                {!slotSektionAufgeklappt && (<>
                {/* Alle/Bereich – sticky direkt unter Haupt-Header */}
                {kombiListe && fokusZeigt("einzel") && (aufteilen || (quizBereichTyp === "bereich" && quizListeAufgeklappt)) && (   /* 298: nur Bereichswahl / Aufteilen */
                  <div ref={alleBereichRef} style={{position:"relative", top:0, zIndex:8, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginLeft:"-16px", marginRight:"-16px",
                    ...(maxFenster ? { position:"fixed", top:maxFenster.top, ...maxSpalte } : {})}}>
                    {aufteilen ? (<>
                      <span style={{flex:1, fontWeight:700, fontSize:"0.85rem", color:"var(--gelb-dunkel)"}}>▦ Aufteilen</span>
                      <span data-anzahl="auswahl" style={{fontSize:"0.8rem", color:"var(--text3)"}}>({quizGefilterteVoks.length} V.)</span>
                      <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                        <button data-aufteilen-abbrechen className="btn btn-ghost btn-sm" onClick={() => setAufteilen(null)}
                          {...tt("Aufteilen beenden, ohne Quiz anzulegen")}>Abbrechen</button>
                      </span>
                    </>) : (<>
                    {/* LINKS */}
                    <span style={{flex:1, display:"flex", alignItems:"center", gap:6}}>
                      {quizBereichTyp === "bereich" && quizListeAufgeklappt ? (
                        <>
                          <button data-auswahl-durchlass className={`btn btn-sm${quizVonBisModus ? " btn-primary" : " btn-ghost"}`}
                            onClick={() => { if (quizVonBisModus) { setQuizVonBisModus(false); setQuizVonBisErster(null); } else { setQuizVonBisModus(true); } }}
                            {...tt("Bereichsauswahl: erste Vokabel antippen, dann letzte")}>
                            {!quizVonBisModus ? "Von–Bis" : quizVonBisErster === null ? "Von…" : "…Bis"}
                          </button>
                          {quizCheckboxAuswahl.size > 0 && (
                            <button className="btn btn-ghost btn-sm" style={{padding:"6px 8px"}}
                              onClick={() => { setQuizCheckboxAuswahl(new Set()); setQuizVonBisModus(false); setQuizVonBisErster(null); }}
                              {...tt("Checkbox-Auswahl aufheben")}>
                              <IcoX s={12}/>
                            </button>
                          )}
                          {quizCheckboxAuswahl.size > 0 && sprungKnopf("quiz", quizBasisVoks, quizCheckboxAuswahl)}
                        </>
                      ) : (
                        <span style={{fontWeight:600, fontSize:"0.85rem", color:"var(--text)"}}>Vokabel-Auswahl</span>
                      )}
                    </span>
                    {/* MITTE */}
                    <span data-anzahl="auswahl" style={{position:"absolute", left:"50%", transform:"translateX(-50%)", fontSize:"0.8rem", color:"var(--text3)", cursor:"help"}}
                      {...tt(quizBereichTyp === "bereich" ? "Anzahl der im Bereich ausgewählten Vokabeln" : "Anzahl der Vokabeln, die zur Auswahl stehen (alle Vokabeln der Listen mit den gewählten Spalten)")}>({quizGefilterteVoks.length} V.)</span>
                    {/* RECHTS */}
                    <span style={{flex:1, display:"flex", justifyContent:"flex-end"}}>
                      {quizBereichTyp === "bereich" && quizListeAufgeklappt ? (
                        <button data-vok-bestaetigen className="toggle-opt aktiv zeile-rechts bestaetigen-knopf"
                          onClick={() => { if (vokAuswahlZurTafel()) return;   // 297
                            if (quizCheckboxAuswahl.size === 0) setQuizBereichTyp("alle"); setQuizListeAufgeklappt(false); leuchte("vokwahl"); }}
                          {...tt("Auswahl bestätigen – schließt die Vokabelliste (nichts angehakt: wieder alle Vokabeln)")}>
                          Bestätigen
                        </button>
                      ) : (
                      <div className="toggle-btn zeile-rechts">
                        <button className={`toggle-opt${quizBereichTyp==="alle"?" aktiv" + blitzt("vokwahl"):""}`} data-vokwahl="alle"
                          onClick={() => { setQuizBereichTyp("alle"); setQuizListeAufgeklappt(false); setQuizVonBisModus(false); setQuizVonBisErster(null); }}
                          {...tt("Alle Vokabeln der gewählten Listen abfragen")}>
                          Alle
                        </button>
                        <button className={`toggle-opt${quizBereichTyp==="bereich"?" aktiv" + blitzt("vokwahl"):""}`} data-vokwahl="bereich"
                          onClick={() => {
                            if (quizBereichTyp !== "bereich") { setQuizBereichTyp("bereich"); if (quizCheckboxAuswahl.size === 0) { schliesseQuizBereiche("einzel"); setQuizListeAufgeklappt(true); } }
                            else { toggleEinzelauswahl(); }
                          }}
                          {...tt("Einzelne Vokabeln per Checkbox oder Von–Bis-Bereich auswählen – antippen öffnet die Vokabelliste")}>
                          Bereich
                        </button>
                      </div>
                      )}
                    </span>
                    </>)}
                  </div>
                )}

                {aufteilen && kombiListe && renderAufteilenKasten()}

                {/* Einzelauswahl (Bereich-Modus) */}
                {quizListeAufgeklappt && quizBereichTyp === "bereich" && kombiListe && (() => {
                  const such = suchInfo(basisVoks, sucheQuiz);
                  return (
                  <div ref={einzelauswahlRef} className="karte" data-vok-scroller={maxFenster ? "" : undefined}
                    style={maxFenster
                      ? { position:"fixed", top:maxFenster.top + alleBereichH, height:Math.max(120, maxFenster.h - alleBereichH), ...maxSpalte, zIndex:7,
                          overflowY:"auto", overscrollBehavior:"contain", WebkitOverflowScrolling:"touch", borderRadius:0, borderLeft:"none", borderRight:"none", borderTop:"none",
                          paddingBottom:"var(--tafel-platz, 0px)" }
                      : {marginBottom:8, marginTop:8, overflow:"visible"}}>
                    {basisVoks.length > 0 && renderSuchleiste("quiz", basisVoks, sucheQuiz, setSucheQuiz, maxFenster ? 0 : headerH + slotH + listenauswahlHeaderH + alleBereichH)}
                    {basisVoks.length === 0
                      ? <div style={{padding:"16px", color:"var(--text2)", fontSize:"0.85rem"}}>Keine Vokabeln verfügbar.</div>
                      : basisVoks.map((vok, idx) => {
                        if (such.filter && !such.ids.has(vok.id)) return null;   // „nur Treffer“ (Von–Bis zählt trotzdem über die ganze Liste)
                        const inChk = quizCheckboxAuswahl.has(vok.id);
                        const isVon = quizVonBisModus && vok.id === quizVonBisErster;
                        const sp1 = abfragbar[0]; const sp2 = abfragbar[1];
                        return (
                          <div {...vonBisLangDruck("quiz", vok, idx + 1, sp1 && vok[sp1]?.wert, sp2 && vok[sp2]?.wert)} key={vok.id} className="vok-zeile"
                            data-such-ziel="quiz" data-such-id={vok.id} data-auswahl-durchlass
                            style={{background: isVon ? "var(--gelb-flaeche)" : inChk ? "var(--haupt-flaeche)" : "transparent", ...suchMarke(such, vok.id)}}
                            onClick={() => {
                              zeileImBlick("quiz", vok.id);
                              if (!quizVonBisModus) { toggleVokCheckbox(vok.id); return; }
                              if (quizVonBisErster === null) {
                                setQuizVonBisErster(vok.id);
                              } else {
                                const vonIdx = basisVoks.findIndex(v => v.id === quizVonBisErster);
                                const [lo, hi] = vonIdx <= idx ? [vonIdx, idx] : [idx, vonIdx];
                                setQuizCheckboxAuswahl(prev => {
                                  const neu = new Set(prev);
                                  basisVoks.slice(lo, hi + 1).forEach(v => neu.add(v.id));
                                  return neu;
                                });
                                setQuizVonBisModus(false);
                                setQuizVonBisErster(null);
                              }
                            }}>
                            <div className={`checkbox${isVon ? " checked" : inChk?" checked":""}`} style={{flexShrink:0, ...(isVon ? {background:"var(--bestaetigen)", borderColor:"var(--bestaetigen)"} : {})}}>{isVon?"→":inChk?"✓":""}</div>
                            <span className="vok-nr">{idx+1}</span>
                            <span style={{fontSize:"0.88rem", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sp1?vok[sp1]?.wert||'':''}</span>
                            <span style={{fontSize:"0.82rem", color:"var(--text2)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"right"}}>{sp2?vok[sp2]?.wert||'':''}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                  ); })()}

                {!quizVokMax && (<>
                {/* 301: Filter-Zeile direkt unter dem Kopf (274: feste Plätze, an gefüllt, aus invertiert, nicht verfügbar ausgegraut); auf/zu über die Anzahl im Kopf */}
                {kombiListe && fokusZeigt("zeile1") && !schalterZeileZu && (
                  <div className="quiz-zeile schalter-zeile" data-schalter-zeile style={{position:"relative", top:0, zIndex:5}}>
                    {(() => {
                      // 310: Stufen-Knöpfe – antippen schaltet weiter (Kreislauf)
                      const auswahlAlle = gruppenAnz.nie + gruppenAnz.abgefragt + gruppenAnz.negativ, auswahlAbg = gruppenAnz.abgefragt + gruppenAnz.negativ;
                      const kn = [
                        { k: "grund", label: quizGrund === "abgefragt" ? "Schon geübt" : "Zu lernen", stufe: quizGrund === true ? "alle" : quizGrund || "aus",
                          n: quizGrund === "abgefragt" ? auswahlAbg : auswahlAlle, an: quizGrund !== false, frei: auswahlAlle > 0,
                          weiter: () => setQuizGrund(g => g === true ? "abgefragt" : g === "abgefragt" ? false : true),
                          text: quizGrund === "abgefragt" ? "Schon geübt: zu lernende, die schon einmal abgefragt wurden" : "Zu lernen: alle noch nicht gelernten Vokabeln",
                          naechste: quizGrund === true ? "nur schon geübte" : quizGrund === "abgefragt" ? "aus" : "alle zu lernenden" },
                        { k: "faellig", label: langStufe === "gelernt" ? "Gelernte" : langStufe === "aus" ? "Bereits gelernte" : "Fällige", stufe: langStufe, zeichen: langStufe === "faellig" ? <SymWdh/> : "✓", plus: true,   // 319
                          n: langStufe === "faellig" ? eigeneFAnz : gruppenAnz.gelernt + eigeneFAnz, an: langStufe !== "aus", frei: schwelle > 0 && gruppenAnz.gelernt + eigeneFAnz > 0,
                          weiter: () => { if (langStufe === "faellig") { setQuizFaellig(f => ({ ...f, an: false })); setQuizGelerntEinschliessen(true); }
                            else if (langStufe === "gelernt") { setQuizFaellig(f => ({ ...f, an: false })); setQuizGelerntEinschliessen(false); }
                            else { setQuizFaellig(f => ({ ...f, an: true })); setQuizGelerntEinschliessen(false); } },
                          text: langStufe === "gelernt" ? "Alle gelernten der Auswahl" : langStufe === "aus" ? "Bereits gelernte – werden nicht abgefragt" : "Gelernte der Auswahl, die jetzt zur Prüfung fällig sind",
                          naechste: langStufe === "faellig" ? "alle gelernten" : langStufe === "gelernt" ? "aus" : "die fälligen" },
                        { k: "heute", label: "Heute", stufe: quizHeuteEinschliessen ? "an" : "aus", n: gruppenAnz.heute, an: quizHeuteEinschliessen, frei: heuteSperre && gruppenAnz.heute > 0, plus: true,
                          weiter: () => setQuizHeuteEinschliessen(v => !v), text: "Heute schon abgefragte Vokabeln – sonst kommen sie erst morgen wieder",
                          naechste: quizHeuteEinschliessen ? "aus" : "ein" },
                      ];
                      return kn.map(x => (
                        <div key={x.k} className="quiz-zeile-zelle"><span className="quiz-zeile-label">{x.label}</span>
                        <button className={`quiz-zeile-knopf${x.an ? " an" : ""}`} data-schalter={x.k} data-an={x.an ? "an" : "aus"} data-filter-stufe={x.stufe} {...gesperrtAttr(!x.frei)}
                          {...(x.k === "heute" ? { "data-heute": x.an ? "an" : "aus" } : x.k === "faellig" ? { "data-gelernte": x.stufe === "gelernt" ? "an" : "aus" } : {})}
                          onClick={e => { if (!x.frei) { blinke(e.currentTarget); return; } schliesseQuizBereiche(null); x.weiter(); setStartLeerHinweis(false); }}
                          {...tt(`${x.text}: ${x.n} – ${x.an ? "werden abgefragt" : "ausgeschaltet"}; antippen: ${x.naechste}`)}>
                          {x.plus && x.an && x.n > 0 && "+ "}{x.zeichen && <>{x.zeichen} </>}{x.n}
                        </button></div>
                      ));
                    })()}
                  </div>
                )}

                {/* ZEILE 1: Stufe (Lernen/Leicht/Schwer) | Abfrage-Modus | Reihenfolge – je ein Bereich klappt darunter auf */}
                {kombiListe && fokusZeigt("zeile1") && (
                  <div ref={abfrageModusRef} className={`quiz-zeile${quizStufeAufgeklappt || quizAbfrageModusAufgeklappt || quizReihenfolgeAufgeklappt ? " hat-offen" : ""}`} style={{position: quizFokus === "zeile1" ? "sticky" : "relative", top: quizFokus === "zeile1" ? headerH + slotH : 0}}>
                    <div className={`quiz-zeile-zelle${quizStufeAufgeklappt ? " offen" : ""}`}><span className="quiz-zeile-label">Lern-Modus</span>
                    <button className={`quiz-zeile-knopf stufe${quizStufeAufgeklappt ? " offen bestaetigen-knopf" : ""}${leuchtet("stufe")}`} data-stufe={lernAktiv ? "lernen" : einstellungen.modus === "einfach" ? "einfach" : "schwer"}
                      onClick={() => { const auf = !quizStufeAufgeklappt; if (auf) schliesseQuizBereiche("stufe"); setQuizStufeAufgeklappt(auf); }}
                      {...tt(quizStufeAufgeklappt ? "Bestätigen – klappt die Stufe zu" : "Stufe: Lernen, Leicht oder Schwer – antippen zum Einstellen (dort auch Regeln, Lernen und Vorlesen)")}>
                      {offenText(quizStufeAufgeklappt, lernAktiv ? "Lernen" : einstellungen.modus === "einfach" ? "Leicht" : "Schwer")}
                    </button></div>
                    <div className={`quiz-zeile-zelle${quizAbfrageModusAufgeklappt ? " offen" : ""}`}><span className="quiz-zeile-label" data-frage-antwort-label>{frageAntwortLabel}</span>
                    <button className={`quiz-zeile-knopf${quizAbfrageModusAufgeklappt ? " offen bestaetigen-knopf" : ""}${leuchtet("modus")}${(!quizAbfrageModusAufgeklappt && !istDiktat && (quizModus === "rotierend" || gemischt)) || (quizAbfrageModusAufgeklappt && (artenMehrfach || antwortMehrfach)) ? " zweizeilig" : ""}`} data-abfragemodus onClick={toggleAbfrageModus}
                      {...tt(quizAbfrageModusAufgeklappt && (artenMehrfach || antwortMehrfach) ? "Auswahl übernehmen und zuklappen" : quizAbfrageModusAufgeklappt ? "Bestätigen – klappt den Abfrage-Modus zu" : "Abfrage-Modus: Spalten, Karte/MC/Tastatur, Frage–Antwort oder wechselnd – antippen zum Einstellen")}>
                      {/* wechselnd: zweizeilig, damit die Antwort-Arten Platz haben */}
                      {quizAbfrageModusAufgeklappt && (artenMehrfach || antwortMehrfach) ? (() => {
                          const n = artenMehrfach ? new Set((quizModus === "rotierend" ? quizAusgewaehlt : quizAntwortTypenGeordnet).flatMap(x => modiVon(quizSpalteModus[x]))).size : quizAntwortTypenGeordnet.length;
                          return <><span className="zeile1" data-mehrfach-anzahl={n}>{n} {artenMehrfach ? (n === 1 ? "Art" : "Arten") : (n === 1 ? "Antwort" : "Antworten")}</span><span className="zeile2" data-bestaetigen>✓ Bestätigen</span></>; })()
                        : quizAbfrageModusAufgeklappt ? offenText(true, !istDiktat && (quizModus === "rotierend" || gemischt) ? (quizModus === "rotierend" ? "wechselnd" : "Gemischt") : abfrageModusName)
                        : !istDiktat && (quizModus === "rotierend" || gemischt)
                        ? <><span className="zeile1">{quizModus === "rotierend" ? (gemischt ? "wechselnd · gemischt" : "wechselnd") : "Gemischt"}</span><span className="zeile2">{antwortArten.join(" – ") || "keine Spalte"}</span></>
                        : abfrageModusName}
                    </button></div>
                    <div className={`quiz-zeile-zelle${quizReihenfolgeAufgeklappt ? " offen" : ""}`}><span className="quiz-zeile-label">Reihenfolge</span>
                    <button className={`quiz-zeile-knopf umbruch${quizReihenfolgeAufgeklappt ? " offen bestaetigen-knopf" : ""}${leuchtet("reihenfolge")}`} data-reihenfolge onClick={toggleReihenfolge}
                      {...tt(quizReihenfolgeAufgeklappt ? "Bestätigen – klappt die Reihenfolge zu" : "Reihenfolge: zufällig, schlechteste zuerst oder nach Listenplatz – antippen zum Einstellen")}>
                      {offenText(quizReihenfolgeAufgeklappt, quizReihenfolge === "zufall" ? "Zufällig" : quizReihenfolge === "schlechteste" ? "Schlechteste zuerst" : "Listenplatz")}
                    </button></div>
                  </div>
                )}
                {kombiListe && quizStufeAufgeklappt && (
                  <div className="karte" data-stufe-auswahl data-wahl-bereich style={{marginTop:16, marginBottom:16}}>
                    <div className="toggle-row">
                      <div className="toggle-btn" style={{display:"flex", width:"100%"}}>
                        {[["lernen", "Lernen", "Lernen: Wort, Übersetzung und Zusatzinfo nacheinander zeigen – ohne Score"],
                          ["einfach", "Leicht", "Leicht: Regeln der Stufe „Leicht“ (siehe Regeln)"], ["schwer", "Schwer", "Schwer: Regeln der Stufe „Schwer“ (siehe Regeln)"]].map(([k, label, info]) => {
                          const aktiv = k === "lernen" ? lernAktiv : !lernAktiv && (einstellungen.modus === "einfach" ? "einfach" : "schwer") === k;
                          return (
                            <button key={k} data-stufe-wahl={k} className={`toggle-opt${aktiv ? " aktiv" : ""}`} style={{flex:1}}
                              onClick={() => { if (aktiv) return; speichereEinst(k === "lernen" ? { ...einstellungen, lernen: { ...lernEinstellungen(), aktiv: true } }
                                : { ...einstellungen, modus: k, lernen: { ...lernEinstellungen(), aktiv: false } }); setTimeout(() => setQuizStufeAufgeklappt(false), WAHL_ZU_MS); }}
                              {...tt(info)}>{label}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap", padding:"0 16px 12px"}}>
                      <button className="typ-btn" data-stufe-regeln onClick={() => setModal("stufen-regeln")} {...tt("Was in den Stufen Leicht und Schwer gilt (Punkte, Hilfen, Zuordnung …)")}>⚙ Regeln Leicht / Schwer</button>
                      {lernAktiv && <button className="typ-btn" data-stufe-lernen onClick={() => setModal("lernen-einst")} {...tt("Lernen einstellen: Reihenfolge, Pausen, Vorlesen, Quiz danach")}>🎬 Lernen einstellen</button>}
                      <button className="typ-btn" data-stufe-vorlesen onClick={() => setModal("vorlesen")} {...tt("Vorlesen einstellen")}>🔊 Vorlesen</button>
                    </div>
                  </div>
                )}
                {kombiListe && !quizFokus && mitAkzentAnzahl != null && (
                  <div className="quiz-zeile-hinweis" data-anzahl="akzent"
                    {...tt(ohneAkzentAnzahl != null ? "Vokabeln mit Akzent und dazu genommene Wörter ohne Akzent (Anzahl begrenzt, siehe Regeln)" : "Davon Vokabeln mit Akzent in der Akzente-Spalte")}>
                    ({mitAkzentAnzahl} mit Akzent{ohneAkzentAnzahl != null ? ` + ${ohneAkzentAnzahl} ohne` : ""})
                  </div>
                )}
                {kombiListe && (
                  <div ref={abfrageModusContainerRef} style={{overflow:'hidden', paddingTop: quizAbfrageModusAufgeklappt ? 16 : 0}}>
                    {quizAbfrageModusAufgeklappt && (<>
                      {/* ABFRAGE-MODUS */}
                      {quizArt === "uebersetzung" && (
                      <div className="karte" style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div className="toggle-btn">
                            <button className={`toggle-opt${quizModus==="sequenziell"?" aktiv":""}`} onClick={() => setQuizModus("sequenziell")} {...tt("Karte aufdecken und mit Richtig/Falsch selbst bewerten")}>Frage – Antwort</button>
                            <button className={`toggle-opt${quizModus==="rotierend"?" aktiv":""}`} onClick={() => setQuizModus("rotierend")} {...tt("Frage- und Antwortspalte wechseln sich zwischen Vokabeln ab")}>wechselnd</button>
                          </div>
                          <button className="btn-toggle-ghost" onClick={() => setQuizModusInfoAufgeklappt(v => !v)}
                            {...tt("Spalten und Anzeigeoptionen konfigurieren")}>
                            {quizModusInfoAufgeklappt ? <IcoDown s={10}/> : <IcoUp s={10}/>}
                          </button>
                        </div>
                        {quizModusInfoAufgeklappt && (
                          <div style={{padding:"0 16px 14px", fontSize:"0.82rem", color:"var(--text2)"}}>
                            {quizModus === "sequenziell"
                              ? "Feste Frage-Spalte, Antwort-Spalten der Reihe nach. Kartenmodus pro Spalte wählbar."
                              : quizModus === "rotierend"
                              ? "Frage-Spalte wechselt mit jeder Vokabel. Kartenmodus pro Spalte wählbar."
                              : "Wort wird vorgelesen – du tippst was du hörst. Falsch → ein Buchstabe mehr aufgedeckt."}
                          </div>
                        )}
                      </div>
                      )}

                      {/* DIKTAT-KONFIGURATION */}
                      {quizModus === "diktat" && (
                        <>
                          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}} data-diktat-art>
                            <span className="sektion-label" style={{margin:0, flex:1}}>Antwortart: Diktat</span>
                            <button className="typ-btn" data-diktat-zurueck onClick={() => wechsleQuizArt("uebersetzung")}
                              {...tt("Zurück zu den Antwortarten der Übersetzung (Karte, MC, Tastatur …)")}>Andere Antwortart</button>
                          </div>
                          <div className="sektion-label" style={{marginBottom:8}}>Diktat-Konfiguration</div>
                          <div className="karte" style={{marginBottom:16}}>
                            <div style={{padding:"12px 16px", borderBottom:"1px solid var(--rahmen)"}}>
                              <div className="inp-label">Diktat-Spalte (wird vorgelesen)</div>
                              <div style={{display:"flex", gap:6, marginTop:8, flexWrap:"wrap"}}>
                                {abfragbar.map(typ => (
                                  <button {...tt("Diese Spalte wird vorgelesen und muss geschrieben werden")} key={typ} className={`typ-btn${quizDiktatSpalte===typ?" aktiv":""}`}
                                    onClick={() => setQuizDiktatSpalte(typ)}>
                                    {kombiListe.spalten[typ].name || typ}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{padding:"12px 16px"}}>
                              <div className="inp-label">Übersetzungs-Spalte (als Hinweis, optional)</div>
                              <div style={{display:"flex", gap:6, marginTop:8, flexWrap:"wrap"}}>
                                <button {...tt("Keine Übersetzung als Hinweis anzeigen")} className={`typ-btn${quizDiktatUebersetzung===""?" aktiv":""}`}
                                  onClick={() => setQuizDiktatUebersetzung("")}>Keine</button>
                                {abfragbar.filter(t => t !== quizDiktatSpalte).map(typ => (
                                  <button {...tt("Diese Spalte als Übersetzung/Hinweis anzeigen")} key={typ} className="typ-btn"
                                    style={quizDiktatUebersetzung===typ ? {background:"var(--gelb)",color:"var(--auf-gelb)",borderColor:"var(--gelb)"} : undefined}
                                    onClick={() => setQuizDiktatUebersetzung(typ)}>
                                    {kombiListe.spalten[typ].name || typ}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SPALTEN + INFO-SPALTEN */}
                      {quizModus !== "diktat" && (<>
                        <div className="sektion-label" style={{marginBottom:8}}>Spalten auswählen</div>
                        <div className="karte" style={{marginBottom:16}}>
                          {abfragbar.map(typ => {
                            const checked = quizAusgewaehlt.includes(typ);
                            const isFrage = quizFrageTyp === typ;
                            const antwortNr = quizAntwortTypenGeordnet.indexOf(typ);
                            const isAntwort = antwortNr >= 0;
                            const isInfo = quizInfoTypenSession.includes(typ);
                            const hatFrage = quizFrageTyp !== "";
                            const anzGesamt = quizAusgewaehlt.length;
                            return (
                              <div key={typ} style={{padding:"10px 16px", borderBottom:"1px solid var(--rahmen)"}}>
                                <div {...tt("Spalte für die Abfrage aus- oder abwählen")} style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}}
                                  onClick={() => toggleQuizSpalte(typ)}>
                                  <div className={`checkbox${checked?" checked":""}`}>{checked?"✓":""}</div>
                                  <div style={{flex:1}}>
                                    <div style={{fontWeight:600, fontSize:"0.9rem"}}>{kombiListe.spalten[typ].name||typ}</div>
                                    <div style={{fontSize:"0.75rem", color:"var(--text2)"}}>{typ}</div>
                                  </div>
                                </div>
                                {checked && quizModus === "sequenziell" && (
                                  <div style={{display:"flex", gap:5, marginTop:8, marginLeft:30, flexWrap:"wrap", alignItems:"center"}}>
                                    {(!hatFrage || isFrage) && (
                                      <button {...tt("Diese Spalte wird als Frage gezeigt")} className={`spalten-rolle-btn${isFrage?" frage":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"frage")}>Frage</button>
                                    )}
                                    {!isFrage && !isInfo && (quizArt !== "akzente" || typ.startsWith('E')) && (
                                      <button {...tt("Antwort – antippen: diese Spalte ist die einzige Antwort; lang drücken: weitere Antwort dazu bzw. weg (Reihenfolge ergibt Antwort 1, 2 …)", null,
                                          { beimLang: () => toggleSpalteRolle(typ, "antwort", true) })}
                                        className={`spalten-rolle-btn${isAntwort?" antwort":""}${blitzt(`rolle:${typ}`)}`} data-rolle-antwort={typ}
                                        onClick={() => toggleSpalteRolle(typ,"antwort")}>
                                        {isAntwort ? `Antwort ${antwortNr+1}` : "Antwort"}
                                      </button>
                                    )}
                                    {!isFrage && !isAntwort && anzGesamt >= 3 && (
                                      <button {...tt("Diese Spalte nur als Hinweis zeigen, nicht abfragen")} className={`spalten-rolle-btn${isInfo?" info":""}`}
                                        onClick={() => toggleSpalteRolle(typ,"info")}>Info</button>
                                    )}
                                    {isAntwort && quizArt === "akzente" && (
                                      <span className="spalten-modus-btn aktiv" style={{marginLeft:4, cursor:"default"}}
                                        {...tt("Akzente üben: für jeden Buchstaben den richtigen Akzent wählen – eigener Akzent-Score")}>Akzente</span>
                                    )}
                                  </div>
                                )}
                                {checked && quizModus === "sequenziell" && isAntwort && quizArt !== "akzente" && (
                                  <div style={{marginTop:12, marginLeft:30}}>{renderModusKnoepfe(typ)}</div>
                                )}
                                {checked && quizModus === "rotierend" && (
                                  <div style={{marginTop:10, marginLeft:30}}>{renderModusKnoepfe(typ)}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {infoSpalten.length > 0 && (
                          <>
                            <div className="sektion-label" style={{marginBottom:8}}>Info-Spalten anzeigen</div>
                            <div className="karte" style={{marginBottom:16}}>
                              {infoSpalten.map(typ => (
                                <div {...tt("Diese Info-Spalte während der Abfrage anzeigen")} key={typ} className="quiz-setup-check" style={{padding:"10px 16px"}}
                                  onClick={() => toggleInfoSpalte(typ)}>
                                  <div className={`checkbox${quizZeigeInfo[typ]?" checked":""}`}>{quizZeigeInfo[typ]?"✓":""}</div>
                                  <div>
                                    <div style={{fontWeight:600, fontSize:"0.9rem"}}>{kombiListe.spalten[typ].name||typ}</div>
                                    <div style={{fontSize:"0.75rem", color:"var(--text2)"}}>{typ} — immer nur angezeigt</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>)}

                    </>)}
                  </div>
                )}
                {kombiListe && (
                  <div ref={reihenfolgeContainerRef} style={{overflow:'hidden', paddingTop: quizReihenfolgeAufgeklappt ? 16 : 0}}>
                    {quizReihenfolgeAufgeklappt && (
                      <div className="karte" data-wahl-bereich style={{marginBottom:16}}>
                        <div className="toggle-row">
                          <div className="toggle-btn">
                            <button className={`toggle-opt${quizReihenfolge==="zufall"?" aktiv":""}`} data-reihenfolge-wahl="zufall" onClick={() => { if (quizReihenfolge === "zufall") return; setQuizReihenfolge("zufall"); setTimeout(() => setQuizReihenfolgeAufgeklappt(false), WAHL_ZU_MS); }} {...tt("Vokabeln zufällig mischen")}>Zufällig</button>
                            <button className={`toggle-opt${quizReihenfolge==="schlechteste"?" aktiv":""}`} data-reihenfolge-wahl="schlechteste" onClick={() => { if (quizReihenfolge === "schlechteste") return; setQuizReihenfolge("schlechteste"); setTimeout(() => setQuizReihenfolgeAufgeklappt(false), WAHL_ZU_MS); }} {...tt("Vokabeln mit niedrigstem Score zuerst abfragen")}>Schlechteste zuerst</button>
                            <button className={`toggle-opt${quizReihenfolge==="listennr"?" aktiv":""}`} data-reihenfolge-wahl="listennr" onClick={() => { if (quizReihenfolge === "listennr") return; setQuizReihenfolge("listennr"); setTimeout(() => setQuizReihenfolgeAufgeklappt(false), WAHL_ZU_MS); }} {...tt("Vokabeln in der Reihenfolge der Liste (Listenplatz) abfragen")}>Listenplatz</button>
                          </div>
                        </div>
                        <div className="toggle-row" style={{cursor:"pointer", padding:"12px 16px", borderTop:"1px solid var(--rahmen)"}}
                          onClick={() => setQuizUnbeantwortetZuerst(prev => ({...prev, [quizReihenfolge]: !prev[quizReihenfolge]}))}
                          {...tt("Noch nie abgefragte Vokabeln werden vorgezogen")}>
                          <div>
                            <div className="toggle-label">Unbeantwortete zuerst</div>
                            <div className="toggle-sub">Vokabeln ohne Score werden zuerst abgefragt</div>
                          </div>
                          <div className={`checkbox${quizUnbeantwortetZuerst[quizReihenfolge]?" checked":""}`}>{quizUnbeantwortetZuerst[quizReihenfolge]?"✓":""}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ZEILE 2: Umfang | Abfrage-Ziel (274: die Vokabel-Schalter haben eine eigene Zeile) */}
                {kombiListe && fokusZeigt("zeile2") && (
                  <div ref={sessionRef} className={`quiz-zeile${quizSessionAufgeklappt === "umfang" || quizSessionAufgeklappt === "ziel" ? " hat-offen" : ""}`} style={{position: quizFokus === "zeile2" ? "sticky" : "relative", top: quizFokus === "zeile2" ? headerH + slotH : 0, zIndex:6}}>
                    <div className={`quiz-zeile-zelle${quizSessionAufgeklappt === "ziel" ? " offen" : ""}`}><span className="quiz-zeile-label">Wie oft</span>
                    <button className={`quiz-zeile-knopf${quizSessionAufgeklappt === "ziel" ? " offen bestaetigen-knopf" : ""}${leuchtet("ziel")}`} data-abfrageziel
                      onClick={() => toggleSessionBereich("ziel")}
                      {...tt(quizSessionAufgeklappt === "ziel" ? "Bestätigen – klappt das Abfrage-Ziel zu" : "Abfrage-Ziel: wie oft bzw. bis wann jede Vokabel abgefragt wird – antippen zum Einstellen")}>
                      {offenText(quizSessionAufgeklappt === "ziel", abfrageZielModus === "blitz" ? "⚡ Blitz 60 s" : abfrageZielModus === "serie" ? "🔥 Serie" : abfrageZielModus === "wiederholung" ? `${abfrageZielWiederholung}× richtig`
                        : abfrageZielModus === "score" ? (abfrageZielScoreTyp === "session" ? `Quiz ${abfrageZielScore > 0 ? "+" : ""}${abfrageZielScore}` : `Score < ${abfrageZielScore > 0 ? "+" : ""}${abfrageZielScore}`) : `${abfrageZielAnzahl}×`)}
                    </button></div>
                    {langzeitKnopf}
                  </div>
                )}
                {quizSessionAufgeklappt && kombiListe && (
                  <div ref={sessionContainerRef} className="karte" data-wahl-bereich style={{marginBottom:8, marginTop:8}}>
                    {(<>
                    <div style={{padding:"12px 16px 8px", fontWeight:600, fontSize:"0.82rem", color:"var(--text2)"}}>Abfrage-Ziel</div>
                    <div style={{display:"flex", gap:6, flexWrap:"wrap", padding:"0 16px 8px"}}>
                      {[["anzahl","Anzahl","Jede Vokabel 1–3× pro Runde abfragen"],["wiederholung","Mit Wiederholung","Vokabeln wiederholen bis jede N-mal in Folge richtig beantwortet wurde"],["score","Score","Vokabeln wiederholen bis ihr Score das Ziel erreicht"],
                        ["blitz","⚡ Blitzrunde","Möglichst viele richtig in 60 Sekunden – die Vokabeln kommen immer wieder, mit Rekord"],
                        ["serie","🔥 Serie","So viele wie möglich am Stück richtig – der erste Fehler beendet die Serie, mit Rekord"]].map(([m, label, tip]) => (
                        <button key={m} className={`typ-btn${abfrageZielModus===m?" aktiv":""}`}
                          onClick={() => setAbfrageZielModus(m)} {...tt(tip)}>{label}</button>
                      ))}
                    </div>
                    {abfrageZielModus === "anzahl" && (
                      <div style={{display:"flex", gap:6, padding:"0 16px 12px", alignItems:"center"}}>
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginRight:4}}>Jede Vokabel</span>
                        {[1,2,3].map(n => (
                          <button key={n} className={`typ-btn${abfrageZielAnzahl===n?" aktiv":""}`}
                            onClick={() => setAbfrageZielAnzahl(n)} {...tt(`Jede Vokabel ${n}× pro Runde abfragen`)}>{n}×</button>
                        ))}
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginLeft:4}}>abfragen</span>
                      </div>
                    )}
                    {abfrageZielModus === "wiederholung" && (
                      <div style={{display:"flex", gap:6, padding:"0 16px 12px", alignItems:"center"}}>
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginRight:4}}>Bis</span>
                        {[1,2,3].map(n => (
                          <button key={n} className={`typ-btn${abfrageZielWiederholung===n?" aktiv":""}`}
                            onClick={() => setAbfrageZielWiederholung(n)} {...tt(`Jede Vokabel ${n}× in Folge richtig beantworten`)}>{n}×</button>
                        ))}
                        <span style={{fontSize:"0.78rem", color:"var(--text3)", marginLeft:4}}>richtig</span>
                      </div>
                    )}
                    {abfrageZielModus === "score" && (() => {
                      const zielSliderPct = (abfrageZielScore + 10) / 20;
                      return (
                        <div style={{padding:"0 16px 12px"}}>
                          <div style={{display:"flex", gap:6, marginBottom:10}}>
                            {[["global","Globaler Score","Nur Vokabeln mit Score unter dem Ziel abfragen, ein Durchgang (Ziel 0: nur negative)"],["session","Quiz-Score","Vokabeln abfragen bis der Fortschritt dieses Quiz das Ziel erreicht"]].map(([t, label, tip]) => (
                              <button key={t} className={`typ-btn${abfrageZielScoreTyp===t?" aktiv":""}`}
                                onClick={() => setAbfrageZielScoreTyp(t)} {...tt(tip)}>{label}</button>
                            ))}
                          </div>
                          <div style={{fontSize:"0.75rem", color:"var(--text3)", marginBottom:6}}>
                            {abfrageZielScoreTyp === "session" ? "Quiz-Score-Ziel" : "Globaler Score-Ziel"}
                          </div>
                          <div style={{position:"relative", paddingTop:28}}>
                            <div style={{
                              position:"absolute", top:0,
                              left:`calc(${zielSliderPct} * (100% - 28px) + 14px)`,
                              transform:"translateX(-50%)",
                              background:"var(--haupt)", color:"var(--auf-haupt)",
                              borderRadius:6, padding:"3px 9px",
                              fontSize:"0.82rem", fontWeight:600, pointerEvents:"none",
                            }}>{abfrageZielScore > 0 ? "+" : ""}{abfrageZielScore}</div>
                            {/* Nullpunkt-Markierung */}
                            <div style={{
                              position:"absolute", top:32,
                              left:`calc(0.5 * (100% - 28px) + 14px)`,
                              transform:"translateX(-50%)",
                              width:2, height:8, background:"var(--text4)", borderRadius:1, pointerEvents:"none",
                            }}/>
                            <input {...ttFeld("Ziel-Score: Vokabeln werden wiederholt, bis sie ihn erreichen")} type="range" min={-10} max={10} step={1}
                              value={abfrageZielScore}
                              onChange={e => setAbfrageZielScore(Number(e.target.value))}
                              className="score-slider" style={{width:"100%", display:"block"}}/>
                          </div>
                        </div>
                      );
                    })()}
                    </>)}
                  </div>
                )}

                {/* START-BEREICH: Quiz-Fortschritt + großer Start-Knopf */}
                {kombiListe && !quizFokus && (
                  <div className="start-bereich">
                    {(() => {
                      // Abfrageart wählen: gewählte Art groß (mit Name und Lernfortschritt), die anderen kleiner
                      const ls = lernstandJeArt(quizBereichTyp === "bereich" && quizCheckboxAuswahl.size > 0 ? kombiListe.vokabeln.filter(v => quizCheckboxAuswahl.has(v.id)) : kombiListe.vokabeln);
                      return (
                        <div data-start-arten hidden>{/* Abfrageart (Ü/D/A) wird über die Antwortarten gewählt – unsichtbare Umschalter für Tests */}
                          {QUIZ_ARTEN.filter(a => !ls[a].aus).map(a => <button key={a} className={`start-art${a === quizArt ? " aktiv" : ""}`} data-quiz-art={a} data-pct={Math.round(ls[a].pct)}
                            onClick={() => { if (a !== quizArt) wechsleQuizArt(a); }}/>)}
                        </div>
                      );
                    })()}
                    <div className="start-titel-zeile">
                    {/* 300: lang auf die Überschrift setzt den Lernstand bzw. den Abgefragt-Stand zurück */}
                    <div className="start-titel" data-start-titel
                      {...(lernStand && !aufteilen ? { "data-lernstand": true } : isPakete && sessionHatFortschritt ? { "data-session-zuruecksetzen": "" } : {})}
                      {...tt(lernStand && !aufteilen ? `Lernstand: ${lernAngesehen} von ${lernGesamt} angesehen – lang drücken: Lernen von vorn beginnen (Scores bleiben)`
                        : isPakete && sessionHatFortschritt ? `${sessionAbgefragtAnzahl} von ${anzeigeGesamt} abgefragt – lang drücken: Abgefragt-Stand zurücksetzen (Scores und Lernfortschritt bleiben)` : null, null,
                        lernStand && !aufteilen ? { lang: () => setLernResetFrage(true) } : isPakete && sessionHatFortschritt ? { lang: () => setSessionResetFrage(true) } : {})}>{lernAktiv ? (lernStand && !aufteilen ? <><span data-anzahl="lernstand">{lernAngesehen}/{lernGesamt}</span> Vokabeln</> : <>{sessionAnzahl} Vokabel{sessionAnzahl !== 1 ? "n" : ""}</>)
                        : isPakete ? <>{sessionHatFortschritt ? <span data-anzahl="fortschritt">{sessionAbgefragtAnzahl}/{anzeigeGesamt}</span> : <>0/{anzeigeGesamt}</>} Vokabeln
                            {fZiel > 0 && <span data-start-titel-faellig={fZiel}> + <SymWdh/> <span data-anzahl="faellig">{fGemacht}/{fZiel}</span></span>}</>
                        : <>{titelAnzahl} Vokabel{titelAnzahl !== 1 ? "n" : ""}{fZiel > 0 ? <span data-start-titel-faellig={fZiel}> + <SymWdh/> {fZiel}</span> : null}</>}</div>
                    </div>
                    {(isPakete || (lernStand && !aufteilen)) && (() => {   // 300/302: Fortschritt bzw. Lernstand als Balken (Zahlen in der Überschrift)
                      const lern = lernStand && !aufteilen, pct = lern ? (lernGesamt ? Math.round(100 * lernAngesehen / lernGesamt) : 0) : sessionPct;
                      return (
                      <div className="start-balken" data-start-balken={pct}>
                        <div className="start-balken-fuellung" style={{width:`${pct}%`}}/>
                      </div>
                      ); })()}
                    <div style={{display:"flex", gap:10, alignItems:"stretch"}}>
                      {lernAktiv && !aufteilen ? (
                        <button className="btn btn-primary start-knopf" data-start-knopf data-lernen-start={lernStand ? "weiter" : "neu"} data-start-anzahl={lernAnzahl}
                          onClick={() => starteLernen(lernVokabeln(), isPakete ? quizPaketGroesse : null, lernSpalten, lernInfo, lernStand)} disabled={!kannStarten || (lernAnzahl === 0 && !lernStand)}
                          {...tt((lernStand ? `Weiter lernen an der Stelle, an der du aufgehört hast (${lernAngesehen} von ${lernGesamt} angesehen)` : "Lernen starten: Wort zeigen, nach einer Pause die Übersetzung – ohne Score, des Quiz-Fortschritt bleibt") + umfangTipp, null, { lang: () => setUmfangAuf(true) })}>
                          {lernStand ? <><b>Weiter lernen – {umfangText}</b><span>{lernAngesehen} von {lernGesamt} angesehen</span></>
                            : <><b>Lernen starten – {umfangText}</b><span>{lernAnzahl} Vokabel{lernAnzahl !== 1 ? "n" : ""}</span></>}
                        </button>
                      ) : aufteilen ? (() => {
                        const neu = (aufteilenStand()?.gruppen || []).filter(g => !g.vorhanden).length;
                        return (
                          <button data-aufteilen-anlegen className="btn btn-primary" style={{flex:1, background:"var(--gelb-dunkel)", borderColor:"var(--gelb-dunkel)"}}
                            disabled={!kannStarten || neu === 0} onClick={legeAufteilenAn}
                            {...tt("Je Gruppe eine gespeicherte Konfiguration mit diesen Einstellungen anlegen")}>
                            ▦ {neu} Quiz anlegen
                          </button>
                        );
                      })() : alleAbgefragt ? (
                        <>
                        <button className="btn btn-primary start-knopf" data-start-knopf data-start-anzahl={sessionAnzahl}
                          onClick={() => { loescheSessionSlot(); }}
                          {...tt("Quiz-Fortschritt löschen und alle Vokabeln erneut abfragen", sessionSpeicherAktionen())}>
                          <b>Neuer Durchlauf</b><span>alle {sessionAnzahl} abgefragt</span>
                        </button>
                        {faelligeAlle.length > 0 && (
                          <button className="btn btn-primary start-knopf" data-nur-faellige={faelligeAlle.length} onClick={starteNurFaellige}
                            {...tt(`Nur die ${faelligeAlle.length} fälligen Vokabeln abfragen (eine Runde${quizPaketGroesse && quizPaketGroesse < PAKET_ALLE ? ` mit höchstens ${quizPaketGroesse}` : ""}) – der Quiz-Fortschritt bleibt`)}>
                            <b><SymWdh/> Nur Fällige</b><span>{faelligeAlle.length} fällig</span>
                          </button>
                        )}
                        </>
                      ) : verfuegbar === 0 && faelligeAlle.length > 0 && !lernAktiv ? (   // 310: nur Fällige übrig → „Nur Fällige“
                        <button className="btn btn-primary start-knopf" data-nur-faellige={faelligeAlle.length} onClick={starteNurFaellige}
                          {...tt(`Keine neuen Vokabeln offen – nur die ${faelligeAlle.length} fälligen abfragen (eine Runde) – der Quiz-Fortschritt bleibt`)}>
                          <b><SymWdh/> Nur Fällige</b><span>{faelligeAlle.length} fällig</span>
                        </button>
                      ) : (
                        <button className={`btn btn-primary start-knopf${!startbar ? " leer" : ""}`} data-start-knopf data-start-anzahl={verfuegbar} data-start-rest={startRest} data-start-faellig={fRest}
                          onClick={() => !startbar ? setStartLeerHinweis(h => !h) : starteQuiz()} disabled={!kannStarten}
                          {...tt((isPakete ? `${START_TEXT[quizArt] || "Quiz starten"} – in dieses Quiz sind noch ${startRest} Vokabeln übrig; abgefragt wird ${quizPaketGroesse >= PAKET_ALLE ? "alles in einem Paket" : `in Paketen zu ${quizPaketGroesse}`}` : `${START_TEXT[quizArt] || "Quiz starten"} – die Zahl nennt die Vokabeln dieser Fragerunde`) + umfangTipp, null, { lang: () => setUmfangAuf(true) })}>
                          <b data-start-umfang={umfangText}>{START_TEXT[quizArt] || "Quiz starten"} – {umfangText}</b><span>{startRest} Vokabel{startRest !== 1 ? "n" : ""}{isPakete && fRest > 0 ? <> + <SymWdh/> {fRest}</> : ""}</span>
                        </button>
                      )}
                    </div>
                    {umfangAuf && !aufteilen && (
                      <div className="karte" data-wahl-bereich data-umfang-kasten style={{marginTop:10, marginBottom:0}}>
                        <div className="umfang-raster" data-umfang-auswahl>
                          <button className={`typ-btn${!isPakete || quizPaketGroesse >= PAKET_ALLE ? " aktiv" : ""}`} data-umfang-wahl="alle"
                            onClick={() => { setQuizSessionModus("pakete"); setQuizPaketGroesse(PAKET_ALLE); setTimeout(() => setUmfangAuf(false), WAHL_ZU_MS); }}
                            {...tt("Alle Vokabeln des Quiz in einem Paket – der Fortschritt bleibt gespeichert")}>Alle</button>
                          {[5,10,15,20,25,30,40,50].map(n => (
                            <button key={n} className={`typ-btn${isPakete && quizPaketGroesse === n ? " aktiv" : ""}`} data-umfang-wahl={n}
                              onClick={() => { setQuizSessionModus("pakete"); setQuizPaketGroesse(n); setTimeout(() => setUmfangAuf(false), WAHL_ZU_MS); }}
                              {...tt(`Je ${n} Vokabeln pro Paket – der Fortschritt bleibt zwischen den Paketen erhalten`)}>{n}</button>
                          ))}
                        </div>
                        {farbeImMenueAn() && (   // 322: „🎨 Farbe ändern“ wie in der Tafel – rechts unten im Kasten
                          <div style={{display:"flex", justifyContent:"flex-end", marginTop:10}}>
                            <button data-umfang-farbe onClick={() => { const r = document.querySelector("[data-start-knopf]")?.getBoundingClientRect();
                                setUmfangAuf(false); if (r) farbeHier(r.x + r.width / 2, r.y + r.height / 2); }}
                              style={{background:"var(--karte)", color:"var(--text2)", border:"1.5px solid var(--haupt-zart)", borderRadius:22, padding:"8px 12px",
                                fontSize:"0.85rem", fontWeight:700, fontFamily:"inherit", cursor:"pointer", boxShadow:"0 4px 16px rgba(0,0,0,0.22)", whiteSpace:"nowrap"}}
                              {...tt("Farbe des Start-Knopfs ändern")}>🎨 Farbe ändern</button>
                          </div>
                        )}
                      </div>
                    )}
                    {lernStand && lernResetFrage ? (
                      <div data-lern-reset-frage style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", minHeight:31, fontSize:"0.82rem", marginTop:10}}>
                        <span style={{color:"var(--text)", fontWeight:600}}>Lernstand löschen?</span>
                        <button data-lern-reset-ja className="toggle-opt aktiv" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8}}
                          onClick={() => { setLernResetFrage(false); setzeLernStand(aktiverSlot, quizAbfrageArt, null); }}
                          {...tt("Ja: das Lernen beginnt beim nächsten Start von vorn. Scores und Abfrage-Fortschritt bleiben.")}>
                          Ja, von vorn
                        </button>
                        <button className="toggle-opt" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8, border:"1.5px solid var(--rahmen)"}}
                          onClick={() => setLernResetFrage(false)} {...tt("Nein: nichts ändern")}>Nein</button>
                      </div>
                    ) : null}
                    {sessionResetFrage && sessionHatFortschritt ? (
                      <div data-reset-frage style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", minHeight:31, fontSize:"0.82rem", marginTop:10}}>
                        <span style={{color:"var(--text)", fontWeight:600}}>Abgefragt-Stand löschen?</span>
                        <button data-reset-ja className="toggle-opt aktiv" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8}}
                          onClick={() => { setSessionResetFrage(false); loescheSessionSlot(); }}
                          {...tt("Ja: das Quiz beginnt von vorn – alle Vokabeln kommen wieder in die Pakete. Scores und Lernfortschritt bleiben erhalten.")}>
                          Ja, neu beginnen
                        </button>
                        <button className="toggle-opt" style={{padding:"5px 12px", fontSize:"0.8rem", borderRadius:8, border:"1.5px solid var(--rahmen)"}}
                          onClick={() => setSessionResetFrage(false)}
                          {...tt("Nein: nichts ändern")}>
                          Nein
                        </button>
                        <span style={{color:"var(--text3)", fontSize:"0.7rem"}}>(Scores bleiben)</span>
                      </div>
                    ) : null}
                    {startLeerHinweis && !lernAktiv && !aufteilen && !alleAbgefragt && verfuegbar === 0 && (() => {
                      const gel = quizGelerntEinschliessen ? 0 : gelernteAnzahl, heu = quizHeuteEinschliessen ? 0 : heuteAnzahl;
                      const teile = [gel && `${gel} gelernt`, heu && `${heu} heute schon abgefragt`].filter(Boolean);
                      const knoepfe = [gel && "„Fällige“ (antippen bis „Gelernte“)", heu && "„Heute“"].filter(Boolean);
                      return (
                        <div className="start-hinweis" data-start-hinweis onClick={() => setStartLeerHinweis(false)}>
                          {teile.length ? <span><b>{teile.join(" · ")}</b> – oben bei {knoepfe.join(" / ")} dazunehmen</span> : <span>Keine Vokabeln ausgewählt</span>}
                        </div>
                      );
                    })()}
                  </div>
                )}
                </>)}

                </>)}
              </div>
            </>
          );
        })()
  );
}
