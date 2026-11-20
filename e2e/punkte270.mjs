import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 270: eigenes Wiederholungszeichen (SVG in Schriftfarbe) statt 🔁 · 275: Balken-Reihenfolge nie · negativ · arbeit · gelernt
// 276: Kachel-Balken mit hohlem Anfang für die Fälligen
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
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[], gespeichert: [{ id:"sA", name:"Teil A", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
}, alt);
await page.reload(); await sleep(800); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
const ladeQuiz = async () => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);
  await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
  await page.evaluate(() => document.querySelector('[data-slot-id="sA"]').click()); await sleep(900);
};
// Quiz-Kacheln sichtbar (Kopf offen, Ansicht Quiz)
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
// ── 276 ──
const k = await page.evaluate(() => { const b = document.querySelector('[data-slot-id="sA"] .kachel-balken'); const m = b?.style.maskImage || b?.style.webkitMaskImage || "";
  return { n: b?.dataset.kachelFaellig, maske: /gradient/.test(m), info: b?.closest("[data-kachel-balken]")?.dataset.info }; });
ok(k.n === "2" && k.maske && /davon 2 fällig/.test(k.info || ""), `276: Quiz-Kachel – 2 fällige als hohler Anfang des Balkens (${JSON.stringify(k)})`);
// ── 275: Info des Quiz – Balken und Legende nie · negativ · arbeit · gelernt ──
await page.evaluate(() => document.querySelector('[data-slot-id="sA"]').click()); await sleep(900);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);
await page.evaluate(() => { if (!document.querySelector("[data-vorschau-gruppen]")) document.querySelector("[data-slot-info]")?.click(); }); await sleep(300);
const r = await page.evaluate(() => ({ balken: [...document.querySelectorAll("[data-vorschau-balken] [data-gruppe]")].map(x => x.dataset.gruppe).join(","),
  legende: [...document.querySelectorAll("[data-vorschau-gruppen] [data-gruppe-text]")].map(x => x.dataset.gruppeText).join(","),
  fae: __txt(document.querySelector("[data-vorschau-gruppen] [data-faellig-text]")) }));
ok(r.balken === "nie,negativ,gelernt" && r.legende === "nie,negativ,gelernt", `275: Reihenfolge links nie → rechts gelernt (${JSON.stringify(r)})`);
// ── 270: eigenes Zeichen in Schriftfarbe ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
const z = await page.evaluate(() => { const b = document.querySelector('[data-schalter-zeile] [data-schalter="faellig"]'), s = b?.querySelector("svg[data-sym='wiederholung']");
  return { sym: !!s, emoji: /🔁/.test(b?.textContent || ""), farbe: s && getComputedStyle(s).color === getComputedStyle(b).color, strich: s?.getAttribute("stroke"),
    titel: !!document.querySelector("[data-start-titel] svg[data-sym]"), start: !!document.querySelector("[data-start-knopf] svg[data-sym]") }; });
ok(z.sym && !z.emoji && z.farbe && z.strich === "currentColor" && z.titel && z.start, `270: Knopf, Titel und Start mit eigenem Zeichen in Schriftfarbe, kein Emoji (${JSON.stringify(z)})`);
// Menü-Texte (Info-Tafel): 🔁 im Text wird beim Anzeigen zum Zeichen
await page.evaluate(() => { const el = document.querySelector("[data-langzeit]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(400);
const blase = await page.evaluate(() => { const b = document.querySelector("[data-info-blase]"); return { sym: !!b?.querySelector("svg[data-sym]"), emoji: /🔁/.test(b?.textContent || "") }; });
ok(blase.sym && !blase.emoji, `270: Info-Tafel zeigt das Zeichen statt des Emojis (${JSON.stringify(blase)})`);

console.log(`\n${fehler ? fehler + " FEHLER" : "ALLES OK"}`);
await browser.close();
process.exit(fehler ? 1 : 0);
