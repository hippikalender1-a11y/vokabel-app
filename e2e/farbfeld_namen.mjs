import puppeteer from "puppeteer-core";
import { quizEinstellungen, listenZu, bereichZu } from "./hilfen.mjs";

// Farbfeld: Zeilen nennen Element und Teil („Start-Knopf · Text groß“), darunter die Rolle („gilt auch für: …“);
// es öffnet sich gegenüber der angetippten Stelle (Element bleibt sichtbar, markiert); Schrift auf Liste & Start gilt unverändert
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

// Einstellungen: Bereich aufklappen (immer nur einer offen)
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
// Farbe im Farbkreis-Dialog per Hex-Feld setzen (live) und anwenden
const farbradHex = async (wert, anwenden = true) => {
  await page.evaluate(w => { const i = document.querySelector("[data-farbrad-hex]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, w); i.dispatchEvent(new Event("input", { bubbles: true })); }, wert);
  await new Promise(r => setTimeout(r, 200));
  if (anwenden) { await page.click("[data-farbrad-anwenden]"); await new Promise(r => setTimeout(r, 300)); }
};
const setzeFarbe = async (rolle, wert) => { await page.evaluate(r => document.querySelector(`[data-farbfeld-zeile="${r}"]`).click(), rolle); await sleep(300); await farbradHex(wert); };
const eigene = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}").eigeneSchemata || []);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 2, vokabeln: [{ id: 1, E1: { wert: "mot", falsch: [] }, D1: { wert: "Wort", falsch: [] } }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ gelerntSchwelle: 3, sprache: "alle", farbschema: "pastelle" }));
});
await page.reload(); await sleep(500);
await quizEinstellungen(page);
await clickText(".quiz-setup-check", "Unité 1");
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
ok(await variable("auf-start") === "#24382d", `Pastelle: Schrift auf Liste & Start aus der Vorlage (${await variable("auf-start")})`);

// Lang-Druck auf den Start-Knopf → 🎨 Farbe ändern
const knopf = await page.evaluate(() => { const r = document.querySelector("[data-start-knopf] b").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await rechtsklick(knopf.x, knopf.y);
await page.evaluate(() => document.querySelector("[data-info-farbe]").click()); await sleep(500);
const titel = await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-titel]")].map(z => z.dataset.farbfeldTitel));
console.log("     Zeilen:", titel.join(" | "));
ok(["Start-Knopf · Text groß", "Start-Knopf · Text klein", "Start-Knopf · Hintergrund"].every(t => titel.includes(t)), "Zeilen nennen Element und Teil: Text groß, Text klein, Hintergrund");
const unter = await page.evaluate(() => document.querySelector('[data-farbfeld-titel="Start-Knopf · Text groß"] .farb-rolle')?.textContent);
ok(unter === "gilt auch für: Schrift auf Liste & Start", `darunter klein die Rolle (${unter})`);
const lage = await page.evaluate(() => { const f = document.querySelector("[data-farbfeld]").getBoundingClientRect(), k = document.querySelector("[data-start-knopf]").getBoundingClientRect();
  return { seite: document.querySelector("[data-farbfeld]").dataset.farbfeldSeite, frei: f.bottom <= k.top || f.top >= k.bottom, marke: !!document.querySelector("[data-farbfeld-ziel]") }; });
console.log("     Lage:", JSON.stringify(lage));
ok(lage.seite === "oben" && lage.frei && lage.marke, "Start-Knopf unten: Farbfeld oben, Knopf frei und markiert");

// Schrift auf Liste & Start: gewählte Farbe gilt genau so (auch wenig Kontrast)
await page.evaluate(() => document.querySelector('[data-farbfeld-zeile="auf-start"]').click()); await sleep(300);
// Farbwähler: Leiste „In diesem Schema“ mit allen Farben des Schemas, ohne Doppelte; Tipp übernimmt die Farbe
const schemaFarben = await page.evaluate(() => [...document.querySelectorAll("[data-farbrad-schema] button")].map(b => b.title));
console.log("     In diesem Schema:", schemaFarben.length, "Farben");
ok(schemaFarben.includes("#7d9d8c") && schemaFarben.includes("#24382d") && new Set(schemaFarben).size === schemaFarben.length && schemaFarben.every(f => /^#[0-9a-f]{6}$/.test(f)),
  "Leiste „In diesem Schema“: Hauptfarbe und Schrift auf Liste & Start, keine Doppelten, 6-stellig");
await page.evaluate(() => document.querySelector('[data-farbrad-schema] button[title="#7d9d8c"]').click()); await sleep(200);
ok(await page.evaluate(() => document.querySelector("[data-farbrad-hex]").value) === "#7d9d8c" && await variable("auf-start") === "#7d9d8c", "Tipp auf eine Schema-Farbe: übernommen (live)");
await farbradHex("#ffff00");
ok(await variable("auf-start") === "#ffff00" && await page.evaluate(() => getComputedStyle(document.querySelector("[data-start-knopf] b")).color) === "rgb(255, 255, 0)",
  "Schrift auf Liste & Start: Gelb wird unverändert übernommen (keine automatische Umstellung)");
await clickText("[data-farbfeld] button", "Schließen", true).catch(() => {});

// Element oben (Tab) → Farbfeld unten
const tabP = await page.evaluate(() => { const r = [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await rechtsklick(tabP.x, tabP.y);
const lage2 = await page.evaluate(() => { const f = document.querySelector("[data-farbfeld]")?.getBoundingClientRect(), t = [...document.querySelectorAll(".tab")].find(x => x.textContent === "Statistik").getBoundingClientRect();
  return { seite: document.querySelector("[data-farbfeld]")?.dataset.farbfeldSeite, frei: f && f.top >= t.bottom }; });
ok(lage2.seite === "unten" && lage2.frei, `Tab oben: Farbfeld unten, Tab frei (${JSON.stringify(lage2)})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
