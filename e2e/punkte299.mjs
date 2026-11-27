import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 299: Bereich des Geladenen (lang auf „Vokabeln“ / Statistik-Anzahl), Bereich aus der Tafel lädt sofort, Tabwechsel übernimmt die Listen-Tafel
// (Grundlage: Aufbau aus punkte274)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const s = window.speechSynthesis; s.getVoices = () => []; s.speak = () => {}; s.cancel = () => {}; });
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const alt = "2026-01-01T10:00:00.000Z";
await page.goto(URL);
await page.evaluate(alt => {
  localStorage.clear(); localStorage.setItem("vokabel_test_alte_ansicht", "1");
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Fremd",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: alt, stufeSeit: alt });
  const liste = (id, name, sprache, w) => localStorage.setItem(`vokabel_liste_${id}`, JSON.stringify({ id, name, sprache, spalten: sp, naechste_id: w.length + 1,
    vokabeln: w.map(([e, d, sc], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(sc === undefined ? {} : { fortschritt: f(sc) }) })) }));
  // Unit 1 (Quiz): 8 neue, 2 fällige, 1 negative; Unit 2 (en): 3 fällige; Unité (fr): 2 fällige (andere Sprache)
  liste("l_a", "Unit 1", "en", [...Array.from({ length: 8 }, (_, i) => [`a${i}`, `A-Neu${i}`]), ["af1", "A-Fällig1", 3], ["af2", "A-Fällig2", 3], ["an", "A-Negativ", -2]]);
  liste("l_b", "Unit 2", "en", [["b1", "B-Fällig1", 3], ["b2", "B-Fällig2", 3], ["b3", "B-Fällig3", 4], ["bn", "B-Negativ", -2]]);
  liste("l_c", "Unité", "fr", [["c1", "C-Fällig1", 3], ["c2", "C-Fällig2", 3]]);
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} },
    { id:"l_c", name:"Unité", sprache:"fr", platz:{z:2,s:0} }]));
  const k = { listenIds:["l_a"], vokabelAuswahl: [], bereichTyp:"alle", quizBereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[], gespeichert: [{ id:"sA", name:"Teil A", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }, { id:"sB", name:"Teil B", timestamp:2, konfiguration:{ ...k, listenIds:["l_b"] }, sessionFortschritt:null, platz:{z:0,s:1} }] }));
}, alt);
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
const ladeQuiz = async () => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
  await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
  await page.evaluate(() => document.querySelector('[data-slot-id="sA"]').click()); await sleep(900);
};
const menue = async (sel, dx = 10) => { await page.evaluate((sel, dx) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + dx, clientY: r.y + 10 })); }, sel, dx); await sleep(400); };
const filterAuf = async () => {};   // 351
const tafel = async () => { await filterAuf(); return tafelRoh(); };
const tafelRoh = () => page.evaluate(() => ({ raster: [...document.querySelectorAll("[data-schalter-raster] button")].map(b => `${b.dataset.schalter}:${b.dataset.rasterText || __txt(b)}`),
  kopf: __txt(document.querySelector("[data-wahl-anzahl]")) }));
const kopf = () => page.evaluate(() => ({ text: __txt(document.querySelector("[data-slot-kopf-name]")), art: document.querySelector("[data-slot-kopf-name]")?.dataset.kopfArt || "",
  start: document.querySelector("[data-start-knopf]")?.dataset.startAnzahl }));
const langVokabeln = () => page.evaluate(() => { const b = document.querySelector('[data-kopf-anzahl]'), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); });
const zeilen = async nr => { for (const i of nr) { await page.evaluate(i => document.querySelectorAll(".vok-zeile")[i - 1].click(), i); await sleep(150); } };
const offeneAuswahl = () => page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); });
const zuAuswahl = () => page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); });
const tab = n => page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n))?.click(), n);
const lang = sel => page.evaluate(sel => { const b = document.querySelector(sel), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
// ── A: Quiz-Tab – lang auf „Vokabeln“ der geladenen Liste ──
await offeneAuswahl(); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter === "quiz") b.click(); }); await sleep(300);
await page.evaluate(() => document.querySelector('[data-liste-id="l_a"]').click()); await sleep(1200);   // Unit 1 laden
await zuAuswahl(); await sleep(400);
await page.click("[data-kopf-anzahl]"); await sleep(800);   // 351: antippen
ok(await page.evaluate(() => !!document.querySelector("[data-vok-bestaetigen]") && document.querySelectorAll(".vok-zeile").length === 11), "299/351: „n V“ antippen – Bereichswahl der geladenen Liste");
await zeilen([2, 3, 4]);
await page.click("[data-vok-bestaetigen]"); await sleep(800);
let k = await kopf();
ok(!(await page.$("[data-vok-bestaetigen]")) && k.art === "liste" && /Unit 1/.test(k.text) && (await page.evaluate(() => document.querySelector("[data-kopf-anzahl]")?.dataset.kopfBereich)) === "Auswahl" && k.start === "3" && !(await page.evaluate(() => document.querySelector("[data-slot-kopf]")?.dataset.slotKopf === "offen")),
  `299: „Bestätigen“ – zurück im Quiz-Tab, Bereich gilt (${JSON.stringify(k)})`);
// ── B (351): die Tafel einer Liste hat keinen Bereichsknopf – der Bereich wird nach dem Laden gewählt ──
await offeneAuswahl(); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter === "quiz") b.click(); }); await sleep(300);
await menue('[data-liste-id="l_b"]');
ok(!(await page.$("[data-kopf-anzahl]")), "351: Tafel ohne Bereichsknopf im Kopf");
await zuAuswahl(); await sleep(500);
let t;
// ── C: Tabwechsel mit offener Listen-Tafel übernimmt die Auswahl ──
await offeneAuswahl(); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter === "quiz") b.click(); }); await sleep(300);
await menue('[data-liste-id="l_a"]'); await menue('[data-liste-id="l_b"]');   // Tafel mit beiden Listen
t = await tafel();
ok(/^2 ausgewählt/.test(t.kopf), `Tafel mit zwei Listen (${t.kopf})`);
await tab("Statistik"); await sleep(900);
const st = await page.evaluate(() => ({ n: document.querySelector("[data-st-anzahl]")?.textContent, kopf: __txt(document.querySelector("[data-slot-kopf-name]")) }));
ok(st.n === "15" && /2 Listen/.test(st.kopf), `299: Tabwechsel übernimmt die Tafel – Statistik zeigt beide Listen (${JSON.stringify(st)})`);
// ── D (301/358): Statistik – statt der Anzahl rechts die Pfeile ‹ › (Bereich wählt man im Quiz-Tab) ──
const knopf = await page.evaluate(() => ({ seg: document.querySelector("[data-kopf-anzahl]")?.dataset.kopfAnzahl ?? null, art: __txt(document.querySelector("[data-kreismitte]")) }));
ok(knopf.seg === null && /^Übersetzung ⇄$/.test(knopf.art.trim()), `301/358: keine Anzahl im Statistik-Kopf, Art-Knopf ohne Zahl (${JSON.stringify(knopf)})`);
await browser.close();
console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
process.exit(fehler ? 1 : 0);
