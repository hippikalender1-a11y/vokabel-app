import { F, FARB_VORLAGEN, elementName, elementSchluessel, farbeZuHex, farbenAus, mitFestenSchriften, schemaVon, zufallsFarben } from "../farben.js";
import { SK, TYPEN, lsSet } from "../speicher.js";
import { hinweiseAus, ohneHinweis } from "../quiz.jsx";

// Stufe 2 (Aufteilung): Logik aus App.jsx. app = die Namen der Komponente, die eine Funktion braucht
// (die Hülle in App.jsx baut das Objekt beim Aufruf).

export function dupliziereSchema(app, sch) {
  const { eigeneSchemata, einstellungen, schemaName, setSchemaBearbeiten, speichereEinst } = app;
    const neu = { id: "eigen_" + Date.now(), name: schemaName(sch.name), basis: sch.basis || sch.id, dunkel: !!sch.dunkel, farben: { ...sch.farben }, elemente: { ...(sch.elemente || {}) } };
    speichereEinst({ ...einstellungen, eigeneSchemata: [...eigeneSchemata, neu], farbschema: neu.id });
    setSchemaBearbeiten(neu.id);
  }

// 🎲 Zufällige Farben: ersetzt das Schema „Zufall“ (umbenannte oder duplizierte bleiben erhalten)
export function zufallsSchema(app) {
  const { eigeneSchemata, einstellungen, schemaBearbeiten, setSchemaBearbeiten, speichereEinst } = app;
    const farben = zufallsFarben();
    const alt = eigeneSchemata.find(x => x.zufall && x.name === "Zufall");
    const sch = alt ? { ...alt, farben, elemente: {} } : { id: "zufall_" + Date.now(), name: "Zufall", basis: "natur", dunkel: false, zufall: true, farben, elemente: {} };
    speichereEinst({ ...einstellungen, farbschema: sch.id,
      eigeneSchemata: alt ? eigeneSchemata.map(x => x.id === alt.id ? sch : x) : [...eigeneSchemata, sch] });
    if (schemaBearbeiten && schemaBearbeiten !== sch.id) setSchemaBearbeiten(null);
  }

export function aendereEigenesSchema(app, id, aenderung) {
  const { eigeneSchemata, einstellungen, speichereEinst } = app;
    speichereEinst({ ...einstellungen, eigeneSchemata: eigeneSchemata.map(x => x.id === id ? { ...x, ...aenderung(x) } : x) });
  }

export function loescheSchema(app, id) {
  const { eigeneSchemata, einstellungen, schemaBearbeiten, setModal, setSchemaBearbeiten, setSchemaMenueId, speichereEinst } = app;
    speichereEinst({ ...einstellungen, eigeneSchemata: eigeneSchemata.filter(x => x.id !== id), farbschema: einstellungen.farbschema === id ? "natur" : einstellungen.farbschema });
    if (schemaBearbeiten === id) setSchemaBearbeiten(null);
    setModal(null); setSchemaMenueId(null);
  }

// ── Aufräum-Werkzeug: Klammerhinweise der Wort-Spalten in eine Info-Spalte verschieben ──
export function klammerAenderungen(app, liste, ziel) {
  const {  } = app;
    const quellen = TYPEN.filter(t => !t.startsWith("i") && liste.spalten[t]?.aktiv);
    return liste.vokabeln.map(v => {
      const hinweise = quellen.flatMap(t => hinweiseAus(v[t]?.wert));
      if (!hinweise.length) return null;
      const neu = { ...v };
      quellen.forEach(t => { if (v[t]?.wert && hinweiseAus(v[t].wert).length) neu[t] = { ...v[t], wert: ohneHinweis(v[t].wert) }; });
      const alt = v[ziel]?.wert?.trim();
      neu[ziel] = { wert: [alt, ...hinweise].filter(Boolean).join("; "), falsch: v[ziel]?.falsch || [] };
      return { vorher: v, nachher: neu, hinweise };
    }).filter(Boolean);
  }

export function verschiebeKlammern(app) {
  const { aktiveListe, klammerAenderungen, klammerZiel, listenIndex, setAktiveListe, setModal, speichereIndex } = app;
    const aenderungen = klammerAenderungen(aktiveListe, klammerZiel);
    const neuMap = new Map(aenderungen.map(a => [a.vorher.id, a.nachher]));
    const sp = aktiveListe.spalten[klammerZiel];
    const neu = { ...aktiveListe, vokabeln: aktiveListe.vokabeln.map(v => neuMap.get(v.id) || v),
      spalten: { ...aktiveListe.spalten, [klammerZiel]: { ...sp, aktiv: true, name: sp?.name || "Hinweis" } } };
    lsSet(SK.liste(aktiveListe.id), neu); setAktiveListe(neu); speichereIndex(listenIndex);
    setModal(null);
  }

// ── Farbwähler (Farbkreis): live über CSS-Variablen, ohne die App neu aufzubauen ──
export function oeffneFarbRad(app, rolle, titel, basis, ziel, el = null) {
  const { setFarbRad, vollHex } = app;
    const r = el?.getBoundingClientRect();
    setFarbRad({ rolle, titel, start: vollHex(basis[rolle] || farbenAus(basis)[rolle] || "#000000").toLowerCase(), basis, ziel,
      rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
      oben: !!r && r.top + r.height / 2 > window.innerHeight / 2 });
  }

// nur diese Element-Art: eigene Regel statt der Rolle
export function oeffneElementFarbRad(app, schluessel, eigenschaft, titel, el) {
  const { elementVorschau, setFarbRad, vollHex } = app;
    const r = el?.getBoundingClientRect();
    const cs = el ? getComputedStyle(el) : null;
    const jetzt = elementVorschau?.[schluessel]?.[eigenschaft] || (cs && farbeZuHex(cs.getPropertyValue(eigenschaft))) || "#000000";
    setFarbRad({ rolle: `${schluessel}|${eigenschaft}`, titel, start: vollHex(jetzt).toLowerCase(), element: { schluessel, eigenschaft },
      rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null, oben: !!r && r.top + r.height / 2 > window.innerHeight / 2 });
  }

export function farbRadAnwenden(app, hex) {
  const { eigeneSchemata, einstellungen, farbRad, liveEntfernen, setElementVorschau, setFarbRad, setFarbVorschau, speichereEinst } = app;
    const { rolle, ziel } = farbRad;
    const verlauf = [hex, ...(einstellungen.farbVerlauf || []).filter(x => x !== hex)].slice(0, 10);
    if (farbRad.element) {
      const { schluessel, eigenschaft } = farbRad.element;
      setElementVorschau(e => ({ ...(e || {}), [schluessel]: { ...(e?.[schluessel] || {}), [eigenschaft]: hex } }));
      speichereEinst({ ...einstellungen, farbVerlauf: verlauf });
      liveEntfernen(); setFarbRad(null); return;
    }
    if (ziel === "vorschau") { setFarbVorschau(f => mitFestenSchriften(f || farbRad.basis, rolle, hex)); speichereEinst({ ...einstellungen, farbVerlauf: verlauf }); }
    else speichereEinst({ ...einstellungen, farbVerlauf: verlauf,
      eigeneSchemata: eigeneSchemata.map(x => x.id === ziel ? { ...x, farben: mitFestenSchriften(x.farben, rolle, hex) } : x) });
    liveEntfernen(); setFarbRad(null);
  }

export function farbRadAbbrechen(app) {
  const { liveEntfernen, setFarbRad } = app; liveEntfernen(); setFarbRad(null); }

// ── Farbmodus ──
export function starteFarbModus(app) {
  const { einstellungen, setElementVorschau, setFarbModus, setFarbVorschau, setSchemaBearbeiten } = app;
    setFarbVorschau({ ...schemaVon(einstellungen).farben });
    setElementVorschau({ ...(schemaVon(einstellungen).elemente || {}) });
    setFarbModus(true); setSchemaBearbeiten(null);
  }

export function beendeFarbModus(app) {
  const { setElementVorschau, setFarbFeld, setFarbMarke, setFarbModus, setFarbName, setFarbVorschau } = app; setFarbModus(false); setFarbVorschau(null); setElementVorschau(null); setFarbFeld(null); setFarbMarke(null); setFarbName(null); }

// eigene Farbe einer Element-Art entfernen → wieder die Rolle
export function entferneElementFarbe(app, schluessel, eigenschaft) {
  const { setElementVorschau } = app;
    setElementVorschau(e => {
      const p = { ...(e?.[schluessel] || {}) }; delete p[eigenschaft];
      const n = { ...(e || {}) }; if (Object.keys(p).length) n[schluessel] = p; else delete n[schluessel];
      return n;
    });
  }

export function uebernehmeFarben(app, name = null) {
  const { aendereEigenesSchema, beendeFarbModus, eigeneSchemata, einstellungen, elementVorschau, farbVorschau, schemaName, setFarbFeld, setFarbName, speichereEinst } = app;
    const sch = schemaVon(einstellungen);
    if (FARB_VORLAGEN.includes(sch)) {
      if (name === null) { setFarbName(schemaName(sch.name)); setFarbFeld(null); return; }   // Vorlage: erst Namen für die Kopie
      const neu = { id: "eigen_" + Date.now(), name: name.trim() || schemaName(sch.name), basis: sch.id, dunkel: !!sch.dunkel, farben: { ...farbVorschau }, elemente: { ...(elementVorschau || {}) } };
      speichereEinst({ ...einstellungen, eigeneSchemata: [...eigeneSchemata, neu], farbschema: neu.id });
    } else {
      aendereEigenesSchema(sch.id, () => ({ farben: { ...farbVorschau }, elemente: { ...(elementVorschau || {}) } }));
    }
    beendeFarbModus();
  }

// Farbrollen der Elemente im Umkreis von (x, y): je Element Hintergrund, Schrift, Rahmen bzw. bei Grafik Füllung, Linie
export function farbRollenBei(app, x, y) {
  const { vollHex } = app;
    const zuHex = farbeZuHex;
    // gleiche Farbe in mehreren Rollen (z. B. Weiß = Karten und Schrift auf Hauptfarbe): je nach Teil die naheliegende Rolle
    const VORZUG = { Schrift: ["auf-haupt", "auf-start", "text-stark", "text", "text2", "text3", "haupt", "falsch", "richtig"],
      Hintergrund: ["karte", "hintergrund", "flaeche", "haupt", "falsch", "gelb"], Füllung: ["karte", "haupt", "haupt-hell", "gelernt", "arbeit", "nie", "negativ"],
      "Ring/Linie": ["haupt-hell", "rahmen", "haupt"], Linie: ["rahmen", "text3", "haupt"], Rahmen: ["rahmen", "haupt", "falsch"] };
    const nachWert = (h, teil) => { if (!h) return null; const alle = Object.keys(F).filter(k => vollHex(F[k]).toLowerCase() === h);
      return (VORZUG[teil] || []).find(k => alle.includes(k)) || alle[0]; };
    const regeln = [];
    for (const sh of document.styleSheets) { try { regeln.push(...[...sh.cssRules].filter(r => r.selectorText)); } catch { /* fremdes Stylesheet */ } }
    const deklariert = (el, props) => {
      const st = el.getAttribute?.("style") || "";
      for (const p of props) { const m = st.match(new RegExp(`(?:^|;)\\s*${p}\\s*:[^;]*var\\(--([\\w-]+)\\)`)); if (m) return m[1]; }
      let gef = null;
      regeln.forEach(r => { let passt = false; try { passt = el.matches(r.selectorText); } catch { /* */ }
        if (passt) props.forEach(p => { const m = r.style.getPropertyValue(p).match(/var\(--([\w-]+)\)/); if (m) gef = m[1]; }); });
      return gef;
    };
    const elemente = new Set();
    for (const [dx, dy] of [[0, 0], [-14, 0], [14, 0], [0, -14], [0, 14], [-10, -10], [10, 10], [-10, 10], [10, -10]])
      document.elementsFromPoint(x + dx, y + dy).forEach(el => { if (!el.closest("[data-farbmodus-ui]") && el !== document.documentElement) elemente.add(el); });
    // kleine Grafiken (Mini-Kreise …): alle Teile mitnehmen – dünne Ringe trifft der Finger sonst kaum
    [...elemente].forEach(el => { const svg = el instanceof SVGElement ? el.ownerSVGElement || el : null;
      if (svg && svg.getBoundingClientRect().width <= 60) svg.querySelectorAll("circle, path, rect, line, polyline, text").forEach(t => elemente.add(t)); });
    const name = el => {
      const eigenerText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").trim();
      const t = el.tagName.toLowerCase();
      const info = el.closest("[data-info]")?.getAttribute("data-info");
      if (t === "body") return "Seite";
      if (["circle", "path", "rect", "line", "polyline", "text"].includes(t)) return `Grafik${info ? " · " + info.split(/[–:]/)[0].trim() : ""}`;
      return (eigenerText || info || el.textContent.trim() || t).slice(0, 34);
    };
    const gruppen = [];
    [...elemente].map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height).forEach(({ el, r }) => {
      const cs = getComputedStyle(el), teile = [];
      const svg = el instanceof SVGElement && el.tagName.toLowerCase() !== "svg";
      // Schrift ohne eigene Regel: von außen geerbte Rolle (z. B. Text im Start-Knopf), wenn die Farbe passt
      const geerbt = h => { for (let pe = el.parentElement, i = 0; pe && i < 4; pe = pe.parentElement, i++) { const r = deklariert(pe, ["color"]); if (r) return F[r] !== undefined && vollHex(F[r]).toLowerCase() === h ? r : null; } return null; };
      const dazu = (teil, wert, props) => { const h = zuHex(wert); if (!h) return; const rolle = (props && deklariert(el, props)) || (teil === "Schrift" && geerbt(h)) || nachWert(h, teil); if (rolle && F[rolle] !== undefined && !teile.some(t => t.rolle === rolle && t.teil === teil)) teile.push({ teil, rolle }); };
      if (svg) {
        if (cs.fill && cs.fill !== "none") dazu(el.tagName.toLowerCase() === "text" ? "Schrift" : "Füllung", cs.fill);
        if (cs.stroke && cs.stroke !== "none") dazu(el.tagName.toLowerCase() === "line" || el.tagName.toLowerCase() === "path" && cs.fill === "none" ? "Linie" : "Ring/Linie", cs.stroke);
      } else {
        dazu("Hintergrund", cs.backgroundColor, ["background", "background-color"]);
        if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) dazu("Schrift", cs.color, ["color"]);
        const seite = ["Top", "Right", "Bottom", "Left"].find(sd => parseFloat(cs[`border${sd}Width`]) > 0 && cs[`border${sd}Style`] !== "none");
        if (seite) dazu("Rahmen", cs[`border${seite}Color`], ["border", "border-color", `border-${seite.toLowerCase()}`, `border-${seite.toLowerCase()}-color`]);
      }
      if (teile.length && gruppen.length < 7) gruppen.push({ name: name(el), titel: elementName(el), el, teile, schluessel: elementSchluessel(el) });
    });
    return gruppen;
  }
