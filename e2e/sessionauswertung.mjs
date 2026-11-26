import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { zuListen, bereichZu, paketGroesse } from "./hilfen.mjs";

// Quiz-Auswertung über mehrere Pakete: Balken Start/Ende, Lernfortschritt, neu gelernt, Zusatzdaten;
// nach „Nochmal!“ beginnt die Auswertung mit neuen Start-Werten
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
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
// alle Karten des Pakets: „nicht“ = Wörter, die nicht gewusst werden
const paket = async (nicht = []) => {
  for (let i = 0; i < 20; i++) {
    const f = await frage(); if (!f || !(await page.$("[data-karte-verdeckt]"))) break;
    await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(150);
    await page.click(nicht.includes(f) ? ".karte-btn-nein" : ".karte-btn-ja"); await sleep(150);
    await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(250);   // Pause per Antippen beenden
    if (await page.evaluate(() => /Wiederholung/.test(document.body.innerText) && !!document.querySelector("button") && [...document.querySelectorAll("button")].some(b => b.textContent.includes("Wiederholung abbrechen"))))
      await clickText("button", "Wiederholung abbrechen");
  }
};
const auswertung = () => page.evaluate(() => {
  const b = [...document.querySelectorAll("[data-ausw-balken]")];
  const nie = (document.querySelector("[data-ausw-nie]")?.textContent.match(/(\d+) → (\d+)/) || []);
  const map = feld => Object.fromEntries([...b.filter(x => +x.dataset[feld] > 0).map(x => [x.dataset.auswBalken, x.dataset[feld]]), ...(nie.length && +nie[feld === "vorher" ? 1 : 2] > 0 ? [["nie", nie[feld === "vorher" ? 1 : 2]]] : [])]);
  return { text: document.querySelector("[data-session-auswertung]")?.innerText.replace(/\s+/g, " ") || "", start: map("vorher"), ende: map("nachher") };
});

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear(); localStorage.setItem("vokabel_test_ohne_tagessperre", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
  // 12 Vokabeln: w1–w2 Score 2 (werden mit „Gewusst“ gelernt), w3 Score −1, Rest nie abgefragt
  const voks = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + (i + 1), falsch: [] }, D1: { wert: "w" + (i + 1), falsch: [] },
    ...(i < 2 ? { fortschritt: f(2) } : i === 2 ? { fortschritt: f(-1) } : {}) }));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id: "l_fr", name: "Verbes", sprache: "fr", spalten: sp, naechste_id: 13, vokabeln: voks }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id: "l_fr", name: "Verbes", sprache: "fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await zuListen(page);
await clickText(".karte-zeile", "Verbes"); await listeOeffnen(page);
await clickText("button", "Quiz starten", true);
// Reihenfolge Listen-Nr., keine Score-Grenze → alle 12 in des Quiz, Pakete zu 10
await page.click("[data-reihenfolge]"); await sleep(300);
await clickText(".toggle-opt", "Listenplatz", true);
await page.evaluate(() => { const r = document.querySelector('input[type="range"]'); });
await bereichZu(page);
await paketGroesse(page, 10);
await clickText("[data-start-knopf]", "");
await sleep(300);
const titel1 = await page.evaluate(() => document.querySelector(".topbar-title")?.textContent.trim());
console.log("     Paket 1:", titel1);

const kopf = () => page.evaluate(() => document.querySelector("[data-kopf-fortschritt]")?.dataset.kopfFortschritt);
ok(await kopf() === "0/12", `Kopfzeile: Quiz-Balken zu Beginn 0/12 (${await kopf()})`);
// die ersten zwei Karten (w4, w5) mit „Nicht gewusst“ beantworten → 2/12
for (let i = 0; i < 2; i++) { await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(150); await page.click(".karte-btn-nein"); await sleep(150); await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(250); }
ok(await kopf() === "2/12", `nach 2 Antworten: 2/12 (${await kopf()})`);
// Reihenfolge Listen-Nr. mit „unbeantwortete zuerst“: Paket 1 = w4 … w12, w1; Paket 2 = w2, w3
await paket(["w4", "w5"]);
await clickText("[data-naechstes-paket]", "");
await sleep(400);
ok(await kopf() === "10/12", `zweites Paket: Balken zählt die ganze Quiz weiter (${await kopf()})`);
await paket([]);
ok(await page.$("[data-zur-auswertung]"), "Quiz fertig: „Weiter →“");
await page.click("[data-zur-auswertung]"); await sleep(400);
let a = await auswertung();
{ await page.setViewport({ width: 360, height: 690 }); await sleep(300);   // 348: Handy-Größe – alles samt Knöpfen ohne Scrollen
  const unten = await page.evaluate(() => { window.scrollTo(0, 0); const b = [...document.querySelectorAll(".sektion button")].pop(); return { bottom: Math.round(b.getBoundingClientRect().bottom), text: b.textContent.trim(), reihe: [...document.querySelectorAll(".sektion button")].map(x => x.textContent.trim()).join(" | ") }; });
  if (process.env.BILD) await page.screenshot({ path: process.env.BILD });
  ok(unten.bottom <= 690 && /Statistik/.test(unten.text), `348: Auswertung passt auf 360×690 (unterster Knopf „${unten.text}“ endet bei ${unten.bottom})`);
  ok(/^Zur Übersicht \| .*Nochmal! \| .*Zur Statistik$/.test(unten.reihe), `347: Reihenfolge Übersicht · Nochmal · Statistik (${unten.reihe})`);
  await page.setViewport({ width: 390, height: 900 }); await sleep(200); }
if (process.env.SHOT) await page.screenshot({ path: "auswertung_shot.png", fullPage: true });
console.log("     Auswertung:", a.text);
console.log("     Start:", JSON.stringify(a.start), "Ende:", JSON.stringify(a.ende));
ok(/Ganzes Quiz · 12 Vokabeln/i.test(a.text), "ganze Quiz: 12 Vokabeln (beide Pakete)");
ok(a.start.arbeit === "2" && a.start.negativ === "1" && a.start.nie === "9", "Balken Start: 2 in Arbeit, 1 negativ, 9 nie");
ok(a.ende.gelernt === "2" && !a.ende.nie, "Balken Ende: 2 gelernt, keine mehr nie abgefragt");
ok(/Neu gelernt 2/.test(a.text), "neu gelernt: 2 (w1, w2)");
ok(/Vokabeln 12 in 2 Paketen/.test(a.text), "Zusatzdaten: 12 in 2 Paketen");
ok(/Auf Anhieb gewusst 10 von 12/.test(a.text), "auf Anhieb gewusst: 10 von 12 (w4, w5 nicht)");
ok(/Dauer/.test(a.text), "Dauer angezeigt");

// Nochmal: neuer Durchlauf (w1, w2 jetzt gelernt → ausgeblendet, 10 Vokabeln in einem Paket);
// die Auswertung beginnt beim aktuellen Stand: keine „nie abgefragt“ mehr am Start
await clickText("button", "Nochmal");
await sleep(400);
await paket([]);
if (await page.evaluate(() => !!document.querySelector("[data-naechstes-paket]"))) { await clickText("[data-naechstes-paket]", ""); await sleep(400); await paket([]); }
await page.click("[data-zur-auswertung]"); await sleep(400);
a = await auswertung();
console.log("     2. Durchlauf:", a.text.slice(0, 220));
console.log("     Start:", JSON.stringify(a.start));
ok(/Ganzes Quiz · 10 Vokabeln/i.test(a.text) && !a.start.nie, "2. Durchlauf: neue Start-Werte (keine „nie abgefragt“ mehr)");
ok(/Vokabeln 10 in 1 Paket/.test(a.text) && /Auf Anhieb gewusst 10 von 10/.test(a.text), "2. Durchlauf: eigene Paketzahl und Bewertungen");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
