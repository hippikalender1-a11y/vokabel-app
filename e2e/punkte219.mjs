import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// 219: Info zuklappen schließt die Vokabel-Liste; 220: Kopf antippen → Element in der Auswahl gewählt und sichtbar;
// 221: Listen eckig, Quiz rund; 222: ein Umschalt-Knopf so hoch wie der Pfad; 223: Pfad-Zeile klebt;
// 224: breite Bildschirme – Leistenfarben bis zum Rand
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(500); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear(); localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const idx = [];
  for (let i = 1; i <= 12; i++) { const id = "l" + i; localStorage.setItem("vokabel_liste_" + id, JSON.stringify({ id, name: `Unit ${i}`, sprache:"en", spalten: sp, naechste_id: 4, vokabeln: [1, 2, 3].map(j => ({ id: j, E1: { wert: "w" + j, falsch: [] }, D1: { wert: "W" + j, falsch: [] } })) }));
    idx.push({ id, name: `Unit ${i}`, sprache: "en", ...(i === 12 ? { ordner: "lo" } : {}), platz: { z: i === 12 ? 0 : i - 1, s: 0 } }); }
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id: "lo", name: "Fortgeschritten", platz: { z: 11, s: 0 } }]));
  localStorage.setItem("vokabel_listen_index", JSON.stringify(idx));
  const k = { listenIds:["l1"], bereichTyp:"alle", quizBereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf: [], gespeichert: [{ id: "g1", name: "Teil 1", timestamp: 1, konfiguration: k, sessionFortschritt: null, platz: { z: 0, s: 0 } }] }));
  localStorage.setItem("vokabel_letzter_slot", JSON.stringify("listen:l12"));   // Liste im Ordner „Fortgeschritten“
});
await page.reload(); await sleep(1000);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);

// ── 220: Listen-Kopf → Listen-Auswahl, Ordner offen, Kachel gewählt und sichtbar ──
await auswahlAuf();
const a220 = await page.evaluate(() => { const k = document.querySelector('[data-qliste-id="l12"]'); const r = k?.getBoundingClientRect();
  return { umschalter: document.querySelector("[data-auswahl-umschalter]")?.dataset.auswahlUmschalter, ordner: document.querySelector('[data-ordner-navi="quiz-listen"] [data-ordner-name]')?.textContent.trim(),
    gewaehlt: k?.classList.contains("kachel-gewaehlt"), sichtbar: !!r && r.top >= 0 && r.bottom <= innerHeight }; });
ok(a220.umschalter === "listen" && /Fortgeschritten/.test(a220.ordner || "") && a220.gewaehlt && a220.sichtbar, `220: Liste im Kopf → Listen-Auswahl, Ordner offen, Kachel gewählt und sichtbar (${JSON.stringify(a220)})`);

// ── 222: ein Knopf, so hoch wie die Pfad-Zeile ──
const a222 = await page.evaluate(() => { const b = document.querySelectorAll("[data-auswahl-umschalter]"); const z = document.querySelector('[data-ordner-navi="quiz-listen"]');
  const cs = getComputedStyle(z); const innen = z.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  return { anzahl: b.length, hoehe: Math.round(b[0].getBoundingClientRect().height), zeile: Math.round(innen) }; });
ok(a222.anzahl === 1 && Math.abs(a222.hoehe - a222.zeile) <= 1, `222: ein Umschalt-Knopf, so hoch wie die Pfad-Zeile (${JSON.stringify(a222)})`);

// ── 221: Listen eckig, Quiz rund ──
const ecke = sel => page.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s)).borderTopLeftRadius), sel);
const listeEcke = await ecke('[data-qliste-id="l12"]');
await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]").click()); await sleep(300);
const quizEcke = await ecke('[data-slot-id="g1"]');
ok(listeEcke <= 4 && quizEcke >= 8, `221: Listen-Kachel eckig (${listeEcke}px), Quiz-Kachel rund (${quizEcke}px)`);
await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]").click()); await sleep(300);

// ── 223: Pfad-Zeile klebt unter Kopf und Info ──
await page.evaluate(() => { if (document.querySelector("[data-ordner-zurueck]")) document.querySelector("[data-ordner-zurueck]").click(); }); await sleep(300);
await page.evaluate(() => window.scrollTo(0, 400)); await sleep(300);
const a223 = await page.evaluate(() => { const p = document.querySelector('[data-ordner-navi="quiz-listen"]').getBoundingClientRect(), i = document.querySelector("[data-slot-info]").getBoundingClientRect();
  return { pfad: Math.round(p.top), info: Math.round(i.bottom) }; });
ok(Math.abs(a223.pfad - a223.info) <= 1, `223: beim Scrollen bleibt die Pfad-Zeile direkt unter der Info stehen (${JSON.stringify(a223)})`);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);

// ── 219: Info zuklappen schließt die Vokabel-Liste ──
await page.evaluate(() => { if (document.querySelector("[data-slot-info-zu]")) document.querySelector("[data-slot-info]").click(); }); await sleep(300);
await page.evaluate(() => document.querySelector("[data-vorschau-vokabeln]")?.click()); await sleep(300);
const offen = !!(await page.$("[data-vorschau-vokliste]"));
await page.evaluate(() => document.querySelector("[data-slot-info]").click()); await sleep(300);   // zu
await page.evaluate(() => document.querySelector("[data-slot-info]").click()); await sleep(300);   // wieder auf
ok(offen && !(await page.$("[data-vorschau-vokliste]")), "219: Info zu und wieder auf – die Vokabel-Liste ist mit zugeklappt");

// ── 223: Einstellungen › Listen – Pfad klebt unter der Knopfzeile ──
await zuListen(page);
await page.evaluate(() => window.scrollTo(0, 500)); await sleep(300);
const a223b = await page.evaluate(() => { const p = document.querySelector('[data-ordner-navi="liste"]').getBoundingClientRect(), k = document.querySelector("[data-listen-kopf-bereich]").getBoundingClientRect();
  return { pfad: Math.round(p.top), kopf: Math.round(k.bottom) }; });
ok(Math.abs(a223b.pfad - a223b.kopf) <= 1, `223: Listen-Pfad klebt unter der Knopfzeile (${JSON.stringify(a223b)})`);

// ── 224: breite Bildschirme ──
await page.setViewport({ width: 1024, height: 700 }); await sleep(400);
const a224 = await page.evaluate(() => { const q = document.querySelector(".quiz-zeile"); const cs = getComputedStyle(q); return { clip: cs.clipPath, schatten: cs.boxShadow }; });
ok(/inset/.test(a224.clip) && /\d{3,}px/.test(a224.schatten), `224: Knopfzeile wird zum Rand fortgeführt (${a224.clip})`);
await page.setViewport({ width: 390, height: 844 }); await sleep(300);
const a224b = await page.evaluate(() => getComputedStyle(document.querySelector(".quiz-zeile")).clipPath);
ok(a224b === "none", `224: auf dem Handy unverändert (${a224b})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
