import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, stufeWaehlen } from "./hilfen.mjs";

// Vorlesen: Einstellungen › Stimmen (Variante, Stimmen an/aus, Tempo je Sprache, Gesamt-Tempo),
// auf der Abfrage-Karte: ganze Karte spielt ab, „🔁 Stimme“ bei mehreren aktiven Stimmen, Gesamt-Tempo per langem Druck.
// Das System hat im Test keine Stimmen → gefälschte Stimmen und Utterance, gesprochen wird nur protokolliert.
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => {
  const V = [["Anna", "de-DE"], ["Markus", "de-DE"], ["Daniel", "en-GB"], ["Samantha", "en-US"], ["Thomas", "fr-FR"], ["Amélie", "fr-CA"]]
    .map(([name, lang], i) => ({ name, lang, voiceURI: "v" + i, default: i === 0, localService: true }));
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; this.rate = 1; } };
  const s = window.speechSynthesis;
  s.getVoices = () => V;
  s.speak = u => window.__gesprochen.push({ text: u.text, voice: u.voice?.name || null, rate: u.rate, lang: u.lang });
  s.cancel = () => {};
});
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wahl = () => page.evaluate(() => JSON.parse(localStorage.getItem("geraet_stimmen") || "{}"));
const letztes = () => page.evaluate(() => window.__gesprochen[window.__gesprochen.length - 1] || null);
const regler = async (sel, wert) => page.evaluate((sel, wert) => { const r = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, String(wert));
  r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); r.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); }, sel, wert);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, E1: { wert: `mot${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 6, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);

// ── Einstellungen › Stimmen ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await page.click('[data-einst-kopf="stimmen"]'); await sleep(300);
const sprachen = await page.evaluate(() => [...document.querySelectorAll("[data-stimme-sprache]")].map(e => e.dataset.stimmeSprache).join(","));
ok(sprachen === "de,fr", `Sprachen der Listen + Deutsch (${sprachen})`);
const varianten = await page.evaluate(() => [...document.querySelectorAll('[data-stimme-sprache="fr"] [data-stimme-variante]')].map(b => b.textContent.trim()));
ok(varianten.join("|") === "Alle|🇨🇦 Kanada|🇫🇷 Frankreich", `Französisch: Varianten (${varianten.join(" | ")})`);
ok(await page.evaluate(() => document.querySelectorAll('[data-stimmen-liste="de"] [data-stimme]').length) === 2, "Deutsch: 2 Stimmen mit Haken");
const geschlecht = await page.evaluate(() => [...document.querySelectorAll('[data-stimmen-liste="de"] [data-stimme]')].map(z => z.querySelector("[data-stimme-geschlecht]")?.textContent || "-").join(""));
ok(geschlecht === "♀♂", `bekannte Namen mit ♀/♂ (Anna, Markus: ${geschlecht})`);
await page.click('[data-stimmen-hilfe=""]'); await sleep(300);
ok(await page.evaluate(() => { const f = document.querySelector("[data-stimmen-hilfe-fenster]"); return f && f.querySelector("details[open]")?.dataset.stimmenWeg === f.dataset.stimmenHilfeFenster && f.querySelectorAll("details").length === 4; }),
  "„＋ Weitere Stimmen laden“: Anleitung, der passende Weg aufgeklappt");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "OK")?.click()); await sleep(300);
// Stimme abschalten
await page.click('[data-stimme-an="v1"]'); await sleep(200);
ok((await wahl()).aus?.de?.includes("v1"), "Markus abgeschaltet");
// Variante wählen: nur deren Stimmen
await page.click('[data-stimme-variante="fr:fr-fr"]'); await sleep(200);
ok((await wahl()).variante?.fr === "fr-fr" && await page.evaluate(() => [...document.querySelectorAll('[data-stimmen-liste="fr"] [data-stimme]')].map(e => e.dataset.stimme).join(",")) === "v4",
  "Variante Frankreich: nur Thomas");
await page.click('[data-stimme-variante="fr:alle"]'); await sleep(200);
// Tempo je Sprache × Gesamt-Tempo
await regler('[data-stimme-tempo="de"]', 1.3); await sleep(200);
await regler("[data-stimmen-tempo-regler]", 1.2); await sleep(200);
await page.click('[data-stimme-probe="v0"]'); await sleep(150);
let l = await letztes();
ok((await wahl()).tempoSprache?.de === 1.3 && Math.abs(l.rate - 1.56) < 0.001 && l.voice === "Anna", `Probe Deutsch: Tempo 1,3 × 1,2 = ${l.rate}, Stimme ${l.voice}`);
await page.click('[data-stimme-probe="v4"]'); await sleep(150);
l = await letztes();
ok(Math.abs(l.rate - 1.2) < 0.001, `Französisch: nur Gesamt-Tempo (${l.rate})`);

// ── Abfrage: Karte spielt ab, 🔁 Stimme, Tempo per langem Druck ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
await listenZu(page);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
const frage = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
await page.click("[data-karte-frage]"); await sleep(200);
l = await letztes();
ok(l?.text === frage && l.voice === "Anna", `Frage-Karte antippen liest vor („${l?.text}“, ${l?.voice})`);
ok(await page.$("[data-karte-verdeckt]"), "Antippen der Frage deckt die Karte nicht auf");
ok(!(await page.$('[data-stimme-wechsel="frage"]')), "Deutsch: nur 1 aktive Stimme → kein „🔁“");
// aufdecken → Antwort (Französisch, 2 aktive Stimmen)
await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(400);
ok(await page.evaluate(() => document.querySelector('[data-stimme-wechsel="antwort"]')?.textContent.trim()) === "1/2", "Antwort Französisch: Stimmen-Knopf „1/2“ statt Pfeil");
const antwort = await page.evaluate(() => document.querySelector("[data-karte-antwort] .quiz-frage-text")?.textContent.trim());
await page.click("[data-karte-antwort]"); await sleep(200);
const vorher = (await letztes())?.voice;
ok((await letztes())?.text === antwort, `Antwort-Karte antippen liest vor („${antwort}“, ${vorher})`);
await page.click('[data-stimme-wechsel="antwort"]'); await sleep(200);
l = await letztes();
ok(l.text === antwort && l.voice && l.voice !== vorher && (await wahl()).sprachen?.fr, `Stimmen-Knopf: andere Stimme (${vorher} → ${l.voice}), bleibt eingestellt`);
ok(await page.evaluate(() => document.querySelector('[data-stimme-wechsel="antwort"]')?.textContent.trim()) === "2/2", "Knopf zeigt jetzt „2/2“");
// lang drücken: Tafel mit Gesamt-Tempo
await page.evaluate(() => { const el = document.querySelector("[data-karte-antwort]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 30, clientY: r.y + 20 })); }); await sleep(300);
ok(await page.$("[data-info-regler]") && await page.$('[data-info-aktion="✎ Richtige Antwort bearbeiten"]'), "lang drücken: Tafel mit Tempo-Regler und „bearbeiten“");
await regler("[data-info-regler] input", 0.8); await sleep(200);
l = await letztes();
ok((await wahl()).tempo === 0.8 && await page.evaluate(() => document.querySelector("[data-info-regler-wert]").textContent) === "0,8×" && l.text === antwort,
  `Regler: Gesamt-Tempo 0,8× gespeichert, beim Loslassen vorgelesen (rate ${l.rate})`);
ok(await page.$("[data-info-regler]"), "Tafel bleibt beim Ziehen offen");

// Lernen-Modus: Stimmen-Knopf auch auf der Lernkarte
await page.mouse.click(5, 300); await sleep(200);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht|Beenden/.test(b.textContent))?.click()); await sleep(400);
await stufeWaehlen(page, "lernen");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
const lk = await page.evaluate(() => document.querySelector('[data-stimme-wechsel="lernen"]')?.textContent.trim());
ok(lk === "2/2" || lk === "1/2", `Lernkarte: Stimmen-Knopf (${lk})`);
const vorL = (await letztes())?.voice;
await page.click('[data-stimme-wechsel="lernen"]'); await sleep(200);
l = await letztes();
ok(l.voice && l.voice !== vorL && /^mot\d$/.test(l.text) && await page.evaluate(() => document.querySelector("[data-lernen-karte]")?.dataset.lernenPhase) === "0",
  `Lernkarte: andere Stimme (${vorL} → ${l.voice}), Karte bleibt stehen`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
