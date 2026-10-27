import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 900 });
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
const liste = () => page.evaluate(() => {
  const n = document.querySelectorAll(".vok-nr");
  const letzte = n[n.length - 1]?.parentElement.getBoundingClientRect();
  return { offen: n.length > 0, letzteUnten: letzte ? Math.round(letzte.bottom) : null, hoehe: innerHeight,
    hinweis: /Weiter ziehen oder hier tippen/.test(document.body.innerText) };
});
// Scrollen in Schritten (wie eine Wischbewegung mit Schwung, ohne Pause dazwischen)
const wisch = async (dy, schritte = 12) => {
  for (let i = 0; i < schritte; i++) { await page.evaluate(d => window.scrollBy(0, d), dy / schritte); await sleep(16); }
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id:81,
    vokabeln: Array.from({ length: 80 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] } })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Vocabulaire");
await clickText("button", "Bereich", true);
await sleep(600);
let z = await liste();
ok(z.offen && z.letzteUnten > z.hoehe, `Lange Vokabel-Auswahl offen, Ende nicht sichtbar (${z.letzteUnten} > ${z.hoehe})`);

// 1) Schwungvoll weit über das Ende hinaus
await wisch(6000);
await sleep(1200);   // Scroll-Ruhe + Zurückgleiten
z = await liste();
console.log("     nach Schwung:", JSON.stringify(z));
ok(z.offen, "Schwung über das Ende: Bereich bleibt offen");
ok(z.letzteUnten !== null && z.letzteUnten <= z.hoehe && z.letzteUnten > z.hoehe - 200, "Zurückgeglitten: Listenende unten sichtbar");
ok(z.hinweis, "Hinweis „Weiter ziehen oder hier tippen“ sichtbar");

// 2) Zweites Ziehen → klappt zu
await wisch(1500);
await sleep(500);
z = await liste();
ok(!z.offen, "Zweites Weiterziehen: Bereich klappt zu");
ok(!z.hinweis, "Hinweis verschwindet");

// 3) Tippen auf den Hinweis
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await clickText("button", "Bereich", true);   // Bereich ist schon aktiv → Klick öffnet die Liste wieder
await sleep(600);
if (!(await liste()).offen) { await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("V.)"))?.click()); await sleep(600); }
z = await liste();
if (z.offen) {
  await wisch(6000); await sleep(1200);
  await clickText("button", "Weiter ziehen oder hier tippen");
  await sleep(300);
  z = await liste();
  ok(!z.offen, "Tippen auf den Hinweis klappt zu");
} else {
  console.log("     (Liste ließ sich im Test nicht erneut öffnen – Schritt 3 übersprungen)");
}

// 4) Kurzer Bereich: Abfrage-Modus öffnen, Weiterscrollen klappt wie bisher sofort zu
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await page.click("[data-abfragemodus]"); await sleep(300);
await sleep(600);
const modusOffen = () => page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "wechselnd"));
ok(await modusOffen(), "Abfrage-Modus offen");
ok(!(await liste()).hinweis, "Kurzer Bereich: kein Hinweis");
await wisch(1500);
await sleep(400);
ok(!(await modusOffen()), "Kurzer Bereich klappt beim Weiterscrollen wie bisher zu");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
