import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { zuListen, quizEinstellungen, neueEineSession, listenZu, bereichZu } from "./hilfen.mjs";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1200 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  // Ende eines Durchlaufs: „Weiter →“ führt zur Quiz-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done && await bereichZu(page)) return clickText(sel, text, exact);   // offener Bereich blendet den Rest aus
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
// Umfang-Knopf („Je 10 Vokabeln“ / „Alle Vokabeln“) und Anzahl am Start-Knopf
const info = () => page.evaluate(() => ({
  session: document.querySelector("[data-umfang]")?.textContent.trim() || null,
  start: Number(document.querySelector("[data-start-knopf]")?.dataset.startAnzahl),
}));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id:26,
    vokabeln: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] } })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz"); await quizEinstellungen(page);
await clickText(".quiz-setup-check", "Vocabulaire");
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
let i = await info();
console.log("     Start:", JSON.stringify(i));
ok(i.session === "Alle Vokabeln" && i.start === 25, "App-Start: alle Vokabeln in einem Paket");

// 10 wählen, dann "Neu" → wieder „Alle“
await page.click("[data-umfang]"); await sleep(200);
await page.click('[data-umfang-wahl="10"]');
await sleep(300);
i = await info();
ok(i.session === "Je 10 Vokabeln" && i.start === 10, "10 gewählt: Pakete mit 10");
await page.evaluate(() => window.scrollTo(0, 0));
if (!(await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].some(c => c.textContent.trim() === "Neu"))))
  await page.evaluate(() => [...document.querySelectorAll(".toggle-opt.aktiv")].find(b => b.textContent.trim().startsWith("Neues Quiz"))?.click());
await sleep(300);
await neueEineSession(page);
await clickText(".quiz-setup-check", "Vocabulaire");
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
i = await info();
ok(i.session === "Alle Vokabeln" && i.start === 25, "Nach „Neu“: wieder alle in einem Paket");

// Start aus der Liste
await zuListen(page);
await clickText(".karte-zeile", "Vocabulaire"); await listeOeffnen(page);
await clickText("button", "Quiz starten", true);
i = await info();
ok(i.session === "Alle Vokabeln" && i.start === 25, "Quiz aus der Liste: alle in einem Paket");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
