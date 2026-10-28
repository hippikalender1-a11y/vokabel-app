import { useEffect, useRef, useState } from "react";
import { schalteInfoModus } from "./infoEreignisse.js";

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
      setInfo(e.detail);
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
      if (e.target.closest("[data-info-schalter]") || e.target.closest("[data-info-aktion]")) return;
      const el = modus ? e.target.closest("[data-info]") : null;
      if (el) {
        e.preventDefault(); e.stopPropagation();
        // am angetippten Element verankern (auch bei Klicks ohne Koordinaten, z. B. Tastatur)
        const r = el.getBoundingClientRect();
        setInfo({ text: el.getAttribute("data-info"), x: r.left + r.width / 2, y: r.top + r.height / 2 });
        return;
      }
      if (info) { e.preventDefault(); e.stopPropagation(); setInfo(null); }
    };
    document.addEventListener("click", klick, true);
    return () => document.removeEventListener("click", klick, true);
  }, [info, modus]);

  // Sprechblase an der Fingerstelle: knapp darüber, bei zu wenig Platz oben knapp darunter.
  // Menü-Knöpfe (aktionen) schweben getrennt unter der Blase.
  const breite = Math.min(300, window.innerWidth - 24);
  const links = info ? Math.max(12, Math.min(info.x - breite / 2, window.innerWidth - breite - 12)) : 0;
  const mitMenue = info?.aktionen?.length > 0;
  const darueber = info && info.y > (mitMenue ? 330 : 150);
  return (
    <>
      {info && (
        <div style={{
          position: "fixed", left: links, width: breite, zIndex: 10001,
          top: darueber ? info.y - 14 : info.y + 14,
          transform: darueber ? "translateY(-100%)" : "none",
          display: "flex", flexDirection: "column", gap: 10,
          fontFamily: "system-ui,sans-serif",
        }}>
          <div role="status" style={{
            background: "rgba(28,24,20,0.95)", color: "#fff", borderRadius: 14,
            padding: "12px 14px 8px", boxShadow: "0 6px 24px rgba(0,0,0,0.3)", boxSizing: "border-box",
          }}>
            <div style={{ fontSize: mitMenue ? "1.05rem" : "0.95rem", fontWeight: mitMenue ? 700 : 400, lineHeight: 1.5, overflowWrap: "anywhere" }}>{info.text}</div>
            <div style={{ fontSize: "0.7rem", color: "#c0bcb7", textAlign: "right", marginTop: 6 }}>Antippen zum Schließen</div>
          </div>
          {mitMenue && (
            <div data-info-menue style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {info.aktionen.map(a => (
                <button key={a.label} data-info-aktion={a.label} onClick={() => { setInfo(null); a.fn(); }} style={{
                  background: "#fff", color: a.gefahr ? "#c0392b" : "#2d6a4f", textAlign: "left", whiteSpace: "nowrap",
                  border: `1.5px solid ${a.gefahr ? "#e8a39b" : "#a8d5be"}`, borderRadius: 22, padding: "11px 18px",
                  fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
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
          background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 20,
          padding: "8px 14px", fontSize: "0.8rem", fontWeight: 600, fontFamily: "system-ui,sans-serif",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)", cursor: "pointer",
        }}>ⓘ Info-Modus beenden</button>
      )}
    </>
  );
}
