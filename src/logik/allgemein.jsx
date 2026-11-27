import { SK, lsGet } from "../speicher.js";
import { ansichtVon, ebeneVon, ebenenSpalten, eintraegeImOrdner, ordneEbeneAn } from "../raster.js";
import { STIMMEN_WAHL, aeusserung, naechsteStimme, normLang, vorleseTeile } from "../sprache.js";
import { zeigeInfo } from "../infoEreignisse.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

// 359: alle = für die oberste Ebene und alle Ordner (Listen bzw. Quiz getrennt)
export function setzeMinSpalten(app, art, ordnerId, n, alle = false) {
  const { einstellungen, getSlotsData, listenOrdnerDaten, setSlotsData, speichereEinst, speichereListenOrdnerDaten } = app;
    if (alle || !ordnerId) speichereEinst({ ...einstellungen, ebenenSpalten: { ...(einstellungen.ebenenSpalten || {}), [art]: n } });
    if (!alle && !ordnerId) return;
    const pass = o => alle || o.id === ordnerId ? { ...o, spalten: n } : o;
    if (art === "liste") { const d = listenOrdnerDaten(); speichereListenOrdnerDaten({ ...d, ordner: d.ordner.map(pass) }); }
    else { const d = getSlotsData(); setSlotsData({ ...d, ordner: (d.ordner || []).map(pass) }); }
  }

// eslint-disable-line react-hooks/exhaustive-deps       // 217: Quiz-Auswahl zeigt die Listen (Umschalter „Quiz | Listen“)   // 208: { art, ordner } – Fenster „Anordnen“
// 208/359: anordnen – name | datum | lernstand: automatisch (lückenlos) und dauerhaft so sortiert; frei: die eigenen
// gespeicherten Plätze (bleiben in der automatischen Anordnung erhalten); luecken: freie Plätze einmal zusammenrücken.
// alle = oberste Ebene und alle Ordner (Listen bzw. Quiz getrennt)
export function ordneAn(app, art, ordnerId, nach, alle = false) {
  const { einstellungen, getSlotsData, lernstandJeArt, listenOrdnerDaten, rasterEinordnen, setAnordnen, setSlotsData, speichereEinst, speichereListenOrdnerDaten } = app;
    const liste = art === "liste";
    let data = liste ? listenOrdnerDaten() : rasterEinordnen(getSlotsData());
    const ebenen = alle ? [null, ...(data.ordner || []).map(o => o.id)] : [ordnerId || null];
    const ansicht = id => ansichtVon(einstellungen, data.ordner, art, id);
    const pctListe = id => lernstandJeArt(lsGet(SK.liste(id))?.vokabeln || [], id).uebersetzung.pct || 0;
    const pctSession = x => { const k = x.konfiguration || {};
      let v = (k.listenIds || []).flatMap(id => (lsGet(SK.liste(id))?.vokabeln || []).map(y => ({ ...y, _key: `${id}__${y.id}` })));
      if (k.bereichTyp === "bereich" && k.vokabelAuswahl?.length) { const a = new Set(k.vokabelAuswahl); v = v.filter(y => a.has(y._key)); }
      return lernstandJeArt(v).uebersetzung.pct || 0; };
    const pct = x => x.istOrdner
      ? (() => { const e = eintraegeImOrdner(data, x.id); return e.length ? e.reduce((m, y) => m + (liste ? pctListe(y.id) : pctSession(y)), 0) / e.length : 0; })()
      : liste ? pctListe(x.id) : pctSession(x);
    const nachLernstand = (a, b) => pct(b) - pct(a);
    let werte = null;
    ebenen.forEach(id => {
      const a = ansicht(id), frei = ebenenSpalten(ebeneVon(data, id), false, a.spalten);
      if (nach === "frei") return;   // die eigenen (gespeicherten) Plätze bleiben – wie zuletzt frei angeordnet
      if (nach === "luecken") data = ordneEbeneAn(data, id, null, a.auto ? a.spalten : frei);
      else if (nach === "lernstand") data = ordneEbeneAn(data, id, nachLernstand, a.spalten);   // Lernstand: als Plätze festgehalten
    });
    if (nach === "frei") werte = { anordnung: "frei" };
    else if (nach !== "luecken") werte = { anordnung: "auto", sortierung: nach };
    if (werte) {
      if (alle || ordnerId) data = { ...data, ordner: (data.ordner || []).map(o => ebenen.includes(o.id) ? { ...o, ...werte } : o) };
      if (ebenen.includes(null)) speichereEinst({ ...einstellungen, ebenenAnordnung: { ...(einstellungen.ebenenAnordnung || {}), [art]: werte.anordnung },
        ...(werte.sortierung ? { ebenenSortierung: { ...(einstellungen.ebenenSortierung || {}), [art]: werte.sortierung } } : {}) });
    }
    if (liste) speichereListenOrdnerDaten(data); else setSlotsData(rasterEinordnen(data));
    setAnordnen(null);
  }

export function wechsleStimme(app, text, lang) {
  const { setStimmenWahlState } = app;
    const v = naechsteStimme(normLang(lang).split("-")[0]);
    setStimmenWahlState(STIMMEN_WAHL);
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    vorleseTeile(text).forEach(x => window.speechSynthesis.speak(aeusserung(x, lang, v)));
  }

// Fingerposition beim Aufsetzen: kleine Bewegungen brechen den langen Druck nicht ab
// Erklärtext: Maus = title; Touch = lange drücken → Info-Tafel (bleibt bis Antippen, InfoTafel.jsx);
// data-info macht das Element im Info-Modus erklärbar
// aktionen (optional): Lang-Druck bzw. Rechtsklick zeigt die Erklärung mit Menü-Knöpfen darunter
// opts.langText: anderer Text für den Lang-Druck (z. B. nur der volle Name); opts.beimZeigen(x, y): Rückruf;
// opts.auswahl: als Auswahl-Tafel zeigen (siehe infoEreignisse.js); opts.eigeneGeste: Touch-Lang-Druck übernimmt die Kachel-Geste
// 322: Android meldet einen langen Druck zusätzlich als Kontextmenü – eine Lang-Aktion läuft nur einmal
let letzteLangAktion = { t: 0, quelle: null };   // nur Touch + Kontextmenü desselben Drucks zusammenfassen
const langEinmal = (f, quelle) => { const t = Date.now(); if (t - letzteLangAktion.t < 900 && letzteLangAktion.quelle !== quelle) return; letzteLangAktion = { t, quelle }; f(); };
export function tt(app, text, aktionen, opts = {}) {
  const { farbModusRef, kachelGesteRef, lassoRef, slotZiehenRef, tooltipShown, tooltipStart, tooltipTimer } = app;
    if (!text) return {};
    const langText = opts.langText || text;
    return {
      // Rechtsklick = langer Druck: Menü bzw. Erklärung (mit „🎨 Farbe ändern“)
      // verschachtelt: ein inneres Element mit eigenem Menü hat Vorrang vor dem äußeren (sonst gewinnt wie bisher das äußere)
      onContextMenu(e) { e.preventDefault(); if (e.nativeEvent._ttMenue) return; if (aktionen) e.nativeEvent._ttMenue = true;
        // 171: Android meldet den Lang-Druck zusätzlich als Kontextmenü – bei Kacheln läuft schon die eigene Geste (sonst rein + wieder heraus)
        if (opts.eigeneGeste && (kachelGesteRef.current || lassoRef.current?.aktiv || e.nativeEvent.sourceCapabilities?.firesTouchEvents || e.nativeEvent.pointerType === "touch")) return;
        if (opts.lang && !farbModusRef.current) { langEinmal(opts.lang, "kontext"); return; }   // 299: langer Druck = Aktion (z. B. Bereich wählen); Farbmodus: Farbfeld
        opts.beimLang?.();
        if (aktionen) opts.beimMenue?.(); zeigeInfo(langText, e.clientX, e.clientY, aktionen, { ...(opts.auswahl ? { auswahl: opts.auswahl } : {}), ...(opts.regler ? { regler: opts.regler() } : {}), ...(opts.zusatz ? { zusatz: opts.zusatz() } : {}) }); },
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
          if (opts.lang) { tooltipShown.current = true; langEinmal(opts.lang, "touch"); return; }   // 299/322
          tooltipShown.current = true; opts.beimLang?.(); zeigeInfo(langText, t.clientX, t.clientY, aktionen, { ...(opts.auswahl ? { auswahl: opts.auswahl } : {}), ...(opts.regler ? { regler: opts.regler() } : {}), ...(opts.zusatz ? { zusatz: opts.zusatz() } : {}) });
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
export function ttFeld(app, text) {
  const {  } = app; return text ? { title: text, "data-info": text } : {}; }

