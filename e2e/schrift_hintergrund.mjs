import puppeteer from "puppeteer-core";

// Eine Schrift gilt nur auf ihrem Hintergrund: „Schrift auf Hauptfarbe“ ändern lässt Schrift auf Falsch, Hervorhebung,
// Liste & Start usw. unverändert (sie werden beim Ändern mit ihrem bisherigen Wert festgeschrieben)
import { quizEinstellungen, listenZu, bereichZu } from "./hilfen.mjs";




const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));


const oeffneEinst = async key => { await page.evaluate(k => { const b = document.querySelector(`[data-einst-kopf="${k}"]`); if (b && b.dataset.offen !== "ja") b.click(); }, key); await new Promise(r => setTimeout(r, 250)); };
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  if (!done && await bereichZu(page)) return clickText(sel, text, exact);   // offener Bereich blendet den Rest aus
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const mitte = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const rechtsklick = async (x, y) => { await page.evaluate((x, y) => document.elementFromPoint(x, y).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })), x, y); await sleep(300); };
const feldZeilen = () => page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-zeile]")].map(z => z.innerText.trim().replace(/\s+/g, " ")));

const farbradHex = async (wert, anwenden = true) => {
  await page.evaluate(w => { const i = document.querySelector("[data-farbrad-hex]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, w); i.dispatchEvent(new Event("input", { bubbles: true })); }, wert);
  await new Promise(r => setTimeout(r, 200));
  if (anwenden) { await page.click("[data-farbrad-anwenden]"); await new Promise(r => setTimeout(r, 300)); }
};
const setzeFarbe = async (rolle, wert) => { await page.evaluate(r => document.querySelector(`[data-farbfeld-zeile="${r}"]`).click(), rolle); await sleep(300); await farbradHex(wert); };
const eigene = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}").eigeneSchemata || []);

await page.goto(URL);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 2, vokabeln: [{ id: 1, E1: { wert: "mot", falsch: [] }, D1: { wert: "Wort", falsch: [] } }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(500);
await page.click("[data-slot-kopf-name]"); await sleep(300);
await clickText(".quiz-setup-check", "Unité 1");
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
const schriften = ["auf-haupt", "auf-start", "auf-falsch", "auf-gelb", "auf-haupt-hell", "auf-gelernt"];
const werte = async () => Object.fromEntries(await Promise.all(schriften.map(async n => [n, await variable(n)])));
const vorher = await werte();
console.log("     vorher:", JSON.stringify(vorher));
ok(schriften.every(n => vorher[n]), "eigene Schrift-Rollen je farbigem Hintergrund vorhanden");
// Farbmodus: Schrift auf einem Haupt-Knopf (Umfang) über „Alle Stellen“ ändern
await clickText(".tab", "Einstellungen"); await oeffneEinst("app");
await page.evaluate(() => document.querySelector("[data-farbmodus-start]").click()); await sleep(300);
await clickText(".tab", "Quiz");
const p = await mitte("[data-umfang]");
await rechtsklick(p.x, p.y);
await setzeFarbe("auf-haupt", "#ff0000");
const nachher = await werte();
console.log("     nachher:", JSON.stringify(nachher));
ok(nachher["auf-haupt"] === "#ff0000", "Schrift auf Hauptfarbe geändert");
ok(schriften.filter(n => n !== "auf-haupt").every(n => nachher[n] === vorher[n]), "Schrift auf Liste & Start, Falsch, Hervorhebung, Hauptfarbe hell, Gelernt unverändert");
ok(await page.evaluate(() => getComputedStyle(document.querySelector("[data-start-knopf] b")).color) !== "rgb(255, 0, 0)", "Start-Knopf-Schrift bleibt");
// übernehmen: festgeschriebene Werte im Schema
if (await page.$("[data-farbfeld]")) await clickText("[data-farbfeld] button", "Schließen", true);
await page.click("[data-farbmodus-uebernehmen]"); await sleep(300);
await page.click("[data-farb-name-speichern]"); await sleep(400);
const sch = (await eigene())[0]?.farben || {};
ok(sch["auf-haupt"] === "#ff0000" && sch["auf-falsch"] === vorher["auf-falsch"] && sch["auf-start"] === vorher["auf-start"], "gespeichert: neue Schrift und die übrigen mit ihrem bisherigen Wert");
await page.reload(); await sleep(500);
const geladen = await werte();
ok(geladen["auf-haupt"] === "#ff0000" && schriften.filter(n => n !== "auf-haupt").every(n => geladen[n] === vorher[n]), "nach dem Neuladen gleich");

// Kopfzeilen: eigene Schrift – weiß auf den Einstellungs-Köpfen, der Inhalt bleibt
const farbe = sel => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).color, sel);
await clickText(".tab", "Einstellungen");
const kartenTextVorher = await variable("text-stark");
const kopfFarbfeld = async () => { const q = await mitte('[data-einst-kopf="lernen"] .einst-kopf-text'); await rechtsklick(q.x, q.y); };
await oeffneEinst("app");
await page.evaluate(() => document.querySelector("[data-farbmodus-start]").click()); await sleep(300);
await kopfFarbfeld();
console.log("     Farbfeld Kopf:", (await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-zeile]")].map(z => z.dataset.farbfeldZeile))).join(","));
ok(await page.$('[data-farbfeld-zeile="kopf-schrift"]'), "Farbfeld am Einstellungs-Kopf: „Schrift auf Kopfzeilen“");
await setzeFarbe("kopf-schrift", "#ffffff");
ok(await farbe('[data-einst-kopf="lernen"]') === "rgb(255, 255, 255)" && await variable("text-stark") === kartenTextVorher, "Kopf-Schrift weiß, „Text kräftig“ des Inhalts unverändert");
// allgemeinen Text ändern → Kopf-Schrift bleibt weiß
if (await page.$("[data-farbfeld]")) await clickText("[data-farbfeld] button", "Schließen", true);
await oeffneEinst("lernen");
const z = await mitte("[data-akzent-sprachen] .toggle-label");
await rechtsklick(z.x, z.y);
await setzeFarbe("text-stark", "#003300");
ok(await variable("text-stark") === "#003300" && await farbe('[data-einst-kopf="raster"]') === "rgb(255, 255, 255)", "„Text kräftig“ geändert, Kopf-Schrift bleibt weiß");
ok(await variable("abfrage-schrift") === kartenTextVorher && await variable("dialog-schrift") === kartenTextVorher, "Abfrage- und Dialog-Schrift bleiben beim alten Wert");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
