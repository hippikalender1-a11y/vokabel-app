import { useState, useEffect, useRef } from "react";
import { LESBAR_SOLL, fv, hexZuHsv, hexZuRgb, hsvZuHex, kontrast, kontrastText } from "./farben.js";


// Gelernt-Effekt: Sternenregen von der Antwort-Karte nach außen (8 Sterne, leicht versetzt)
export function GelerntSterne() {
  return (
    <span className="gelernt-sterne" data-gelernt-sterne aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="stern" style={{ "--w": `${i * 45 + (i % 2 ? 12 : -8)}deg`, "--r": `${i % 2 ? 150 : 120}px`, "--v": `${(i % 3) * 40}ms` }}>{i % 2 ? "✦" : "★"}</span>
      ))}
    </span>
  );
}
// Mini-Kreis im Raster: Lernfortschritt einer Abfrageart (Ü/D/A); aus = keine passenden Vokabeln
// groesse: Pixel; aufGruen: Farben für die grüne Kopfzeile
export function MiniKreis({ pct, buchstabe, aktiv, aus, groesse = 24, aufGruen = false }) {
  const r = 9, u = 2 * Math.PI * r;
  const f = aufGruen
    ? { fill: aktiv ? "var(--karte)" : "transparent", grund: "rgba(255,255,255,0.3)", ring: aktiv ? "var(--haupt-hell)" : "var(--haupt-zart)", text: aktiv ? "var(--haupt)" : "var(--auf-haupt)" }
    : { fill: aktiv ? "var(--haupt)" : "var(--karte)", grund: "var(--rahmen)", ring: aktiv ? "var(--haupt-zart)" : "var(--haupt-hell)", text: aktiv ? "var(--auf-haupt)" : "var(--haupt)" };
  // 100 % gelernt: Kreis komplett grün gefüllt (gewählte Art zusätzlich mit äußerem Ring)
  if (!aus && pct >= 99.999) return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" style={{display:"block"}}>
      <circle cx="12" cy="12" r="10.5" fill={fv("var(--haupt-hell)")} stroke={fv(aktiv ? (aufGruen ? "var(--auf-haupt)" : "var(--haupt)") : "var(--haupt-hell)")} strokeWidth={aktiv ? 2.5 : 0}/>
      <text x="12" y="12.5" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill={fv("var(--karte)")}>{buchstabe}</text>
    </svg>
  );
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" style={{display:"block", opacity: aus ? 0.35 : 1}}>
      <circle cx="12" cy="12" r={r} fill={fv(f.fill)} stroke={fv(f.grund)} strokeWidth="3"/>
      {!aus && pct > 0 && <circle cx="12" cy="12" r={r} fill="none" stroke={fv(f.ring)} strokeWidth="3"
        strokeDasharray={`${u * Math.min(100, pct) / 100} ${u}`} transform="rotate(-90 12 12)" strokeLinecap={pct >= 100 ? "butt" : "round"}/>}
      <text x="12" y="12.5" textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill={fv(f.text)}>{buchstabe}</text>
    </svg>
  );
}
// oben: Leiste am oberen Rand (Element liegt unten), sonst am unteren Rand – das Element bleibt sichtbar
// 265: flaeche = { teile: [{ rolle, label, beispiel }], werte: { rolle: hex }, aktiv, bg (Rolle des Hintergrunds), akzente: [[hex, label]],
// beiWahl(rolle), beiZurueck(), kannZurueck(), beiVorlage() } – Vorschau der Fläche mit allen Schriften, Auswahl, was eingestellt wird
// paar = { bg, schrift, teil: "bg" | "schrift" } – nur dieses Element: Schrift und Hintergrund des Elements als Vorschau
export function FarbRad({ titel, start, verlauf, schema = [], beiLive, beiAnwenden, beiAbbrechen, oben = false, flaeche = null, paar = null }) {
  const [hsv, setHsv] = useState(() => hexZuHsv(start));
  const [klein, setKlein] = useState(false);   // 265 F: auf die Vorschau eingeklappt – Blick auf die ganze Seite
  const [frage, setFrage] = useState(null);    // 265 A: Rückfrage beim Anwenden (schlechter lesbar geworden)
  const [hexText, setHexText] = useState(start);
  const canvasRef = useRef(null);
  const groesse = Math.max(130, Math.min(170, ((typeof window !== "undefined" ? window.innerWidth : 360) - 40) * 0.46));
  const hex = hsvZuHex(hsv.h, hsv.s, hsv.v);
  // Kreis einmal zeichnen (volle Helligkeit; Helligkeit regelt der Schieber)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, n = Math.round(groesse * dpr);
    c.width = n; c.height = n;
    const ctx = c.getContext("2d"), bild = ctx.createImageData(n, n), r = n / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - r, dy = y - r, dist = Math.hypot(dx, dy), i = (y * n + x) * 4;
      if (dist > r) { bild.data[i + 3] = 0; continue; }
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      const [rr, gg, bb] = hexZuRgb(hsvZuHex(h, dist / r, 1));
      bild.data[i] = rr; bild.data[i + 1] = gg; bild.data[i + 2] = bb; bild.data[i + 3] = 255;
    }
    ctx.putImageData(bild, 0, 0);
  }, [groesse]);
  const setze = (neu, live = true) => { setHsv(neu); const h = hsvZuHex(neu.h, neu.s, neu.v); setHexText(h); if (live) beiLive(h); };
  const greife = e => {
    const rect = canvasRef.current.getBoundingClientRect(), r = rect.width / 2;
    const dx = e.clientX - rect.left - r, dy = e.clientY - rect.top - r;
    setze({ ...hsv, h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(dx, dy) / r) });
  };
  const winkel = hsv.h * Math.PI / 180, mx = groesse / 2 + Math.cos(winkel) * hsv.s * groesse / 2, my = groesse / 2 + Math.sin(winkel) * hsv.s * groesse / 2;
  const regler = (name, attr, wert, aendern, verlaufCss, max = 100) => (
    <div style={{marginBottom:4}}>
      <div style={{fontSize:"0.68rem", color:"var(--text2)", marginBottom:1}}>{name}</div>
      <input type="range" min={0} max={max} value={Math.round(wert * max)} {...{ [attr]: true }}
        onChange={e => aendern(e.target.value / max)}
        style={{width:"100%", height:20, accentColor:hex, background:verlaufCss, borderRadius:10, WebkitAppearance:"none", appearance:"none", display:"block"}}/>
    </div>
  );
  // Werte der Vorschau: gespeicherter Arbeitsstand, die gerade bearbeitete Rolle live
  const wert = r => flaeche ? (r === flaeche.aktiv ? hex : flaeche.werte[r]) : null;
  // 265 A: Lesbarkeit je Schrift (jetzt und beim Öffnen) – Ampel in der Vorschau, Rückfrage nur, wenn kräftig/normal durch
  // die Änderung unter die Schwelle fällt bzw. dort schlechter wird
  const zeilen = flaeche ? flaeche.teile.filter(t => t.rolle !== flaeche.bg).map(t => ({ ...t, stufe: t.stufe || "normal",
      k: kontrast(wert(t.rolle), wert(flaeche.bg)), k0: flaeche.werte0 ? kontrast(flaeche.werte0[t.rolle], flaeche.werte0[flaeche.bg]) : 99 }))
    : paar ? [{ rolle: "paar", label: "Schrift", stufe: "normal", k: kontrast(paar.teil === "schrift" ? hex : paar.schrift, paar.teil === "bg" ? hex : paar.bg), k0: kontrast(paar.schrift, paar.bg) }] : [];
  const ampel = z => { const gut = z.k >= LESBAR_SOLL[z.stufe]; return <span className={`fv-ampel${gut ? " ok" : " warn"}`} data-lesbar={gut ? "ok" : "warn"} title={`Kontrast ${kontrastText(z.k)}${gut ? "" : ` – empfohlen ab ${kontrastText(LESBAR_SOLL[z.stufe])}`}`}>{gut ? "✓" : "⚠"} {z.k.toFixed(1).replace(".", ",")}</span>; };
  const schlechter = zeilen.filter(z => (z.stufe === "kraeftig" || z.stufe === "normal") && z.k < LESBAR_SOLL[z.stufe] && z.k < z.k0 - 0.05);
  const anwenden = () => { if (schlechter.length && !frage) { setFrage(schlechter); setKlein(false); return; } beiAnwenden(hex); };
  const vorschau = flaeche ? (
    <div className="fv-karte" data-flaeche-vorschau style={{background: wert(flaeche.bg)}}>
      {zeilen.map(t => (
        <div key={t.rolle} className="fv-zeile">
          <button className={`fv-probe fv-${t.stufe}${t.rolle === flaeche.aktiv ? " aktiv" : ""}`} data-flaeche-probe={t.rolle}
            style={{color: wert(t.rolle)}} onClick={() => t.rolle !== flaeche.aktiv && flaeche.beiWahl(t.rolle)}>{t.beispiel}</button>
          {ampel(t)}
        </div>
      ))}
      {flaeche.akzente?.length > 0 && <div className="fv-akzente" data-flaeche-akzente>{flaeche.akzente.map(([f, l]) => <span key={l} style={{color: f}}>{l}{kontrast(f, wert(flaeche.bg)) < 3 ? " ⚠" : ""}</span>)}</div>}
    </div>
  ) : paar ? (
    <div className="fv-karte" data-paar-vorschau style={{background: paar.teil === "bg" ? hex : paar.bg}}>
      <div className="fv-zeile"><span className="fv-probe fv-normal" style={{color: paar.teil === "schrift" ? hex : paar.schrift}}>Schrift auf diesem Hintergrund</span>{ampel(zeilen[0])}</div>
    </div>
  ) : null;
  return (
    <div className={`farbrad-rahmen${oben ? " oben" : ""}`} data-farbmodus-ui>
      <div className="farbrad" data-farbrad data-farbrad-seite={oben ? "oben" : "unten"} data-farbrad-klein={klein ? "" : undefined} onClick={e => e.stopPropagation()}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8}}>
          <span style={{flex:1, minWidth:0, fontWeight:800, color:"var(--text)", fontSize:"0.85rem", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{titel}</span>
          <span title="vorher" style={{width:28, height:22, borderRadius:6, background:start, border:"1px solid var(--rahmen)", flexShrink:0}}/>
          <span style={{color:"var(--text3)", fontSize:"0.8rem"}}>→</span>
          <span title="neu" data-farbrad-neu style={{width:28, height:22, borderRadius:6, background:hex, border:"1px solid var(--rahmen)", flexShrink:0}}/>
          {flaeche && <button className="btn-icon fv-knopf" data-farbrad-zurueck disabled={!flaeche.kannZurueck()} onClick={flaeche.beiZurueck} title="Rückgängig">↶</button>}
          {vorschau && <button className="btn-icon fv-knopf" data-farbrad-klein-knopf onClick={() => setKlein(k => !k)} title={klein ? "Farbwähler wieder aufklappen" : "Einklappen – ganze Seite ansehen"}>{klein ? (oben ? "▾" : "▴") : (oben ? "▴" : "▾")}</button>}
        </div>
        {vorschau}
        {flaeche && !klein && (
          <div className="fv-teile" data-flaeche-teile>
            {flaeche.teile.map(t => <button key={t.rolle} className={`typ-btn${t.rolle === flaeche.aktiv ? " aktiv" : ""}`} data-flaeche-teil={t.rolle}
              onClick={() => t.rolle !== flaeche.aktiv && flaeche.beiWahl(t.rolle)}>{t.label}</button>)}
            {flaeche.beiVorlage && <button className="typ-btn" data-flaeche-vorlage onClick={flaeche.beiVorlage} title="Hintergrund und Schriften dieser Fläche wie in der Vorlage">↺ Vorlage</button>}
          </div>
        )}
        {!klein && <>
        <div style={{display:"flex", gap:12, alignItems:"flex-start"}}>
          <div style={{position:"relative", width:groesse, height:groesse, flexShrink:0, touchAction:"none"}}>
            <canvas ref={canvasRef} data-farbrad-kreis style={{width:groesse, height:groesse, display:"block", borderRadius:"50%", filter:`brightness(${Math.max(0.15, hsv.v)})`, cursor:"crosshair"}}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); greife(e); }}
              onPointerMove={e => { if (e.buttons || e.pointerType === "touch") greife(e); }}/>
            <span style={{position:"absolute", left:mx - 10, top:my - 10, width:20, height:20, borderRadius:"50%", border:"3px solid #fff", boxShadow:"0 0 0 1.5px rgba(0,0,0,0.6)", background:hex, pointerEvents:"none"}}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            {regler("Farbton", "data-farbrad-ton", hsv.h / 360, v => setze({ ...hsv, h: v * 360 }),   // 259
              `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map(h => hsvZuHex(h, Math.max(0.35, hsv.s), Math.max(0.35, hsv.v))).join(", ")})`, 360)}
            {regler("Helligkeit", "data-farbrad-hell", hsv.v, v => setze({ ...hsv, v }), `linear-gradient(to right, #000, ${hsvZuHex(hsv.h, hsv.s, 1)})`)}
            {regler("Sättigung", "data-farbrad-saett", hsv.s, v => setze({ ...hsv, s: v }), `linear-gradient(to right, ${hsvZuHex(hsv.h, 0, hsv.v)}, ${hsvZuHex(hsv.h, 1, hsv.v)})`)}
            <input className="inp" data-farbrad-hex value={hexText} style={{width:"100%", padding:"4px 8px", fontFamily:"monospace", fontSize:"0.85rem", marginBottom:6}}
              onChange={e => { const t = e.target.value.trim(); setHexText(t); if (/^#?[0-9a-f]{6}$/i.test(t)) { const h = (t.startsWith("#") ? t : "#" + t).toLowerCase(); setHsv(hexZuHsv(h)); beiLive(h); } }}/>
            {[["Zuletzt verwendet", verlauf, "data-farbrad-verlauf"], ["In diesem Schema", schema, "data-farbrad-schema"]].map(([name, farben, attr]) => farben.length > 0 && (
              <div key={attr} style={{marginTop:4}}>
                <div style={{fontSize:"0.68rem", color:"var(--text2)", marginBottom:2}}>{name}</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:4}} {...{ [attr]: true }}>
                  {farben.map(f => <button key={f} title={f} onClick={() => { setHsv(hexZuHsv(f)); setHexText(f); beiLive(f); }}
                    style={{width:22, height:22, borderRadius:6, background:f, border: f === hex ? "2.5px solid var(--text)" : "1px solid var(--rahmen)", cursor:"pointer", padding:0}}/>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        </>}
        {frage && (
          <div className="fv-frage" data-lesbar-frage>
            <div>{frage.map(z => `„${z.label}“`).join(", ")} {frage.length > 1 ? "sind" : "ist"} damit schlecht lesbar ({frage.map(z => kontrastText(z.k)).join(", ")}). Trotzdem anwenden?</div>
            <div style={{display:"flex", gap:8, marginTop:8}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}} data-lesbar-zurueck onClick={() => setFrage(null)}>Zurück</button>
              <button className="btn btn-primary btn-sm" style={{flex:1}} data-lesbar-trotzdem onClick={() => beiAnwenden(hex)}>Trotzdem anwenden</button>
            </div>
          </div>
        )}
        {!frage && <div style={{display:"flex", gap:8, marginTop:10}}>
          <button className="btn btn-ghost" style={{flex:1, padding:"8px"}} data-farbrad-abbrechen onClick={beiAbbrechen}>Abbrechen</button>
          <button className="btn btn-primary" style={{flex:1, padding:"8px"}} data-farbrad-anwenden onClick={anwenden}>Anwenden</button>
        </div>}
      </div>
    </div>
  );
}

export const IcoUp    = ({s=12}) => <svg viewBox="0 0 12 8" width={s} height={s*.67} style={{display:"block"}}><polygon points="6,0 12,8 0,8" fill="currentColor"/></svg>;
export const IcoDown  = ({s=12}) => <svg viewBox="0 0 12 8" width={s} height={s*.67} style={{display:"block"}}><polygon points="0,0 12,0 6,8" fill="currentColor"/></svg>;
export const IcoBack  = ({s=20}) => <svg viewBox="0 0 20 20" width={s} height={s} style={{display:"block"}}><path d="M13,2 L3,10 L13,18 L13,13 L17,13 L17,7 L13,7 Z" fill="currentColor"/></svg>;
export const IcoX     = ({s=14}) => <svg viewBox="0 0 14 14" width={s} height={s} style={{display:"block"}}><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
export const IcoPencil= ({s=15}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polygon points="13,0 16,3 5,14 2,11" fill="currentColor"/><polygon points="2,11 5,14 0,16" fill="currentColor"/></svg>;
export const IcoSpk   = ({s=18}) => <svg viewBox="0 0 20 20" width={s} height={s} style={{display:"block"}}><polygon points="2,7 2,13 6,13 12,18 12,2 6,7" fill="currentColor"/></svg>;
export const IcoSpkOn = ({s=20}) => <svg viewBox="0 0 26 20" width={s} height={s*.77} style={{display:"block"}}><polygon points="2,7 2,13 6,13 12,18 12,2 6,7" fill="currentColor"/><path d="M15,7 Q17,10 15,13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18,4 Q22,10 18,16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
export const IcoPlus  = ({s=15}) => <svg viewBox="0 0 14 14" width={s} height={s} style={{display:"block"}}><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
export const IcoCopy    = ({s=15}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><rect x="5" y="1" width="10" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="1" y="4" width="10" height="11" rx="2" fill={fv("var(--karte)")} stroke="currentColor" strokeWidth="2"/></svg>;
export const IcoExpand  = ({s=16}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polyline points="1,6 1,1 6,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="10,1 15,1 15,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="15" y1="1" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="1,10 1,15 6,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="15" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,10 15,15 10,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="15" y1="15" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
export const IcoCollapse= ({s=16}) => <svg viewBox="0 0 16 16" width={s} height={s} style={{display:"block"}}><polyline points="1,6 6,6 6,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="6" x2="0.5" y2="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,6 10,6 10,1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="6" x2="15.5" y2="0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="1,10 6,10 6,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="6" y1="10" x2="0.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="15,10 10,10 10,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="10" x2="15.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
