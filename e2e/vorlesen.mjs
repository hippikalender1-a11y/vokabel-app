import puppeteer from "puppeteer-core";

// Vorlesen: jede Spalte mit einer Stimme ihrer Sprache (Deutsch nie mit französischer Stimme).
// Sprachausgabe als Attrappe mit deutschen und französischen Stimmen; protokolliert Text, lang und Stimme.
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
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
await page.evaluateOnNewDocument(() => {
  const stimmen = [
    { name: "Amelie", lang: "fr-FR", default: true, localService: true },   // Standardstimme des Geräts: Französisch
    { name: "Anna", lang: "de-DE", default: false, localService: true },
    { name: "Petra", lang: "de_DE", default: false, localService: false },
  ];
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; } };
  Object.defineProperty(window, "speechSynthesis", { value: {
    getVoices: () => stimmen, cancel() {}, addEventListener() {},
    speak(u) { window.__gesprochen.push({ text: u.text, lang: u.lang, stimme: u.voice?.name || null }); },
  } });
});

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 2,
    vokabeln: [{ id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]} }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ autoplay: true, vorlesen: ["E1", "D1"], gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Verbes");
await clickText("button", "Quiz starten", true);
await clickText("[data-start-knopf]", "");
await sleep(600);
// Frage „gehen“ (Deutsch) wird automatisch vorgelesen
// Französisch: Vorlese-Knopf in der Vokabelliste der Liste
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
if (await page.evaluate(() => /Zur Übersicht/.test(document.body.innerText))) await clickText("button", "Zur Übersicht");
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Verbes");
await page.evaluate(() => { const b = document.querySelector('button[title="Vorlesen"]'); if (!b) [...document.querySelectorAll("button, div")].find(x => /^Vokabeln/.test(x.textContent.trim()) && x.onclick)?.click(); });
await sleep(300);
await page.evaluate(() => document.querySelector('button[title="Vorlesen"]')?.click()); await sleep(150);
const g = await page.evaluate(() => window.__gesprochen);
console.log("     gesprochen:", JSON.stringify(g));
const de = g.filter(x => x.text === "gehen"), fr = g.filter(x => x.text === "aller");
ok(de.length > 0 && de.every(x => x.lang === "de-DE" && (x.stimme === "Anna" || x.stimme === "Petra")), "Deutsch: lang de-DE mit deutscher Stimme (nicht die französische Standardstimme)");
ok(fr.length > 0 && fr.every(x => x.lang === "fr-FR" && x.stimme === "Amelie"), "Französisch: lang fr-FR mit französischer Stimme");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
