// Gemeinsame Test-Hilfen
// 225: Listen liegen im Quiz-Tab (Auswahl offen, Umschalter „Listen“) – Einstellungen › Listen gibt es nicht mehr
export async function zuListen(page) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  // eine offene Liste (Liste-Detail) bzw. der Import: über die Rückweg-Knöpfe verlassen
  await page.evaluate(() => { const b = document.querySelector("[data-zurueck-listen]"); if (b) b.click(); }); await s(200);
  const imQuiz = await page.evaluate(() => document.querySelector(".tab.aktiv")?.textContent.includes("Quiz") && !!document.querySelector("[data-slot-kopf]"));
  if (!imQuiz) { await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await s(300); }
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]")?.click(); }); await s(400);
  await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "listen") b.click(); }); await s(300);
}
// Quiz-Tab: Ist die Quiz-Auswahl offen, Kopf antippen → Einstellungen (Listen-Auswahl usw.) sichtbar
export async function quizEinstellungen(page) {
  await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 300));
}
// „＋ Neues Quiz aus Listen“ → „Ein Quiz“ (ersetzt den früheren „Neu“-Chip)
export async function neueEineSession(page) {
  await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="einstellungen"]')) document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 300));
  await neueSessionMenue(page);
  await page.click('[data-neue-session-art="eine"]'); await new Promise(r => setTimeout(r, 400));
}
// 160: „＋ Neues Quiz aus Listen“ über lang drücken auf „Alle Quiz“ (bzw. die Gruppe in der Pfad-Zeile)
export async function neueSessionMenue(page) {
  // 225: zeigt die Auswahl die Listen, erst auf „Quiz“ umschalten
  await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter === "listen") b.click(); });
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => { const el = document.querySelector('[data-ordner-navi]:not([data-ordner-navi="liste"]) [data-ordner-name]') || document.querySelector("[data-alle-sessions]"); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); });
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "＋ Neues Quiz aus Listen")?.click());
  await new Promise(r => setTimeout(r, 300));
}
// Listen-Auswahl zuklappen: solange sie offen ist (Fokus), sind die übrigen Quiz-Optionen ausgeblendet
export async function listenZu(page) {
  await page.evaluate(() => { if (document.querySelector(".quiz-setup-check")) document.querySelector(".liste-detail-header .zeile-rechts")?.click(); });
  await new Promise(r => setTimeout(r, 350));
}
// offenen Quiz-Bereich (Fokus) über seine Überschrift zuklappen – solange er offen ist, ist alles andere ausgeblendet
export async function bereichZu(page) {
  const zu = await page.evaluate(() => {
    const o = document.querySelector("[data-quiz-offen]")?.dataset.quizOffen;
    if (o === "einzel") { const b = document.querySelector("[data-vok-bestaetigen]"); b?.click(); return !!b; }
    const sel = { modus: "[data-abfragemodus]", reihenfolge: "[data-reihenfolge]", umfang: "[data-umfang]", ziel: "[data-abfrageziel]", listen: ".liste-detail-header .zeile-rechts" }[o];
    const k = sel && document.querySelector(sel); k?.click(); return !!k;
  });
  if (zu) await new Promise(r => setTimeout(r, 350));
  return zu;
}
// Einstellungen › Farben: Bereich öffnen und den Tab (Vorlagen | Eigene | Sprachen | Werkzeuge) zeigen, in dem sel liegt
export async function farbZeige(page, sel) {
  const warte = ms => new Promise(r => setTimeout(r, ms));
  if (await page.$(sel)) return true;
  if (!(await page.$("[data-farb-tabs]"))) {
    await page.evaluate(() => { const k = document.querySelector('[data-einst-kopf="farben"]'); if (k && k.dataset.offen !== "ja") k.click(); });
    await warte(300);
  }
  for (const t of [null, "vorlagen", "eigene", "sprachen", "werkzeuge"]) {
    if (t) { await page.evaluate(t => document.querySelector(`[data-farb-tab="${t}"]`)?.click(), t); await warte(250); }
    if (await page.$(sel)) return true;
  }
  return false;
}
// Quiz-Tab: Paketgröße wählen (Standard ist „Alle“ = ein Paket); danach den Umfang-Bereich wieder zuklappen
export async function paketGroesse(page, n) {
  const warte = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluate(() => document.querySelector("[data-umfang]")?.click()); await warte(250);
  await page.evaluate(n => document.querySelector(`[data-umfang-wahl="${n}"]`)?.click(), String(n)); await warte(300);
}
// Stufe (Zeile 1): aufklappen, wählen, zuklappen („Bestätigen“ = Stufen-Knopf nochmal)
export async function stufeAuf(page) {
  await page.evaluate(() => { if (!document.querySelector("[data-stufe-auswahl]")) document.querySelector("[data-stufe]")?.click(); });
  await new Promise(r => setTimeout(r, 250));
}
export async function stufeZu(page) {
  await page.evaluate(() => { if (document.querySelector("[data-stufe-auswahl]")) document.querySelector("[data-stufe]")?.click(); });
  await new Promise(r => setTimeout(r, 250));
}
export async function stufeWaehlen(page, k) {
  await stufeAuf(page);
  await page.evaluate(k => document.querySelector(`[data-stufe-wahl="${k}"]`)?.click(), k);
  await new Promise(r => setTimeout(r, 200));
  await stufeZu(page);
}
// Fenster aus der Stufe öffnen (regeln | lernen | vorlesen) – die Stufe klappt danach wieder zu
export async function stufeFenster(page, was) {
  await stufeAuf(page);
  await page.evaluate(w => document.querySelector(`[data-stufe-${w}]`)?.click(), was);
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => { if (document.querySelector("[data-stufe-auswahl]")) document.querySelector("[data-stufe]")?.click(); });
  await new Promise(r => setTimeout(r, 250));
}

// Modus-Fenster (offen): Richtung drehen – Frage = Fremdsprache (E1), Antwort = Deutsch (D1)
export async function fremdAlsFrage(page) {
  const rolle = (typ, art) => page.evaluate((typ, art) => {
    const b = [...document.querySelectorAll(".spalten-rolle-btn")].find(x => x.closest('div[style*="border-bottom"]')?.textContent.includes(typ) && x.textContent.trim().startsWith(art));
    b?.click(); return !!b;
  }, typ, art);
  await rolle("D1", "Frage"); await new Promise(r => setTimeout(r, 150));
  await rolle("E1", "Antwort"); await new Promise(r => setTimeout(r, 150));
  await rolle("E1", "Frage"); await new Promise(r => setTimeout(r, 150));
  await rolle("D1", "Antwort"); await new Promise(r => setTimeout(r, 200));
}
// Geöffnete Liste: Bereich (sprache | saetze | spalten | vokabeln) über die Knopfzeile aufklappen
export async function listeBereich(page, k) {
  await page.evaluate(k => { const b = document.querySelector(`[data-liste-bereich="${k}"]`); if (b && !b.classList.contains("offen")) b.click(); }, k);
  await new Promise(r => setTimeout(r, 300));
}
// Einstellungen: Bereich (listen | lernen | stimmen | raster | farben | app) öffnen und darin den Knopf der Knopfzeile (k) aufklappen
export async function einstUnter(page, bereich, k) {
  const warte = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluate(() => { const t = [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")); if (!t.classList.contains("aktiv") || !document.querySelector("[data-einst-bereiche]")) t.click(); });
  await warte(250);
  await page.evaluate(b => { const k = document.querySelector(`[data-einst-kopf="${b}"]`); if (k && k.dataset.offen !== "ja") k.click(); }, bereich);
  await warte(250);
  if (k) {
    await page.evaluate(k => { const b = document.querySelector(`[data-einst-unter="${k}"]`); if (b && !b.closest(".quiz-zeile-zelle").classList.contains("offen")) b.click(); }, k);
    await warte(250);
  }
}
// Antwort-Arten: Mehrfach-Auswahl (alle Spalten) mit der Art des Knopfs (data-modus-knopf="typ:art"): lang drücken wählt sie sofort aus
export async function artenMehrfach(page, knopf) {
  await page.evaluate(s => { const el = document.querySelector(`[data-modus-knopf="${s}"]`); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }, knopf);
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector("[data-info-blase]")?.click()); await new Promise(r => setTimeout(r, 150));   // Erklärung wieder zu
}
// Rolle „Antwort“ dazunehmen (Spalte nach Namen): lang drücken nimmt sie als weitere Antwort dazu (antippen hieße: einzige Antwort)
export async function antwortDazu(page, name) {
  const ok = await page.evaluate(n => {
    const z = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n) && d.querySelector(".checkbox"));
    const b = z?.querySelector("[data-rolle-antwort]");
    if (!b) return false;
    if (!b.classList.contains("antwort")) { const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }
    return true;
  }, name);
  if (!ok) throw new Error(`Antwort-Knopf fehlt: ${name}`);
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector("[data-info-blase]")?.click()); await new Promise(r => setTimeout(r, 150));
}
// Gespeicherte Quiz laden: Quiz-Tab, Quiz-Kopf auf, Kachel/Chip antippen, ggf. mit dem grünen Kopf-Knopf bestätigen
export async function sessionLaden(page, name) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await s(300);
  await quizEinstellungen(page);
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv")?.click(); }); await s(300);
  await page.evaluate(n => [...document.querySelectorAll(".slot-chip, [data-slot-id]")].find(e => e.textContent.includes(n))?.click(), name); await s(400);
  if (await page.$("[data-slot-laden]")) { await page.evaluate(() => document.querySelector("[data-slot-laden]").click()); await s(500); }
}
// Quiz-Auswahl: angetippte Quiz mit dem grünen Kopf-Knopf („✓ … laden“) laden
export async function slotLaden(page) {
  if (await page.$("[data-slot-laden]")) { await page.evaluate(() => document.querySelector("[data-slot-laden]").click()); await new Promise(r => setTimeout(r, 600)); }
}
// Einstellungen › Listen: angetippte Liste mit dem grünen Knopf („‹Name› öffnen“) öffnen
// 225: Antippen einer Liste fragt sie ab (Kopf zeigt die Liste) – geöffnet wird sie über das Kopf-Menü „📂 Liste öffnen“
export async function listeOeffnen(page) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  if (await page.$("[data-liste-oeffnen]")) { await page.evaluate(() => document.querySelector("[data-liste-oeffnen]").click()); await s(500); return; }
  if (await page.$("[data-listen-zeile]")) return;   // schon offen
  await s(450);   // Auswahl klappt nach dem Laden kurz verzögert zu
  await page.evaluate(() => { const el = document.querySelector('[data-slot-kopf-name][data-kopf-art="liste"]') || document.querySelector("[data-slot-kopf-name]"); if (!el) return;
    const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); });
  await s(300);
  await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "📂 Liste öffnen")?.click());
  await s(500);
}
// 192: Kachel kurz halten (Maus ≥ ¼ s ohne Bewegung) – wählt nur aus (Blätter-Modus), statt sofort zu übernehmen
export async function kurzHalten(page, sel) {
  const p = await page.evaluate(s => { const el = typeof s === "string" ? document.querySelector(s) : null; if (!el) return null;
    el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  if (!p) throw new Error(`kurzHalten: nicht gefunden ${sel}`);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await new Promise(r => setTimeout(r, 400)); await page.mouse.up();
  await new Promise(r => setTimeout(r, 350));
}
// 190: nach „Zur Übersicht“ ist die Quiz-Auswahl offen – zuklappen (Einstellungen mit Start sichtbar)
export async function auswahlZu(page) {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 400));
}
// 199: „＋ Neue Liste“ – über den Lang-Druck auf „Alle Listen“ (der breite Knopf entfällt)
export async function neueListe(page) {
  await page.evaluate(() => { const el = document.querySelector("[data-alle-listen]"); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "＋ Neue Liste")?.click());
  await new Promise(r => setTimeout(r, 300));
}

// 225: eine Liste über das Menü ihrer Kachel öffnen (antippen fragt sie ab)
export async function listeKachelOeffnen(page, id) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluate(i => { const el = document.querySelector(`[data-liste-id="${i}"]`); if (!el) return; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, id);
  await s(350);
  await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "📂 Liste öffnen")?.click());
  await s(500);
}

// 235: Menüs sind gruppiert („Name ›“ öffnet die Unterpunkte). Für Tests, die Menüpunkte direkt suchen:
// __aktionen() liefert die sichtbaren Knöpfe und dahinter die Punkte aller Gruppen; click() auf einen Gruppenpunkt
// öffnet erst die Gruppe und tippt dann den Punkt an (async – page.evaluate wartet darauf). Einbinden vor page.goto:
// await page.evaluateOnNewDocument(menueShim);   (das echte Öffnen der Gruppen prüft punkte235)
export function menueShim() {
  window.__aktionen = () => {
    const direkt = [...document.querySelectorAll("[data-info-aktion]")];
    const mehr = [];
    for (const g of document.querySelectorAll("[data-info-gruppe]")) for (const l of g.dataset.infoGruppe.split("|")) mehr.push({
      dataset: { infoAktion: l }, textContent: l, disabled: false, hasAttribute: () => false, getAttribute: () => null,
      click: async () => { g.click(); await new Promise(r => setTimeout(r, 60)); [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(); },
    });
    return [...direkt, ...mehr];
  };
  window.__aktion = l => window.__aktionen().find(b => b.dataset.infoAktion === l) || null;
  // 270: Text eines Elements, eigene Zeichen (svg[data-sym]) als Emoji gelesen – z. B. „+ 🔁 2“
  const SYM = { wiederholung: "🔁" };
  window.__txt = el => { if (!el) return el; const c = el.cloneNode(true); c.querySelectorAll("svg[data-sym]").forEach(s => s.replaceWith(SYM[s.dataset.sym] || "")); return c.textContent; };
}

// 241: „✕ Auswahl beenden“ gibt es nicht mehr – die Auswahl endet beim Wechsel Quiz/Listen; für Tests: hin und zurück
export async function auswahlEnde(page) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 2; i++) { await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]")?.click()); await s(250); }
}

// 289: Liste fürs Quiz wählen – früher Häkchen in der Listen-Auswahl des Quiz-Tabs (.quiz-setup-check); ist nichts geladen,
// steht jetzt die Auswahl mit den Listen offen: Liste antippen lädt sie. Die alte Häkchen-Liste gibt es noch beim „Listen ändern“.
export async function listeWaehlen(page, name) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  const alt = await page.evaluate(n => { const e = [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes(n)); if (e) e.click(); return !!e; }, name);
  if (alt) return;
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]")?.click(); }); await s(400);
  await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "listen") b.click(); }); await s(300);
  const da = await page.evaluate(n => { const e = [...document.querySelectorAll('[data-kachel-geste="liste"][data-liste-id]')].find(e => e.textContent.includes(n)); e?.click(); return !!e; }, name);
  if (!da) throw new Error("Liste nicht gefunden: " + name);
  await s(900);
}
