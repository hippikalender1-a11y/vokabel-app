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
const info = () => page.evaluate(() => ({
  session: (() => { const p = [...document.querySelectorAll(".toggle-opt")].find(b => /^(\d+ V\.|Pakete)$/.test(b.textContent.trim()));
    if (!p) return null; return p.classList.contains("aktiv") ? p.textContent.trim() : (p.previousElementSibling?.classList.contains("aktiv") ? "Alle" : "?"); })(),
  start: [...document.querySelectorAll("button")].map(b => b.textContent.trim()).find(t => /^Quiz starten/.test(t)),
}));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id:26,
    vokabeln: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] } })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Vocabulaire");
let i = await info();
console.log("     Start:", JSON.stringify(i));
ok(i.session === "10 V." && i.start === "Quiz starten (10 Vokabeln)", "App-Start: Pakete mit 10 Vokabeln");

// "Alle" wählen, dann "Neu" → wieder 10
await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].find(x => x.textContent.trim() === "Alle" && /V\./.test(x.nextElementSibling?.textContent || ""))?.click());
await sleep(300);
i = await info();
ok(i.session === "Alle" && /\(25 /.test(i.start), "„Alle“ gewählt: 25 Vokabeln");
await page.evaluate(() => window.scrollTo(0, 0));
if (!(await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].some(c => c.textContent.trim() === "Neu"))))
  await page.evaluate(() => [...document.querySelectorAll(".toggle-opt.aktiv")].find(b => b.textContent.trim() === "Neu")?.click());
await sleep(300);
await clickText(".slot-chip", "Neu", true);
await clickText(".quiz-setup-check", "Vocabulaire");
i = await info();
ok(i.session === "10 V." && /\(10 /.test(i.start), "Nach „Neu“: wieder Pakete mit 10");

// Start aus der Liste
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Vocabulaire");
await clickText("button", "Quiz starten", true);
i = await info();
ok(i.session === "10 V." && /\(10 /.test(i.start), "Quiz aus der Liste: Pakete mit 10");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
