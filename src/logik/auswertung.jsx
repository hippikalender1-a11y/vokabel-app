import { SK, lsGet } from "../speicher.js";
import { hatAkzentWort } from "../quiz.jsx";
import { CSS } from "../stil.js";
import { SPRACH_KUERZEL, sprachInfo } from "../sprache.js";
import { sucheVokabeln } from "../raster.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// ── Quiz-Auswertung (zweiter Bildschirm nach „Weiter →“) ──
// Quiz mit Paketen: alle Vokabeln des Quiz seit Durchlauf-Start; sonst: diese Runde
export function sessionAuswertungDaten(app, q) {
  const { erstAusQuiz } = app;
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

// ganze Seite des Quiz-Auswertung mit den gewohnten Knöpfen darunter
export function sessionAuswertungSeite(app, q, knoepfe, schliessen) {
  const { farbModusUI, farbRadUI, renderSessionAuswertung, sessionAuswertungDaten, tt } = app;
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

// zurück aus Liste/Import zu Einstellungen › Listen
export function zuEinstListen(app) {
  const { setAnsicht, setEinstBereich, setListenWahl, setTab } = app; setTab("einstellungen"); setEinstBereich("listen"); setAnsicht("uebersicht"); setListenWahl(null); requestAnimationFrame(() => window.scrollTo(0, 0)); }

// Namensvorschlag für gespeicherte Konfigurationen: Sprache(n) + Datum, eindeutig
// 216: ungespeichertes Quiz aus genau einer Liste – deren Name (Teil der Liste: „· Nr. 1–10“ bzw. „· Auswahl“)
export function einListenName(app) {
  const { listenIndex, quizBereichTyp, quizCheckboxAuswahl, quizTabListen } = app;
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

export function slotNamenVorschlag(app) {
  const { aktiverSlot, einListenName, multiVonSlot, quizTabListen, slots, spracheVonListe } = app;
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

export function auswahlStuecke(app, voks, auswahl) {
  const {  } = app;
    const anf = [];
    voks.forEach((v, i) => { if (auswahl.has(v.id) && !(i > 0 && auswahl.has(voks[i - 1].id))) anf.push(v.id); });
    return anf;
  }

export function sprungKnopf(app, art, voks, auswahl) {
  const { auswahlStuecke, setSprungTick, sprungRef, tt } = app;
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

export function suchInfo(app, voks, such) {
  const {  } = app;
    const treffer = sucheVokabeln(voks, such.text);
    const nr = Math.min(such.nr, Math.max(0, treffer.length - 1));
    return { treffer, nr, ids: new Set(treffer.map(t => t.id)), aktuell: treffer[nr]?.id, filter: such.nurTreffer && !!such.text.trim() };
  }

// Hervorhebung einer Zeile: aktueller Treffer kräftig, weitere Treffer zart (linker Rand)
export function suchMarke(app, info, id) {
  const {  } = app;
    return id === info.aktuell ? { boxShadow:"inset 5px 0 0 var(--gelb)", outline:"2px solid var(--gelb)", outlineOffset:-2 }
      : info.ids.has(id) ? { boxShadow:"inset 5px 0 0 var(--gelb-zart)" } : {};
  }

export function springeZuTreffer(app, art, id) {
  const {  } = app;
    requestAnimationFrame(() => document.querySelector(`[data-such-ziel="${art}"][data-such-id="${window.CSS.escape(String(id))}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

// Nach einer Aktion in der Vokabelliste (Häkchen, Von–Bis): Tastatur der Suche schließen und die Zeile im Blick halten –
// verschoben wird nur, wenn sie danach verdeckt oder außerhalb liegt (Tastatur zu, Tafel unten, Liste länger), dann in die Mitte
export function sichtbarHalten(app, art, id) {
  const {  } = app;
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

export function zeileImBlick(app, art, id) {
  const { sichtbarHalten } = app;
    const f = document.activeElement;
    if (f?.matches?.("[data-such-feld]")) f.blur();
    [0, 150, 400, 800].forEach(ms => setTimeout(() => requestAnimationFrame(() => sichtbarHalten(art, id)), ms));
  }

// Lang-Druck auf eine Vokabelzeile: Von–Bis mit dieser Vokabel als Anfang
export function vonBisLangDruck(app, art, vok, nr, w1, w2) {
  const { setQuizVonBisErster, setQuizVonBisModus, setStatistikVonBisErster, setStatistikVonBisModus, tt, vonBisTafelRef, zeileImBlick } = app;
    const [setModus, setErster] = art === "quiz" ? [setQuizVonBisModus, setQuizVonBisErster] : [setStatistikVonBisModus, setStatistikVonBisErster];
    const abbrechen = () => { vonBisTafelRef.current = null; setModus(false); setErster(null); };
    return tt("Vokabel aus- oder abwählen (bei Von–Bis: Anfang bzw. Ende des Bereichs) – lang drücken: Von–Bis ab hier",
      [{ label: "✕ Von–Bis abbrechen", fn: abbrechen }],
      { auswahl: { zu: () => abbrechen(), ohneText: true },
        beimMenue: () => { vonBisTafelRef.current = art; setModus(true); setErster(vok.id); zeileImBlick(art, vok.id); } });
  }
