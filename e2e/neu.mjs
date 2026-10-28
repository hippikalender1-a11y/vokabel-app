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
const zustand = () => page.evaluate(() => {
  const t = document.body.innerText;
  return {
    start: [...document.querySelectorAll("button")].map(b => b.textContent.trim()).find(x => /^Quiz starten/.test(x)) || "(kein Start)",
    kopfChip: [...document.querySelectorAll(".toggle-opt.aktiv")].map(b => b.textContent.trim())[0],
    reihenfolge: [...document.querySelectorAll(".aktiv")].map(b => b.textContent.trim()).find(x => ["Zufällig", "Schlechteste", "Listen-Nr."].includes(x)),
    gewaehlt: [...document.querySelectorAll(".quiz-setup-check .checkbox.checked")].length,
  };
});

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
    { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]} },
    { id:3, E1:{wert:"voir",falsch:[]},  D1:{wert:"sehen",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Verbes");
// Bereich: 2 Vokabeln, Reihenfolge Schlechteste, speichern
await clickText("button", "Bereich", true);
await page.evaluate(() => [...document.querySelectorAll(".vok-nr")].slice(0, 2).forEach(z => z.parentElement.click()));
await sleep(300);
await clickText("button", "Zufällig", true);
await clickText(".toggle-opt", "Schlechteste", true);
await clickText("button", "Speichern", true);
await page.evaluate(() => [...document.querySelectorAll(".modal .btn-primary")].pop()?.click());
await sleep(400);
let z = await zustand();
console.log("     Preset aktiv:", JSON.stringify(z));
ok(/\(2 /.test(z.start) && z.reihenfolge === "Schlechteste", "Preset: 2 Vokabeln, Schlechteste");

// Neu
await page.evaluate(() => window.scrollTo(0, 0));
if (!(await page.evaluate(() => /📌 Gespeichert/i.test(document.body.innerText)))) await clickText(".toggle-opt.aktiv", "Französisch");
await clickText(".slot-chip", "Neu", true);
await sleep(400);
z = await zustand();
console.log("     Nach Neu:", JSON.stringify(z));
ok(z.gewaehlt === 0 && !/Quiz starten \(\d/.test(z.start), "Neu: keine Liste mehr ausgewählt");
ok(z.kopfChip === "Neu", "Neu: kein Preset aktiv");
const sa = await page.evaluate(() => localStorage.getItem("vokabel_session_aktiv"));
ok(sa === null, "Neu: keine aktive Session");

await clickText(".quiz-setup-check", "Verbes");
z = await zustand();
ok(/\(3 /.test(z.start), `Liste neu gewählt: alle 3 Vokabeln (${z.start})`);
ok(z.reihenfolge === "Zufällig", `Neu: Reihenfolge zurück auf Zufällig (${z.reihenfolge})`);

// Statistik: Preset laden, dann Neu
await clickText(".tab", "Statistik");
await sleep(300);
const offen = await page.evaluate(() => /📌 Gespeichert/i.test(document.body.innerText));
if (!offen) await page.evaluate(() => document.querySelector(".toggle-opt.aktiv")?.click());
await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes("Französisch"))?.click());
await sleep(300);
let t = await page.evaluate(() => document.body.innerText);
ok(/\(2 V\.\)/.test(t), "Statistik: Preset zeigt 2 Vokabeln");
// nach dem Laden ist der Bereich zu → wieder öffnen
await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.click());
await sleep(300);
await clickText(".slot-chip", "Neu", true);
await sleep(300);
t = await page.evaluate(() => document.body.innerText);
ok(/GESAMT\s*\n?\s*3/i.test(t), "Statistik Neu: wieder alle 3 Vokabeln");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
