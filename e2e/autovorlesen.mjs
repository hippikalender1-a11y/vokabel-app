import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// Auto-Vorlesen in der Kartenabfrage: 🔊 in der Kopfzeile schaltet es während der Abfrage an/aus (dauerhaft gespeichert);
// Frage beim Erscheinen und Antwort beim Aufdecken werden vorgelesen, wenn ihre Spalte gewählt ist; Lang-Druck wählt die Spalten
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
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; } };
  Object.defineProperty(window, "speechSynthesis", { value: {
    getVoices: () => [{ name: "Amelie", lang: "fr-FR", default: true, localService: true }, { name: "Anna", lang: "de-DE", default: false, localService: true }],
    cancel() {}, addEventListener() {}, speaking: false, pending: false,
    speak(u) { window.__gesprochen.push({ text: u.text, lang: u.lang }); },
  } });
});
const gesprochen = () => page.evaluate(() => window.__gesprochen);
const schalter = () => page.evaluate(() => document.querySelector("[data-autoplay-schalter]")?.dataset.autoplaySchalter);
const einst = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")));
const aufdecken = async () => { await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(300); };
const gewusst = async () => { await clickText(".karte-btn", "Gewusst"); await sleep(1300); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 4,
    vokabeln: [{ id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]} }, { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]} },
      { id:3, E1:{wert:"voir",falsch:[]}, D1:{wert:"sehen",falsch:[]} }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ autoplay: false, vorlesen: ["E1"], gelerntSchwelle: 3, sprache: "alle" }));
});
await page.reload(); await sleep(500);
await zuListen(page);
await clickText(".karte-zeile", "Verbes");
await clickText("button", "Quiz starten", true);
await clickText("[data-start-knopf]", "");
await sleep(500);
ok(await schalter() === "aus" && (await gesprochen()).length === 0, "Kartenabfrage: 🔊-Schalter in der Kopfzeile, aus – nichts vorgelesen");

await page.click("[data-autoplay-schalter]"); await sleep(300);
ok(await schalter() === "an" && (await einst()).autoplay === true, "antippen: Auto-Vorlesen an und gespeichert");
ok((await gesprochen()).length === 0, "Frage (Deutsch) nicht vorgelesen – nur Französisch gewählt");
await page.screenshot({ path: "autovorlesen.png", clip: { x: 0, y: 0, width: 390, height: 260 } });
await aufdecken();
let g = await gesprochen();
console.log("     gesprochen:", JSON.stringify(g));
ok(g.length === 1 && ["aller", "venir", "voir"].includes(g[0].text) && g[0].lang === "fr-FR", "Aufdecken: französische Antwort automatisch vorgelesen");
await gewusst();
await aufdecken();
g = await gesprochen();
ok(g.length === 2 && g[1].text !== g[0].text, "nächste Karte: Antwort wieder vorgelesen (einmal je Karte)");

// Lang-Druck: Spalten wählen → Deutsch dazu
await page.evaluate(() => { const el = document.querySelector("[data-autoplay-schalter]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); }); await sleep(300);
const menue = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.textContent.trim()));
console.log("     Menü:", menue.join(" | "));
ok(menue.includes("○ Deutsch vorlesen") && menue.includes("✓ Französisch vorlesen"), "Lang-Druck: Spalten der Abfrage mit ✓/○");
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.textContent.includes("Deutsch")).click()); await sleep(300);
ok((await einst()).vorlesen.includes("D1"), "Deutsch zum Vorlesen gewählt");

// ausschalten: nächste Karte stumm
await page.click("[data-autoplay-schalter]"); await sleep(300);
ok(await schalter() === "aus" && (await einst()).autoplay === false, "erneut antippen: aus");
await gewusst();
await aufdecken();
ok((await gesprochen()).length === 2, "aus: weder Frage noch Antwort vorgelesen");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
