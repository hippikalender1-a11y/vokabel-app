import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1100 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
page.on("console", m => { if (m.type() === "error") console.log("CONSOLE", m.text()); });
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
const titel = () => page.evaluate(() => [...document.querySelectorAll(".topbar-title")].map(e => e.textContent).join(" | "));
const paketDurchspielen = async (n) => {
  for (let k = 0; k < n; k++) {
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
    await sleep(250);
    await clickText(".karte-btn", "Gewusst");
    await sleep(1200);
  }
};

const start = process.argv[2] || "quiztab";
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id:13,
    vokabeln: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] } })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);

if (start === "detail") {
  await clickText(".tab", "Listen");
  await clickText(".karte-zeile", "Vocabulaire");
  await clickText("button", "Quiz starten", true);
} else {
  await clickText(".tab", "Quiz");
  await clickText(".quiz-setup-check", "Vocabulaire");
}
if (start === "preset") {
  // Bereich: 8 Vokabeln per Checkbox
  await clickText("button", "Bereich", true);
  await sleep(300);
  await page.evaluate(() => {
    const zeilen = [...document.querySelectorAll(".vok-nr")].slice(0, 8);
    zeilen.forEach(z => z.parentElement.click());
  });
  await sleep(300);
}
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Pakete|\d+ V\.)$/.test(b.textContent.trim()))?.click()); await sleep(300);
await clickText(".typ-btn", "5", true);
await sleep(300);
if (start === "preset") {
  await clickText("button", "Speichern", true);
  await page.type(".modal input.inp", "Mein Preset");
  await page.evaluate(() => [...document.querySelectorAll(".modal .btn-primary")].pop()?.click());
  await sleep(400);
  console.log("     Slots:", await page.evaluate(() => localStorage.getItem("vokabel_slots")?.slice(0, 160)));
}
const startBtn = await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent.trim()).find(t => /^Quiz starten/.test(t)));
console.log("     Start-Button:", startBtn);
await clickText("button", "Quiz starten (");
await sleep(500);
await paketDurchspielen(5);
console.log("     Nach Paket 1:", await titel());
ok((await text()).includes("Nächste 5 Vokabeln"), "Paket 1 fertig, Button sichtbar");
await clickText("button", "Nächste 5 Vokabeln");
await sleep(600);
const t2 = await titel();
console.log("     Nach Klick:", t2);
const sa = await page.evaluate(() => localStorage.getItem("vokabel_session_aktiv"));
console.log("     sessionAktiv:", sa?.slice(0, 200));
ok(!t2.includes("Paket fertig"), "Klick auf „Nächste 5 Vokabeln“ startet das nächste Paket");

await browser.close();
process.exit(fehler ? 1 : 0);
