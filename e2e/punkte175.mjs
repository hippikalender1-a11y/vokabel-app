import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// 175–179: im Quiz zurückwischen und Bewertung ändern, Vokabel herausnehmen (und wieder hineinnehmen),
// lange Zeilen umbrechen, rote Kreise (zwei Stufen des Nichtwissens, −6), Altlasten (−100 → −6)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const wische = async (von, bis) => {
  await finger("touchStart", von, 450);
  for (let i = 1; i <= 6; i++) { await finger("touchMove", von + (bis - von) * i / 6, 452); await sleep(20); }
  await finger("touchEnd"); await sleep(350);
};
const zurueck = () => wische(60, 330), vor = () => wische(330, 60);
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(300);
};
const aktion = async label => { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
const bewerte = async gewusst => {
  await page.evaluate(() => document.querySelector("[data-frei-klick]")?.click()); await sleep(250);
  await page.evaluate(g => [...document.querySelectorAll(".karte-btn")].find(b => g ? /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent) : /Nicht/.test(b.textContent))?.click(), gewusst);
  await sleep(1400);
};
const vok = id => page.evaluate(i => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.id === i), id);
const LANG = "nervös/verlegen/aufgeregt/verärgert/beschämt/unsicher";

await page.goto(URL);
await page.evaluate(lang => {
  localStorage.clear(); localStorage.setItem("vokabel_test_ohne_tagessperre", "1");
  localStorage.setItem("vokabel_stufen_v1", "1");
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus: "schwer" }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => s == null ? undefined : { score: s, letzteAbfrage: new Date().toISOString() };
  const w = (id, e, d, s) => ({ id, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(s != null ? { fortschritt: f(s) } : {}) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 7, vokabeln: [
    w(1, "one", "eins", -5), w(2, "two", "zwei", -2), w(3, "three", "drei", -6), w(4, "four", "vier", 0), w(5, "Baker Street", "Bäckerstraße", -100), w(6, "nervous", lang, 0)] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
  const k = { listenIds:["l_a"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizSpalteModus:{ E1:"karte" }, quizInfoTypenSession:[], quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Unit 1", timestamp:1, platz:{z:0,s:0}, sessionFortschritt:null, konfiguration:k }] }));
}, LANG);
await page.reload(); await sleep(800);

// ── 179: Altlast −100 → −6 ──
ok((await vok(5)).fortschritt.score === -6, `179: alter Score −100 einmalig auf −6 (${(await vok(5)).fortschritt.score})`);

// Session laden und starten
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => document.querySelector('[data-slot-id="g_1"]').click()); await sleep(650);   // 192: antippen lädt sofort
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);

// ── 178: Stufen des Nichtwissens ──
ok(await frage() === "eins", `Start: „eins“ (${await frage()})`);
await bewerte(true);
ok((await vok(1)).fortschritt.score === -3, `−5 (zwei gefüllte) + richtig → −3 (drei Umrisse) (${(await vok(1)).fortschritt.score})`);
await bewerte(true);
ok((await vok(2)).fortschritt.score === 0, `−2 + richtig → 0 (${(await vok(2)).fortschritt.score})`);
await bewerte(false);
ok((await vok(3)).fortschritt.score === -6, `−6 + falsch → bleibt −6 (gekappt) (${(await vok(3)).fortschritt.score})`);
await bewerte(false);
ok((await vok(4)).fortschritt.score === -1, `0 + falsch → −1 (${(await vok(4)).fortschritt.score})`);

// ── 176: Vokabel im Quiz herausnehmen ──
ok(await frage() === "Bäckerstraße", `nächste Frage „Bäckerstraße“ (${await frage()})`);
await kontext("[data-karte-frage]");
ok(await page.$('[data-info-aktion="🚫 Nicht mehr abfragen"]'), "Lang-Druck auf die Karte: „🚫 Nicht mehr abfragen“");
await aktion("🚫 Nicht mehr abfragen");
ok((await vok(5)).herausgenommen === true && (await vok(5)).fortschritt.score === -6, "herausgenommen (gespeichert), Score unverändert");
ok((await frage())?.replace(/\u200B/g, "") === LANG, `weiter mit der nächsten Karte (${await frage()})`);

// ── 177: lange Zeile ohne Leerzeichen bricht um ──
const breite = await page.evaluate(() => ({ seite: document.documentElement.scrollWidth, frage: Math.round(document.querySelector(".quiz-frage-text").getBoundingClientRect().right) }));
ok(breite.seite <= 390 && breite.frage <= 390, `177: nichts steht über (Seite ${breite.seite}, Frage rechts ${breite.frage})`);
ok(await page.evaluate(() => document.querySelector(".quiz-frage-text").getBoundingClientRect().height > 50), "177: Frage umgebrochen (mehrzeilig)");

// ── 175: zurückwischen, Bewertung ansehen und ändern ──
await zurueck();
ok(await page.$('[data-rueckblick="3"]') && await frage() === "vier", `nach rechts wischen: vorige Karte „vier“ (${await frage()})`);
ok(await page.evaluate(() => document.querySelector('[data-rueck-bewertung="falsch"]')?.dataset.gewaehlt) === "ja", "Rückblick: „Nicht gewusst“ als Wertung markiert");
await page.evaluate(() => document.querySelector('[data-rueck-bewertung="richtig"]').click()); await sleep(300);
ok((await vok(4)).fortschritt.score === -1, "antippen der anderen Bewertung ändert nichts");
await kontext('[data-rueck-bewertung="richtig"]');
ok(await page.$('[data-info-aktion="✓ Doch gewusst – umwerten"]'), "Lang-Druck auf „Gewusst“: Rückfrage „✓ Doch gewusst – umwerten“");
await aktion("✓ Doch gewusst – umwerten");
ok((await vok(4)).fortschritt.score === 1, `umgewertet: Score aus dem Stand vor der Antwort neu (0 + richtig = 1) (${(await vok(4)).fortschritt.score})`);
ok(await page.evaluate(() => document.querySelector('[data-rueck-bewertung="richtig"]')?.dataset.gewaehlt) === "ja" && await page.$("[data-rueck-geaendert]"), "Rückblick zeigt jetzt „Gewusst“, als geändert markiert");
await zurueck(); await zurueck();
ok(await page.$('[data-rueckblick="1"]') && await frage() === "zwei", `zwei weitere Karten zurück: „zwei“ (${await frage()})`);
await zurueck(); await zurueck();
ok(await page.$('[data-rueckblick="0"]'), "am Anfang der Runde bleibt es bei der ersten Karte");
for (let i = 0; i < 4; i++) await vor();
ok(!(await page.$("[data-rueckblick]")) && (await frage())?.replace(/\u200B/g, "") === LANG, `nach links bis zur aktuellen Karte: Quiz geht weiter (${await frage()})`);
await bewerte(true);
ok((await vok(6)).fortschritt.score === 1, "aktuelle Karte normal bewertet");

// ── 176: Herausgenommene in der Liste anzeigen und zurückholen ──
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Wiederholung abbrechen/.test(b.textContent))?.click()); await sleep(400);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(300);
await zuListen(page);
await kontext('[data-liste-id="l_a"]');
ok(await page.$('[data-info-aktion="🚫 Herausgenommene (1)"]'), "Listen-Menü: „🚫 Herausgenommene (1)“");
await aktion("🚫 Herausgenommene (1)");
const zeilen = await page.evaluate(() => [...document.querySelectorAll("[data-such-ziel='liste']")].map(z => (z.dataset.herausgenommen !== undefined ? "🚫" : "") + z.textContent.slice(0, 30)));
ok(zeilen.length === 1 && zeilen[0].startsWith("🚫"), `nur die herausgenommene Vokabel, ausgegraut mit 🚫 (${zeilen.join(" | ")})`);
await kontext("[data-herausgenommen]");
await aktion("↩ Wieder abfragen");
ok(!(await vok(5)).herausgenommen, "„↩ Wieder abfragen“: wieder dabei");
ok(!(await page.$("[data-nur-aus]")) && await page.evaluate(() => document.querySelectorAll("[data-such-ziel='liste']").length) === 6, "Liste zeigt wieder alle 6");

// ── 178: Symbole ──
const sym = await page.evaluate(() => [...document.querySelectorAll(".score-symbole")].map(s => `${s.dataset.scoreSymbole}:${s.querySelectorAll(".negativ").length}n${s.querySelectorAll(".negativ.voll").length}v`).join(","));
ok(/-3:3n0v/.test(sym) && /-6:3n3v/.test(sym), `178: −3 = drei rote Umrisse, −6 = drei rot gefüllt (${sym})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
