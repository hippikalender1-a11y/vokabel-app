import puppeteer from "puppeteer-core";
import { einstUnter, zuListen, listeOeffnen } from "./hilfen.mjs";

// 168–174: Farbe je Sprache schon bei der Session-Wahl (Einstellung „erst im Quiz“), Kopf-Balken auch bei offener Auswahl,
// inaktiver „Keine fälligen“-Knopf, Kachel-Lang-Druck mit zusätzlichem Kontextmenü (Android), fällige einstreuen,
// Kreise ODER Rauten, Einstellungen-Tab zugeklappt
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(250); };
const haupt = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--haupt").trim());
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(300);
};
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300); };
const gewaehlt = () => page.evaluate(() => [...document.querySelectorAll("[data-multi-nr]")].map(b => b.dataset.slotId).join(","));
const tageHer = d => new Date(Date.now() - d * 86400000).toISOString();
const STD = "#2d6a4f", EN = "#1d3c78", FR = "#0055a4";

await page.goto(URL);
await page.evaluate(alt => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "einfach", sprachFarben: { an: true } }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Fremd",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vok = (p, f) => Array.from({ length: 4 }, (_, i) => ({ id: i + 1, E1: { wert: `${p}${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] }, ...(f?.[i] ? { fortschritt: f[i] } : {}) }));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 5, vokabeln: vok("mot") }));
  // Unit 1: Vokabel 2 hat Score 2 (Kreise), Vokabel 3 Stufe 2 (Rauten), Vokabel 4 ist fällig (Stufe 1 seit 10 Tagen)
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify({ id:"l_en", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 5, vokabeln: vok("word", [null,
    { score: 2, streak: 0, aufgedecktStreak: 0, letzteAbfrage: alt },
    { score: 4, streak: 0, aufgedecktStreak: 0, letzteAbfrage: new Date().toISOString(), stufeSeit: new Date().toISOString() },
    { score: 3, streak: 0, aufgedecktStreak: 0, letzteAbfrage: alt, stufeSeit: alt }]) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }, { id:"l_en", name:"Unit 1", sprache:"en", platz:{z:1,s:0} }]));
  const k = id => ({ listenIds:[id], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizSpalteModus:{ E1:"karte" }, quizInfoTypenSession:[], quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_fr", name:"Französisch", timestamp:1, platz:{z:0,s:0}, sessionFortschritt:null, konfiguration:k("l_fr") },
    { id:"g_en", name:"Englisch", timestamp:2, platz:{z:1,s:0}, sessionFortschritt:null, konfiguration:k("l_en") }] }));
}, tageHer(10));
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();

// ── 168: Farbe schon bei der Wahl ──
ok(await haupt() === STD, `nichts gewählt: Standard-Farbe (${await haupt()})`);
await klick('[data-slot-id="g_en"]');
ok(await haupt() === EN, `Session „Englisch“ angetippt: englische Farbe (${await haupt()})`);
// ── 169: Balken auch im offenen Kopf ──
ok(await page.$("[data-slot-kopf-name] [data-kopf-balken]"), "169: offener Kopf zeigt den Fortschrittsbalken");
await kontext('[data-slot-id="g_fr"]');
ok(await haupt() === FR, `Lang-Druck „Französisch“ (Mehrfachauswahl mit nur ihr): französische Farbe (${await haupt()})`);
await kontext('[data-slot-id="g_en"]');
ok(await gewaehlt() === "g_fr,g_en" && await haupt() === STD, `zwei Sprachen gewählt: normale Farbe (${await gewaehlt()} · ${await haupt()})`);
ok(await page.$("[data-slot-kopf-name] [data-kopf-balken]"), "169: Balken auch bei Mehrfachauswahl");
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "✕ Auswahl beenden")?.click()); await sleep(300);
await klick('[data-slot-id="g_en"]'); await klick("[data-slot-laden]");
ok(await haupt() === EN, `„Englisch“ geladen (Auswahl zu): englische Farbe (${await haupt()})`);
ok(await page.$("[data-slot-kopf-name] [data-kopf-balken]"), "169: Balken im geschlossenen Kopf");
// Einstellung „Erst im Quiz wechseln“
await einstUnter(page, "farben");
await page.evaluate(() => { const b = document.querySelector('[data-farb-tab="sprachen"]'); if (b && !document.querySelector("[data-sprachfarben]")) b.click(); }); await sleep(300);
ok(await page.$("[data-sprachfarben-quiz]"), "Einstellung „Erst im Quiz wechseln“ vorhanden");
await klick("[data-sprachfarben-quiz]");
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).sprachFarben.erstImQuiz) === true, "„Erst im Quiz“ gespeichert");
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
ok(await haupt() === STD, `„Erst im Quiz“: geladene englische Session färbt nicht (${await haupt()})`);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await haupt() === EN, `„Erst im Quiz“: in der Abfrage englische Farbe (${await haupt()})`);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(300);

// ── 174: Einstellungen-Tab beim Wechsel zugeklappt ──
await einstUnter(page, "lernen", "wiederholen");
ok(await page.$('[data-einst-kopf][data-offen="ja"]'), "Einstellungen: Bereich „Lernen“ offen");
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen"))?.click()); await sleep(300);
ok(!(await page.$('[data-einst-kopf][data-offen="ja"]')) && !(await page.$("[data-wiederholen-einst]")), "174: nach Tabwechsel alle Bereiche zugeklappt");

// ── 172: Fällige einstreuen ──
await einstUnter(page, "lernen", "wiederholen");
ok(await page.$('[data-faellig-anteil="30"].aktiv'), "Fällige einstreuen: Standard 30 %");
await klick('[data-faellig-anteil="100"]');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).faelligAnteil) === 100, "100 % gespeichert");
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim()) === "Wort4", `100 %: die fällige Vokabel „Wort4“ kommt zuerst (${await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim())})`);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(300);
await einstUnter(page, "lernen", "wiederholen");
await klick('[data-faellig-anteil="0"]');
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim()) === "Wort1", "0 %: die fällige kommt zuletzt (zuerst „Wort1“)");
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(300);

// ── 170: nichts fällig → inaktiver Knopf ──
await auswahlAuf();
await kontext("[data-alle-sessions]");
const aktiv = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => `${b.dataset.infoAktion}${b.disabled ? "(aus)" : ""}`).join(" | "));
ok(/🔁 Fällige wiederholen \(1\)/.test(aktiv), `„Alle Sessions“: eine fällige (${aktiv})`);
await page.mouse.click(5, 830); await sleep(300);
await page.evaluate(() => document.querySelector("[data-info-blase]")?.click()); await sleep(200);
await kontext('[data-slot-id="g_fr"]');
const fr = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => /fällig/i.test(b.dataset.infoAktion)));
ok(await page.evaluate(() => { const b = [...document.querySelectorAll("[data-info-aktion]")].find(b => /fällig/i.test(b.dataset.infoAktion)); return b && b.disabled && b.dataset.infoAktion === "🔁 Keine fälligen Vokabeln"; }),
  "170: Kachel ohne fällige: inaktiver Knopf „🔁 Keine fälligen Vokabeln“");
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => /fällig/i.test(b.dataset.infoAktion))?.click()); await sleep(300);
ok(await page.$("[data-auswahl-tafel]"), "inaktiver Knopf: antippen bewirkt nichts (Tafel bleibt)");
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "✕ Auswahl beenden")?.click()); await sleep(300);

// ── 171: Lang-Druck per Finger, der Browser meldet zusätzlich ein Kontextmenü (Android) ──
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
const m = await page.evaluate(() => { const r = document.querySelector('[data-slot-id="g_fr"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await finger("touchStart", m.x, m.y); await sleep(550);
await page.evaluate(m => { const el = document.elementFromPoint(m.x, m.y); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: m.x, clientY: m.y })); }, m);
await sleep(600);
await finger("touchEnd"); await sleep(500);
ok(await page.$("[data-auswahl-tafel]") && await gewaehlt() === "g_fr", `171: nach dem Loslassen bleibt die Tafel offen, „Französisch“ ausgewählt (${await gewaehlt()})`);
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "✕ Auswahl beenden")?.click()); await sleep(300);

// ── 173: Kreise ODER Rauten ──
await zuListen(page);
await page.evaluate(() => document.querySelector('[data-liste-id="l_en"]')?.click()); await sleep(300); await listeOeffnen(page);
await page.evaluate(() => document.querySelector('[data-liste-bereich="vokabeln"]')?.click()); await sleep(300);
const sym = await page.evaluate(() => [...document.querySelectorAll(".score-symbole")].map(s => `${s.dataset.scoreSymbole}:${s.querySelectorAll(".kreis").length}k${s.querySelectorAll(".raute").length}r${s.querySelectorAll(".voll").length}v`).join(","));
ok(/2:3k0r2v/.test(sym) && /4:0k3r1v/.test(sym), `173: Score 2 = Kreise (2 voll), Stufe 2 = nur Rauten (1 voll) (${sym})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
