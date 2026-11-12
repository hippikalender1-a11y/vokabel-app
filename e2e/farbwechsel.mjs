import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, farbZeige, stufeWaehlen } from "./hilfen.mjs";

// Zufallsfarben je Abschnitt (schließt „Farben je Sprache“ aus); Stufe „Lernen“: Knöpfe normal (nicht abgeschwächt)

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

// Sprachen an, dann Zufallsfarben an → Sprachen aus (und umgekehrt)
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await farbZeige(page, "[data-sprachfarben]");
await page.click("[data-sprachfarben-an]"); await sleep(200);
await page.click("[data-farbwechsel-an]"); await sleep(300);
const zust = () => page.evaluate(() => ({ sprache: document.querySelector("[data-sprachfarben-an]").checked, wechsel: document.querySelector("[data-farbwechsel-an]").checked }));
ok(JSON.stringify(await zust()) === '{"sprache":false,"wechsel":true}', `Zufallsfarben an → Farben je Sprache aus (${JSON.stringify(await zust())})`);
const f0 = await haupt();
ok(f0 !== "#2d6a4f", `Zufalls-Schema aktiv (${f0})`);

// Quiz starten → neue Farbe; Quiz zu Ende / zurück → wieder neue Farbe
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unit 1"))?.click()); await sleep(300);
await listenZu(page);
const f1 = await haupt();
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
const f2 = await haupt();
ok(f2 !== f1, `Quiz startet: neue Zufallsfarbe (${f1} → ${f2})`);
for (let i = 0; i < 12 && !(await page.$("[data-zur-auswertung]")); i++) {
  await page.evaluate(() => document.querySelector(".sektion")?.click()); await sleep(200);
  await page.evaluate(() => document.querySelector(".karte-btn-ja")?.click()); await sleep(900);
}
const f3 = await haupt();
ok(f3 !== f2, `Quiz zu Ende: neue Zufallsfarbe (${f2} → ${f3})`);

// Farben je Sprache wieder an → Zufallsfarben aus
await page.evaluate(() => document.querySelector("[data-zur-auswertung]")?.click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht|Fertig|Beenden/.test(b.textContent))?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await farbZeige(page, "[data-sprachfarben]");
await page.click("[data-sprachfarben-an]"); await sleep(300);
ok(JSON.stringify(await zust()) === '{"sprache":true,"wechsel":false}', `Farben je Sprache an → Zufallsfarben aus (${JSON.stringify(await zust())})`);

// Stufe „Lernen“: Knöpfe normal (Abschwächen wieder zurückgenommen)
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await stufeWaehlen(page, "lernen");
const op = await page.evaluate(() => [...document.querySelectorAll(".quiz-zeile-zelle")].map(z => `${z.querySelector(".quiz-zeile-label").textContent}=${getComputedStyle(z).opacity}`));
ok(op.length > 1 && op.every(x => x.endsWith("=1")), `Lernen: alle Knöpfe normal (${op.join(", ")})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
