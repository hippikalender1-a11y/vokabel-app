import puppeteer from "puppeteer-core";
import { slotLaden, listeWaehlen } from "./hilfen.mjs";
import { bereichZu } from "./hilfen.mjs";

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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Quiz-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done && await bereichZu(page)) return clickText(sel, text, exact);   // offener Bereich blendet den Rest aus
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
// Kopfzeile: Zustand + Name; Listen-Chip (rechte Spalte der Listen-Auswahl)
const stand = async () => { if (await page.evaluate(() => { const b = document.querySelector("[data-listen-bestaetigen]"); b?.click(); return !!b; })) await sleep(300);   // offene Listen-Auswahl: erst bestätigen, dann steht der Name da
  return page.evaluate(() => {
  const k = document.querySelector("[data-slot-kopf]");
  const listen = [...document.querySelectorAll("button.zeile-rechts")].find(b => /Listen für|Gewählte Listen/.test(b.getAttribute("title") || ""));
  // gespeicherte Konfiguration: Listen-Auswahl ausgeblendet
  return { kopf: k?.dataset.slotKopf, name: k?.querySelector("button.toggle-opt.aktiv")?.textContent.trim(), listen: listen ? listen.textContent.trim() : "(ausgeblendet)" };
}); };
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
await page.reload(); await sleep(500); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz

// Quiz: Paket Tiere wählen → Statistik zeigt dasselbe
await clickText(".tab", "Quiz");
await oeffneKopf();
await clickText(".slot-chip", "Paket Tiere"); await sleep(500); await slotLaden(page);
await clickText(".tab", "Statistik");
await sleep(300);
let st = await stand();
console.log("     Statistik:", JSON.stringify(st));
ok(st.kopf === "gruen" && st.name === "Paket Tiere" && st.listen === "(ausgeblendet)", "Quiz → Statistik: Paket Tiere bleibt gewählt (Listen-Auswahl ausgeblendet)");

// Statistik: Paket Farben wählen → Quiz zeigt dasselbe
await oeffneKopf();
await clickText(".slot-chip", "Paket Farben"); await sleep(500); await slotLaden(page);
await clickText(".tab", "Quiz");
await sleep(300);
st = await stand();
console.log("     Quiz:", JSON.stringify(st));
ok(st.kopf === "gruen" && st.name === "Paket Farben" && st.listen === "(ausgeblendet)", "Statistik → Quiz: Paket Farben übernommen (Listen-Auswahl ausgeblendet)");
{
  const anzahl = await page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl);
  await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").click()); await sleep(300);
  await page.evaluate(() => { if (document.querySelector("[data-slot-info-zu]")) document.querySelector("[data-slot-info]")?.click(); }); await sleep(300);
  const infoText = await page.evaluate(() => document.querySelector("[data-slot-info]")?.innerText.replace(/\s+/g, " ") || "");
  await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").click()); await sleep(300);
  ok(anzahl === "3" && /Farben.*3 Vokabeln/.test(infoText), `Quiz: 3 Vokabeln aus Farben (Info-Zeile „Farben · 3 Vokabeln“) (${anzahl} | ${infoText.slice(0, 80)})`);
}

// Statistik: „Neu“ (alle Listen, keine Konfiguration) → Quiz ohne Konfiguration, beide Listen
// vorher im Quiz auf Diktat wechseln – ein neues Quiz beginnt trotzdem in Übersetzung
await page.evaluate(() => document.querySelector('[data-start-arten] [data-quiz-art="diktat"]')?.click()); await sleep(300);
await clickText(".tab", "Statistik");
await oeffneKopf();
await page.evaluate(() => { const el = document.querySelector("[data-alle-sessions]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(250);
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion.startsWith("▦ Alle Listen"))?.click());
await sleep(300);
await clickText(".tab", "Quiz");
await sleep(300);
st = await stand();
console.log("     Quiz nach Statistik-Neu:", JSON.stringify(st));
// 298: „▦ Alle Listen“ ist nur eine Ansicht der Statistik – das Quiz bleibt geladen
ok(st.name === "Paket Farben", `298: Statistik „▦ Alle Listen“ → Quiz unverändert (${JSON.stringify(st)})`);

// Quiz: nur Tiere → Statistik zeigt Tiere
await listeWaehlen(page, "Tiere");   // 298: Liste antippen lädt sie
await clickText(".tab", "Statistik");
await sleep(300);
const gesamt = () => page.evaluate(() => document.querySelector('[data-st-kachel="gesamt"] b')?.textContent);
ok(await gesamt() === "2", `Quiz-Listenauswahl → Statistik: Tiere (2 Vokabeln) (${await gesamt()})`);
// 294: Statistik – Listen über die Auswahl (Umschalter „📋 Listen“): beide auswählen, der Kopf zeigt sie zusammen
await oeffneKopf();
await page.evaluate(() => document.querySelector('[data-auswahl-umschalter="quiz"]')?.click()); await sleep(300);
ok(!!(await page.$('[data-liste-id="l_a"]')), "294: Statistik-Auswahl hat den Umschalter „📋 Listen“");
for (const id of ["l_a", "l_b"]) { await page.evaluate(id => { const el = document.querySelector(`[data-liste-id="${id}"]`); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, id); await sleep(400); }
const kopfW = await page.evaluate(() => document.querySelector("[data-wahl-anzahl]")?.textContent.trim());
ok(kopfW === "2 ausgewählt · 5 Vokabeln", `294: Kopf „2 ausgewählt · 5 Vokabeln“ (${kopfW})`);
await page.evaluate(() => document.querySelector("[data-wahl-fertig]").click()); await sleep(800);
ok(await gesamt() === "5" && /2 Listen/.test(await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.textContent || "")), `294: Statistik beider Listen (${await gesamt()})`);
// eine Liste antippen → ihre Statistik
await oeffneKopf();
await page.evaluate(() => document.querySelector('[data-auswahl-umschalter="quiz"]')?.click()); await sleep(300);
await page.evaluate(() => document.querySelector('[data-liste-id="l_b"]').click()); await sleep(800);
const nameF = await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.textContent || "");
ok(await gesamt() === "3" && /Farben/.test(nameF), `294: Liste antippen → Statistik „Farben“ (${await gesamt()} · ${nameF})`);
ok(!(await page.$("button.zeile-rechts[title^='Listen für']")), "294: keine Zeile „Listen-Auswahl“ in der Statistik");
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
