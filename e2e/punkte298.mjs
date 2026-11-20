import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 298: Vereinfachung – Statistik zeigt das Geladene, Bereich über mehrere Listen, „💾 Als Quiz speichern“, „📝 Vokabeln ändern“, kein „Neues Quiz“
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
const filterAuf = async () => { if (await page.$('[data-kopf-anzahl][data-schalter-klapp="zu"]')) { await page.click("[data-kopf-anzahl]"); await new Promise(r => setTimeout(r, 300)); } };   // 305
const tafel = async () => { await filterAuf(); return tafelRoh(); };
const tafelRoh = () => page.evaluate(() => ({ raster: [...document.querySelectorAll("[data-schalter-raster] button")].map(b => `${b.dataset.schalter}:${b.dataset.rasterText || __txt(b)}`),
  kopf: __txt(document.querySelector("[data-wahl-anzahl]")) }));
const kopf = () => page.evaluate(() => ({ text: __txt(document.querySelector("[data-slot-kopf-name]")), art: document.querySelector("[data-slot-kopf-name]")?.dataset.kopfArt || "",
  start: document.querySelector("[data-start-knopf]")?.dataset.startAnzahl }));
const langVokabeln = () => page.evaluate(() => { const b = document.querySelector('[data-kopf-anzahl]'), r = b.getBoundingClientRect();
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); });
const zeilen = async nr => { for (const i of nr) { await page.evaluate(i => document.querySelectorAll(".vok-zeile")[i - 1].click(), i); await sleep(150); } };
await ladeQuiz();
let k = await kopf();
ok(k.art === "quiz" && /Teil A/.test(k.text), `„Teil A“ geladen (${k.text})`);
// ── keine Zeilen „Listen-Auswahl“ / „Vokabel-Auswahl“ mehr ──
ok(!(await page.$("[data-listen-kopf]")) && !(await page.$("[data-vokwahl]")), "298: keine Listen-Auswahl-/Vokabel-Auswahl-Zeilen");
// ── Bereich über zwei Listen ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await page.evaluate(() => document.querySelector('[data-auswahl-umschalter="quiz"]')?.click()); await sleep(400);
await menue('[data-liste-id="l_a"]'); await menue('[data-liste-id="l_b"]');
let t = await tafel();
ok(/^2 ausgewählt/.test(t.kopf), `zwei Listen gewählt (${t.kopf})`);
await langVokabeln(); await sleep(900);
const b1 = await page.evaluate(() => ({ zeilen: document.querySelectorAll(".vok-zeile").length, liste: !!document.querySelector("[data-vok-bestaetigen]"), kopf: __txt(document.querySelector("[data-slot-kopf-name]")) }));
ok(b1.liste && b1.zeilen === 15 && /🎯 Unit 1 \+ Unit 2/.test(b1.kopf), `298: lang auf „Vokabeln“ bei zwei Listen → Bereichswahl über beide (${JSON.stringify(b1)})`);
await zeilen([1, 2, 15]);   // zwei neue aus Unit 1, die negative aus Unit 2
await page.evaluate(() => document.querySelector("[data-vok-bestaetigen]").click()); await sleep(1000);
t = await tafel();
ok(t.raster[0] === "grund:3" && /^2 ausgewählt · 3 Vokabeln/.test(t.kopf), `298/310: zurück in der Tafel – „Auswahl 3“ (2 neue + 1 negative) (${t.raster[0]}, ${t.kopf})`);
// das Geladene ist unverändert (Teil A), solange nicht geladen wird
await page.evaluate(() => document.querySelector("[data-listen-wahl-kopf]").click()); await sleep(1200);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
k = await kopf();
ok(k.start === "3" && /2 Listen$/.test(k.text) && (await page.evaluate(() => document.querySelector("[data-kopf-anzahl]")?.dataset.kopfBereich)) === "Auswahl", `298: laden – zwei Listen mit Bereich, 3 Vokabeln (${JSON.stringify(k)})`);
// ── Statistik zeigt das Geladene ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Statistik"))?.click()); await sleep(600);
const stat = await page.evaluate(() => __txt(document.querySelector("[data-slot-kopf-name]")));
ok(/2 Listen/.test(stat), `298: Statistik zeigt das Geladene (${stat})`);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(500);
// ── „💾 Als Quiz speichern“ aus der Tafel einer Liste ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector('[data-auswahl-umschalter]'); if (b && b.dataset.auswahlUmschalter === "quiz") b.click(); }); await sleep(400);
await page.evaluate(() => document.querySelector('[data-liste-id="l_b"]').click()); await sleep(600);   // in der (wiederhergestellten) Auswahl: neu mit Unit 2
ok(!(await page.$('[data-info-aktion="💾 Als Quiz speichern"]')), "323: Tafel einer Liste ohne „💾 Als Quiz speichern“");
await page.evaluate(() => { const el = document.querySelector("[data-slot-kopf-name]"), r = el.getBoundingClientRect();   // 325: im Kopf-Menü
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await sleep(400);
ok(!!(await page.$('[data-info-aktion="💾 Als Quiz speichern"]')), "325: Kopf-Menü der Liste hat „💾 Als Quiz speichern“");
await page.evaluate(() => document.querySelector('[data-info-aktion="💾 Als Quiz speichern"]').click()); await sleep(700);
ok(!!(await page.$("[data-erstellen-dialog]")), "298: Fenster „Als Quiz speichern“ (Name, Ordner)");
await page.evaluate(() => { const i = document.querySelector("[data-erstellen-name]"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "Unit 2 Quiz"); i.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(200);
await page.evaluate(() => document.querySelector("[data-erstellen-ok]").click()); await sleep(900);
k = await kopf();
const gesp = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.find(g => g.name === "Unit 2 Quiz")?.konfiguration?.listenIds?.join());
ok(k.art === "quiz" && /Unit 2 Quiz/.test(k.text) && gesp === "l_b", `298: gespeichert und geladen (${k.text}, ${gesp})`);
// ── „📝 Vokabeln ändern“ (lang auf den Kopf) ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(600);
await menue("[data-slot-kopf-name]");
ok(!!(await page.$('[data-info-aktion="📝 Vokabeln ändern"]')), "298: Kopf-Menü „📝 Vokabeln ändern“");
await page.evaluate(() => document.querySelector('[data-info-aktion="📝 Vokabeln ändern"]').click()); await sleep(800);
ok(await page.evaluate(() => !!document.querySelector("[data-vok-bestaetigen]") && document.querySelectorAll(".vok-zeile").length === 4), "298: „📝 Vokabeln ändern“ öffnet die Vokabelliste der Quiz");
await zeilen([4]);   // nur die negative
await page.evaluate(() => document.querySelector("[data-vok-bestaetigen]").click()); await sleep(600);
k = await kopf();
ok(k.start === "1" && await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.hasAttribute("data-geaendert")), `298: Bereich geändert – Quiz „geändert“ (${JSON.stringify(k)})`);
await browser.close();
console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
process.exit(fehler ? 1 : 0);
