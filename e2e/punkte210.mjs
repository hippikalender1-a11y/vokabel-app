import puppeteer from "puppeteer-core";
import { zuListen, kurzHalten } from "./hilfen.mjs";

// 210/211: Vokabelzahlen auf Ordnern und Quiz-Kacheln (eng: „Q.“, „L.“, „V.“), kein „· n Ordner“; 212: Verlauf bis 10,
// zweispaltig; 213: Jahr zweistellig; 214: immer ein freier Platz; 215: Quiz-Tab öffnet/schließt die Quiz-Auswahl;
// 216: ungespeichertes Quiz aus einer Liste heißt wie die Liste
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n))?.click(), name); await sleep(400); };
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim() }));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 6, vokabeln: [1, 2, 3, 4, 5].map(i => ({ id: i, E1: { wert: name + i, falsch: [] }, D1: { wert: "W" + i, falsch: [] } })) });
  ["l_a", "l_b", "l_c"].forEach((id, i) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify(liste(id, "Unit " + (i + 1)))));
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id: "lo1", name: "Englisch", platz: { z: 0, s: 0 } }, { id: "lo2", name: "Sub", ordner: "lo1", platz: { z: 0, s: 0 } }]));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", ordner: "lo1", platz:{z:1,s:0} },
    { id:"l_b", name:"Unit 2", sprache:"en", ordner: "lo2", platz:{z:0,s:0} }, { id:"l_c", name:"Unit 3", sprache:"en", platz:{z:1,s:0} }]));
  const k = (id, von, bis) => ({ listenIds:[id], vokabelAuswahl: Array.from({ length: bis - von + 1 }, (_, i) => `${id}__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  const verlauf = Array.from({ length: 10 }, (_, i) => ({ id: "v" + i, name: `0${i}.11.2026, 10:0${i}`, timestamp: i, konfiguration: k("l_c", 1, 5), sessionFortschritt: null }));
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf, ordner: [{ id: "o1", name: "Ordner", platz: { z: 0, s: 0 } }], gespeichert: [
    { id: "s1", name: "Teil 1", timestamp: 1, ordner: "o1", konfiguration: k("l_a", 1, 3), sessionFortschritt: null, platz: { z: 0, s: 0 } },
    { id: "s2", name: "Teil 2", timestamp: 2, ordner: "o1", konfiguration: k("l_a", 2, 5), sessionFortschritt: null, platz: { z: 1, s: 0 } },
    { id: "s3", name: "Teil 3", timestamp: 3, konfiguration: k("l_c", 1, 5), sessionFortschritt: null, platz: { z: 1, s: 0 } }] }));
});
await page.reload(); await sleep(900);

// ── 210: Quiz (eine Spalte → ausgeschrieben) ──
await tab("Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
const s = await page.evaluate(() => ({ ordner: document.querySelector('[data-ordner-id="o1"] .ordner-anzahl')?.textContent.trim(), ordnerV: document.querySelector('[data-ordner-id="o1"] .raster-anz')?.textContent.trim(),
  teil: document.querySelector('[data-slot-id="s3"] .raster-anz')?.textContent.trim() }));
ok(s.ordner === "· 2 Quiz" && s.ordnerV === "5 Vokabeln" && s.teil === "5 Vokabeln", `210: Ordner „· 2 Quiz“ + „5 Vokabeln“ (jede einmal), Quiz „5 Vokabeln“ (${JSON.stringify(s)})`);
// 214: eine Spalte, beide Plätze belegt → freie Zeile darunter
ok(await page.$("[data-freier-platz]") !== null, "214: Quiz – alle Plätze belegt → eine freie Zeile für den Lang-Druck");

// ── 212/213: Verlauf ──
await page.evaluate(() => document.querySelector('[data-verlauf-kopf="zu"]')?.click()); await sleep(300);
const v = await page.evaluate(() => ({ spalten: getComputedStyle(document.querySelector("[data-verlauf-raster]")).gridTemplateColumns.split(" ").length,
  breiten: [...new Set([...document.querySelectorAll("[data-verlauf-id]")].map(b => Math.round(b.getBoundingClientRect().width)))], erster: document.querySelector("[data-verlauf-id]")?.textContent.trim() }));
ok(v.spalten === 2 && v.breiten.length === 1 && /^\d{2}\.11\.26, /.test(v.erster), `212/213: Verlauf zweispaltig, gleich breit, Jahr zweistellig (${JSON.stringify(v)})`);

// ── 215: Quiz-Tab ──
await tab("Quiz");
ok((await kopf()).zustand !== "offen", "215: Auswahl offen, nichts geändert → Quiz-Tab schließt sie");
await tab("Quiz");
ok((await kopf()).zustand === "offen", "215: Quiz-Tab öffnet die Quiz-Auswahl");
await kurzHalten(page, '[data-slot-id="s3"]');
await tab("Quiz");
let k = await kopf();
ok(k.zustand === "offen" && /Teil 3 laden/.test(k.name), `215: Auswahl geändert → Quiz-Tab tut nichts (${JSON.stringify(k)})`);
await page.evaluate(() => document.querySelector("[data-slot-laden]")?.click()); await sleep(600);

// ── 212: neuer Verlauf-Eintrag – es bleiben 10 ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await zuListen(page);
await page.evaluate(() => document.querySelector('[data-liste-id="l_c"]')?.click()); await sleep(500);   // antippen öffnet
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Quiz starten")?.click()); await sleep(600);
// ── 216: ungespeichertes Quiz aus einer Liste ──
k = await kopf();
ok(/Unit 3/.test(k.name) && !/nicht gespeichert/.test(k.name), `216/217: Kopf zeigt die Liste „Unit 3“ (ohne „nicht gespeichert“) (${k.name})`);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(500);
const vl = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).verlauf);
ok(vl.length === 10 && vl[0].id === "v0", `212/217: Liste als Quiz legt keinen Verlauf-Eintrag an – es bleiben die 10 (${vl.length}, ${vl[0].id})`);

// ── 210/211/214: Listen-Ordner ──
await zuListen(page);
await page.evaluate(() => { if (document.querySelector("[data-ordner-zurueck]")) document.querySelector("[data-ordner-zurueck]").click(); }); await sleep(300);
const lo = await page.evaluate(() => document.querySelector('[data-lordner-id="lo1"] .karte-zeile-sub')?.textContent.trim());
ok(lo === "2 Listen · 10 Vokabeln", `210/211: Listen-Ordner „2 Listen · 10 Vokabeln“ (samt Unterordner, ohne „· n Ordner“) (${lo})`);
ok(await page.$("[data-freier-platz]") !== null, "214: Listen – alle Plätze belegt → eine freie Zeile");
// 216 Speichern-Vorschlag
await tab("Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => { const el = document.querySelector("[data-slot-kopf-name]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(300);
const listenMenue = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
ok(listenMenue.includes("📂 Liste öffnen") && listenMenue.includes("＋ Quiz erstellen") && !listenMenue.some(m => /Speichern/.test(m)), `217: Listen-Kopf ohne Speichern, mit „Liste öffnen“ / „Quiz erstellen“ (${listenMenue.join(" | ")})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
