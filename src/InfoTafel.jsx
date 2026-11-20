import { useEffect, useRef, useState } from "react";
import { schalteInfoModus, farbeImMenueAn, farbeHier } from "./infoEreignisse.js";
import { mitSymbolen } from "./symbole.jsx";
import { blinke } from "./speicher.js";

// Erklär-Tafel: zeigt Erklärtexte (data-info) als Sprechblase an der Stelle des Fingers,
// bis man irgendwo hintippt. Info-Modus: Antippen eines Elements erklärt es, statt es auszuführen.

export default function InfoTafel() {
  const [info, setInfo] = useState(null);
  const [modus, setModus] = useState(false);
  const [gruppeOffen, setGruppeOffen] = useState(null);
  const langRef = useRef(null);   // 274: langer Druck auf einen Menü-Knopf (a.lang)
  // Lang-Druck (iPad): Der Finger liegt noch auf, wenn die Tafel aufgeht. Beim Loslassen schickt iOS
  // oft noch einen Klick hinterher – der darf die Tafel nicht gleich wieder schließen.
  const fingerAufRef = useRef(0);          // aktuell aufliegende Finger
  const haltenRef = useRef(false);         // Tafel ging bei aufliegendem Finger auf
  const sperreBisRef = useRef(0);          // Klicks bis dahin ignorieren (nach dem Loslassen)

  useEffect(() => {
    const runter = e => { fingerAufRef.current = e.touches.length; };
    const hoch = e => {
      fingerAufRef.current = e.touches.length;
      if (haltenRef.current && e.touches.length === 0) { haltenRef.current = false; sperreBisRef.current = Date.now() + 400; }
    };
    document.addEventListener("touchstart", runter, true);
    document.addEventListener("touchend", hoch, true);
    document.addEventListener("touchcancel", hoch, true);
    return () => {
      document.removeEventListener("touchstart", runter, true);
      document.removeEventListener("touchend", hoch, true);
      document.removeEventListener("touchcancel", hoch, true);
    };
  }, []);

  useEffect(() => {
    const zeigen = e => {
      if (fingerAufRef.current > 0) haltenRef.current = true;
      // Auswahl-Tafel aktualisiert (ohne Stelle): Stelle des Lang-Drucks behalten
      setInfo(alt => e.detail.x == null && alt ? { ...e.detail, x: alt.x, y: alt.y } : e.detail);
    };
    const umschalten = () => setModus(m => !m);
    const schliessen = () => setInfo(null);
    window.addEventListener("vokabel-info", zeigen);
    window.addEventListener("vokabel-infomodus", umschalten);
    window.addEventListener("vokabel-info-schliessen", schliessen);
    return () => {
      window.removeEventListener("vokabel-info-schliessen", schliessen);
      window.removeEventListener("vokabel-info", zeigen);
      window.removeEventListener("vokabel-infomodus", umschalten);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("info-modus", modus);
    if (!modus) setInfo(null);
  }, [modus]);

  // Klicks abfangen (Capture-Phase, vor React): Tafel schließen bzw. im Info-Modus erklären
  useEffect(() => {
    if (!info && !modus) return;
    const klick = e => {
      // Nachzügler-Klick vom Loslassen des Lang-Drucks: verschlucken, Tafel bleibt offen
      if (info && (haltenRef.current || Date.now() < sperreBisRef.current)) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.target.closest("[data-info-schalter]") || e.target.closest("[data-info-aktion]") || e.target.closest("[data-info-farbe]") || e.target.closest("[data-info-regler]")) return;
      // Auswahl-Tafel: Kacheln wählen weiter aus, die Tafel selbst beendet die Auswahl, sonst passiert nichts
      if (info?.auswahl) {
        if (e.target.closest("[data-auswahl-durchlass]")) return;
        e.preventDefault(); e.stopPropagation();
        if (e.target.closest("[data-info-blase]")) { setInfo(null); info.auswahl.zu?.(false); }
        return;
      }
      const el = modus ? e.target.closest("[data-info]") : null;
      if (el) {
        e.preventDefault(); e.stopPropagation();
        // am angetippten Element verankern (auch bei Klicks ohne Koordinaten, z. B. Tastatur)
        const r = el.getBoundingClientRect();
        setInfo({ text: el.getAttribute("data-info"), x: r.left + r.width / 2, y: r.top + r.height / 2 });
        return;
      }
      // offene Erklärung: schließen; ein Knopf darunter bleibt antippbar (z. B. weitere Art bei der Mehrfach-Auswahl), sonst nichts auslösen
      if (info) { setInfo(null); if (!e.target.closest("button, a, input, select, textarea, label, [role=button]")) { e.preventDefault(); e.stopPropagation(); } }
    };
    document.addEventListener("click", klick, true);
    return () => document.removeEventListener("click", klick, true);
  }, [info, modus]);

  // Sprechblase weg vom Finger: Finger in der unteren Hälfte → oben am Rand, sonst unten am Rand (der Bereich um den Finger bleibt frei).
  // Menü-Knöpfe (aktionen) schweben getrennt unter der Blase.
  // Auswahl-Tafel: unten angedockt, damit die Kacheln darüber antippbar bleiben
  const unten = !!info?.auswahl;
  // Auswahl-Tafel: unten Platz schaffen (die Kacheln lassen sich über die Tafel hochscrollen)
  // und die gedrückte Kachel freilegen, falls die Tafel sie verdeckt
  const tafelRef = useRef(null);
  const warUntenRef = useRef(false);
  const zielRef = useRef(null);   // 274: Stelle des Lang-Drucks im Dokument – bleibt frei, auch wenn die Tafel danach wächst
  useEffect(() => {
    if (!unten) { warUntenRef.current = false; zielRef.current = null; document.body.style.paddingBottom = ""; document.documentElement.style.removeProperty("--tafel-platz"); return; }
    const el = tafelRef.current;
    if (!el) return;
    // Platz unten: Seite (body) und eigene Scroll-Bereiche (var(--tafel-platz), z. B. die maximierte Vokabelliste);
    // die gedrückte Kachel (≈ 60 px hoch) ganz über die Tafel, falls die Tafel sie verdeckt
    const freilegen = () => { if (zielRef.current == null) return; const frei = window.innerHeight - el.offsetHeight - 24, y = zielRef.current - window.scrollY;
      if (y > frei - 135) window.scrollBy({ top: y - frei + 145, behavior: "smooth" }); };   // 305/312: Kacheln bis ~110 px hoch, der Kopf (zweizeilig) wächst mit den Filtern
    // 305: unten genug Platz, um die unterste Kachel über die (kleine) Tafel zu holen
    const anpassen = () => { document.body.style.paddingBottom = `${el.offsetHeight + 104}px`; document.documentElement.style.setProperty("--tafel-platz", `${el.offsetHeight + 24}px`); freilegen(); };
    if (!warUntenRef.current) { warUntenRef.current = true; zielRef.current = info.y != null ? info.y + window.scrollY : null; }
    anpassen();
    const obs = new ResizeObserver(anpassen);
    obs.observe(el);
    return () => obs.disconnect();
  }, [unten, info]);
  const breite = unten ? Math.min(480, window.innerWidth - 24) : Math.min(300, window.innerWidth - 24);
  const links = unten ? (window.innerWidth - breite) / 2 : info ? Math.max(12, Math.min(info.x - breite / 2, window.innerWidth - breite - 12)) : 0;
  // Menü: Aktionen des Elements, dazu „🎨 Farbe ändern“ (startet den Farbmodus an dieser Stelle)
  // 235: geöffnete Gruppe – ihre Unterpunkte ersetzen das Menü, oben „‹ zurück“
  const grp = info && gruppeOffen?.text === info.text ? (info.aktionen || []).find(a => a.gruppe && a.label === gruppeOffen.label) : null;
  const menue = !info ? [] : grp ? [{ label: "‹ zurück", zurueck: true }, ...grp.gruppe]
    : [...(info.aktionen || []), ...(!modus && farbeImMenueAn() && info.x != null ? [{ label: "🎨 Farbe ändern", farbe: true, fn: () => farbeHier(info.x, info.y) }] : [])];
  const mitMenue = menue.length > 0;
  const obenHin = info && info.y != null && info.y > window.innerHeight / 2;
  return (
    <>
      {info && (
        <div ref={tafelRef} data-auswahl-tafel={unten ? "" : undefined} style={{
          position: "fixed", left: links, width: breite, zIndex: 10001,
          ...(unten ? { bottom: 12 } : obenHin ? { top: 12 } : { bottom: 12 }), maxHeight: "calc(100vh - 24px)", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: unten ? 8 : 10,
          fontFamily: "system-ui,sans-serif",
        }}>
          {!info.auswahl?.ohneText && <div role="status" data-info-blase style={{
            background: "rgba(28,24,20,0.95)", color: "var(--auf-haupt)", borderRadius: 14, cursor: unten ? "pointer" : undefined,
            padding: "12px 14px", boxShadow: "0 6px 24px rgba(0,0,0,0.3)", boxSizing: "border-box",
          }}>
            <div style={{ fontSize: mitMenue ? "1.05rem" : "0.95rem", fontWeight: mitMenue ? 700 : 400, lineHeight: 1.5, overflowWrap: "anywhere" }}>{mitSymbolen(info.text)}</div>
            {info.zusatz && <div data-info-zusatz style={{ marginTop: 8, fontSize: "0.88rem", lineHeight: 1.5 }}>{info.zusatz}</div>}
          </div>}
          {info.regler && <TafelRegler key={info.text} regler={info.regler}/>}
          {mitMenue && (() => {
            // 274: Schalter-Raster (raster: true) oben als Gitter 2 Spalten (breit = ganze Zeile); in der Tafel unten danach
            // „🎨 Farbe ändern“, dann die übrigen Knöpfe
            const raster = menue.filter(a => a.raster);
            let rest = menue.filter(a => !a.raster);
            const mitHaupt = rest.some(a => a.haupt);   // 324: ein Hauptknopf (breit oben), 🎨 klein rechts unten
            if (unten && (raster.length || info.auswahl) && !mitHaupt) rest = [...rest.filter(a => a.farbe), ...rest.filter(a => !a.farbe)];
            const farbeRechts = mitHaupt ? rest.filter(a => a.farbe) : [];
            if (mitHaupt) rest = rest.filter(a => !a.farbe);
            const klein = unten && (raster.length > 0 || !!info.auswahl) && !grp;   // 281/305: Auswahl-Tafel nur eine kleine Zeile
            const knopf = a => (
                <button key={a.label} className={a.schalter ? `quiz-zeile-knopf${a.an ? " an" : ""}` : undefined} data-info-aktion={a.farbe ? undefined : a.label} data-info-farbe={a.farbe ? "" : undefined}
                  data-info-gruppe={a.gruppe ? a.gruppe.map(u => u.label).join("|") : undefined} data-info-zurueck={a.zurueck ? "" : undefined}
                  data-schalter={a.schalter} data-an={a.schalter ? (a.an ? "an" : "aus") : undefined}
                  disabled={a.aus && !a.schalter} data-info-aus={a.aus ? "" : undefined} {...(a.aus && a.schalter ? { "aria-disabled": true, "data-gesperrt": "" } : {})}
                  onContextMenu={a.lang ? e => { e.preventDefault(); e.stopPropagation(); if (!a.aus || a.langImmer) a.lang(e.clientX, e.clientY); } : undefined}
                  onTouchStart={a.lang ? e => { const t = e.touches[0]; clearTimeout(langRef.current?.t); langRef.current = { t: setTimeout(() => { langRef.current = { fertig: true }; if (!a.aus || a.langImmer) a.lang(t.clientX, t.clientY); }, 500) }; } : undefined}
                  onTouchMove={a.lang ? () => { clearTimeout(langRef.current?.t); } : undefined}
                  onTouchEnd={a.lang ? e => { if (langRef.current?.fertig) e.preventDefault(); clearTimeout(langRef.current?.t); } : undefined}
                  onClick={e => {
                    if (langRef.current?.fertig) { langRef.current = null; return; }
                    if (a.aus) { if (a.schalter) blinke(e.currentTarget); return; }   // 283: gesperrter Schalter leuchtet kurz
                    if (a.schalter) { a.fn(); return; }   // 274: Schalter – Tafel bleibt offen
                    if (a.gruppe) { setGruppeOffen({ text: info.text, label: a.label }); return; }   // 235: Gruppe öffnen, Tafel bleibt
                    if (a.zurueck) { setGruppeOffen(null); return; }
                    setGruppeOffen(null); setInfo(null); info.auswahl?.zu?.(!!a.behalten); a.fn();
                  }} style={a.schalter ? { gridColumn: a.breit ? "1 / -1" : undefined } : {   // 280: Schalter wie im Quiz-Tab (Klasse quiz-zeile-knopf)
                  opacity: a.aus ? 0.45 : 1,
                  background: a.schalter && a.an ? "var(--haupt)" : "var(--karte)", color: a.schalter && a.an ? "var(--auf-haupt)" : a.gefahr ? "var(--falsch)" : a.farbe || a.zurueck ? "var(--text2)" : "var(--haupt)",
                  textAlign: a.schalter || mitHaupt ? "center" : "left", whiteSpace: "nowrap", gridColumn: a.breit ? "1 / -1" : undefined,
                  ...(mitHaupt && !a.farbe ? (a.haupt ? { flexBasis: "100%", background: "var(--haupt)", color: "var(--auf-haupt)", fontSize: "0.92rem", padding: "9px 12px" } : { flex: "1 1 0" }) : {}),
                  border: `1.5px solid ${a.gefahr ? "var(--falsch-zart)" : "var(--haupt-zart)"}`, borderRadius: 22, padding: klein ? "4px 10px" : unten ? "8px 12px" : "11px 18px",
                  fontSize: klein ? "0.78rem" : unten ? "0.85rem" : "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: a.aus ? "default" : "pointer",
                  boxShadow: klein ? "0 2px 8px rgba(0,0,0,0.18)" : "0 4px 16px rgba(0,0,0,0.22)",
                }}>{mitSymbolen(a.label)}</button>
            );
            return (
              <div data-info-menue data-info-gruppe-offen={grp ? grp.label : undefined} style={{ display: "flex", flexDirection: "column", gap: unten ? 6 : 8 }}>
                {raster.length > 0 && <div data-schalter-raster style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{raster.map(knopf)}</div>}
                {rest.length > 0 && <div data-tafel-unten={klein ? "klein" : undefined} style={{ display: "flex", flexDirection: unten ? "row" : "column", flexWrap: unten ? "wrap" : undefined, gap: unten ? 6 : 8, justifyContent: klein ? "center" : undefined }}>{rest.map(knopf)}</div>}
                {farbeRechts.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end" }}>{farbeRechts.map(knopf)}</div>}
              </div>
            );
          })()}
        </div>
      )}
      {modus && (
        <button data-info-schalter onClick={schalteInfoModus} style={{
          position: "fixed", left: 12, bottom: 12, zIndex: 10002,
          background: "var(--haupt)", color: "var(--auf-haupt)", border: "none", borderRadius: 20,
          padding: "8px 14px", fontSize: "0.8rem", fontWeight: 600, fontFamily: "system-ui,sans-serif",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)", cursor: "pointer",
        }}>ⓘ Info-Modus beenden</button>
      )}
    </>
  );
}

// Regler in der Tafel (z. B. Gesamt-Tempo beim Vorlesen): ändert sofort, beim Loslassen „fertig“ (z. B. Probe vorlesen)
function TafelRegler({ regler }) {
  const [wert, setWert] = useState(regler.wert);
  return (
    <div data-info-regler style={{ background: "rgba(28,24,20,0.95)", color: "#fff", borderRadius: 14, padding: "10px 14px", boxSizing: "border-box", boxShadow: "0 6px 24px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700, marginBottom: 6 }}>
        <span>{regler.label}</span><span data-info-regler-wert>{regler.format ? regler.format(wert) : wert}</span>
      </div>
      <input type="range" min={regler.min} max={regler.max} step={regler.step} value={wert} style={{ width: "100%" }}
        onChange={e => { const v = Number(e.target.value); setWert(v); regler.aendern?.(v); }}
        onPointerUp={() => regler.fertig?.()} />
    </div>
  );
}
