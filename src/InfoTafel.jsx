import { useEffect, useRef, useState } from "react";
import { schalteInfoModus, farbeImMenueAn, farbeHier } from "./infoEreignisse.js";

// Erklär-Tafel: zeigt Erklärtexte (data-info) als Sprechblase an der Stelle des Fingers,
// bis man irgendwo hintippt. Info-Modus: Antippen eines Elements erklärt es, statt es auszuführen.

export default function InfoTafel() {
  const [info, setInfo] = useState(null);
  const [modus, setModus] = useState(false);
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
  useEffect(() => {
    if (!unten) { warUntenRef.current = false; document.body.style.paddingBottom = ""; document.documentElement.style.removeProperty("--tafel-platz"); return; }
    const el = tafelRef.current;
    if (!el) return;
    // Platz unten: Seite (body) und eigene Scroll-Bereiche (var(--tafel-platz), z. B. die maximierte Vokabelliste)
    const anpassen = () => { document.body.style.paddingBottom = `${el.offsetHeight + 24}px`; document.documentElement.style.setProperty("--tafel-platz", `${el.offsetHeight + 24}px`); };
    anpassen();
    if (!warUntenRef.current) {
      warUntenRef.current = true;
      const frei = window.innerHeight - el.offsetHeight - 24;   // Unterkante des sichtbaren Bereichs über der Tafel
      if (info.y != null && info.y > frei - 70) window.scrollBy({ top: info.y - frei + 90, behavior: "smooth" });   // die gedrückte Kachel (≈ 60 px hoch) ganz über die Tafel
    }
    const obs = new ResizeObserver(anpassen);
    obs.observe(el);
    return () => obs.disconnect();
  }, [unten, info]);
  const breite = unten ? Math.min(480, window.innerWidth - 24) : Math.min(300, window.innerWidth - 24);
  const links = unten ? (window.innerWidth - breite) / 2 : info ? Math.max(12, Math.min(info.x - breite / 2, window.innerWidth - breite - 12)) : 0;
  // Menü: Aktionen des Elements, dazu „🎨 Farbe ändern“ (startet den Farbmodus an dieser Stelle)
  const menue = info ? [...(info.aktionen || []), ...(!modus && farbeImMenueAn() && info.x != null ? [{ label: "🎨 Farbe ändern", farbe: true, fn: () => farbeHier(info.x, info.y) }] : [])] : [];
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
            <div style={{ fontSize: mitMenue ? "1.05rem" : "0.95rem", fontWeight: mitMenue ? 700 : 400, lineHeight: 1.5, overflowWrap: "anywhere" }}>{info.text}</div>
          </div>}
          {info.regler && <TafelRegler key={info.text} regler={info.regler}/>}
          {mitMenue && (
            <div data-info-menue style={{ display: "flex", flexDirection: unten ? "row" : "column", flexWrap: unten ? "wrap" : undefined, gap: unten ? 6 : 8 }}>
              {menue.map(a => (
                <button key={a.label} data-info-aktion={a.farbe ? undefined : a.label} data-info-farbe={a.farbe ? "" : undefined}
                  disabled={a.aus} data-info-aus={a.aus ? "" : undefined}
                  onClick={() => { if (a.aus) return; setInfo(null); info.auswahl?.zu?.(!!a.behalten); a.fn(); }} style={{
                  opacity: a.aus ? 0.45 : 1,
                  background: "var(--karte)", color: a.gefahr ? "var(--falsch)" : a.farbe ? "var(--text2)" : "var(--haupt)", textAlign: "left", whiteSpace: "nowrap",
                  border: `1.5px solid ${a.gefahr ? "var(--falsch-zart)" : "var(--haupt-zart)"}`, borderRadius: 22, padding: unten ? "8px 12px" : "11px 18px",
                  fontSize: unten ? "0.85rem" : "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: a.aus ? "default" : "pointer",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
                }}>{a.label}</button>
              ))}
            </div>
          )}
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
