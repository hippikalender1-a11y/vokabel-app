import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 274: Auswahl-Tafel mit Schalter-Raster (Multiquiz breit, Negative · Gelernt / Heute · Fällige; darunter Farbe · Ablage · Von–Bis),
// Kopf zählt ohne Doppelungen, Schalter gelten fürs geladene Quiz; Quiz-Tab: eigene Schalter-Zeile Vokabeln · Negative · Gelernte · Heute · Fällige
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
const tafel = () => page.evaluate(() => ({ raster: [...document.querySelectorAll("[data-schalter-raster] button")].map(b => `${b.dataset.schalter}:${__txt(b)}:${b.dataset.an}${b.disabled ? ":x" : ""}`),
  rest: [...document.querySelectorAll("[data-info-menue] > div:not([data-schalter-raster]) button")].map(b => b.dataset.infoAktion || "🎨"),
  breit: document.querySelector('[data-schalter-raster] [data-schalter="grund"]')?.style.gridColumn, kopf: __txt(document.querySelector("[data-wahl-anzahl]")) }));
// ── Auswahl A + B ──
await menue('[data-slot-id="sA"]'); await menue('[data-slot-id="sB"]');
let t = await tafel();
console.log("     ", JSON.stringify(t));
ok(t.raster.join("|") === "grund:Vokabeln (8):an|negativ:✗ Negative (2):an|gelernt:✓ Gelernt (0):aus:x|heute:Heute (0):aus:x|faellig:+ 🔁 Fällige (3):an" && t.breit === "1 / -1",
  "Raster: Multiquiz breit, Negative · Gelernt / Heute · Fällige – mit Anzahlen, nicht verfügbare ausgegraut");
ok(t.rest.join("|") === "🎨|🗂 Ablage ›|↔ Von–Bis", `darunter Farbe · Ablage · Von–Bis; Multiquiz starten / Fällige wiederholen / Negative abfragen entfallen (${t.rest.join("|")})`);
ok(t.kopf === "2 ausgewählt · 10 Vokabeln + 🔁 3", `Kopf: 8 + 2 = 10 Vokabeln + 🔁 3 (25 % von 10), nichts doppelt (${t.kopf})`);
// Multiquiz aus → Tafel bleibt offen, Kopf zählt neu
await page.evaluate(() => document.querySelector('[data-schalter-raster] [data-schalter="grund"]').click()); await sleep(400);
t = await tafel();
ok(t.raster[0] === "grund:Vokabeln (8):aus" && t.kopf === "2 ausgewählt · 2 Vokabeln + 🔁 1", `Multiquiz aus: Tafel bleibt, Kopf „2 Vokabeln + 🔁 1“ (${t.kopf})`);
// Fällige lang drücken → Einstellungen; „Nur diese Quiz“ → zurück zur Tafel
await menue('[data-schalter-raster] [data-schalter="faellig"]', 20);
const fm = await page.evaluate(() => ({ akt: [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion), regler: !!document.querySelector("[data-info-regler]") }));
ok(fm.akt.includes("◉ Alle Engl") && fm.akt.includes("○ Nur diese Quiz") && fm.regler, `Fällige lang drücken: Herkunft + Anteil (${fm.akt.join("|")})`);
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "○ Nur diese Quiz").click()); await sleep(500);
t = await tafel();
ok(t.raster.length === 5, "nach der Wahl wieder die Auswahl-Tafel");
// Kopf antippen → Multiquiz geladen, Schalter bleiben (Vokabeln aus, Fällige nur dieses Quiz)
await page.evaluate(() => document.querySelector("[data-wahl-fertig]").click()); await sleep(900);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
const q = () => page.evaluate(() => ({ s: [...document.querySelectorAll("[data-schalter-zeile] [data-schalter]")].map(b => `${b.dataset.schalter}:${__txt(b).trim()}:${b.dataset.an || b.dataset.faellig}${b.disabled ? ":x" : ""}`).join("|"),
  modus: document.querySelector("[data-faellig]")?.dataset.faelligModus, titel: __txt(document.querySelector("[data-start-titel]")), nurF: document.querySelector("[data-nur-faellige]")?.dataset.nurFaellige || null }));
// 278: Auswahl schon in der Tafel getroffen → Schalter-Zeile eingeklappt, Pfeil an der Überschrift klappt sie auf
ok(!(await page.$("[data-schalter-zeile]")) && await page.evaluate(() => document.querySelector("[data-schalter-klapp]")?.dataset.schalterKlapp) === "zu", "278: Schalter-Zeile eingeklappt, Pfeil an der Überschrift");
await page.evaluate(() => document.querySelector("[data-schalter-klapp]").click()); await sleep(300);
let z = await q();
// 279: nicht verfügbare Schalter gesperrt, aber nicht ausgegraut
ok(await page.evaluate(() => { const b = document.querySelector('[data-schalter-zeile] [data-schalter="gelernt"]'); return b.disabled && getComputedStyle(b).opacity === "1"; }), "279: gesperrt, nicht ausgegraut");
console.log("     ", JSON.stringify(z));
ok(/^grund:8:aus\|negativ:✗ 2:an\|gelernt:✓ 0:aus:x\|heute:0:aus:x\|faellig:\+ 🔁 1:an$/.test(z.s) && z.modus === "quiz",
  `Quiz-Tab: Schalter-Zeile übernimmt die Auswahl (Vokabeln aus, Fällige nur dieses Quiz) (${z.s})`);
ok(z.titel === "Quiz mit 2 Vokabeln + 🔁 1", `Titel: nur die 2 Negativen + 🔁 1 (${z.titel})`);
// Negative auch aus → keine anderen: „Nur Fällige“
await page.evaluate(() => document.querySelector('[data-schalter-zeile] [data-schalter="negativ"]').click()); await sleep(300);
z = await q();
ok(/faellig:\+ 🔁 5:an/.test(z.s) && z.nurF === "5", `nur Fällige an: Knopf zeigt alle 5, Start „Nur Fällige“ (${JSON.stringify(z)})`);
// Negative wieder an, starten → abgefragt werden nur Negative + 1 Fällige
await page.evaluate(() => document.querySelector('[data-schalter-zeile] [data-schalter="negativ"]').click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-start-knopf]").click()); await sleep(800);
const gefragt = [];
for (let i = 0; i < 6; i++) {
  const f = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
  if (!f) break; gefragt.push(f);
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(150);
  await page.evaluate(() => [...document.querySelectorAll(".karte-btn-ja")].find(b => /Gewusst/.test(b.textContent))?.click()); await sleep(1300);
}
console.log("      gefragt:", gefragt.join(", "));
ok(gefragt.length === 3 && gefragt.filter(f => /Negativ/.test(f)).length === 2 && gefragt.filter(f => /Fällig/.test(f)).length === 1 && !gefragt.some(f => /Neu/.test(f)),
  "Abfrage: nur die 2 Negativen + 1 Fällige, keine regulären");

console.log(`\n${fehler ? fehler + " FEHLER" : "ALLES OK"}`);
await browser.close();
process.exit(fehler ? 1 : 0);
