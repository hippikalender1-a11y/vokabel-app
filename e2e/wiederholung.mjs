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
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const text = () => page.evaluate(() => document.body.innerText);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:3, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
    { id:2, E1:{wert:"voir",falsch:[]},  D1:{wert:"sehen",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Verbes");
// Session-Bereich öffnen und Standard prüfen
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Pakete|\d+ V\.)$/.test(b.textContent.trim()))?.click());
await sleep(300);
const aktiv = await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].map(b => b.textContent.trim()));
console.log("     aktive Knöpfe:", aktiv.join(" | "));
ok(aktiv.includes("Mit Wiederholung") && aktiv.includes("1×"), "Standard: Abfrage-Ziel „Mit Wiederholung“ 1×");
ok(aktiv.includes("10"), "Standard: Paketgröße 10");

// Quiz: gehen gewusst, sehen beim 1. Mal nicht, danach gewusst
await clickText("button", "Quiz starten (");
await sleep(400);
const gefragt = [];
for (let k = 0; k < 6; k++) {
  const t = await text();
  if (/Durchlauf abgeschlossen|Auswertung|Paket fertig/.test(t)) break;
  const v = t.includes("gehen") ? "gehen" : "sehen";
  gefragt.push(v);
  const gewusst = v === "gehen" || gefragt.filter(x => x === "sehen").length > 1;
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
  await sleep(250);
  await clickText(".karte-btn", gewusst ? "Gewusst" : "Nicht gewusst");
  await sleep(1300);
}
console.log("     Abfragefolge:", gefragt.join(" → "));
ok(gefragt.filter(x => x === "sehen").length === 2 && gefragt.filter(x => x === "gehen").length === 1, "Nicht gewusste Vokabel kommt wieder, bis sie 1× gewusst wurde");
const t = await text();
ok(/Durchlauf abgeschlossen|Auswertung/.test(t), "Danach ist die Runde fertig");

const scores = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => [v.D1.wert, v.fortschritt?.score])));
console.log("     Scores:", JSON.stringify(scores));
ok(scores.sehen === -1 && scores.gehen === 1, "Nur erste Bewertung zählt: sehen −1 (nicht 0), gehen +1");
ok(/1 von 2 richtig/.test(t), "Auswertung zählt jede Vokabel einmal: 1 von 2 richtig");

// Ausnahme Abfrage-Ziel "Score": jede Antwort zählt (sonst endet die Runde nie)
await clickText("button", "Zur Übersicht");
await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem("vokabel_liste_l_fr"));
  l.vokabeln.forEach(v => { delete v.fortschritt; });
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
});
if (!(await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].some(b => b.textContent.trim() === "Score"))))
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Pakete|\d+ V\.)$/.test(b.textContent.trim()))?.click());
await sleep(300);
await clickText(".typ-btn", "Score", true);
// Ziel-Score per Schieberegler auf +2
await page.evaluate(() => { const r = [...document.querySelectorAll('input[type="range"]')].pop(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(r, "2"); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); });
await sleep(300);
await clickText("button", "Quiz starten (");
await sleep(400);
let schritte = 0;
for (; schritte < 10; schritte++) {
  const tt = await text();
  if (/Durchlauf abgeschlossen|Auswertung|Paket fertig/.test(tt)) break;
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
  await sleep(250);
  await clickText(".karte-btn", "Gewusst");
  await sleep(1300);
}
const sc2 = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => v.fortschritt?.score));
console.log("     Score-Ziel +2: Schritte", schritte, "Scores", JSON.stringify(sc2));
ok(schritte === 4 && sc2.every(x => x === 2), "Abfrage-Ziel Score: jede Antwort zählt, Runde endet bei +2");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
