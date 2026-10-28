import puppeteer from "puppeteer-core";

// Statistik: Lang-Druck auf eine Gruppe des Kreisdiagramms → Menü „Quiz mit n Vokabeln“ → Rückfrage → Quiz mit genau dieser Gruppe
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 1000 });
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
const menue = async sel => {
  await page.evaluate(sel => {
    const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 }));
  }, sel);
  await sleep(250);
};
const aktionen = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.textContent.trim()));
const titel = () => page.evaluate(() => document.querySelector(".topbar-title")?.textContent.trim());
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
// alle Karten durchgehen: aufdecken, Gewusst; gefragte Wörter sammeln
const durchlaufen = async () => {
  const gefragt = [];
  for (let i = 0; i < 10; i++) {
    const f = await frage(); if (!f) break;
    gefragt.push(f);
    await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(250);
    const weiter = await page.evaluate(() => { const b = document.querySelector(".karte-btn-ja"); b?.click(); return !!b; });
    if (!weiter) break;
    await sleep(1200);
  }
  return gefragt;
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
  const liste = (id, name, w) => ({ id, name, sprache:"fr", spalten: sp, naechste_id: w.length + 1,
    vokabeln: w.map(([e, d, sc], i) => ({ id:i+1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]}, ...(sc === null ? {} : { fortschritt: f(sc) }) })) });
  const a = liste("l_a", "Verbes", [["aller","gehen",-2],["venir","kommen",-1],["partir","abfahren",4],["sortir","ausgehen",1]]);
  const b = liste("l_b", "Tiere", [["chat","Katze",-3],["chien","Hund",null]]);
  [a, b].forEach(l => localStorage.setItem("vokabel_liste_" + l.id, JSON.stringify(l)));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([a, b].map(l => ({ id:l.id, name:l.name, sprache:"fr" }))));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Statistik"); await sleep(400);

await menue('[data-kreis-gruppe="negativ"]');
let a = await aktionen();
console.log("     Menü:", a.join(" | "));
ok(a.includes("▶ Quiz mit 3 Vokabeln"), "Lang-Druck auf „Negativ“: Menü „Quiz mit 3 Vokabeln“");
await page.evaluate(() => document.querySelector('[data-info-aktion="▶ Quiz mit 3 Vokabeln"]').click()); await sleep(250);
const rf = await page.evaluate(() => document.querySelector("[data-gruppen-quiz]")?.innerText.replace(/\s+/g, " "));
console.log("     Rückfrage:", rf);
ok(/Quiz starten\?/.test(rf || "") && /3 Vokabeln aus „Negativ“/.test(rf || ""), "Rückfrage erscheint");
await clickText("[data-gruppen-quiz] button", "Abbrechen", true);
ok(!/^\d+ \/ \d+$/.test(await titel() || "") && !(await page.$("[data-gruppen-quiz]")), "Abbrechen: kein Quiz, Statistik bleibt");

await menue('[data-legende="negativ"]');
await page.evaluate(() => document.querySelector('[data-info-aktion="▶ Quiz mit 3 Vokabeln"]').click()); await sleep(250);
await clickText("[data-gruppen-quiz] button", "Starten", true); await sleep(600);
ok(await titel() === "1 / 3", `Quiz läuft mit 3 Vokabeln (${await titel()})`);
const gefragt = await durchlaufen();
console.log("     gefragt:", gefragt.join(", "));
ok(gefragt.length === 3 && ["gehen","kommen","Katze"].every(w => gefragt.includes(w)), "genau die negativen Vokabeln aus beiden Listen");
ok(gefragt[0] === "Katze", "schlechteste zuerst (Katze −3)");

// Gelernt (Score 4 > Standard-Grenze 3) lässt sich trotzdem abfragen
await clickText("button", "Zur Statistik"); await sleep(400);
await clickText(".toggle-btn.zeile-rechts .toggle-opt", "Alle", true); await sleep(300);   // Statistik zeigt danach die Quiz-Auswahl → wieder alle
await menue('[data-kreis-gruppe="gelernt"]');
await page.evaluate(() => document.querySelector('[data-info-aktion="▶ Quiz mit 1 Vokabel"]').click()); await sleep(250);
await clickText("[data-gruppen-quiz] button", "Starten", true); await sleep(600);
ok(await titel() === "1 / 1" && await frage() === "abfahren", `Gelernt-Gruppe: Quiz mit „abfahren“ (${await titel()} ${await frage()})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
