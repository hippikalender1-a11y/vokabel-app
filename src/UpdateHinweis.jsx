import { useRegisterSW } from "virtual:pwa-register/react";

// Banner unten: erscheint, wenn eine neue App-Version geladen wurde
export default function UpdateHinweis() {
  const { needRefresh: [neueVersion, setNeueVersion], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Bei lange geöffneter App stündlich nach Updates schauen
      if (reg) setInterval(() => { if (navigator.onLine) reg.update(); }, 60 * 60 * 1000);
    },
  });

  if (!neueVersion) return null;

  return (
    <div style={{
      position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 10000,
      background: "#fff", border: "1.5px solid #2d6a4f", borderRadius: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 10, fontFamily: "system-ui,sans-serif",
    }}>
      <span style={{ flex: 1, fontSize: "0.88rem", color: "#1a1a1a" }}>Neue Version verfügbar</span>
      <button onClick={() => setNeueVersion(false)} style={{
        background: "transparent", border: "1.5px solid #2d6a4f", color: "#2d6a4f",
        borderRadius: 10, padding: "6px 12px", fontSize: "0.8rem", fontFamily: "inherit", cursor: "pointer",
      }}>Später</button>
      <button onClick={() => updateServiceWorker(true)} style={{
        background: "#2d6a4f", border: "1.5px solid #2d6a4f", color: "#fff", fontWeight: 600,
        borderRadius: 10, padding: "6px 12px", fontSize: "0.8rem", fontFamily: "inherit", cursor: "pointer",
      }}>Aktualisieren</button>
    </div>
  );
}
