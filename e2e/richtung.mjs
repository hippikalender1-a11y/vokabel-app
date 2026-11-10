import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, bereichZu, fremdAlsFrage } from "./hilfen.mjs";

// Antwortarten je Antwortsprache: nur passende werden angeboten (kein automatischer Richtungswechsel), in Gruppen
// Grund · Wort · Satz · Runde; nicht mehr passende werden beim Rollenwechsel abgewählt; Hören liest die Frage nur einmal vor;
// Übersetzung bei Satz finden / Lückensatz einstellbar; Listen-„Bestätigen“ in eigener Farbe; Zuordnung bei „wechselnd“;
// Antwortkarte mit ✓ / ✗ / 👁; Aus/An-Schalter im Vorlesen-Fenster nicht abgeschnitten
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
const knoepfe = sp => page.evaluate(sp => [...document.querySelectorAll(`[data-modus-knopf^="${sp}:"]`)].map(b => b.dataset.modusKnopf.split(":")[1]).join(","), sp);
const gruppen = sp => page.evaluate(sp => [...document.querySelectorAll("[data-modus-gruppe]")].filter(g => g.querySelector(`[data-modus-knopf^="${sp}:"]`)).map(g => g.dataset.modusGruppe).join(","), sp);
const aktiv = () => page.evaluate(() => [...document.querySelectorAll("[data-modus-knopf].aktiv")].map(b => b.dataset.modusKnopf).join(","));

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
  const knopf = await page.evaluate(() => { const b = document.querySelector("[data-listen-bestaetigen]"); return b ? { kl: b.classList.contains("bestaetigen-knopf"), text: b.innerText.trim() } : null; });
  await listenZu(page);
  await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
  return knopf;
};

// ── Bestätigen (Listen-Auswahl) + Gruppen für die Fremdsprachen-Antwort ──
const lk = await vorbereiten();
ok(lk && lk.kl && lk.text === "Bestätigen", `Listen-Auswahl: „Bestätigen“ mit eigener Optik (${JSON.stringify(lk)})`);
ok(await knoepfe("E1") === "karte,mc,tippen,akzent,puzzle,luecke,artikel,satzfinden,satzbauen,lueckensatz,zuordnung,memory", `Antwort Französisch: ohne Hören (${await knoepfe("E1")})`);
ok(await gruppen("E1") === "grund,wort,satz,runde", `Gruppen Grund · Wort · Satz · Runde (${await gruppen("E1")})`);
const abst = await page.evaluate(() => { const g = [...document.querySelectorAll("[data-modus-gruppe]")]; return Math.round(g[1].getBoundingClientRect().top - g[0].getBoundingClientRect().bottom); });
ok(abst >= 12, `Abstand zwischen den Gruppen (${abst}px)`);

// ── Übersetzung-Schalter erscheinen nur mit Satz finden / Lückensatz ──
ok(!(await page.$("[data-satz-ueb-schalter]")), "ohne Satz-Arten kein Übersetzungs-Schalter");
await page.click('[data-modus-knopf="E1:satzfinden"]'); await sleep(150);
await page.click('[data-modus-knopf="E1:lueckensatz"]'); await sleep(150);
const ueb = await page.evaluate(() => [...document.querySelectorAll("[data-satz-ueb]")].map(b => `${b.dataset.satzUeb}:${b.classList.contains("aktiv")}`).join(","));
ok(ueb === "satzfinden:false,lueckensatz:true", `Übersetzung: Satz finden aus, Lückensatz an (${ueb})`);
await page.click('[data-satz-ueb="satzfinden"]'); await sleep(150);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).satzUebFinden) === true, "Schalter speichert die Einstellung");

// ── Richtung drehen: Deutsch als Antwort → nur Karte, MC, Hören, Zuordnung, Memory; Fremd-Arten abgewählt ──
await page.click('[data-modus-knopf="E1:tippen"]'); await sleep(150);
await fremdAlsFrage(page);
ok(await knoepfe("D1") === "karte,mc,hoeren,zuordnung,memory", `Antwort Deutsch: Karte, MC, Hören, Zuordnung, Memory (${await knoepfe("D1")})`);
ok(!(await page.evaluate(() => JSON.stringify(document.body.innerText).includes("Tastatur"))), "keine Tastatur bei deutscher Antwort");
// Hören antippen: keine automatische Änderung der Richtung mehr
await page.click('[data-modus-knopf="D1:hoeren"]'); await sleep(250);
ok(/D1:hoeren/.test(await aktiv()) && await knoepfe("E1") === "", `Hören angehakt, Richtung bleibt (${await aktiv()})`);

// ── Hören liest die Frage genau einmal vor – auch mit Auto-Vorlesen; Antwortkarte mit ✓ ──
await vorbereiten({ autoplay: true, vorlesen: ["E1", "D1"] });
await fremdAlsFrage(page);
await page.click('[data-modus-knopf="D1:hoeren"]'); await sleep(200);
await page.click('[data-modus-knopf="D1:karte"]'); await sleep(200);
await bereichZu(page);
await page.evaluate(() => { window.__gesprochen = []; document.querySelector("[data-start-knopf]")?.click(); }); await sleep(1200);
const gesp = await page.evaluate(() => window.__gesprochen.filter(x => x !== "|abbruch|"));
ok(gesp.length === 1 && WOERTER.includes(gesp[0]), `Frage einmal vorgelesen (${JSON.stringify(await page.evaluate(() => window.__gesprochen))})`);
await page.evaluate(z => [...document.querySelectorAll("[data-mc-raster] button")].find(b => b.textContent.trim() === z)?.click(), `Wort${WOERTER.indexOf(gesp[0]) + 1}`); await sleep(200);
ok(await page.evaluate(() => document.querySelector("[data-antwort-status]")?.textContent) === "✓", "richtige Wahl: ✓ auf der Antwortkarte");
await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Weiter/.test(b.textContent))?.click()); await sleep(800);
// nächste Frage: „Lösung anzeigen“ → 👁 (nicht mit richtig zu verwechseln)
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Lösung anzeigen/.test(b.textContent))?.click()); await sleep(300);
const st = await page.evaluate(() => document.querySelector("[data-antwort-status]")?.dataset.antwortStatus);
ok(st === "aufgedeckt" || st === "falsch", `aufgedeckt: kein ✓ (${st})`);

// ── Zuordnung bei „wechselnd“: angeboten; Seiten je Zeile zufällig ──
await vorbereiten();
await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].find(b => b.textContent.trim() === "wechselnd")?.click()); await sleep(300);
ok(/zuordnung/.test(await knoepfe("E1")) && /zuordnung/.test(await knoepfe("D1")), "wechselnd: Zuordnung wird angeboten");
await page.click('[data-modus-knopf="E1:zuordnung"]'); await sleep(200);
ok(/E1:zuordnung/.test(await aktiv()) && /D1:zuordnung/.test(await aktiv()), `Zuordnung gilt für alle Spalten (${await aktiv()})`);
for (const sp of ["E1", "D1"]) await page.evaluate(sp => document.querySelector(`[data-modus-knopf="${sp}:karte"].aktiv`)?.click(), sp);
await sleep(200);
await bereichZu(page);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const links = await page.evaluate(() => [...document.querySelectorAll(".zuo-raster [data-zuo-karte], .zuo-raster .zuo-karte")].filter((_, i) => i % 2 === 0).map(b => b.textContent.trim()));
const fremdLinks = links.filter(t => /[a-zéèçâêô]/.test(t) && !/^Wort/.test(t)).length;
ok(links.length >= 3 && !(await page.$(".zuo-kopf")), `Zuordnungsrunde ohne Spaltenköpfe (${links.join(" | ")})`);
console.log(`     links Französisch: ${fremdLinks} von ${links.length}`);

// ── Vorlesen-Fenster: Aus/An vollständig sichtbar ──
await vorbereiten();
await page.keyboard.press("Escape");
await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(200);
await page.evaluate(() => document.querySelector("[data-stufe]")?.click()); await sleep(200);
await page.evaluate(() => document.querySelector("[data-stufe-vorlesen]")?.click()); await sleep(300);
const sch = await page.evaluate(() => { const m = document.querySelector("[data-vorlesen-einstellungen]"); const r = m.getBoundingClientRect();
  return [...m.querySelector(".toggle-btn").querySelectorAll(".toggle-opt")].map(b => { const x = b.getBoundingClientRect(); return { t: b.textContent, sichtbar: x.right <= r.right && x.width > 30, h: Math.round(x.height) }; }); });
ok(sch.length === 2 && sch.every(x => x.sichtbar && x.h >= 38), `Aus | An vollständig und groß genug (${JSON.stringify(sch)})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
