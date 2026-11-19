import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 300/301: Anzahl rechts im Kopf (antippen: Filter-Zeile auf/zu, lang: Bereich), Filter-Zeile unter dem Kopf, Start-Knopf über die ganze Breite, Fortschritt im Balken, Zurücksetzen lang auf die Überschrift
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
  localStorage.clear();
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
const tafel = () => page.evaluate(() => ({ raster: [...document.querySelectorAll("[data-schalter-raster] button")].map(b => `${b.dataset.schalter}:${__txt(b)}`),
  kopf: __txt(document.querySelector("[data-wahl-anzahl]")) }));
const kopf = () => page.evaluate(() => ({ text: __txt(document.querySelector("[data-slot-kopf-name]")), art: document.querySelector("[data-slot-kopf-name]")?.dataset.kopfArt || "",
  start: document.querySelector("[data-start-knopf]")?.dataset.startAnzahl }));
const langVokabeln = () => page.evaluate(() => { const b = document.querySelector('[data-kopf-anzahl]'), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); });
const zeilen = async nr => { for (const i of nr) { await page.evaluate(i => document.querySelectorAll(".vok-zeile")[i - 1].click(), i); await sleep(150); } };
const offeneAuswahl = () => page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); });
const zuAuswahl = () => page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); });
const lang = sel => page.evaluate(sel => { const b = document.querySelector(sel), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
await offeneAuswahl(); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter === "quiz") b.click(); }); await sleep(300);
await page.evaluate(() => document.querySelector('[data-liste-id="l_a"]').click()); await sleep(1300);   // Unit 1 (11 Vokabeln)
await zuAuswahl(); await sleep(400);
const seg = () => page.evaluate(() => { const s = document.querySelector("[data-kopf-anzahl]"); return s ? { n: s.dataset.kopfAnzahl, b: s.dataset.kopfBereich, klapp: s.dataset.schalterKlapp } : null; });
let s = await seg();
ok(s && s.n === "11" && s.b === "Alle", `301: rechts im Kopf „Alle“ / 11 (${JSON.stringify(s)})`);
ok(await page.evaluate(() => document.querySelector("[data-kopf-anzahl]").classList.contains("eckig")), "302: Liste geladen – Anzahl im Kopf eckig");
// antippen: Filter-Zeile auf/zu
const zeileDa = () => page.evaluate(() => !!document.querySelector("[data-schalter-zeile]"));
const vorher = await zeileDa();
await page.click("[data-kopf-anzahl]"); await sleep(300);
ok(await zeileDa() !== vorher, "301: antippen der Anzahl klappt die Filter-Zeile um");
if (!(await zeileDa())) { await page.click("[data-kopf-anzahl]"); await sleep(300); }
const z = await page.evaluate(() => ({ labels: [...document.querySelectorAll("[data-schalter-zeile] .quiz-zeile-label")].map(l => l.textContent).join("|"),
  ueber: document.querySelector("[data-schalter-zeile]").getBoundingClientRect().top < document.querySelector("[data-reihenfolge]").getBoundingClientRect().top }));
ok(z.labels === "Neue|Negative|Gelernte|Heute|Fällige" && z.ueber, `301: Filter-Zeile „Neue · Negative · Gelernte · Heute · Fällige“ direkt unter dem Kopf (${z.labels}, ${z.ueber})`);
// Start-Knopf über die ganze Breite, kein Kasten daneben, kein Klapp-Pfeil
const st = await page.evaluate(() => { const k = document.querySelector("[data-start-knopf]"), b = document.querySelector(".start-bereich");
  const rk = k.getBoundingClientRect(), rb = b.getBoundingClientRect(); return { breit: rk.width > rb.width - 50, kasten: !!document.querySelector(".start-fortschritt"), pfeil: !!document.querySelector(".schalter-klapp") }; });
ok(st.breit && !st.kasten && !st.pfeil, `300: Start-Knopf über die ganze Breite, ohne Kasten (${JSON.stringify(st)})`);
// Fortschritt klein im Balken: eine Runde mit 2 Vokabeln, dann „x/y“ im Balken; lang auf die Überschrift → zurücksetzen
await page.evaluate(() => document.querySelector("[data-umfang]")?.click()); await sleep(300);
await page.evaluate(() => document.querySelector('[data-umfang-wahl="5"]')?.click()); await sleep(300);
const balken = () => page.evaluate(() => __txt(document.querySelector("[data-start-titel]")));   // 302: Zahlen in der Überschrift
ok(/^0\/9/.test(await balken()), `300: Balken zeigt „0/9 …“ (${await balken()})`);
await page.click("[data-start-knopf]"); await sleep(700);
for (let i = 0; i < 15 && await page.evaluate(() => /\d+ \/ 5/.test(document.body.innerText) && !/Weiter →/.test(document.body.innerText)); i++) {
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent))?.click()); await sleep(900);
}
for (const t of ["Pause"]) { await page.evaluate(t => [...document.querySelectorAll("button")].find(b => b.textContent.includes(t))?.click(), t); await sleep(700); }
await zuAuswahl(); await sleep(400);
ok(/^[1-9]\/9/.test(await balken()), `300: nach einem Paket der Fortschritt im Balken (${await balken()})`);
await lang("[data-start-titel]"); await sleep(400);
ok(!!(await page.$("[data-reset-frage]")), "300: lang auf die Überschrift – Rückfrage zum Zurücksetzen");
// lang auf die Anzahl → Bereichswahl
await lang("[data-kopf-anzahl]"); await sleep(800);
ok(await page.evaluate(() => !!document.querySelector("[data-vok-bestaetigen]")), "301: lang auf die Anzahl öffnet die Bereichswahl");
// 302: Statistik – Langzeit-Balken filtern mit, Anzahl und Lernfortschritt folgen den Filtern
await page.click("[data-vok-bestaetigen]"); await sleep(600);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Statistik"))?.click()); await sleep(700);
const stat = () => page.evaluate(() => ({ n: document.querySelector("[data-st-anzahl]")?.textContent, rauten: [...document.querySelectorAll("[data-st-raute]")].map(b => b.dataset.stRauteAus).join(","),
  kopf: __txt(document.querySelector("[data-statistik-kopf-titel]")?.parentElement?.parentElement) }));
let st0 = await stat();
await page.click('[data-st-balken="gelernt"]'); await sleep(400);
let st1 = await stat();
ok(st0.n === "11" && st1.n === "9" && st1.rauten === "an,an,an,an", `302: Gelernt aus – alle Langzeit-Balken aus, Anzahl 11 → 9 (${JSON.stringify([st0, st1])})`);
await page.click('[data-st-raute="3"]'); await sleep(400);
let st2 = await stat();
ok(st2.n === "11" && st2.rauten === "aus,an,an,an", `302: Langzeit-Balken ◇◇◇ antippen – Gelernt wieder an, nur diese Stufe (${JSON.stringify(st2)})`);
await page.click('[data-st-raute="3"]'); await sleep(400);
ok((await stat()).n === "9", "302: ◇◇◇ wieder aus – Anzahl 9");
await browser.close();
console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
process.exit(fehler ? 1 : 0);
