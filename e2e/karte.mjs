import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1400 });
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
const zeile = async (name, btn) => {
  const r = await page.evaluate((n, b) => {
    const z = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n) && d.querySelector(".checkbox"));
    if (!z) return "zeile fehlt";
    if (b === "__check") { z.firstElementChild.click(); return true; }
    const x = [...z.querySelectorAll("button")].find(x => x.textContent.trim().startsWith(b)); x?.click(); return !!x;
  }, name, btn);
  if (r !== true) throw new Error(`${name} ${btn}: ${r}`);
  await sleep(250);
};
const aktiverModus = name => page.evaluate(n => {
  const z = [...document.querySelectorAll("div")].find(d => d.style.padding === "10px 16px" && d.textContent.includes(n) && d.querySelector(".checkbox"));
  return [...(z?.querySelectorAll(".spalten-modus-btn.aktiv") || [])].map(b => b.textContent.trim()).join(",");
}, name);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Infinitive",E2:"Simple Past",E3:"Past Participle",D1:"Deutsch"}[t] || "", aktiv: ["E1","E2","E3","D1"].includes(t) }]));
  const l = { id:"l_en", name:"Irregular Verbs", sprache:"en", spalten: sp, naechste_id:3, vokabeln: [
    { id:1, E1:{wert:"go",falsch:[]}, E2:{wert:"went",falsch:[]}, E3:{wert:"gone",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
    { id:2, E1:{wert:"see",falsch:[]}, E2:{wert:"saw",falsch:[]}, E3:{wert:"seen",falsch:[]}, D1:{wert:"sehen",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:l.name, sprache:"en" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Irregular Verbs");
await clickText("button", "Quiz starten", true);
await page.click("[data-abfragemodus]"); await sleep(300);
await zeile("Simple Past", "__check");
await zeile("Simple Past", "Antwort");
ok(await aktiverModus("Infinitive") === "Karte", "Infinitive: Karte");
ok(await aktiverModus("Simple Past") === "Karte", `Neu hinzugefügte Antwort-Spalte: Karte (${await aktiverModus("Simple Past")})`);

// Quiz: zweite Spalte muss als Karte (Aufdecken + Gewusst/Nicht gewusst) erscheinen
await clickText("button", "Quiz starten (");
await sleep(400);
await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
await sleep(250);
await clickText(".karte-btn", "Gewusst");
await sleep(1300);
const zweite = await page.evaluate(() => ({ input: !!document.querySelector("input.inp"), aufdecken: !!document.querySelector(".sektion[style*='pointer']") }));
ok(!zweite.input && zweite.aufdecken, `Spalte 2 im Quiz als Karte (kein Eingabefeld) ${JSON.stringify(zweite)}`);
await clickText("button", "Beenden");
await sleep(300);
const zu = await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent)));
if (zu) await clickText("button", "Zur Übersicht");

// Modus "wechselnd": alle Spalten Karte
if (!(await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "wechselnd"))))
  await page.click("[data-abfragemodus]"); await sleep(300);
await clickText(".toggle-opt", "wechselnd", true);
await sleep(300);
const modi = await page.evaluate(() => [...document.querySelectorAll(".spalten-modus-btn.aktiv")].map(b => b.textContent.trim()));
console.log("     wechselnd:", modi.join(","));
ok(modi.length >= 2 && modi.every(m => m === "Karte"), "wechselnd: alle Spalten Karte");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
