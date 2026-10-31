import puppeteer from "puppeteer-core";

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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const text = () => page.evaluate(() => document.body.innerText);

async function runde(scores, antworten) {
  await page.goto(URL);
  await page.evaluate((scores) => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const f = s => ({ score: s, streak: 2, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
    const woerter = [["aller","gehen"],["venir","kommen"],["partir","abfahren"],["sortir","ausgehen"]];
    const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:5,
      vokabeln: woerter.map(([e, d], i) => ({ id: i + 1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]}, fortschritt: f(scores[i]) })) };
    localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
    localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
  }, scores);
  await page.reload(); await sleep(500);
  await clickText(".tab", "Quiz");
  await clickText(".quiz-setup-check", "Verbes");
  // Abfrage-Ziel "Anzahl" (ein Durchgang) – dieser Test prüft die Punkte eines einzelnen Durchgangs
  if (!(await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].some(b => b.textContent.trim() === "Anzahl"))))
    await page.evaluate(() => document.querySelector("[data-abfrageziel]")?.click());
  await sleep(300);
  await clickText(".typ-btn", "Anzahl", true);
  await clickText("[data-start-knopf]", "");
  await sleep(400);
  for (let k = 0; k < Object.keys(antworten).length; k++) {
    const t = await text();
    const v = Object.keys(antworten).find(d => t.includes(d));
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
    await sleep(250);
    await clickText(".karte-btn", antworten[v] ? "Gewusst" : "Nicht gewusst");
    await sleep(1300);
  }
  return text();
}

// Runde 1: aller 3, venir 3 (gelernt, ausgeblendet), partir 2 ✓, sortir 2 ✗
// vorher (100+100+67+67)/4 = 83 %, nachher partir 3 (100), sortir 1 (33) → 83 % ; +1 neu gelernt
let t = await runde([3, 3, 2, 2], { abfahren: true, ausgehen: false });
console.log("     Runde 1:", (t.match(/✓ \+\d+ neu gelernt|Lernfortschritt[^\n]*/g) || []).join(" | "));
ok(/✓ \+1 neu gelernt/.test(t), "Runde 1: „+1 neu gelernt“");
ok(!/Lernfortschritt/.test(t) && /\(Score \+3 erreicht\)/.test(t), "Runde 1: keine unklare Lernfortschritt-Zahl, „neu gelernt“ mit Erklärung (Score +3 erreicht)");
ok(await page.evaluate(() => !!document.querySelector("svg[data-ergebniskreis]")), "Ergebnis als Kreisdiagramm");
ok(!/Geschafft/.test(t), "Runde 1: keine Gratulation");

// Runde 2: partir 2 ✓, sortir 2 ✓ → alle gelernt → 100 %
t = await runde([3, 3, 2, 2], { abfahren: true, ausgehen: true });
console.log("     Runde 2:", (t.match(/Geschafft[^\n]*|✓ \+\d+ neu gelernt|Lernfortschritt[^\n]*/g) || []).join(" | "));
ok(/Geschafft! Alle 4 Vokabeln gelernt\./.test(t), "Runde 2: Gratulation „Geschafft! Alle 4 Vokabeln gelernt.“");
ok(/✓ \+2 neu gelernt/.test(t), "Runde 2: +2 neu gelernt");
await page.screenshot({ path: "bilanz.png" });

// Listen-Übersicht
await clickText("button", "Zur Übersicht");
await clickText(".tab", "Listen");
await sleep(300);
const kr = await page.evaluate(() => [...document.querySelectorAll("[data-liste-id]")].filter(d => d.textContent.includes("Verbes")).map(d => [...d.querySelectorAll("[data-listen-kreise] [data-mini-kreis]")].map(k => k.dataset.miniKreis + ":" + k.dataset.pct).join(",")).join());
console.log("     Listen-Kreise:", kr);
ok(/^uebersetzung:100,/.test(kr), "Listen-Übersicht: Kreis Ü bei Verbes 100 %");
await page.screenshot({ path: "listen_fortschritt.png" });

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
