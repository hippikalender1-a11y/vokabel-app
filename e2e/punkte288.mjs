import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 288: Listen-Auswahl im Quiz-Tab wie die Quiz-Auswahl (274/277–283): Schalter-Raster, kleine untere Zeile, Kopf zählt, Laden behält die Schalter
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
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
const menue = async (sel, dx = 10) => { await page.evaluate((sel, dx) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + dx, clientY: r.y + 10 })); }, sel, dx); await sleep(400); };
const filterAuf = async () => { if (await page.$('[data-kopf-anzahl][data-schalter-klapp="zu"]')) { await page.click("[data-kopf-anzahl]"); await new Promise(r => setTimeout(r, 300)); } };   // 305
const tafel = async () => { await filterAuf(); return tafelRoh(); };
const tafelRoh = () => page.evaluate(() => ({ raster: [...document.querySelectorAll("[data-schalter-raster] button")].map(b => `${b.dataset.schalter}:${b.dataset.rasterText || __txt(b)}:${b.dataset.an}${b.hasAttribute("data-gesperrt") ? ":x" : ""}`),
  rest: [...document.querySelectorAll("[data-info-menue] > div:not([data-schalter-raster]) button")].map(b => b.dataset.infoAktion || "🎨"),
  klein: !!document.querySelector('[data-tafel-unten="klein"]'), kopf: __txt(document.querySelector("[data-wahl-anzahl]")) }));
// zur Listen-Auswahl
await page.evaluate(() => document.querySelector('[data-auswahl-umschalter="quiz"]').click()); await sleep(400);
ok(!!(await page.$('[data-liste-id="l_a"]')), "Listen-Auswahl offen");
await menue('[data-liste-id="l_a"]'); await menue('[data-liste-id="l_b"]');
let t = await tafel();
console.log("     ", JSON.stringify(t));
ok(/^grund:10:an\|faellig:[^|]*\|heute:0:aus:x$/.test(t.raster.join("|")), `288/310: Filter wie in der Quiz-Auswahl – Auswahl · Fällige · Heute (${t.raster.join("|")})`);
ok(t.klein && t.rest[0] === "🎨" && t.rest.includes("🗂 Ablage ›") && t.rest.includes("↔ Von–Bis") && t.rest.length === 3, `288/323: unten kleine Zeile 🎨 · Von–Bis · Ablage (Speichern im Kopf) (${t.rest.join("|")})`);
ok(/^2 ausgewählt · \d+ Vokabeln/.test(t.kopf), `288: Kopf „2 ausgewählt · n Vokabeln …“ (${t.kopf})`);
const ablage = await page.evaluate(() => document.querySelector('[data-info-aktion="🗂 Ablage ›"]')?.dataset.infoGruppe);
ok(/📤 Exportieren/.test(ablage || "") && /🗑 Löschen/.test(ablage || ""), `288: Exportieren und Löschen in der Ablage (${ablage})`);
// 310: Auswahl → „Bereits abgefragte“ → Kopf zählt neu, Tafel bleibt offen
const vorher = t.kopf;
await page.evaluate(() => document.querySelector('[data-schalter-raster] [data-schalter="grund"]').click()); await sleep(400);
t = await tafel();
ok(t.raster[0] === "grund:2:an" && t.kopf !== vorher, `288/310: bereits abgefragte – Tafel offen, Kopf zählt neu (${t.kopf})`);
// gesperrter Schalter leuchtet kurz (283)
{ const r = await page.evaluate(async () => { const b = document.querySelector('[data-schalter-raster] [data-schalter="heute"]'); b.click();
    const sofort = b.classList.contains("leuchten"); await new Promise(r => setTimeout(r, 600)); return sofort && !b.classList.contains("leuchten"); });
  ok(r, "288/283: gesperrter Schalter leuchtet kurz"); }
// Kopf antippen → Quiz aus beiden Listen, Negative bleiben aus, Schalter-Zeile eingeklappt
await page.evaluate(() => document.querySelector("[data-wahl-fertig]").click()); await sleep(900);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
ok(!(await page.$("[data-schalter-zeile]")) && await page.evaluate(() => document.querySelector("[data-schalter-klapp]")?.dataset.schalterKlapp) === "zu", "288: geladen – Schalter-Zeile eingeklappt");
await page.evaluate(() => document.querySelector("[data-schalter-klapp]").click()); await sleep(300);
const neg = await page.evaluate(() => document.querySelector('[data-schalter-zeile] [data-schalter="grund"]')?.dataset.filterStufe);
const titel = await page.evaluate(() => __txt(document.querySelector("[data-start-titel]")));
ok(neg === "abgefragt" && /^0\/2 Vokabeln/.test(titel), `288/310: „Bereits abgefragte“ bleibt, Quiz mit den 2 negativen (${neg}, ${titel})`);
// eine Liste: Tafel ebenfalls mit Raster, „Unit 1 laden“
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector('[data-auswahl-umschalter="quiz"]'); if (b) b.click(); }); await sleep(400);
// 251: die Auswahl aus beiden Listen kommt zurück – Unit 2 herausnehmen, bleibt Unit 1
ok(/^2 ausgewählt/.test((await tafel()).kopf), "Auswahl der geladenen Listen wiederhergestellt");
await menue('[data-liste-id="l_b"]');
// 310: Auswahl wieder auf „alle“ (Kreislauf: bereits abgefragte → aus → alle)
for (let i = 0; i < 2; i++) { await filterAuf(); await page.evaluate(() => document.querySelector('[data-schalter-raster] [data-schalter="grund"]').click()); await sleep(300); }
t = await tafel();
console.log("     ", JSON.stringify(t));
ok(t.raster.length === 3 && t.klein && t.rest.join("|") === "📂 Liste öffnen|↔ Von–Bis|🗂 Ablage ›|🎨" && /Unit 1 laden/.test(t.kopf), `288: eine Liste – Raster, kleine Zeile, „Unit 1 laden“ (${t.rest.join("|")}, ${t.kopf})`);
// 296: eine Liste – lang drücken auf „Vokabeln (n)“ öffnet die Bereichswahl (wie „🎯 Bereich wählen…“)
await page.evaluate(() => { const b = document.querySelector('[data-kopf-anzahl]'), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await sleep(900);
const b296 = await page.evaluate(() => ({ tafel: !!document.querySelector("[data-schalter-raster]"), liste: !!document.querySelector("[data-vok-bestaetigen]"), zeilen: document.querySelectorAll(".vok-zeile").length }));
ok(!b296.tafel && b296.liste && b296.zeilen === 11, `296: lang drücken auf „Vokabeln“ → Bereichswahl der Liste offen (${JSON.stringify(b296)})`);
// 297: Nr. 2–4 wählen, „Bestätigen“ → zurück in die Tafel der Liste; „Vokabeln“ zählt den Bereich, Kopf nennt ihn
const zeilen = async nr => { for (const i of nr) { await page.evaluate(i => document.querySelectorAll(".vok-zeile")[i - 1].click(), i); await sleep(150); } };
await zeilen([2, 3, 4]);
await page.evaluate(() => document.querySelector("[data-vok-bestaetigen]").click()); await sleep(1000);
t = await tafel();
console.log("     ", JSON.stringify(t));
const zeilen297 = await page.evaluate(() => ({ listenZeile: !!document.querySelector("[data-vok-bestaetigen]") || [...document.querySelectorAll("span")].some(s => s.textContent === "Vokabel-Auswahl") }));
ok(t.raster[0] === "grund:3:an" && (await page.evaluate(() => document.querySelector("[data-kopf-anzahl]")?.dataset.kopfBereich)) === "Auswahl" && /Unit 1 \(Auswahl\)$/.test(t.kopf) && !zeilen297.listenZeile, `297: zurück in der Tafel – „Vokabeln (3)“, Kopf „Unit 1 · Nr. 2–4 laden“ (${t.raster[0]}, ${t.kopf})`);
// nochmals lang drücken → Bereich vorgewählt, auf Nr. 2–5 erweitern
await page.evaluate(() => { const b = document.querySelector('[data-kopf-anzahl]'), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await sleep(900);
ok(await page.evaluate(() => document.querySelectorAll("[data-anzahl=auswahl]")[0]?.textContent) === "(3 V.)", "297: nochmals lang drücken – der Bereich ist vorgewählt (3 V.)");
await zeilen([5]);
await page.evaluate(() => document.querySelector("[data-vok-bestaetigen]").click()); await sleep(1000);
t = await tafel();
ok(t.raster[0] === "grund:4:an" && (await page.evaluate(() => document.querySelector("[data-kopf-anzahl]")?.dataset.kopfAnzahl)) === "4", `297: geändert – „Vokabeln (4)“, „Nr. 2–5“ (${t.raster[0]}, ${t.kopf})`);
// laden → Liste mit Bereich geladen
await page.evaluate(() => document.querySelector("[data-listen-wahl-kopf]").click()); await sleep(1200);
const g297 = await page.evaluate(() => ({ kopf: __txt(document.querySelector("[data-slot-kopf-name]")), start: document.querySelector("[data-start-knopf]")?.dataset.startAnzahl }));
ok(g297.start === "4", `297: „Unit 1 laden“ – Quiz mit den 4 Vokabeln des Bereichs (${JSON.stringify(g297)})`);
await browser.close();
console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
process.exit(fehler ? 1 : 0);
