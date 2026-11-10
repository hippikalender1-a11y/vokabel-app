import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, bereichZu } from "./hilfen.mjs";

// Richtung je Antwortart: „Hören“ wählen dreht auf Fremd → Deutsch, Hören liest die Frage nur einmal vor (auch mit Auto-Vorlesen);
// beim Mischen nur passende Arten; Modus-Fenster: Karte/MC/Tastatur neben „Antwort 1“, Akzente zuletzt;
// Übersetzung bei Satz finden / Lückensatz einstellbar; Listen-„Bestätigen“ in eigener Farbe
const URL = "http://localhost:4199/vokabel-app/";
const WOERTER = ["école", "maison", "garçon", "château", "élève", "forêt"];
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => {
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; this.rate = 1; } };
  const s = window.speechSynthesis; s.getVoices = () => [];
  s.speak = u => window.__gesprochen.push(u.text); s.cancel = () => window.__gesprochen.push("|abbruch|");
});
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const aktiv = () => page.evaluate(() => [...document.querySelectorAll("[data-modus-knopf].aktiv")].map(b => b.dataset.modusKnopf).join(","));
const rolle = () => page.evaluate(() => ({ frage: document.querySelector(".spalten-rolle-btn.frage")?.closest("[style]")?.parentElement?.textContent.match(/E1|D1/)?.[0],
  antwort: document.querySelector(".spalten-rolle-btn.antwort")?.closest("[style]")?.parentElement?.textContent.match(/E1|D1/)?.[0] }));

const vorbereiten = async (einst = {}) => {
  await page.goto(URL);
  await page.evaluate((w, einst) => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const vokabeln = w.map((x, i) => ({ id: i + 1, E1: { wert: x, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
    localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: w.length + 1, vokabeln }));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
    if (Object.keys(einst).length) localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "schwer", vorlesen: ["E1"], gelerntSchwelle: 3, sprache: "alle", ...einst }));
  }, WOERTER, einst);
  await page.reload(); await sleep(700);
  await neueEineSession(page);
  await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
  // Listen-„Bestätigen“ in eigener Farbe (nicht wie ein normaler aktiver Knopf)
  const knopf = await page.evaluate(() => { const b = document.querySelector("[data-listen-bestaetigen]"); return b ? { kl: b.classList.contains("bestaetigen-knopf"), text: b.innerText.trim() } : null; });
  await listenZu(page);
  await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
  return knopf;
};

// ── Bestätigen (Listen-Auswahl) + Modus-Fenster-Aufbau ──
const lk = await vorbereiten();
ok(lk && lk.kl && lk.text === "Bestätigen", `Listen-Auswahl: „Bestätigen“ mit eigener Optik (${JSON.stringify(lk)})`);
const aufbau = await page.evaluate(() => {
  const antw = document.querySelector(".spalten-rolle-btn.antwort"), top = antw.getBoundingClientRect().top;
  const basis = [...document.querySelectorAll("[data-modus-basis] [data-modus-knopf]")].map(b => ({ m: b.dataset.modusKnopf.split(":")[1], top: Math.round(b.getBoundingClientRect().top - top) }));
  const weitere = [...document.querySelectorAll("[data-modus-weitere] [data-modus-knopf]")].map(b => b.dataset.modusKnopf.split(":")[1]);
  return { basis, weitere, rechts: basis.every(b => Math.abs(b.top) < 6) };
});
ok(aufbau.basis.map(b => b.m).join(",") === "karte,mc,tippen" && aufbau.rechts, `Karte, MC, Tastatur in der Zeile von „Antwort 1“ (${JSON.stringify(aufbau.basis)})`);
ok(aufbau.weitere[aufbau.weitere.length - 1] === "akzent" && aufbau.weitere[0] === "hoeren", `darunter die weiteren, Akzente zuletzt (${aufbau.weitere.join(",")})`);

// ── Übersetzung-Schalter erscheinen nur mit Satz finden / Lückensatz ──
ok(!(await page.$("[data-satz-ueb-schalter]")), "ohne Satz-Arten kein Übersetzungs-Schalter");
await page.click('[data-modus-knopf="E1:satzfinden"]'); await sleep(150);
await page.click('[data-modus-knopf="E1:lueckensatz"]'); await sleep(150);
const ueb = await page.evaluate(() => [...document.querySelectorAll("[data-satz-ueb]")].map(b => `${b.dataset.satzUeb}:${b.classList.contains("aktiv")}`).join(","));
ok(ueb === "satzfinden:false,lueckensatz:true", `Übersetzung: Satz finden aus, Lückensatz an (${ueb})`);
await page.click('[data-satz-ueb="satzfinden"]'); await sleep(150);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).satzUebFinden) === true, "Schalter speichert die Einstellung");

// ── Hören wählen: Richtung dreht sich (Fremdsprache wird Frage) ──
await vorbereiten();
ok(JSON.stringify(await rolle()) === JSON.stringify({ frage: "D1", antwort: "E1" }), `Standard: Deutsch → Französisch (${JSON.stringify(await rolle())})`);
await page.click('[data-modus-knopf="E1:hoeren"]'); await sleep(250);
ok(JSON.stringify(await rolle()) === JSON.stringify({ frage: "E1", antwort: "D1" }) && /D1:hoeren/.test(await aktiv()), `„Hören“: Französisch → Deutsch, Antwortarten wandern mit (${JSON.stringify(await rolle())}, ${await aktiv()})`);

// ── Lücken + Hören gemischt (Deutsch → Französisch): nie Hören, weil die Frage deutsch ist ──
await vorbereiten();
await page.click('[data-modus-knopf="E1:luecke"]'); await sleep(150);
await page.click('[data-modus-knopf="E1:karte"]'); await sleep(150);
await page.click('[data-modus-knopf="E1:hoeren"]'); await sleep(150);
ok(JSON.stringify(await rolle()) === JSON.stringify({ frage: "D1", antwort: "E1" }) && await aktiv() === "E1:hoeren,E1:luecke", `mit Lücken bleibt die Richtung (${await aktiv()})`);
await bereichZu(page);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
let hoerAnz = 0, lueckeAnz = 0;
for (let i = 0; i < 6; i++) {
  if (await page.$("[data-hoer-verdeckt]")) hoerAnz++;
  if (await page.$("[data-luecke]")) lueckeAnz++;
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Lösung anzeigen/.test(b.textContent))?.click()); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Nicht gewusst|Weiter/.test(b.textContent))?.click()); await sleep(500);
}
ok(hoerAnz === 0 && lueckeAnz > 0, `gemischt: nur Lücken, kein Hören bei deutscher Frage (Hören ${hoerAnz}, Lücken ${lueckeAnz})`);

// ── Hören liest die Frage genau einmal vor – auch mit Auto-Vorlesen ──
await vorbereiten({ autoplay: true, vorlesen: ["E1", "D1"] });
await page.click('[data-modus-knopf="E1:hoeren"]'); await sleep(200);
await page.evaluate(() => document.querySelector('[data-modus-knopf$=":karte"].aktiv')?.click()); await sleep(200);
await bereichZu(page);
await page.evaluate(() => { window.__gesprochen = []; document.querySelector("[data-start-knopf]")?.click(); }); await sleep(1200);
const gesp = await page.evaluate(() => window.__gesprochen.filter(x => x !== "|abbruch|"));
ok(gesp.length === 1 && WOERTER.includes(gesp[0]), `Frage einmal vorgelesen (${JSON.stringify(await page.evaluate(() => window.__gesprochen))})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
