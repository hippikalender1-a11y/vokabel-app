import { SK, lsGet } from "../speicher.js";
import { ebeneVon, ebenenSpalten, eintraegeImOrdner, nameVergleich, ordneEbeneAn } from "../raster.js";
import { STIMMEN_WAHL, aeusserung, naechsteStimme, normLang, vorleseTeile } from "../sprache.js";
import { zeigeInfo } from "../infoEreignisse.js";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

export function setzeMinSpalten(app, art, ordnerId, n) {
  const { einstellungen, getSlotsData, listenOrdnerDaten, setSlotsData, speichereEinst, speichereListenOrdnerDaten } = app;
    if (!ordnerId) { speichereEinst({ ...einstellungen, ebenenSpalten: { ...(einstellungen.ebenenSpalten || {}), [art]: n } }); return; }
    if (art === "liste") { const d = listenOrdnerDaten(); speichereListenOrdnerDaten({ ...d, ordner: d.ordner.map(o => o.id === ordnerId ? { ...o, spalten: n } : o) }); }
    else { const d = getSlotsData(); setSlotsData({ ...d, ordner: (d.ordner || []).map(o => o.id === ordnerId ? { ...o, spalten: n } : o) }); }
  }

// eslint-disable-line react-hooks/exhaustive-deps       // 217: Quiz-Auswahl zeigt die Listen (Umschalter „Quiz | Listen“)   // 208: { art, ordner } – Fenster „Anordnen“
// 208: anordnen nach name | datum | lernstand | luecken (Spalten = gewählte bzw. belegte)
export function ordneAn(app, art, ordnerId, nach) {
  const { getSlotsData, lernstandJeArt, listenOrdnerDaten, minSpalten, rasterEinordnen, setAnordnen, setSlotsData, speichereListenOrdnerDaten } = app;
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
export function ttFeld(app, text) {
  const {  } = app; return text ? { title: text, "data-info": text } : {}; }

export function klappeFreieZu(app) {
  const { kontexteRef, setZuklappHinweis, zuklappFreiRef } = app;
    kontexteRef.current().forEach(k => k.schliessen());
    zuklappFreiRef.current = new Set();
    setZuklappHinweis(false);
  }
