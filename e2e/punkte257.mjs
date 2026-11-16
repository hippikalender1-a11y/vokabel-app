import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, bereichZu } from "./hilfen.mjs";

// 257: „Artikel“ nur, wo Wörter mit Artikel sind; nur „Artikel“ gewählt → nur diese Wörter
// 258: Score-Symbole bei allen Antwortarten (hier Puzzle), Puls beim Ändern; Zuordnung: Symbole in den Ergebnis-Zeilen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const s = window.speechSynthesis; s.getVoices = () => []; s.speak = () => {}; s.cancel = () => {};
});
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const lade = async (sprache, woerter) => {
  await page.goto(URL);
  await page.evaluate((sprache, w) => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Fremd",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const vokabeln = w.map((x, i) => ({ id: i + 1, E1: { wert: x, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
    localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache, spalten: sp, naechste_id: w.length + 1, vokabeln }));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache, platz:{z:0,s:0} }]));
  }, sprache, woerter);
  await page.reload(); await sleep(700);
  await neueEineSession(page);
  await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unit 1"))?.click()); await sleep(300);
  await listenZu(page);
  await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
};
const knopfDa = art => page.evaluate(a => !!document.querySelector(`[data-modus-knopf="E1:${a}"]`), art);
const nurArt = async art => {
  await page.evaluate(a => document.querySelector(`[data-modus-knopf="E1:${a}"]`)?.click(), art); await sleep(200);
  await page.evaluate(() => document.querySelector('[data-modus-knopf$=":karte"].aktiv')?.click()); await sleep(200);
  await bereichZu(page);
};
const startAnzahl = () => page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl);

// ── 257: Englisch – kein „Artikel“ ──
await lade("en", ["drive", "the house", "a dog"]);
ok(!(await knopfDa("artikel")) && await knopfDa("puzzle"), "257: Englisch-Liste – kein Knopf „Artikel“ (andere Arten da)");

// ── 257: Französisch – „Artikel“ da; allein gewählt nur die Wörter mit Artikel ──
await lade("fr", ["le chat", "la maison", "manger", "vite"]);
ok(await knopfDa("artikel"), "257: Französisch mit le/la – Knopf „Artikel“ da");
await nurArt("artikel");
ok(await startAnzahl() === "2", `257: nur „Artikel“ – Quiz mit den 2 Wörtern mit Artikel (${await startAnzahl()})`);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const fragen = new Set();
for (let i = 0; i < 2; i++) {
  fragen.add(await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim()));
  const art = await page.evaluate(() => !!document.querySelector("[data-artikel-wort]"));
  ok(art, `257: Frage ${i + 1} ist eine Artikel-Frage`);
  await page.evaluate(() => [...document.querySelectorAll("[data-mc-knopf], .mc-btn, button")].find(b => /^(le|la)$/.test(b.textContent.trim()))?.click()); await sleep(1800);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^Weiter/.test(b.textContent.trim()))?.click()); await sleep(600);
}
ok([...fragen].every(f => f === "Wort1" || f === "Wort2"), `257: nur „le chat“ und „la maison“ gefragt (${[...fragen].join(", ")})`);

// ── 258: Puzzle – Score-Symbole sichtbar, Puls beim Ändern ──
await lade("fr", ["chat", "maison", "porte"]);
await nurArt("puzzle");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const sym = () => page.evaluate(() => { const s = document.querySelector("[data-karte-antwort] .score-symbole"); return s ? { score: s.dataset.scoreSymbole, puls: s.querySelectorAll(".puls").length } : null; });
const vor = await sym();
ok(vor && vor.score === "0", `258: Puzzle – Kreise in der Antwort-Box (${JSON.stringify(vor)})`);
const frage = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
const ziel = { Wort1: "chat", Wort2: "maison", Wort3: "porte" }[frage];
for (const c of [...ziel]) { await page.evaluate(c => [...document.querySelectorAll("[data-puzzle-kachel]:not([disabled])")].find(b => b.textContent === c)?.click(), c); await sleep(40); }
await sleep(100);
const nach = await sym();
ok(nach && nach.score === "1" && nach.puls === 1, `258: richtig gelegt – Score 1, ein Kreis pulsiert (${JSON.stringify(nach)})`);

// ── 258: Memory (Zuordnungs-Familie) – Symbole je Vokabel in den Ergebnis-Zeilen ──
await lade("fr", ["chat", "maison", "porte", "table"]);
await nurArt("memory");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(900);
const mk = await page.evaluate(() => [...document.querySelectorAll("[data-memory-karte]")].map(b => ({ i: +b.dataset.memoryKarte, id: b.dataset.memoryId })));
for (const id of [...new Set(mk.map(k => k.id))]) {
  const [x, y] = mk.filter(k => k.id === id);
  await page.click(`[data-memory-karte="${x.i}"]`); await sleep(80); await page.click(`[data-memory-karte="${y.i}"]`); await sleep(150);
}
await sleep(400);
const zeilen = await page.evaluate(() => [...document.querySelectorAll("[data-zuo-score] .score-symbole")].map(s => s.dataset.scoreSymbole));
ok(zeilen.length >= 1 && zeilen.every(x => x === "1"), `258: Memory – Ergebnis-Zeilen zeigen den Score je Vokabel (${zeilen.join(",")})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
