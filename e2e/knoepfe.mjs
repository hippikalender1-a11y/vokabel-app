import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu } from "./hilfen.mjs";

// Zeilen-Knöpfe im Quiz-Tab: aufgeklappt „Kurzwert / Bestätigen“, gleiche Farbe wie zugeklappt;
// Stufe aufklappbar; lang drücken auf „Start“: Speichern-Menü wie beim Session-Namen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const text = sel => page.evaluate(s => document.querySelector(s)?.innerText.replace(/\s+/g, " ").trim(), sel);
const farbe = sel => page.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, E1: { wert: `mot${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 7, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
await listenZu(page);

const zu = await farbe("[data-reihenfolge]");
await page.click("[data-reihenfolge]"); await sleep(300);
ok(await text("[data-reihenfolge]") === "Schlechteste Bestätigen" && await farbe("[data-reihenfolge]") === zu, `Reihenfolge offen: „Schlechteste / Bestätigen“, gleiche Farbe (${await text("[data-reihenfolge]")})`);
await page.click("[data-reihenfolge]"); await sleep(300);
ok(await text("[data-reihenfolge]") === "Schlechteste zuerst", "„Bestätigen“ klappt zu, wieder der volle Text");
await page.click("[data-umfang]"); await sleep(300);
ok(await text("[data-umfang]") === "Alle Bestätigen", `Umfang offen: „Alle / Bestätigen“ (${await text("[data-umfang]")})`);
await page.click("[data-umfang]"); await sleep(300);
await page.click("[data-abfrageziel]"); await sleep(300);
ok(/Bestätigen$/.test(await text("[data-abfrageziel]")), `Abfrage-Ziel offen: „… / Bestätigen“ (${await text("[data-abfrageziel]")})`);
await page.click("[data-abfrageziel]"); await sleep(300);
await page.click("[data-stufe]"); await sleep(300);
ok(await text("[data-stufe]") === "Schwer Bestätigen" && await page.$("[data-stufe-auswahl]"), "Stufe offen: „Schwer / Bestätigen“ mit Auswahl darunter");
await page.click('[data-stufe-wahl="einfach"]'); await sleep(200);
ok(await text("[data-stufe]") === "Leicht Bestätigen", "Auswahl ändert den Kurzwert sofort");
await page.click("[data-stufe]"); await sleep(300);
ok(await text("[data-stufe]") === "Leicht" && !(await page.$("[data-stufe-auswahl]")), "„Bestätigen“: Stufe zu");

// Start: lang drücken → Speichern
await page.evaluate(() => { const el = document.querySelector("[data-start-knopf]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 10 })); }); await sleep(300);
ok(await page.$('[data-info-aktion="💾 Speichern"]'), "lang drücken auf „Start“: „💾 Speichern“");
await page.click('[data-info-aktion="💾 Speichern"]'); await sleep(300);
ok(await page.$("[data-slot-name-feld]"), "öffnet das Speichern-Fenster");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
