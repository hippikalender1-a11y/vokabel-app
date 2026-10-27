import { useEffect, useState } from "react";
import { schalteInfoModus } from "./infoEreignisse.js";

// Erklär-Tafel: zeigt Erklärtexte (data-info) als Sprechblase an der Stelle des Fingers,
// bis man irgendwo hintippt. Info-Modus: Antippen eines Elements erklärt es, statt es auszuführen.

export default function InfoTafel() {
  const [info, setInfo] = useState(null);
  const [modus, setModus] = useState(false);

  useEffect(() => {
    const zeigen = e => setInfo(e.detail);
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
      if (e.target.closest("[data-info-schalter]")) return;
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

  // Sprechblase an der Fingerstelle: knapp darüber, bei zu wenig Platz oben knapp darunter
  const breite = Math.min(300, window.innerWidth - 24);
  const links = info ? Math.max(12, Math.min(info.x - breite / 2, window.innerWidth - breite - 12)) : 0;
  const darueber = info && info.y > 150;
  return (
    <>
      {info && (
        <div role="status" style={{
          position: "fixed", left: links, width: breite, zIndex: 10001,
          top: darueber ? info.y - 14 : info.y + 14,
          transform: darueber ? "translateY(-100%)" : "none",
          background: "rgba(28,24,20,0.95)", color: "#fff", borderRadius: 14,
          padding: "12px 14px 8px", boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          fontFamily: "system-ui,sans-serif", boxSizing: "border-box",
        }}>
          <div style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>{info.text}</div>
          <div style={{ fontSize: "0.7rem", color: "#c0bcb7", textAlign: "right", marginTop: 6 }}>Antippen zum Schließen</div>
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
