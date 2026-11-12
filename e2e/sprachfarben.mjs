import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, farbZeige } from "./hilfen.mjs";

// Farben je Sprache: Tab „Sprachen“ unter Einstellungen › Farben – aus: immer Standard-Schema; an: Sprachfilter bzw.
// Sprache der abgefragten Liste bestimmt das Schema (Standard: Länder-Vorlage, wählbar, „wie Standard“)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const haupt = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--haupt").trim());
const einst = aenderung => page.evaluate(a => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"); localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], ...e, ...a })); }, aenderung);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Fremd",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vok = p => Array.from({ length: 4 }, (_, i) => ({ id: i + 1, E1: { wert: `${p}${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 5, vokabeln: vok("mot") }));
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify({ id:"l_en", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 5, vokabeln: vok("word") }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }, { id:"l_en", name:"Unit 1", sprache:"en", platz:{z:1,s:0} }]));
});
await page.reload(); await sleep(700);
ok(await haupt() === "#2d6a4f", `Start: Standard-Schema Natur (${await haupt()})`);

// Tab „Sprachen“: aus, Länder-Vorlagen vorbelegt
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await farbZeige(page, "[data-sprachfarben]");
const belegt = await page.evaluate(() => [...document.querySelectorAll("[data-sprachfarbe]")].map(s => `${s.dataset.sprachfarbe}=${s.value}`).join(","));
ok(!(await page.evaluate(() => document.querySelector("[data-sprachfarben-an]").checked)) && belegt === "en=sprache_en,fr=sprache_fr", `aus; vorbelegt mit Länder-Vorlagen (${belegt})`);
ok(await farbZeige(page, '[data-farbschema="sprache_fr"]') && await page.evaluate(() => document.querySelectorAll('[data-farbschema^="sprache_"]').length) === 10, "zehn Länder-Vorlagen stehen auch unter „Vorlagen“");
await farbZeige(page, "[data-sprachfarben]");
await page.click("[data-sprachfarben-an]"); await sleep(200);
ok(await haupt() === "#2d6a4f", "an, Sprachfilter „Alle“: Standard-Schema");

// Sprachfilter Französisch → französisches Schema
await einst({ sprache: "fr" }); await page.reload(); await sleep(600);
ok(await haupt() === "#0055a4", `Sprachfilter Französisch: Schema „Französisch 🇫🇷“ (${await haupt()})`);
const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--hintergrund").trim());
ok(bg === "#fcf0f3", `Französisch: Hintergrund dezent rosa (${bg})`);
// eigene Wahl: Neon für Französisch
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await farbZeige(page, "[data-sprachfarben]");
const gruppenLabels = await page.evaluate(() => [...document.querySelector('[data-sprachfarbe="fr"]').querySelectorAll("optgroup")].map(g => g.label).join("|"));
ok(gruppenLabels === "Länder|Vorlagen" || gruppenLabels === "Meine Farben|Länder|Vorlagen", `Auswahl gegliedert (${gruppenLabels})`);
await page.select('[data-sprachfarbe="fr"]', "neon"); await sleep(300);
ok(await haupt() === "#ff3fb4", `Französisch auf „Neon“ gestellt: sofort sichtbar (${await haupt()})`);
await page.select('[data-sprachfarbe="fr"]', "standard"); await sleep(300);
ok(await haupt() === "#2d6a4f", "„wie Standard“: Standard-Schema");

// Abfrage einer englischen Liste (Filter „Alle“): englisches Schema, danach wieder Standard
await einst({ sprache: "alle" }); await page.reload(); await sleep(600);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unit 1"))?.click()); await sleep(300);
await listenZu(page);
ok(await haupt() === "#2d6a4f", "Quiz-Einstellungen mit Filter „Alle“: Standard-Schema");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await haupt() === "#1d3c78", `Abfrage der englischen Liste: Schema „Englisch 🇬🇧“ (${await haupt()})`);

// ausgeschaltet: immer Standard
await einst({ sprache: "fr", sprachFarben: { an: false } }); await page.reload(); await sleep(600);
ok(await haupt() === "#2d6a4f", "ausgeschaltet: Standard-Schema trotz Sprachfilter");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
