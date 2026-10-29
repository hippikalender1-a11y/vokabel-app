import puppeteer from "puppeteer-core";

// Vokabel erreicht mit „Gewusst“ die Gelernt-Schwelle → Karte leuchtet kurz hellgelb; andere nicht.
// Mini-Kreis bei 100 % komplett grün gefüllt.
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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
const blitz = () => page.evaluate(() => !!document.querySelector(".quiz-antwort-box.gelernt-blitz"));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 3, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]}, fortschritt: f(2) },     // 2 → 3: erreicht die Schwelle 3
    { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]}, fortschritt: f(-2) } ] }; // −2 → −1: nicht
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Verbes");
await clickText("button", "Quiz starten", true);
await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].find(b => b.textContent.trim() === "Listen-Nr.")?.click());
await clickText("button", "Quiz starten (");
await sleep(300);

const gesehen = {};
for (let i = 0; i < 2; i++) {
  const f = await frage();
  await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(200);
  await clickText(".karte-btn-ja", "Gewusst");
  gesehen[f] = await blitz();
  if (process.env.SHOT && f === "gehen") { await sleep(150); await page.screenshot({ path: "blitz_shot.png", clip: { x: 0, y: 60, width: 390, height: 420 } }); }
  await sleep(1200);
}
console.log("     Aufleuchten:", JSON.stringify(gesehen));
ok(gesehen.gehen === true, "„gehen“ (Score 2 → 3, Schwelle 3): Karte leuchtet hellgelb");
ok(gesehen.kommen === false, "„kommen“ (Score −2 → −1): kein Aufleuchten");

// Mini-Kreis Ü bei 100 %: komplett grün
await clickText("button", "Zur Übersicht").catch(() => {});
await clickText(".tab", "Listen");
await page.evaluate(() => { const l = JSON.parse(localStorage.getItem("vokabel_liste_l_fr")); l.vokabeln.forEach(v => v.fortschritt = { score: 4 }); localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l)); });
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
const kreis = await page.evaluate(() => { const k = document.querySelector('[data-listen-kreise] [data-mini-kreis="uebersetzung"]'); return { pct: k?.dataset.pct, fill: k?.querySelector("circle")?.getAttribute("fill") }; });
console.log("     Kreis Ü:", JSON.stringify(kreis));
ok(kreis.pct === "100" && kreis.fill === "#52b788", "100 %: Kreis komplett grün gefüllt");
const d = await page.evaluate(() => document.querySelector('[data-listen-kreise] [data-mini-kreis="diktat"] circle')?.getAttribute("fill"));
ok(d === "#fff", "0 %: Kreis nicht gefüllt");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
