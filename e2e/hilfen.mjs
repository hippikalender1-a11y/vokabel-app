// Gemeinsame Test-Hilfen
// Listen liegen unter Einstellungen › Listen (kein eigener Tab mehr)
export async function zuListen(page) {
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const k = document.querySelector('[data-einst-kopf="listen"]'); if (k && k.dataset.offen !== "ja") k.click(); });
  await new Promise(r => setTimeout(r, 300));
}
// Quiz-Tab: Ist die Session-Auswahl offen, Kopf antippen → Einstellungen (Listen-Auswahl usw.) sichtbar
export async function quizEinstellungen(page) {
  await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 300));
}
// „＋ Neue Session aus Listen“ → „Eine Session“ (ersetzt den früheren „Neu“-Chip)
export async function neueEineSession(page) {
  await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="einstellungen"]')) document.querySelector("[data-slot-kopf-name]")?.click(); });
  await new Promise(r => setTimeout(r, 300));
  await page.click("[data-neue-session]"); await new Promise(r => setTimeout(r, 300));
  await page.click('[data-neue-session-art="eine"]'); await new Promise(r => setTimeout(r, 400));
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
// Antwort-Arten: Mehrfach-Auswahl (alle Spalten) mit der Art des Knopfs (data-modus-knopf="typ:art"):
// lang drücken auf die Art, dann eine schon gewählte Art derselben Spalte antippen (die bleibt gewählt) – die gedrückte kommt dazu
export async function artenMehrfach(page, knopf) {
  const [typ] = knopf.split(":");
  await page.evaluate(s => { const el = document.querySelector(`[data-modus-knopf="${s}"]`); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }, knopf);
  await new Promise(r => setTimeout(r, 250));
  await page.evaluate((s, t) => { const b = [...document.querySelectorAll(`[data-modus-knopf^="${t}:"].aktiv`)].find(x => x.dataset.modusKnopf !== s && !x.dataset.modusKnopf.endsWith(":akzent")); b?.click(); }, knopf, typ);
  await new Promise(r => setTimeout(r, 250));
}
// Rolle „Antwort“ dazunehmen (Spalte nach Namen): in der Mehrfach-Auswahl antippen, sonst lang drücken und eine schon gewählte Antwort antippen
export async function antwortDazu(page, name) {
  const art = await page.evaluate(n => {
    const z = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n) && d.querySelector(".checkbox"));
    const b = z?.querySelector("[data-rolle-antwort]");
    if (!b) return null;
    if (b.classList.contains("mehrfach")) { b.click(); return "tippen"; }
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 }));
    return b.dataset.rolleAntwort;
  }, name);
  if (!art) throw new Error(`Antwort-Knopf fehlt: ${name}`);
  await new Promise(r => setTimeout(r, 250));
  if (art !== "tippen") { await page.evaluate(t => [...document.querySelectorAll(".spalten-rolle-btn.antwort[data-rolle-antwort]")].find(b => b.dataset.rolleAntwort !== t)?.click(), art); await new Promise(r => setTimeout(r, 250)); }
}
// Gespeicherte Session laden: Quiz-Tab, Session-Kopf auf, Kachel/Chip antippen, ggf. mit dem grünen Kopf-Knopf bestätigen
export async function sessionLaden(page, name) {
  const s = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await s(300);
  await quizEinstellungen(page);
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv")?.click(); }); await s(300);
  await page.evaluate(n => [...document.querySelectorAll(".slot-chip, [data-slot-id]")].find(e => e.textContent.includes(n))?.click(), name); await s(400);
  if (await page.$("[data-slot-laden]")) { await page.evaluate(() => document.querySelector("[data-slot-laden]").click()); await s(500); }
}
// Session-Auswahl: angetippte Session mit dem grünen Kopf-Knopf („✓ … laden“) laden
export async function slotLaden(page) {
  if (await page.$("[data-slot-laden]")) { await page.evaluate(() => document.querySelector("[data-slot-laden]").click()); await new Promise(r => setTimeout(r, 600)); }
}
