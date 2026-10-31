import puppeteer from "puppeteer-core";

// Gewählte Konfiguration / Listenauswahl bleibt beim Wechsel Quiz ↔ Statistik erhalten (beide Richtungen)
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
// Kopfzeile: Zustand + Name; Listen-Chip (rechte Spalte der Listen-Auswahl)
const stand = () => page.evaluate(() => {
  const k = document.querySelector("[data-slot-kopf]");
  const listen = [...document.querySelectorAll("button.zeile-rechts")].find(b => /Listen für/.test(b.getAttribute("title") || ""));
  // gespeicherte Konfiguration: Listen-Auswahl ausgeblendet
  return { kopf: k?.dataset.slotKopf, name: k?.querySelector("button.toggle-opt.aktiv")?.textContent.trim(), listen: listen ? listen.textContent.trim() : "(ausgeblendet)" };
});
const oeffneKopf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") k.querySelector("button.toggle-opt.aktiv").click(); }); await sleep(300); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name, w) => ({ id, name, sprache:"fr", spalten: sp, naechste_id: w.length + 1, vokabeln: w.map(([e, d], i) => ({ id:i+1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]} })) });
  const a = liste("l_a", "Tiere", [["chat","Katze"],["chien","Hund"]]);
  const b = liste("l_b", "Farben", [["rouge","rot"],["bleu","blau"],["vert","grün"]]);
  [a, b].forEach(l => localStorage.setItem("vokabel_liste_" + l.id, JSON.stringify(l)));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([a, b].map(l => ({ id:l.id, name:l.name, sprache:"fr" }))));
  const k = ids => ({ listenIds: ids, vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{E1:"karte"}, quizModus:"sequenziell" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_a", name:"Paket Tiere", timestamp:1, konfiguration:k(["l_a"]), platz:{z:0,s:0} },
    { id:"g_b", name:"Paket Farben", timestamp:1, konfiguration:k(["l_b"]), platz:{z:0,s:1} } ] }));
});
await page.reload(); await sleep(500);

// Quiz: Paket Tiere wählen → Statistik zeigt dasselbe
await clickText(".tab", "Quiz");
await oeffneKopf();
await clickText(".slot-chip", "Paket Tiere");
await clickText(".tab", "Statistik");
await sleep(300);
let st = await stand();
console.log("     Statistik:", JSON.stringify(st));
ok(st.kopf === "gruen" && st.name === "Paket Tiere" && st.listen === "(ausgeblendet)", "Quiz → Statistik: Paket Tiere bleibt gewählt (Listen-Auswahl ausgeblendet)");

// Statistik: Paket Farben wählen → Quiz zeigt dasselbe
await oeffneKopf();
await clickText(".slot-chip", "Paket Farben");
await clickText(".tab", "Quiz");
await sleep(300);
st = await stand();
console.log("     Quiz:", JSON.stringify(st));
ok(st.kopf === "gruen" && st.name === "Paket Farben" && st.listen === "(ausgeblendet)", "Statistik → Quiz: Paket Farben übernommen (Listen-Auswahl ausgeblendet)");
ok(await page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl) === "3" && /Farben · 3 Vokabeln/.test(await page.evaluate(() => { document.querySelector("[data-slot-kopf-name]").click(); return new Promise(r => setTimeout(() => { const t = document.querySelector("[data-kopf-info]")?.textContent || ""; document.querySelector("[data-slot-kopf-name]").click(); r(t); }, 300)); })), "Quiz: 3 Vokabeln aus Farben (Info-Zeile „Farben · 3 Vokabeln“)");

// Statistik: „Neu“ (alle Listen, keine Konfiguration) → Quiz ohne Konfiguration, beide Listen
await clickText(".tab", "Statistik");
await oeffneKopf();
await page.evaluate(() => [...document.querySelectorAll(".slot-kopf-knoepfe .slot-chip")].find(b => b.textContent.trim() === "Neu").click());
await sleep(300);
await clickText(".tab", "Quiz");
await sleep(300);
st = await stand();
console.log("     Quiz nach Statistik-Neu:", JSON.stringify(st));
ok(st.kopf !== "gruen" && st.listen === "2 Listen", "Statistik „Neu“ (alle Listen) → Quiz: keine Konfiguration, beide Listen");
ok(!(await page.$('[data-anzahl="fortschritt"]')), "Quiz: kein Fortschritt einer alten Session sichtbar");

// Quiz: nur Tiere → Statistik zeigt Tiere
await page.evaluate(() => document.querySelector("button.zeile-rechts[title^='Listen für']").click());
await sleep(300);
await clickText(".quiz-setup-check", "Farben");
await clickText(".tab", "Statistik");
await sleep(300);
st = await stand();
ok(st.listen === "Tiere", "Quiz-Listenauswahl → Statistik: Tiere");
// Statistik: Liste Farben dazu → Quiz zeigt beide
await page.evaluate(() => document.querySelector("button.zeile-rechts[title^='Listen für']").click());
await sleep(300);
await clickText(".quiz-setup-check", "Farben");
await clickText(".tab", "Quiz");
await sleep(300);
st = await stand();
console.log("     Quiz nach Statistik-Auswahl:", JSON.stringify(st));
ok(st.listen === "2 Listen", "Statistik-Listenauswahl → Quiz: beide Listen");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
