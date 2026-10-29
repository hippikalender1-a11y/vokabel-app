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
const text = () => page.evaluate(() => document.body.innerText);
const karteGewusst = async (n) => {
  for (let k = 0; k < n; k++) {
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
    await sleep(250);
    await clickText(".karte-btn", "Gewusst");
    await sleep(1200);
  }
};
const seed = async () => {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const l = { id:"l_fr", name:"Vocabulaire", sprache:"fr", spalten: sp, naechste_id:13,
      vokabeln: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, E1: { wert: "mot" + i, falsch: [] }, D1: { wert: "Wort" + i, falsch: [] },
        fortschritt: { score: 2, streak: 0, aufgedecktStreak: 0, letzteAbfrage: null } })) };
    localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  });
  await page.reload(); await sleep(500);
  await clickText(".tab", "Quiz");
  await clickText(".quiz-setup-check", "Vocabulaire");
};
// Auswahlbereich ist nach dem Laden zugeklappt → zum Prüfen der Chips öffnen
const statistikInfo = async () => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv")?.click(); });
  await sleep(300);
  return statistikInfoRoh();
};
const statistikInfoRoh = () => page.evaluate(() => ({
  tabAktiv: document.querySelector(".tab.aktiv")?.textContent,
  anzahl: [...document.querySelectorAll("span")].map(s => s.textContent).filter(t => /^\(\d+ V\.\)$/.test(t)),
  chipAktiv: [...document.querySelectorAll(".slot-chip")].filter(c => c.style.borderColor === "rgb(45, 106, 79)").map(c => c.textContent.trim()),
}));

// ── A: normale Runde, Bereich mit 3 Vokabeln ──
await seed();
await page.evaluate(() => { const b = [...document.querySelectorAll(".toggle-opt")].find(x => x.textContent.trim() === "Alle" && /Pakete|V\./.test(x.nextElementSibling?.textContent || "")); b?.click(); }); await sleep(300);
await clickText("button", "Bereich", true);
await page.evaluate(() => [...document.querySelectorAll(".vok-nr")].slice(0, 3).forEach(z => z.parentElement.click()));
await sleep(300);
await clickText("button", "Quiz starten (");
await sleep(400);
await karteGewusst(3);
let t = await text();
ok(t.includes("Weiter →") && !t.includes("Zur Statistik"), "Runde fertig: nur „Weiter →“");
await clickText("button", "Weiter →", true);
t = await text();
ok(t.includes("Session-Auswertung") && t.includes("Zur Übersicht") && t.includes("Zur Statistik"), "Auswertung: beide Buttons sichtbar");
await clickText("button", "Zur Statistik");
await sleep(500);
let si = await statistikInfo();
t = await text();
console.log("     Statistik A:", JSON.stringify(si));
ok(si.tabAktiv === "Statistik", "A: Statistik-Tab geöffnet");
ok(si.anzahl.includes("(3 V.)"), "A: genau die 3 Vokabeln der Runde");
ok(!/\bSession\b/.test((t.match(/(Lernfortschritt|Ø Score)[\s\S]{0,60}/) || [""])[0]), "A: kein Global/Session-Schalter mehr");
await page.screenshot({ path: "statistik_runde.png" });

// ── B: Pakete, kompletter Durchlauf (12 Vokabeln, Pakete à 10 + 2) ──
await seed();
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^(Pakete|\d+ V\.)$/.test(b.textContent.trim()))?.click()); await sleep(300);
await clickText(".typ-btn", "10", true);
await clickText("button", "Quiz starten (");
await sleep(400);
await karteGewusst(10);
await clickText("button", "Nächste 10 Vokabeln");
await sleep(400);
await karteGewusst(2);
t = await text();
ok(t.includes("Durchlauf abgeschlossen") && t.includes("Weiter →"), "Durchlauf abgeschlossen: „Weiter →“");
await clickText("button", "Weiter →", true);
t = await text();
ok(t.includes("Session-Auswertung") && t.includes("Zur Statistik"), "Session-Auswertung: Button „Zur Statistik“ sichtbar");
await clickText("button", "Zur Statistik");
await sleep(500);
si = await statistikInfo();
console.log("     Statistik B:", JSON.stringify(si));
ok(si.tabAktiv === "Statistik", "B: Statistik-Tab geöffnet");
ok(si.chipAktiv.length === 1, `B: Verlauf-Eintrag der Session aktiv (${si.chipAktiv})`);
ok(si.anzahl.includes("(12 V.)"), "B: alle 12 Vokabeln der Session");
await page.screenshot({ path: "statistik_session.png" });

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
