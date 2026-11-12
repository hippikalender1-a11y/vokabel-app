import puppeteer from "puppeteer-core";
import { quizEinstellungen, listenZu, farbZeige } from "./hilfen.mjs";

// Element-Farben: im Farbfeld je Teil „Alle Stellen“ (Rolle) oder „Nur dieses Element“ (eigene Farbe der Element-Art,
// Rolle bleibt); gespeichert im Farbschema, im Schema-Editor sichtbar und entfernbar
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n)).click(), name); await sleep(400); };
const oeffneEinst = async key => { await page.evaluate(k => { const b = document.querySelector(`[data-einst-kopf="${k}"]`); if (b && b.dataset.offen !== "ja") b.click(); }, key); await sleep(250); };
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const bg = sel => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).backgroundColor, sel);
const rechtsklickAuf = async sel => {
  const p = await page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  await page.evaluate((x, y) => document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })), p.x, p.y);
  await sleep(300);
};
const farbradHex = async wert => {
  await page.evaluate(w => { const i = document.querySelector("[data-farbrad-hex]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, w); i.dispatchEvent(new Event("input", { bubbles: true })); }, wert);
  await sleep(200);
  await page.click("[data-farbrad-anwenden]"); await sleep(300);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 2, vokabeln: [{ id: 1, E1: { wert: "mot", falsch: [] }, D1: { wert: "Wort", falsch: [] } }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500);
await tab("Quiz"); await quizEinstellungen(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(c => c.textContent.includes("Unité 1")).click()); await sleep(400);
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
const haupt = await variable("haupt");
const neuBgVorher = await bg("[data-start-knopf]");

// Farbmodus über „🎨 Farbe ändern“ am Start-Knopf
await page.evaluate(() => { const el = document.querySelector("[data-start-knopf]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); }); await sleep(300);
await page.evaluate(() => document.querySelector("[data-info-farbe]").click()); await sleep(500);
const knoepfe = await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-element]")].map(b => b.dataset.farbfeldElement));
console.log("     Element-Knöpfe:", knoepfe.join(" | "));
ok(knoepfe.includes("[data-start-knopf]|background-color") && await page.$("[data-farbfeld-rolle]"), "Farbfeld: je Teil „Alle Stellen“ und „Nur dieses Element“");
await page.click('[data-farbfeld-element="[data-start-knopf]|background-color"]'); await sleep(300);
ok(await page.$("[data-farbrad]"), "„Nur dieses Element“ öffnet den Farbkreis");
await farbradHex("#123456");
ok(await bg("[data-start-knopf]") === "rgb(18, 52, 86)" && await variable("haupt") === haupt, "nur der Start-Knopf ist umgefärbt, die Hauptfarbe bleibt");
ok(await page.evaluate(() => { const b = [...document.querySelectorAll(".btn-primary")].find(x => !x.matches("[data-start-knopf]") && x.offsetParent); return !b || getComputedStyle(b).backgroundColor !== "rgb(18, 52, 86)"; }),
  "andere Knöpfe mit der Hauptfarbe bleiben unverändert");

// Farbfeld zeigt „eigene Farbe“ und „↺ Rolle“
await rechtsklickAuf("[data-start-knopf]");
ok(await page.$('[data-farbfeld-zurueck="[data-start-knopf]|background-color"]') && /eigene Farbe/.test(await page.evaluate(() => document.querySelector("[data-farbfeld]").innerText)),
  "Farbfeld: „eigene Farbe“ und „↺ Rolle“");
await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld] button")].find(b => b.textContent.trim() === "Schließen").click()); await sleep(200);

// übernehmen (Vorlage → Kopie mit Namen)
await page.click("[data-farbmodus-uebernehmen]"); await sleep(300);
await page.click("[data-farb-name-speichern]"); await sleep(400);
const e = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")));
const sch = e.eigeneSchemata?.find(x => x.id === e.farbschema);
ok(sch?.elemente?.["[data-start-knopf]"]?.["background-color"] === "#123456", "gespeichert im neuen Schema (elemente)");
await page.reload(); await sleep(500);
await tab("Quiz"); await quizEinstellungen(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(c => c.textContent.includes("Unité 1"))?.click()); await sleep(400);
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
ok(await bg("[data-start-knopf]") === "rgb(18, 52, 86)", "nach dem Neuladen weiterhin umgefärbt");

// Schema-Editor: Liste der Element-Farben, entfernen → wieder Rolle
await tab("Einstellungen"); await oeffneEinst("farben");
await farbZeige(page, "[data-farben-bearbeiten]"); await page.click("[data-farben-bearbeiten]"); await sleep(300);
ok(await page.$('[data-element-farbe="[data-start-knopf]|background-color"]'), "Schema-Editor: „Eigene Element-Farben“ mit dem Start-Knopf");
await page.evaluate(() => document.querySelector('[data-element-farbe="[data-start-knopf]|background-color"] button').click()); await sleep(300);
await tab("Quiz"); await quizEinstellungen(page);
ok(await bg("[data-start-knopf]") === neuBgVorher, "entfernt: Start-Knopf wieder in der Hauptfarbe");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
