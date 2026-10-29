import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const FLAG = "vokabel_update_laeuft";

// Banner unten: erscheint, wenn eine neue App-Version geladen wurde;
// nach dem Aktualisieren kurz eine Erfolgsmeldung
export default function UpdateHinweis() {
  const [laeuft, setLaeuft] = useState(false);
  const [erfolg, setErfolg] = useState(false);
  const { needRefresh: [neueVersion, setNeueVersion], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Bei lange geöffneter App stündlich nach Updates schauen
      if (reg) setInterval(() => { if (navigator.onLine) reg.update(); }, 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    try {
      if (!localStorage.getItem(FLAG)) return;
      localStorage.removeItem(FLAG);
    } catch { return; }
    setErfolg(true);
    const t = setTimeout(() => setErfolg(false), 4000);
    return () => clearTimeout(t);
  }, []);

  function aktualisieren() {
    try { localStorage.setItem(FLAG, "1"); } catch { /* ohne Flag nur keine Erfolgsmeldung */ }
    setLaeuft(true);
    updateServiceWorker(true);
    // iPad/iPhone-Web-Apps laden nach dem Wechsel manchmal nicht selbst neu
    setTimeout(() => window.location.reload(), 1500);
  }

  const boxStil = {
    position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 10000,
    background: "var(--karte)", border: "1.5px solid var(--haupt)", borderRadius: 12,
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: "12px 14px",
    display: "flex", alignItems: "center", gap: 10, fontFamily: "system-ui,sans-serif",
  };
  const textStil = { flex: 1, fontSize: "0.88rem", color: "var(--text-stark)" };

  if (erfolg) {
    return (
      <div style={boxStil} onClick={() => setErfolg(false)}>
        <span style={{ ...textStil, color: "var(--haupt)", fontWeight: 600 }}>✓ App wurde aktualisiert</span>
      </div>
    );
  }

  if (!neueVersion) return null;

  return (
    <div style={boxStil}>
      <span style={textStil}>{laeuft ? "Wird aktualisiert…" : "Neue Version verfügbar"}</span>
      {!laeuft && (<>
        <button onClick={() => setNeueVersion(false)} style={{
          background: "transparent", border: "1.5px solid var(--haupt)", color: "var(--haupt)",
          borderRadius: 10, padding: "6px 12px", fontSize: "0.8rem", fontFamily: "inherit", cursor: "pointer",
        }}>Später</button>
        <button onClick={aktualisieren} style={{
          background: "var(--haupt)", border: "1.5px solid var(--haupt)", color: "var(--auf-haupt)", fontWeight: 600,
          borderRadius: 10, padding: "6px 12px", fontSize: "0.8rem", fontFamily: "inherit", cursor: "pointer",
        }}>Aktualisieren</button>
      </>)}
    </div>
  );
}
