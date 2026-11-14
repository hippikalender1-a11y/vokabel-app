import { APP_VERSION, SICHERUNG_TAGE, SK, formatTag, listenAusSicherung, lsGet } from "../speicher.js";
import { FAELLIG_ANTEIL_WAHL, MAX_STUFE, STANDARD_ANTWORT_GEWICHTE, WIEDERHOL_TAGE_WAHL, faelligAnteil, wiederholTage } from "../quiz.jsx";
import { IcoX } from "../komponenten.jsx";
import { MISCH_ARTEN } from "../raster.js";
import { SPRACHEN, STIMMEN_PROBE, aeusserung, gewaehlteStimme, listeSprache, normLang, sprachInfo, stimmeFuer, stimmeGeschlecht, stimmenFuerSprache, stimmenVarianten, varianteText } from "../sprache.js";

// Phase 2 (Aufteilung): Bereich aus dem Haupt-return von App.jsx (tab === "einstellungen")
// app = Zustände, Setter und Funktionen der Komponente (siehe „const app“ in App.jsx)
export function EinstellungenTab(app) {
  const { aendereStimmen, akzenteAn, bestaetigeWiederherstellen, einstBereich, einstKopf, einstUnter, einstWahl, einstZeile, einstellungen, headerH, infoHeaderRef, infoKontextContainerRef, infoModus, ladeSicherungsDatei, letzteSicherung, listeOeffnenKopf, listeVorschau, listenIndex, listenKopfRefCb, listenNavi, listenOrdner, listenOrdnerOffen, listenSortModus, listenWahl, listenWahlKopf, minSpalten, renderFarbschemata, renderListeInfo, renderListenRaster, schalteEinstBereich, setFaelligTick, setInfoModus, setModal, setSicherungLaden, setSpeicherDauerhaft, setUpdateStatus, setzeMinSpalten, sichereAlles, sicherungFehler, sicherungInputRef, sicherungLaden, sicherungTage, sichtbareListen, speicherDauerhaft, speichereEinst, stimmenWahl, tt, ttFeld, updateStatus, vorhandeneSprachen, wahlLeiste } = app;
  return (
<>
          {einstBereich === "info" && (<>
          {/* Info sticky Header */}
          <div ref={infoHeaderRef} style={{position:"sticky", top:headerH, zIndex:9, background:"var(--kopfzeile)", borderBottom:"1px solid var(--rahmen)", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <button className="einst-titel-knopf" data-einst-kopf="info" data-offen="ja" onClick={() => schalteEinstBereich("app")} {...tt("Info schließen – zurück zu App")}>‹ Info</button>
            <div style={{display:"flex", gap:6, alignItems:"center"}}>
              {infoModus !== "uebersicht" && (
                <button className="btn-icon" style={{marginRight:2}} onClick={() => setInfoModus("uebersicht")} {...tt("Zurück zur Übersicht")}><IcoX s={14}/></button>
              )}
              <button className={`typ-btn${infoModus==="uebersicht"?" aktiv":""}`}
                onClick={() => setInfoModus("uebersicht")} {...tt("App-Übersicht anzeigen")}>Übersicht</button>
              <button className={`typ-btn${infoModus==="konzept"?" aktiv":""}`}
                onClick={() => setInfoModus(m => m==="konzept"?"uebersicht":"konzept")} {...tt("Wie die App funktioniert – Konzepte erklärt")}>Konzept</button>
              <button className={`typ-btn${infoModus==="anleitung"?" aktiv":""}`}
                onClick={() => setInfoModus(m => m==="anleitung"?"uebersicht":"anleitung")} {...tt("Vollständige Button-Referenz für alle Tabs")}>Anleitung</button>
            </div>
          </div>

          {infoModus === "uebersicht" && (
            <div className="sektion">
              <div style={{background:"var(--info-kasten)", borderRadius:12, padding:"14px 16px", fontSize:"0.85rem", lineHeight:1.65, color:"var(--text)"}}>
                <div style={{fontWeight:700, marginBottom:6, fontSize:"0.95rem"}}>Vokabel-Trainer</div>
                <p style={{margin:0}}>
                  Lerne Vokabeln aus eigenen Listen – flexibel, ohne Anmeldung, direkt im Browser.
                  Alle Daten bleiben auf diesem Gerät.
                </p>
                <div style={{marginTop:10, display:"flex", flexDirection:"column", gap:4}}>
                                    <div><span style={{fontWeight:600}}>Quiz</span> – Abfragen mit Karte, Tippen oder Diktat</div>
                  <div><span style={{fontWeight:600}}>Statistik</span> – Lernfortschritt auf einen Blick</div>
                  <div><span style={{fontWeight:600}}>Einstellungen</span> – Listen verwalten, importieren und sichern; Lernen, Raster, Farben, Info</div>
                </div>
              </div>
            </div>
          )}

          {/* Aufklappbarer Kontext: Konzept / Anleitung */}
          {infoModus !== "uebersicht" && (
            <div ref={infoKontextContainerRef}>
              {infoModus === "konzept" ? (
                <div className="sektion" style={{fontSize:"0.85rem", lineHeight:1.75, color:"var(--text)"}}>
                  {[
                    {titel:"Listen", text:"Alles beginnt mit einer Liste. Eine Liste ist eine Sammlung von Vokabelpaaren – zum Beispiel Deutsch und Englisch, oder Begriff und Erklärung. Jede Liste kann bis zu sieben Spalten haben (drei Fremdsprache, zwei Deutsch, zwei Info), die du frei benennen kannst – z. B. für unregelmäßige Verben: Infinitiv, Simple Past, Past Participle. Jede Liste hat eine Fremdsprache; oben rechts kannst du zwischen den Sprachen wechseln. Du kannst so viele Listen anlegen wie du möchtest, sie importieren, exportieren und teilen."},
                    {titel:"Vokabelgruppen", text:"Für das Quiz wählst du aus, welche Vokabeln abgefragt werden sollen. Das ist deine Vokabelgruppe: entweder alle Vokabeln einer oder mehrerer Listen, oder eine gezielte Auswahl einzelner Einträge per Checkbox oder Von–Bis-Bereich. Die Vokabelgruppe ist das Material für eine Abfragerunde."},
                    {titel:"Abfragen", text:"Eine Abfrage geht durch alle Vokabeln der Gruppe einmal durch. Dabei bewertest du dich selbst: War die Antwort richtig oder falsch? Das Ergebnis fließt direkt in den Score ein. Jede Vokabel hat einen eigenen Score, der über Zeit steigt oder fällt. Unbeantwortete Vokabeln starten bei 0 und werden optionally zuerst gestellt."},
                    {titel:"Modi", text:"Du kannst zwischen drei Abfrage-Modi wählen:\n\nKarte (Frage–Antwort): Die Frage wird angezeigt, du denkst nach, tippst die Karte an um die Antwort zu sehen, und bewertest dich selbst mit Richtig oder Falsch.\n\nWechselnd: Frage- und Antwortspalte wechseln sich zwischen den Vokabeln ab – hält das Gehirn aktiver.\n\nDiktat: Die Antwort wird vorgelesen, du tippst sie ein. Ideal für Hörverstehen und Schreibübungen."},
                    {titel:"Scoring & Streak", text:"Jede Vokabel hat einen Score (von –10 bis +10). Richtige Antworten geben +1, falsche Antworten kosten Punkte je nach Schwierigkeitsgrad und Fehlerzahl. Wer mehrere Vokabeln hintereinander richtig beantwortet, bekommt ab dem dritten Mal in Folge einen Streak-Bonus – der Score steigt dann schneller. Hat eine Vokabel mehrere Antwort-Spalten (z. B. Infinitiv, Simple Past, Past Participle), werden alle abgefragt, aber der Score ändert sich nur einmal: richtig nur, wenn alle Spalten gewusst wurden."},
                    {titel:"Reihenfolge & Filter", text:"Du entscheidest, in welcher Reihenfolge die Vokabeln kommen: zufällig gemischt, nach schlechtestem Score (was du noch nicht gut kannst, kommt zuerst), oder in der Originalreihenfolge der Liste. Optional lässt sich ein Score-Filter setzen, sodass nur Vokabeln bis zu einem bestimmten Score angezeigt werden."},
                    {titel:"Quiz & Pakete", text:"Mit dem Quiz-Modus teilst du die Vokabelgruppe in kleinere Pakete auf – zum Beispiel 10 Vokabeln auf einmal. Nach jedem Paket kannst du pausieren, dann wird der Fortschritt gespeichert. Beim nächsten Mal werden bereits abgefragte Vokabeln übersprungen. So arbeitest du dich über mehrere Sitzungen durch die gesamte Gruppe."},
                    {titel:"Abfrage-Ziel", text:"Standardmäßig wird jede Vokabel einmal abgefragt. Mit dem Abfrage-Ziel kannst du das ändern:\n\nAnzahl: jede Vokabel 1×, 2× oder 3× pro Durchgang.\n\nMit Wiederholung: Vokabeln werden so lange neu eingereiht, bis du sie 1×, 2× oder 3× in Folge richtig beantwortet hast.\n\nScore-Ziel: Vokabeln werden wiederholt, bis ihr Score einen bestimmten Wert erreicht – global oder bezogen auf den Fortschritt des laufenden Quiz."},
                {titel:"Konfigurationen speichern", text:"Eine Kombination aus Vokabelgruppe, Abfrage-Modus, Reihenfolge und Quiz-Einstellung kann gespeichert und jederzeit wieder geladen werden. So richtest du zum Beispiel eine tägliche Übung mit den schlechtesten 20 Vokabeln einmal ein und startest sie beim nächsten Mal mit einem Tipp."},
                {titel:"Statistik", text:"Die Statistik zeigt dir für jede Vokabel den aktuellen Score als Balken und Zahl, das Datum der letzten Abfrage und einen sortierbaren Überblick. Das Kreisdiagramm oben zeigt auf einen Blick, wie viele Vokabeln gelernt, in Arbeit, nie abgefragt oder negativ sind. Der Lernfortschritt in der Kopfzeile zeigt, wie weit die gewählte Vokabelgruppe gelernt ist."},
              ].map(abschnitt => (
                <div key={abschnitt.titel} style={{marginBottom:20}}>
                  <div className="sektion-label" style={{marginBottom:6}}>{abschnitt.titel}</div>
                  <div style={{background:"var(--info-kasten)", borderRadius:10, padding:"12px 14px", whiteSpace:"pre-line"}}>
                    {abschnitt.text}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sektion" style={{fontSize:"0.85rem", lineHeight:1.7, color:"var(--text)"}}>
              <div style={{background:"var(--haupt-flaeche)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:"0.8rem", color:"var(--haupt)", lineHeight:1.55}}>
                💡 <strong>Tipp:</strong> Tippe oben links auf ⓘ: Im Info-Modus sind erklärbare Elemente gestrichelt markiert – antippen zeigt die Erklärung, statt die Aktion auszuführen. Alternativ einen Knopf gedrückt halten. Die Erklärung bleibt stehen, bis du irgendwo hintippst. Am PC erscheint sie auch beim Darüberfahren.
              </div>
              {[
                {titel:"Listen (Einstellungen › Listen)", inhalt:[
                  {k:"Übersicht", v:"Einstellungen › Listen zeigt alle Vokabellisten in einem Raster (Spalten unter Einstellungen → Raster, bis 4; Zeilen wachsen von selbst, beim Verschieben stehen unten immer zwei freie Zeilen bereit). Tippe eine Liste an, um sie bildschirmfüllend zu öffnen; der Pfeil oben links führt zurück. „+ Neu“ öffnet den Import. Lang drücken zeigt den vollen Namen und darunter „Umbenennen“, „Duplizieren“ (Kopie mit allen Vokabeln, Lernstände beginnen neu), „Verschieben“, „☑ Auswählen“, „In mehrere Quiz aufteilen“, „Lernstand zurücksetzen“ (Scores für Übersetzung, Diktat und/oder Akzente löschen, mit Rückfrage) und „Löschen“. „In mehrere Quiz aufteilen“ öffnet den Quiz-Tab mit dieser Liste und einem gelben Kasten: Name (vorgegeben: Listenname), Gruppengröße (10, 20, 25, 50, 75, 100 oder eigene), Bereich von–bis (Vokabel-Nummern) und bei Rest „eigene Gruppe“ oder „an letzte anhängen“; die Vorschau zeigt die Namen, z. B. „Verbes (21 - 40)“. Darunter alle Einstellungen wie gewohnt wählen, dann „Quiz anlegen“: je Gruppe eine gespeicherte Konfiguration, untereinander in der ersten Spalte unter dem untersten Eintrag. Namen, die es schon gibt, werden übersprungen. Lang drücken und ziehen verschiebt die Liste direkt; auf einem belegten Platz tauschen die beiden. Im Verschieben-Modus lassen sich mehrere Listen markieren und gemeinsam verschieben. „☑ Auswählen“ startet den Auswahl-Modus: weitere Listen antippen (nummeriert, nochmal antippen nimmt heraus, „Alle“ wählt alle sichtbaren, „Fertig“ beendet); lang drücken zeigt dann die Aktionen für die ganze Auswahl – „JSON exportieren“, „TXT exportieren“ (Dateiname änderbar), „📋 Kopieren“, „⇄ Verschieben“, „🗑 Löschen“ (Rückfrage mit allen Namen, „Vorher sichern“) und „Auswahl beenden“. Lang drücken auf eine nicht gewählte Liste nimmt sie dazu. Neue Listen (auch per Import) kommen untereinander in die erste Spalte. Die Reihenfolge gilt auch in Quiz- und Statistik-Tab. Mit Sprachfilter rücken die sichtbaren Listen zusammen – verschoben wird unter „Alle“."},
                  {k:"[+] Neue Liste", v:"Legt eine leere Liste mit eigenem Namen an."},
                  {k:"💾 Alles sichern", v:"Einstellungen → Listen → Sicherung: eine Datei (Vorschlag „Vokabel-App Sicherung Datum.txt“, Name änderbar) mit allem – Listen mit Scores, Einstellungen, Farben, gespeicherte Quiz. Der Browser kann gespeicherte Daten löschen (Speicher aufräumen, Browserdaten löschen); mit der Datei holst du alles zurück: „Laden“ in den Einstellungen oder als Datei im Import („Alles wiederherstellen“). Oben in des Quiz-Auswahl (Quiz-Tab) erinnert die App, wenn die letzte Sicherung älter ist als eingestellt (Standard 7 Tage)."},
                  {k:"▲/▼ Aktionszeile", v:"Öffnet Aktionen zur Liste: Kopieren, JSON, TXT, Löschen. JSON = vollständige Sicherung mit Lernstand (Vorschlag „Name - JSON.txt“), TXT = nur die Vokabeln als Text ohne Scores (Vorschlag „Name - TXT.txt“); den Dateinamen kannst du vor dem Speichern ändern. Auf iPad/iPhone öffnet sich dafür das Teilen-Menü („In Dateien sichern“, Mail, AirDrop), sonst wird die Datei heruntergeladen. Beim Import ist die Endung egal – die App erkennt den Inhalt."},
                  {k:"Stift-Button", v:"Listenname umbenennen."},
                  {k:"Vokabeln [+]", v:"Neue Vokabel am Ende der Liste hinzufügen."},
                  {k:"Stift an Vokabel", v:"Vokabel bearbeiten oder löschen."},
                  {k:"Spalten", v:"Jede Liste hat bis zu 7 Spalten: E1–E3 (Fremdsprache), D1–D2 (Deutsch), i1–i2 (Info). Spalten lassen sich benennen und aktivieren/deaktivieren. Der Stift-Button neben der Spalte öffnet den Namen-Editor."},
                  {k:"Fremdsprache", v:"Legt fest, welche Sprache in den Spalten E1–E3 steht (Englisch, Französisch, Spanisch …). Danach richten sich Vorlese-Stimme, Diktat und der Sprach-Filter."},
                  {k:"Sprach-Auswahl (oben rechts)", v:"Erscheint, sobald Listen in mehr als einer Sprache vorhanden sind. Zeigt in Listen, Quiz und Statistik nur Listen der gewählten Sprache – oder alle."},
                  {k:"Quiz starten", v:"Wechselt direkt zum Quiz-Tab mit dieser Liste vorausgewählt."},
                  {k:"Statistik", v:"Öffnet die Statistik für diese Liste."},
                  {k:"Zusammenführen", v:"Fügt die Vokabeln einer anderen Liste in diese Liste ein."},
                  {k:"Import", v:"Vokabeln aus einer TXT-Datei oder JSON-Datei importieren."},
                ]},
                {titel:"Quiz-Tab", inhalt:[
                  {k:"Kopfzeile (Quiz-Auswahl)", v:"Oben im Tab steht der Name des geladenen Quiz („Neu“, wenn keine geladen ist). Die App startet in der Auswahl: gespeicherte Quiz und Verlauf – die Einstellungen darunter sind dann ausgeblendet. Antippen des Namens schaltet um zwischen Auswahl und Einstellungen (kein Aufklappen); ein Quiz antippen lädt sie und zeigt ihre Einstellungen. In der Auswahl stehen rechts die Kreise Ü, D und A und darunter eine Info-Zeile (z. B. „Englisch 6 · Nr. 1–25 · 25 Vokabeln“); eine gespeicherte Konfiguration erscheint dann in einer grünen Kopfzeile. Lang drücken auf den Namen: „Speichern“. Jede Konfiguration führt für Übersetzung, Diktat und Akzente einen eigenen Paket-Fortschritt. Gespeicherte Konfigurationen liegen in einem Raster (Spalten unter Einstellungen → Raster, bis 4; Zeilen wachsen von selbst, beim Verschieben stehen unten immer zwei freie Zeilen bereit); jede Kachel zeigt unten einen Balken mit dem Lernfortschritt Übersetzung (✓ bei 100 %), die geladene Kachel ist in der Hauptfarbe gefüllt. Lang drücken auf eine Kachel zeigt den vollständigen Namen und darunter „Umbenennen“, „Duplizieren“ (Kopie unter neuem Namen, mit eigenem Fortschritt), „Verschieben“, „Listen/Vokabeln ändern“ und „Löschen“. „Verschieben“: Einträge antippen markiert sie (nummeriert, mehrere möglich), ein freier Platz setzt die markierten dort untereinander ein; oder direkt ziehen – ein markierter Eintrag nimmt alle markierten mit, auf einem belegten Platz rücken die Einträge auf die frei gewordenen Plätze (einzeln: die beiden tauschen); „Fertig“ beendet das Verschieben. Neu Gespeichertes kommt untereinander in die erste Spalte unter den untersten Eintrag; das Raster wächst bei Bedarf."},
                  {k:"📁 Gruppen", v:"Quiz lassen sich in Gruppen (Ordner) zusammenfassen: lang drücken → „📁 In Gruppe…“ (vorhandene Gruppe oder neue mit Namen), im Auswahl-Modus für mehrere auf einmal, oder ein Quiz auf eine Gruppen-Kachel ziehen. Eine Gruppen-Kachel zeigt 📁, Namen, Anzahl und den mittleren Lernfortschritt; antippen öffnet sie, oben führt „← Alle Quiz“ zurück. In der Gruppe: lang drücken → „↑ Aus der Gruppe“. Lang drücken auf die Gruppe: Öffnen, „🧩 Multiquiz der Gruppe“, Umbenennen, Verschieben, „Gruppe auflösen“ (die Quiz kommen zurück). „Mehrere Quiz“ (Aufteilen) legt die neuen Quiz auf Wunsch gleich in eine Gruppe. Gilt auch im Statistik-Tab."},
                  {k:"＋ Neues Quiz aus Listen", v:"Oben in der Auswahl. „Ein Quiz“: Listen und Vokabeln wählen, dann wie gewohnt einstellen und starten (lang auf den Namen drücken → Speichern). „Mehrere Quiz“: eine Liste wählen und in Pakete aufteilen (Name, Gruppengröße, Bereich von–bis, Rest) – je Paket ein gespeichertes Quiz."},
                  {k:"Slot laden", v:"Tippe auf einen Chip, um eine gespeicherte Konfiguration (Listen, Vokabelauswahl, Einstellungen) zu laden."},
                  {k:"Listen-Auswahl", v:"Wähle eine oder mehrere Listen für das Quiz. [Alle] wählt alle Listen, [X] leert die Auswahl. Ohne Liste steht oben rechts „Bitte Liste auswählen“; ist eine gewählt, schließt „Bestätigen“ die Auswahl – danach steht dort ihr Name (bzw. „n Listen“), antippen öffnet sie wieder. Ist eine gespeicherte Konfiguration geladen, sind Listen- und Vokabel-Auswahl festgelegt und ausgeblendet – zum Ändern lang auf die Kachel drücken und „Listen/Vokabeln ändern“ wählen."},
                  {k:"Vokabel-Auswahl [Alle]", v:"Alle Vokabeln der gewählten Listen werden abgefragt."},
                  {k:"Vokabel-Auswahl [Bereich]", v:"Öffnet eine Checkbox-Liste. Einzelne Vokabeln an-/abwählen. [Von–Bis] ermöglicht Bereichsauswahl per 2 Klicks – oder lang auf die erste Vokabel drücken und die letzte antippen. Solange die Liste offen ist, ist der Rest des Quiz ausgeblendet; „Bestätigen“ oben rechts schließt die Liste (ist nichts angehakt, gilt wieder „Alle“), „Bereich“ öffnet sie wieder."},
                  {k:"Ü | D | A", v:"Abfrageart: Übersetzung, Diktat oder Akzente. Die Kreise unten über „Quiz mit … Vokabeln“ zeigen den Lernfortschritt der Auswahl je Art – die gewählte Art groß mit Name und Prozent, die anderen kleiner; antippen schaltet die Art um (auch über die Kreise der aufgeklappten Kopfzeile). In der Statistik wechselt man die Art über die Mitte des großen Kreisdiagramms. Eine Art ohne passende Vokabeln wird nicht angezeigt. Auch die Listen unter Einstellungen › Listen zeigen die drei Kreise. Jede Art hat eigene Einstellungen (Spalten, Modus, Reihenfolge …), einen eigenen Quiz-Fortschritt und eigene Scores; beim Umschalten bleiben die Einstellungen der anderen Arten erhalten und werden mit der Konfiguration gespeichert. Übersetzung: Frage–Antwort (feste Frage-Spalte) oder wechselnd, je Antwortspalte Karte, MC, Tastatur und (bei Sprachen mit Akzenten) Akzente – mehrere angehakt heißt „Gemischt“: je Frage und Spalte wird zufällig eine der Arten gewählt, Akzente nur bei Wörtern mit Akzent; sie zählen dann für den Übersetzungs-Score. Diktat: Wort wird vorgelesen, du tippst die Lösung. Akzente: nur Fremdsprachen-Spalten als Antwort, immer im Akzente-Modus."},
                  {k:"Akzente", v:"Eigene Abfrageart (A): Das Wort steht ohne Akzente in großen Buchstaben da. Buchstaben antippen und darunter den richtigen Akzent wählen (é è ê ë, ç, à, œ …). Richtige Akzente werden sofort grün, ein Buchstabe ohne Akzent oder eine falsche Variante leuchtet kurz rot. Sind alle Akzente richtig, wird die Antwort automatisch übernommen oder mit „Prüfen“ bestätigt (je nach Schwierigkeitsgrad). Nach einem Fehlgriff zählt die Vokabel als nicht gewusst. Eigener Akzent-Score (+1 richtig, −1 falsch). Ob auch Wörter ohne Akzent abgefragt werden, legst du beim Schwierigkeitsgrad fest."},
                  {k:"Zeile 1: Stufe · Modus · Reihenfolge", v:"Erster Knopf: Stufe Lernen, Leicht oder Schwer – antippen wechselt der Reihe nach. Zweiter Knopf: Abfrage-Modus der gewählten Art (z. B. „Karte“) – antippen öffnet die Spalten- und Modus-Einstellungen. Dritter Knopf: Reihenfolge – „Zufällige Reihenfolge“, „Schlechteste zuerst“ (nach Score sortiert) oder „Nach Listen-Platz“ (Originalreihenfolge), dazu Score-Filter und „Unbeantwortete zuerst“. Es ist immer nur ein Bereich offen. Ein neues Quiz (ohne geladene Konfiguration) beginnt immer in Übersetzung. Lang drücken: „Regeln Leicht / Schwer“, bei Lernen „Lernen einstellen“ und „Vorlesen“."},
                  {k:"Lernen", v:"Stufe „Lernen“ (dritter Knopf in Zeile 1): Der Start-Knopf heißt dann „Lernen starten“. Wie ein Film: erst das Wort (auf Wunsch vorgelesen), nach einer Pause die Übersetzung mit den eingeschalteten Info-Spalten, dann die nächste Vokabel. Antippen der Karte überspringt die Pause; unten ⏮ zurück, ⏸ anhalten, ⏭ vor, oben „Schließen“. Schließen pausiert: Der Lernstand bleibt je Konfiguration gespeichert (getrennt vom Abfrage-Fortschritt), auch wenn du zwischendurch eine andere Liste lernst oder abfragst – der Start-Knopf heißt dann „Weiter lernen“ und macht an derselben Stelle weiter; links daneben steht der Lernstand (z. B. 12/40), antippen fragt „Lernstand löschen?“. Sind alle Vokabeln angesehen, beginnt das nächste Lernen von vorn. Gelernt werden die noch offenen Vokabeln des Quiz in Quiz-Reihenfolge, paketweise (Umfang „Je 5“ → 5 pro Paket). Nach jedem Paket: „Quiz mit diesen 5 Vokabeln“ – einmal je Paket: gewusste verbessern den Score, falsche oder aufgedeckte kosten keinen Punkt (Hilfen unter „Lernen einstellen“: Standard „Ohne Hilfen“ – Akzente nicht hervorgehoben, kein Zähler; oder wie Leicht bzw. Schwer); danach geht es mit dem nächsten Paket weiter –, „Weiter lernen: nächste 5“ oder „Zur Übersicht“; 🔄 oben rechts zeigt das Paket nochmals (das Quiz bleibt einmalig). Lernen selbst ändert keine Scores, und auch das Quiz danach nicht den Quiz-Fortschritt. Ablauf: Wort, Übersetzung, Zusatzinfo – nach jedem Teil die Vorlese- bzw. Lesezeit (ohne Vorlesen aus der Textlänge geschätzt) plus eine Pause. Unter „⚙ Vorlesen & Pausen“ (aufklappbar unter den Knöpfen): Vorlesen Wort | Übersetzung | Info, Zusatzinfo An | Aus und drei Regler „Pause Wort / Übersetzung / Info“ (0–10 s, Standard 1 / 1 / 3 s; ganz rechts „Tippen“: dort wartet die App, bis du die Karte antippst). Ohne Zusatzinfo gilt nach der Übersetzung die längere der Pausen Übersetzung und Info. Übersetzung und Zusatzinfo haben ihren Platz schon vorher und blenden kurz ein. Lang drücken auf den Knopf → „Lernen einstellen“: was zuerst kommt (Fremdsprache oder Deutsch), was vorgelesen wird und in welcher Sprache die Zusatzinfo vorgelesen wird. "},
                  {k:"Regeln Leicht / Schwer", v:"Lang drücken auf den Stufen-Knopf. Per Haken legst du fest, was in welcher Stufe gilt: fehlende Akzente beim Tippen als richtig werten, Punktabzug bei „Lösung anzeigen“, „Nicht gewusst“ zieht 1 Punkt ab, im Akzent-Modus auch Wörter ohne Akzent abfragen (mit Höchstanteil), Buchstaben mit Akzent hervorheben, die Zahl der noch fehlenden Akzente anzeigen (z. B. 2 / 3) und richtige Antworten automatisch übernehmen (sonst „Prüfen“). „Vorlesen“ (ebenfalls per Lang-Druck): Auto-Play und welche Spalten vorgelesen werden."},
                  {k:"Zeile 2: Umfang · Abfrage-Ziel · Gelernte", v:"Umfang: „Alle Vokabeln“ in einem Durchgang oder „Je N Vokabeln“ – antippen zeigt große Zahlenknöpfe (Alle, 5–50). Bei Paketen kannst du nach jedem Paket pausieren oder weitermachen; abgefragte Vokabeln werden beim nächsten Paket übersprungen. Gelernte (nur wenn es welche gibt): „13 gelernte“ = ausgeblendet, „+ 13 gelernte“ = werden mit abgefragt."},
                  {k:"Abfrage-Ziel", v:"Anzahl: jede Vokabel 1×/2×/3× pro Durchgang abfragen. Mit Wiederholung: Vokabeln so lange einreihen, bis jede 1×/2×/3× richtig beantwortet wurde. Score (global, Knopf z. B. „Score < +3“): nur Vokabeln mit Score unter dem Ziel kommen in das Quiz, jede einmal (ohne Wiederholung) – Ziel 0 fragt nur negative ab (nie abgefragte zählen als 0). Quiz-Score: alle Vokabeln, jede so lange, bis sie in dieses Quiz um das Ziel gestiegen ist."},
                  {k:"Konfiguration speichern", v:"Lang drücken auf den Namen in der Kopfzeile → „Speichern“. Speichert die aktuelle Auswahl und Einstellungen unter einem Namen; beim nächsten Mal per Kachel laden."},
                  {k:"Quiz starten", v:"Unterste Sektion: Fortschrittsbalken des Quiz, darunter links der Stand (z. B. „15/50“) – antippen beginnt nach kurzer Rückfrage für die aktuelle Art ein neues Quiz (gelöscht wird nur, welche Vokabeln schon abgefragt wurden; Scores bleiben) – und rechts der Start-Knopf mit der Zahl der Vokabeln, die in des Quiz noch übrig sind (z. B. 10 von 25 abgefragt → „15 Vokabeln“; die Paketgröße steht auf dem Umfang-Knopf)."},
                  {k:"Multiquiz", v:"Mehrere gespeicherte Konfigurationen zusammen abfragen: lang auf eine Kachel drücken → „☑ Auswählen“, dann weitere Kacheln antippen (nummeriert; nochmal antippen nimmt sie heraus; über dem Raster steht „2 ausgewählt · 50 Vokabeln“). Lang drücken auf eine Kachel zeigt die Aktionen für die Auswahl: „🧩 Multiquiz starten“ (ab 2, startet sofort), „⇄ Verschieben“, „🗑 Löschen“ (mehrere auf einmal, Rückfrage mit allen Namen) und „Auswahl beenden“; „Fertig“ oben beendet die Auswahl ebenfalls. Abgefragt werden alle Vokabeln der gewählten Konfigurationen (auch verschiedene Sprachen – vorgelesen wird jede in ihrer Sprache), die Einstellungen kommen von Nr. 1. Das Multiquiz erscheint im Verlauf (🧩) mit eigenem Fortschritt, die Kopfzeile zeigt „Multiquiz“ und in der Info-Zeile die Teile. Lang drücken auf die Kopfzeile → „Speichern“ legt es als eigene Kachel ab (Name-Vorschlag „Multiquiz: A + B“). In der Statistik zeigt es die gemeinsame Statistik; die Scores gelten wie immer je Vokabel."},
                ]},
                {titel:"Im Quiz", inhalt:[
                  {k:"Karte (Frage–Antwort)", v:"Tippe auf die Karte, um die Antwort aufzudecken. Dann: Richtig oder Falsch selbst einschätzen. Lang drücken auf Frage- oder Antwortkarte (auch beim Diktat) → „✎ Richtige Antwort bearbeiten“: ändert nur die richtige Antwort der gerade gefragten Spalte – falsche Antworten und Lernstand bleiben, die Änderung gilt sofort (auch für die laufende Frage)."},
                  {k:"Tippen", v:"Antwort eintippen und bestätigen. Nach 3 Fehlversuchen wird die Lösung gezeigt. Ob fehlende Akzente als richtig gelten, hängt vom Schwierigkeitsgrad ab (Einstellungen)."},
                  {k:"Diktat", v:"Großer Lautsprecher: Wort nochmals vorlesen. Kleiner Lautsprecher: langsamer/erneut. Antwort eintippen."},
                  {k:"Scoring", v:"Richtig: +1 Punkt, Streak +1. Ab Streak 3: mindestens +2 Punkte. Falsch: Streak auf 0 und −1 Punkt – oder kein Abzug, wenn die Regel „Nicht gewusst zieht 1 Punkt ab“ in der Stufe aus ist (Standard: Einfach ohne Abzug, Schwer −1). Die Vokabel wird in jedem Fall wiederholt. Aufgedeckt: kein Punkt, kein Streak. Mehrere Antwort-Spalten zählen zusammen als eine Bewertung: alle gewusst = richtig, sonst falsch. Multiple Choice: nur ein Treffer ohne Fehlklick gilt als gewusst – nach einem Fehlklick darf man weitersuchen, die Spalte zählt aber als nicht gewusst."},
                  {k:"Aufdecken", v:"Zeigt die Antwort ohne Wertung."},
                  {k:"Gelernt!", v:"Erreicht eine Vokabel mit deiner Antwort die Gelernt-Schwelle (Einstellungen), leuchtet die Antwort-Karte kurz auf und ein kleiner Sternenregen fliegt heraus. Die Farbe lässt sich im Farbmodus als „Gelernt-Effekt“ ändern (Standard: kräftiges Hellgelb)."},
                  {k:"Quiz-Auswertung", v:"Am Ende eines Durchlaufs (bzw. einer Runde ohne Pakete) zeigt der erste Bildschirm das letzte Paket, „Weiter →“ führt zur Auswertung des ganzen Quiz: zwei Balken Start und Ende (Gelernt, In Arbeit, Nie abgefragt, Negativ), Lernfortschritt vorher → nachher, neu gelernte Vokabeln und darunter Zusatzdaten (Vokabeln und Pakete, Ø Score, verbessert/gleich/verschlechtert, auf Anhieb gewusst, Dauer). Darunter: Nochmal!, Zur Übersicht, Zur Statistik."},
                  {k:"Schließen", v:"Pausiert das Quiz – beim nächsten Start über 'Pakete' weitermachen."},
                ]},
                {titel:"Statistik-Tab", inhalt:[
                  {k:"Listen-Auswahl", v:"Eine oder mehrere Listen für die Statistik wählen."},
                  {k:"Vokabel-Auswahl", v:"Alle Vokabeln oder einen bestimmten Bereich filtern."},
                  {k:"Filter-Boxen", v:"Gesamt / Nie abgefragt / Score positiv / Score negativ. Alle sind standardmäßig aktiv. Antippen deaktiviert eine Kategorie – sie erscheint dann weder in der Liste noch im Graphen. 'Gesamt' stellt alle wieder her."},
                  {k:"Kreisdiagramm", v:"Anteil der Gruppen Gelernt, In Arbeit, Nie abgefragt und Negativ mit Anzahl und Prozent. Segment antippen blendet die Gruppe in der Liste aus/ein, 'Gesamt' zeigt wieder alle. Symbol oben rechts: Vollbild."},
                  {k:"Übersetzung / Diktat / Akzente", v:"Tap in die Mitte des Kreisdiagramms wechselt, welcher Score ausgewertet wird: Übersetzung (normaler Quiz-Score), Diktat oder Akzente (nur Vokabeln mit Akzent). Kreis, Gruppen, Kopfzeile und Vokabelliste richten sich danach."},
                  {k:"Lernfortschritt", v:"Wie weit die Vokabelgruppe gelernt ist (0–100 %). Jede Vokabel zählt anteilig bis zur Gelernt-Schwelle – bei +3 z. B. Score +1 = 33 %, +2 = 67 %, ab +3 = 100 %. 100 % = alle Vokabeln gelernt. Darunter: Anzahl gelernter Vokabeln und Ø Score. Ohne Gelernt-Schwelle wird nur der Ø Score angezeigt."},
                  {k:"Gruppen", v:"Jede Vokabel gehört zu einer Gruppe: Negativ (Score unter 0, rot hinterlegt), Nie abgefragt, In Arbeit (Score 0 bis unter der Gelernt-Schwelle) und ✓ Gelernt (ab der Schwelle, grün hinterlegt). Das Kreisdiagramm (Standard-Ansicht) zeigt Anzahl und Anteil jeder Gruppe; ein Segment antippen blendet die Gruppe in Graph und Liste aus oder wieder ein, 'Gesamt' zeigt wieder alle. Lernfortschritt, Gruppen-Balken und Zähler beziehen sich auf die eingeblendeten Gruppen. Das Symbol oben rechts im Kreis öffnet die Statistik im Vollbild. Der farbige Balken unter dem Lernfortschritt zeigt die Verteilung."},
                  {k:"Score-Balken", v:"Null ist in allen Zeilen an derselben Stelle. Nach links bis −5 (tiefer = voller roter Balken), nach rechts bis zur Gelernt-Schwelle. Gelernte Vokabeln: ganzer Balken dunkelgrün."},
                  {k:"Sortierung", v:"Score / Streak / Datum / A→Z / Listenplatz. Pfeil zeigt Richtung, nochmals tippen kehrt um."},
                  {k:"Vollbild", v:"Maximiert Graph und Vokabelliste ohne die oberen Header-Zeilen. 'Vollbild verlassen' oben rechts."},
                  {k:"Vokabelliste", v:"Alle gefilterten Vokabeln mit Score-Balken (grün = positiv, rot = negativ) und letztem Abfragedatum. Lang drücken auf eine Zeile: „✎ Bearbeiten“ (alle Spalten, mit falschen Antworten nach ||) oder „➕ Neue Vokabel“ in der Liste dieser Zeile (mindestens zwei Spalten außer Info). Lernstände bleiben beim Bearbeiten erhalten."},
                ]},
                {titel:"Einstellungen-Tab", inhalt:[
                  {k:"Aufbau", v:"Vier Bereiche, immer nur einer offen: Listen (alle Listen öffnen, „+ Neu“ zum Importieren, darunter die Sicherung), Lernen (Gelernt-Schwelle, Akzente je Sprache), Raster (Plätze für Quiz und Listen) und App (Aktualisieren, Farbschema, Info mit Übersicht, Konzept und Anleitung)."},
                  {k:"Akzente", v:"Je Sprache An oder Aus (Standard: nur Französisch an). Aus: keine Abfrageart „A“ und keine Akzent-Statistik für Listen dieser Sprache, und fehlende Akzente beim Tippen und im Diktat gelten als richtig. An: „A“ steht zur Verfügung, beim Tippen gilt die Regel der Stufe."},
                  {k:"Farbschema", v:"21 Vorlagen: Natur (Standard), Freudig, Pastelle, Mädchen, Jungs, Dunkel, Ozean, Lavendel, Minze, Sand, Beere, Olive, Graphit, Kontrast, Mitternacht, Espresso und die bunten Pastell-Vorlagen Sorbet, Lagune, Blumenwiese, Nordlicht und Sommerfest (mit eigenen Tönen für Kopf, Kopfzeilen, Karten, Knöpfe und Start). „🎲 Zufällige Farben“ erzeugt bei jedem Tipp ein neues stimmiges Pastell-Schema „Zufall“ (zufälliger Grundton, Begleittöne benachbart, als Gegenfarbe oder Dreiklang) – zum Behalten umbenennen oder duplizieren, sonst ersetzt der nächste Tipp es – antippen wählt das Schema, die App färbt sich sofort um. Vorlagen lassen sich nicht ändern, aber duplizieren (lang drücken). Liste & Start (aktuelle Liste oben im Quiz-Tab und Start-Knopf) und ihre Schrift sind eigene Rollen – gewählte Farben gelten immer genau so, es wird nichts automatisch umgestellt. Flächen haben je Funktion eine eigene Rolle: Hintergrund (nur die Seite), App-Kopf (Titel- und Tab-Leiste), Bereichs-Kopfzeilen (z. B. Kopf der Listenauswahl), Karten (Listen, Quiz-Bereiche), Abfrage-Karten, Dialoge, Knöpfe & Felder, Info-Kästen und Ausgewählt – ohne eigenen Wert übernehmen sie die bisherige Farbe, Kopfzeilen und Info-Kästen mit einem Hauch der Hauptfarbe. „🎨 Farbe ändern“ unter jedem Lang-Druck-Menü (abschaltbar unter Farbschema) startet den Farbmodus direkt für diese Stelle. Das Farbfeld öffnet sich auf der Seite gegenüber der angetippten Stelle, das Element bleibt sichtbar und markiert. Jede Zeile nennt zuerst Element und Teil (z. B. „Start-Knopf · Text groß“, „Start-Knopf · Text klein“, „Start-Knopf · Hintergrund“), darunter klein die Rolle („gilt auch für: …“). Jeder Teil hat zwei Wege: „Alle Stellen“ ändert die Rolle (überall, wo sie vorkommt), „Nur dieses Element“ gibt nur dieser Element-Art eine eigene Farbe (z. B. nur dem Start-Knopf – alle gleichartigen Stellen, die Rolle bleibt); „↺ Rolle“ nimmt die eigene Farbe zurück. Eigene Element-Farben gehören zum Schema und stehen in dessen Bearbeiten-Ansicht (✕ entfernt sie). Farbmodus: „🎨 Farbmodus starten“, dann normal durch die App gehen und lang auf ein Element drücken – das Farbfeld zeigt die Farben dieser Stelle (auch kleiner Teile im Umkreis, z. B. Ring und Buchstabe der Mini-Kreise); antippen hebt das Element hervor und öffnet den Farbwähler: großer Farbkreis (außen kräftig, zur Mitte weniger gesättigt), Regler für Helligkeit und Sättigung, Hex-Feld, „Zuletzt verwendet“ (10 Farben) und „In diesem Schema“ (alle Farben des gerade bearbeiteten Schemas, ohne Doppelte – antippen übernimmt sie); die App färbt sich beim Ziehen sofort um, „Anwenden“ übernimmt, „Abbrechen“ stellt die alte Farbe wieder her. Unten rechts: „Zurücksetzen“ verwirft alles und beendet, „Farben übernehmen“ speichert (bei einer Vorlage als neues eigenes Schema) und beendet. Eigene Schemata: lang drücken → Bearbeiten (Farbwähler je Rolle: Hauptfarbe, Hintergrund, Text, Richtig/Falsch, Statistik-Farben …, Änderungen sofort sichtbar und gespeichert; „Zurücksetzen“ holt die Farben der Vorlage zurück), Duplizieren, Umbenennen, Löschen."},
                  {k:"App aktualisieren", v:"„Prüfen“ sucht nach einer neuen App-Version. Wird eine gefunden, erscheint unten der Hinweis „Neue Version verfügbar“ – mit „Aktualisieren“ wird sie aktiv. Die App funktioniert auch offline."},
                  {k:"Gespeicherte Listen", v:"Zeigt, wie viele Listen aktuell auf diesem Gerät gespeichert sind."},
                ]},
              ].map(abschnitt => (
                <div key={abschnitt.titel} style={{marginBottom:20}}>
                  <div className="sektion-label" style={{marginBottom:8}}>{abschnitt.titel}</div>
                  <div className="karte">
                    {abschnitt.inhalt.map((zeile, i) => (
                      <div key={i} style={{padding:"9px 14px", borderBottom: i < abschnitt.inhalt.length-1 ? "1px solid var(--rahmen)" : "none"}}>
                        <div style={{fontWeight:600, fontSize:"0.8rem", color:"var(--haupt)", marginBottom:2}}>{zeile.k}</div>
                        <div style={{fontSize:"0.82rem", color:"var(--text)"}}>{zeile.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          )}

          </>)}

          {/* Bereiche mit Kopfzeile: immer nur einer offen */}
          <div className="sektion" data-einst-bereiche style={einstBereich === "info" && infoModus !== "uebersicht" ? {paddingBottom:'100dvh'} : {}}>
            {einstKopf("listen", "Listen", "Listen öffnen, importieren, sichern")}
            {einstBereich === "listen" && (<div className="einst-inhalt" data-einst-listen>
            {(() => {
              const vorschauL = !listenWahl && !einstUnter && listeVorschau ? listenIndex.find(x => x.id === listeVorschau) : null;
              return (
                <div ref={listenKopfRefCb} style={{position:"sticky", top: headerH, zIndex: 8, marginBottom: vorschauL || (listenWahl?.length && !einstUnter) ? 12 : 0, background:"var(--hintergrund)"}} data-listen-kopf-bereich>
                  {listenWahl && !einstUnter ? listenWahlKopf() : vorschauL ? listeOeffnenKopf(vorschauL) : einstZeile([
                    { k: "sicherung", label: "Sicherung", text: letzteSicherung ? `💾 ${formatTag(letzteSicherung).slice(0, 6)}` : "💾 nie",
                      hilfe: `Alles sichern, wiederherstellen, Speicher schützen · ${letzteSicherung ? `zuletzt am ${formatTag(letzteSicherung)}` : "noch nie gesichert"}` },
                    { k: "erinnerung", label: "Erinnerung", text: sicherungTage ? `nach ${sicherungTage} T` : "Aus", wahl: true,
                      hilfe: "In des Quiz-Auswahl an eine Sicherung erinnern, wenn die letzte älter ist als …" },
                    { k: "spalten", label: "Spalten", text: `▥ ${minSpalten("liste", listenOrdnerOffen)}`, wahl: true,
                      hilfe: "Spalten dieser Ebene (mindestens) – belegte Spalten können mehr ergeben, höchstens 5" },
                  ])}
                  {vorschauL && renderListeInfo(vorschauL)}
                  {listenWahl?.length > 0 && !einstUnter && (() => { const ls = listenWahl.map(id => listenIndex.find(x => x.id === id)).filter(Boolean); return ls.length ? renderListeInfo(ls[0], ls.length > 1 ? ls : null) : null; })()}
                </div>
              );
            })()}
            {!einstUnter && listenNavi()}
            {!einstUnter && (listenWahl || listenSortModus) && wahlLeiste("liste")}
            {!einstUnter && (sichtbareListen.length === 0 && listenOrdner.length === 0 ? (
              <div className="leer"><div className="leer-text">Noch keine Listen vorhanden.</div></div>
            ) : renderListenRaster())}
            {einstUnter === "sicherung" && (
            <div className="karte" data-sicherung>
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">Gespeicherte Listen</div>
                  <div className="karte-zeile-sub" data-speicher-dauerhaft={String(speicherDauerhaft)}>{listenIndex.length} Liste{listenIndex.length!==1?"n":""} · {
                    speicherDauerhaft === true ? "Speicher dauerhaft geschützt" : speicherDauerhaft === false ? "Speicher nicht geschützt – der Browser darf ihn aufräumen" : "Schutz des Speichers unbekannt"}</div>
                </div>
                {speicherDauerhaft === false && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.storage?.persist?.().then(setSpeicherDauerhaft).catch(() => {})}
                    {...tt("Den Browser erneut bitten, den Speicher dauerhaft zu behalten (Chrome gewährt das meist, wenn die App installiert ist)")}>Schützen</button>
                )}
              </div>
              <div className="karte-zeile" style={{borderTop:"1px solid var(--rahmen)"}}>
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name" {...tt("Listen mit Scores, Einstellungen, Farben und gespeicherte Quiz in einer Datei")}>Alles sichern</div>
                  <div className="karte-zeile-sub" data-letzte-sicherung>{letzteSicherung ? `zuletzt am ${formatTag(letzteSicherung)}` : "noch nie gesichert"}</div>
                </div>
                <button className="btn btn-primary btn-sm" data-alles-sichern onClick={sichereAlles}
                  {...tt("Alles in einer Datei sichern (Vorschlag „Vokabel-App Sicherung Datum“, Name änderbar; landet in Downloads bzw. im Teilen-Menü)")}>💾 Sichern</button>
              </div>
              <div className="karte-zeile" style={{borderTop:"1px solid var(--rahmen)"}}>
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name" {...tt("Sicherungsdatei laden – ersetzt den aktuellen Stand")}>Wiederherstellen</div>
                </div>
                {/* bewusst ohne accept: Android-Dateiauswahlen blenden sonst passende Dateien aus */}
                <input type="file" ref={sicherungInputRef} data-sicherung-datei style={{display:"none"}}
                  onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) ladeSicherungsDatei(f); }} />
                <button className="btn btn-ghost btn-sm" onClick={() => sicherungInputRef.current?.click()}
                  {...tt("Eine Sicherungsdatei wählen; vor dem Wiederherstellen wird nachgefragt")}>Laden</button>
              </div>
              {sicherungFehler && <div className="fehler" style={{margin:"0 16px 12px"}}>{sicherungFehler}</div>}
              {sicherungLaden && (
                <div className="karte-zeile" data-sicherung-bestaetigen style={{borderTop:"1px solid var(--rahmen)", flexDirection:"column", alignItems:"stretch", gap:8}}>
                  <div className="karte-zeile-sub">Sicherung vom {formatTag(sicherungLaden.erstellt)}: {listenAusSicherung(sicherungLaden).length} Liste{listenAusSicherung(sicherungLaden).length !== 1 ? "n" : ""}. Wiederherstellen ersetzt alle aktuellen Listen, Scores und Einstellungen.</div>
                  <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSicherungLaden(null)} {...tt("Nicht wiederherstellen")}>Abbrechen</button>
                    <button className="btn btn-primary btn-sm" data-wiederherstellen-ok onClick={() => bestaetigeWiederherstellen(sicherungLaden)}
                      {...tt("Den Stand aus der Sicherung übernehmen; die App lädt danach neu")}>Wiederherstellen</button>
                  </div>
                </div>
              )}
            </div>)}
            {einstUnter === "spalten" && (
            <div className="karte">
              <div className="toggle-row">
                <div className="toggle-btn" data-listen-spalten data-wahl-bereich style={{display:"flex", width:"100%"}}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} className={`toggle-opt${minSpalten("liste", listenOrdnerOffen) === n ? " aktiv" : ""}`} data-listen-spalten-wahl={n} style={{flex:1}}
                      onClick={() => einstWahl("spalten", () => setzeMinSpalten("liste", listenOrdnerOffen, n))}
                      {...tt(`Mindestens ${n} Spalte${n > 1 ? "n" : ""} in dieser Ebene`)}>{n}</button>
                  ))}
                </div>
              </div>
            </div>)}
            {einstUnter === "erinnerung" && (
            <div className="karte">
              <div className="toggle-row">
                <div className="toggle-btn" data-sicherung-tage data-wahl-bereich style={{display:"flex", width:"100%"}}>
                  {SICHERUNG_TAGE.map(t => (
                    <button key={t} className={`toggle-opt${sicherungTage === t ? " aktiv" : ""}`} data-sicherung-tage-wahl={t} style={{flex:1}}
                      onClick={() => einstWahl("erinnerung", () => speichereEinst({ ...einstellungen, sicherungErinnerung: t }))}
                      {...tt(t ? `In des Quiz-Auswahl erinnern, wenn die letzte Sicherung älter als ${t} Tage ist` : "Nicht an Sicherungen erinnern")}>{t ? `${t} T` : "Aus"}</button>
                  ))}
                </div>
              </div>
            </div>)}
            </div>)}
            {einstKopf("lernen", "Lernen", "Gelernt-Schwelle, Akzente")}
            {einstBereich === "lernen" && (<div className="einst-inhalt">
            {(() => {
              const g = { ...STANDARD_ANTWORT_GEWICHTE, ...(einstellungen.antwortGewichte || {}) };
              const schw = einstellungen.gelerntSchwelle ?? 0;
              const akzAn = (vorhandeneSprachen.length ? vorhandeneSprachen : SPRACHEN.filter(x => x.code === "fr")).filter(sp => akzenteAn(sp.code));
              return einstZeile([
                { k: "mischen", label: "Arten mischen", text: `${MISCH_ARTEN.filter(([k]) => (g[k] || 0) > 0).length} Arten`,
                  hilfe: "Sind bei einer Spalte mehrere Antwortarten gewählt, wird je Frage eine davon gezogen – mit diesen Anteilen" },
                { k: "wiederholen", label: "Wiederholen", text: `${wiederholTage().join("·")} T · ${faelligAnteil()} %`,
                  hilfe: `Score +${schw} = gelernt (Stufe 1). Gelernte werden nach diesen Abständen fällig – gewusst: nächste Stufe (bis Stufe ${MAX_STUFE}). Fällige werden mit der gewählten Wahrscheinlichkeit zwischen die übrigen Vokabeln gemischt` },
                { k: "akzente", label: "Akzente", text: akzAn.length ? `${akzAn.map(sp => sp.flagge).join(" ")} an` : "aus",
                  hilfe: "Akzente je Sprache – ausgeschaltet: keine Abfrageart „A“ und keine Akzent-Statistik; fehlende Akzente beim Tippen gelten als richtig" },
              ]);
            })()}
            {einstUnter === "mischen" && (() => {
              const g = { ...STANDARD_ANTWORT_GEWICHTE, ...(einstellungen.antwortGewichte || {}) };
              const arten = MISCH_ARTEN;
              const summe = arten.reduce((x, [k]) => x + (g[k] || 0), 0);
              const setze = (k, v) => speichereEinst({ ...einstellungen, antwortGewichte: { ...(einstellungen.antwortGewichte || {}), [k]: Math.max(0, Math.min(100, v)) } });
              return (
                <div className="karte" data-antwort-gewichte>
                  <div className="karte-zeile" style={{flexDirection:"column", alignItems:"stretch", gap:8}}>
                    {arten.map(([k, label]) => (
                      <div key={k} style={{display:"flex", alignItems:"center", gap:8}}>
                        <span style={{minWidth:84, fontSize:"0.88rem"}}>{label}</span>
                        <input type="range" min="0" max="100" step="5" value={g[k] || 0} data-gewicht={k} style={{flex:1}}
                          onChange={e => setze(k, Number(e.target.value))} {...ttFeld(`Anteil für „${label}“, wenn mehrere Arten angehakt sind`)}/>
                        <span data-gewicht-wert={k} style={{minWidth:64, textAlign:"right", fontSize:"0.85rem", fontWeight:700}}>{g[k] || 0} %
                          <span style={{fontWeight:400, color:"var(--text3)"}}> ({summe ? Math.round((g[k] || 0) / summe * 100) : 0})</span></span>
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" data-gewichte-standard style={{alignSelf:"flex-start"}}
                      onClick={() => speichereEinst({ ...einstellungen, antwortGewichte: undefined })} {...tt("Zurück auf Karte 50, MC 30, Akzente 30, Tastatur 15, Zuordnung 5")}>Standard</button>
                  </div>
                </div>
              );
            })()}
            {einstUnter === "wiederholen" && (
              <div className="karte" data-wiederholen-einst style={{padding:"10px 16px"}}>
                {["Stufe 1 → 2", "Stufe 2 → 3", "Stufe 3 → 4", "Stufe 4 prüfen"].map((name, i) => (
                  <div key={i} style={{marginBottom:10}}>
                    <div className="inp-label">{name} nach</div>
                    <div style={{display:"flex", gap:5, flexWrap:"wrap"}} data-wahl-bereich>
                      {WIEDERHOL_TAGE_WAHL.map(d => (
                        <button key={d} className={`toggle-opt${wiederholTage()[i] === d ? " aktiv" : ""}`} data-wiederhol-stufe={i + 1} data-wiederhol-tage={d} style={{minWidth:40, padding:"6px 8px"}}
                          onClick={() => { const a = [...wiederholTage()]; a[i] = d; speichereEinst({ ...einstellungen, wiederholTage: a }); setFaelligTick(x => x + 1); }}
                          {...tt(`${name}: nach ${d} Tag${d !== 1 ? "en" : ""} fällig`)}>{d}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{marginBottom:4}}>
                  <div className="inp-label">Fällige einstreuen</div>
                  <div style={{display:"flex", gap:5, flexWrap:"wrap"}} data-wahl-bereich>
                    {FAELLIG_ANTEIL_WAHL.map(p => (
                      <button key={p} className={`toggle-opt${faelligAnteil() === p ? " aktiv" : ""}`} data-faellig-anteil={p} style={{minWidth:44, padding:"6px 8px"}}
                        onClick={() => speichereEinst({ ...einstellungen, faelligAnteil: p })}
                        {...tt(p === 0 ? "Fällige erst nach allen anderen Vokabeln" : p === 100 ? "Fällige zuerst, dann die übrigen" : `Je Karte kommt mit ${p} % Wahrscheinlichkeit eine fällige Vokabel`)}>{p} %</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {einstUnter === "gelernt" && (
            <div className="karte">
              <div className="karte-zeile" style={{flexDirection:"column", alignItems:"flex-start", gap:8}}>
                <div style={{display:"flex", gap:6, flexWrap:"wrap"}} data-gelernt-schwelle data-wahl-bereich>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                    <button key={v} className={`toggle-opt${(einstellungen.gelerntSchwelle??0)===v?" aktiv":""}`} data-gelernt-wahl={v}
                      onClick={() => einstWahl("gelernt", () => speichereEinst({...einstellungen, gelerntSchwelle: v}))}
                      {...tt(v === 0 ? "Deaktiviert – alle Vokabeln werden abgefragt" : `Vokabeln mit Score ≥ +${v} gelten als gelernt`)}>
                      {v === 0 ? "Aus" : `+${v}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>)}
            {einstUnter === "akzente" && (
            <div className="karte" data-akzent-sprachen>
              {(vorhandeneSprachen.length ? vorhandeneSprachen : SPRACHEN.filter(x => x.code === "fr")).map((sp, i) => (
                <div key={sp.code} className="toggle-row" style={i ? {borderTop:"1px solid var(--rahmen)"} : undefined}>
                  <div className="toggle-label">{sp.flagge} {sp.name}</div>
                  <div className="toggle-btn">
                    <button className={`toggle-opt${akzenteAn(sp.code) ? " aktiv" : ""}`} data-akzent-sprache={`${sp.code}:an`}
                      onClick={() => speichereEinst({ ...einstellungen, akzenteSprachen: { ...(einstellungen.akzenteSprachen || {}), [sp.code]: true } })}
                      {...tt(`Akzente für ${sp.name} einschalten: Abfrageart „A“, Akzent-Statistik, Akzente müssen beim Tippen stimmen`)}>An</button>
                    <button className={`toggle-opt${!akzenteAn(sp.code) ? " aktiv" : ""}`} data-akzent-sprache={`${sp.code}:aus`}
                      onClick={() => speichereEinst({ ...einstellungen, akzenteSprachen: { ...(einstellungen.akzenteSprachen || {}), [sp.code]: false } })}
                      {...tt(`Akzente für ${sp.name} ausschalten: keine Abfrageart „A“, fehlende Akzente beim Tippen gelten als richtig`)}>Aus</button>
                  </div>
                </div>
              ))}
            </div>)}
            </div>)}
            {einstKopf("stimmen", "Stimmen", "Vorlesen: Stimme je Sprache, Tempo")}
            {einstBereich === "stimmen" && (<div className="einst-inhalt" data-stimmen-einst>
            {(() => {
              const codes = ["de", ...new Set(listenIndex.map(l => listeSprache(lsGet(SK.liste(l.id)))))];
              const basisVon = c => c === "de" ? "de" : sprachInfo(c).tts.split("-")[0];
              const ttsVon = c => c === "de" ? "de-DE" : sprachInfo(c).tts;
              const gesehen = new Set();
              const zeilen = codes.filter(c => { const b = basisVon(c); if (gesehen.has(b)) return false; gesehen.add(b); return true; });
              const w = stimmenWahl;
              const setze = (feld, b, wert) => aendereStimmen({ ...w, [feld]: { ...(w[feld] || {}), [b]: wert } });
              const regler = { width:"100%" };
              const hilfeKnopf = (b, klein) => (
                <button className={klein ? "btn btn-ghost btn-sm" : "btn btn-ghost"} data-stimmen-hilfe={b || ""} style={klein ? { alignSelf:"flex-start" } : { width:"100%", marginBottom:10 }}
                  onClick={() => setModal("stimmen-hilfe")} {...tt("Anleitung: weitere Stimmen auf dem Gerät laden (z. B. männliche und weibliche, „Erweitert“/„Premium“)")}>＋ Weitere Stimmen laden</button>);
              return (<>
              {einstZeile([
                ...zeilen.map(c => {
                  const b = basisVon(c), akt = gewaehlteStimme(b) || stimmeFuer(ttsVon(c));
                  const name = c === "de" ? "Deutsch" : sprachInfo(c).name;
                  return { k: `sp:${b}`, label: name, text: `${c === "de" ? "🇩🇪" : sprachInfo(c).flagge} ${akt ? akt.name.split(/[ (]/)[0] : "–"}`,
                    hilfe: `${name}: Stimme wählen, an- und abschalten, Tempo${akt ? ` · jetzt: ${akt.name}` : ""}` };
                }),
                { k: "tempo", label: "Tempo", text: `${(w.tempo || 1).toFixed(1).replace(".", ",")}×`, schmal: true, hilfe: "Gesamt-Tempo für alle Sprachen" },
              ])}
              {zeilen.filter(c => einstUnter === `sp:${basisVon(c)}`).map(c => {
                const b = basisVon(c), alle = stimmenFuerSprache(b), varianten = stimmenVarianten(b);
                const name = c === "de" ? "Deutsch" : sprachInfo(c).name;
                const vr = w.variante?.[b] && varianten.includes(w.variante[b]) ? w.variante[b] : null;
                const liste = alle.filter(v => !vr || normLang(v.lang) === vr);
                const aus = w.aus?.[b] || [];
                const aktuell = gewaehlteStimme(b) || stimmeFuer(ttsVon(c));
                const probe = STIMMEN_PROBE[b] || STIMMEN_PROBE[c] || "Test";
                const sprichMit = v => { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); window.speechSynthesis.speak(aeusserung(probe, v ? v.lang : ttsVon(c), v)); };
                const tempo = w.tempoSprache?.[b] || 1;
                return (
                  <div key={b} className="karte" data-stimme-sprache={b}>
                    <div className="karte-zeile" style={{flexDirection:"column", alignItems:"stretch", gap:8}}>
                      {alle.length === 0 ? <div className="karte-zeile-sub">Keine Stimme auf diesem Gerät</div> : (<>
                        {varianten.length > 1 && (
                          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                            <button className={`typ-btn${!vr ? " aktiv" : ""}`} data-stimme-variante={`${b}:alle`} onClick={() => setze("variante", b, undefined)}
                              {...tt(`${name}: Stimmen aller Varianten verwenden`)}>Alle</button>
                            {varianten.map(x => (
                              <button key={x} className={`typ-btn${vr === x ? " aktiv" : ""}`} data-stimme-variante={`${b}:${x}`} onClick={() => setze("variante", b, x)}
                                {...tt(`${name}: Variante ${varianteText(x)} – Aussprache und Stimmen dieser Variante`)}>{varianteText(x)}</button>
                            ))}
                          </div>
                        )}
                        <div data-stimmen-liste={b} style={{display:"flex", flexDirection:"column", gap:2}}>
                          {liste.map(v => {
                            const an = !aus.includes(v.voiceURI), ist = aktuell === v;
                            return (
                              <div key={v.voiceURI} className="stimme-zeile" data-stimme={v.voiceURI}>
                                <input type="checkbox" checked={an} data-stimme-an={v.voiceURI} style={{width:18, height:18}}
                                  onChange={() => setze("aus", b, an ? [...aus, v.voiceURI] : aus.filter(x => x !== v.voiceURI))}
                                  {...ttFeld(an ? "Stimme abschalten – wird nicht mehr verwendet" : "Stimme einschalten – wird beim „🔁 Stimme“ durchgewechselt")}/>
                                <span style={{flex:1, opacity: an ? 1 : 0.45, fontWeight: ist ? 700 : 400, cursor: an ? "pointer" : "default"}} data-stimme-wahl={v.voiceURI}
                                  onClick={() => { if (!an) return; setze("sprachen", b, v.voiceURI); sprichMit(v); }}
                                  {...tt(an ? "Antippen: diese Stimme verwenden" : "abgeschaltet")}>
                                  {v.name}{stimmeGeschlecht(v) && <span data-stimme-geschlecht style={{marginLeft:4}}>{stimmeGeschlecht(v)}</span>} <span style={{fontSize:"0.72rem", color:"var(--text3)"}}>{v.lang}</span>{ist && an ? " ✓" : ""}
                                </span>
                                <button className="btn btn-ghost btn-sm" data-stimme-probe={v.voiceURI} onClick={() => sprichMit(v)} {...tt(`Probe: ${v.name}`)}>▶</button>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{display:"flex", alignItems:"center", gap:8}}>
                          <span style={{fontSize:"0.8rem", color:"var(--text2)", minWidth:92}}>Tempo <b data-stimme-tempo-wert={b}>{tempo.toFixed(1).replace(".", ",")}×</b></span>
                          <input type="range" min="0.6" max="1.6" step="0.1" value={tempo} data-stimme-tempo={b} style={regler}
                            onChange={e => setze("tempoSprache", b, Number(e.target.value) === 1 ? undefined : Number(e.target.value))}
                            onPointerUp={() => sprichMit(aktuell)} {...ttFeld(`Tempo für ${name} – zum Ausgleich zwischen den Sprachen; wird mit dem Gesamt-Tempo multipliziert`)}/>
                        </div>
                      </>)}
                      {hilfeKnopf(b, true)}
                    </div>
                  </div>
                );
              })}
              {einstUnter === "tempo" && <div className="karte">
                <div className="karte-zeile" style={{flexDirection:"column", alignItems:"stretch", gap:6}}>
                  <div className="karte-zeile-name">Gesamt-Tempo <span data-stimmen-tempo style={{fontWeight:400, color:"var(--text2)"}}>{(w.tempo || 1).toFixed(1).replace(".", ",")}×</span></div>
                  <input type="range" min="0.6" max="1.4" step="0.1" value={w.tempo || 1} data-stimmen-tempo-regler style={regler}
                    onChange={e => aendereStimmen({ ...w, tempo: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })}
                    {...ttFeld("Gesamt-Tempo für alle Sprachen (multipliziert mit dem Tempo der Sprache) – auch über lang drücken auf eine Abfrage-Karte")}/>
                </div>
              </div>}
              </>);
            })()}
            </div>)}
            {einstKopf("farben", "Farben", "Vorlagen, eigene Schemata, Farbmodus")}
            {einstBereich === "farben" && (<div className="einst-inhalt" data-farben-einst>
            {renderFarbschemata()}
            </div>)}
            {einstKopf("app", "App", "Aktualisieren, Info")}
            {einstBereich === "app" && (<div className="einst-inhalt">
            {einstZeile([
              { k: "version", label: "Version", text: APP_VERSION, hilfe: `Version ${APP_VERSION} – nach neuer Version suchen` },
              { k: "info", label: "Info", text: "📖 Anleitung", attrs: { "data-info-oeffnen": true }, hilfe: "Übersicht, Konzept und Anleitung der App öffnen",
                aktion: () => schalteEinstBereich("info") },
            ])}
            {einstUnter === "version" && <div className="karte">
              <div className="karte-zeile">
                <div className="karte-zeile-info">
                  <div className="karte-zeile-name">App aktualisieren</div>
                  <div className="karte-zeile-sub">Version {APP_VERSION} · {updateStatus || "Nach neuer Version suchen"}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  // Offline-App: Service Worker nach neuer Version fragen; UpdateHinweis zeigt dann den Banner
                  const reg = await navigator.serviceWorker?.getRegistration();
                  if (!reg) { window.location.reload(); return; }
                  if (!navigator.onLine) { setUpdateStatus("Keine Internetverbindung"); return; }
                  setUpdateStatus("Suche…");
                  try {
                    await reg.update();
                    setUpdateStatus(reg.installing || reg.waiting ? "Neue Version gefunden" : "App ist aktuell");
                  } catch {
                    setUpdateStatus("Prüfung fehlgeschlagen");
                  }
                }} {...tt("Nach neuer App-Version suchen")}>Prüfen</button>
              </div>
            </div>}
            </div>)}
          </div>
        </>
  );
}
