import puppeteer from "puppeteer-core";
import { menueShim, zuListen, listeWaehlen, kurzHalten } from "./hilfen.mjs";

// 357: Rückblick – Kartentext bearbeiten (lang drücken); 358: Statistik-Kopf ‹ › statt Vokabel-Auswahl-Knopf;
// 359: Standard-Ansicht automatisch nach Name in 2 Spalten, Spalten/Anordnen für eine oder alle Ebenen;
// 360: Multi-Quiz ohne „n V“-Knopf; 361: Von–Bis per langem Druck beenden, kehrt die Auswahl um; 362: „✕ Abbrechen“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const s = window.speechSynthesis; s.getVoices = () => []; s.speak = () => {}; s.cancel = () => {}; });
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kontext = async sel => {
  await page.evaluate(sel => { const el = typeof sel === "string" ? document.querySelector(sel) : null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const langZeile = async i => { await page.evaluate(i => { const el = document.querySelectorAll(".vok-zeile")[i - 1], r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, i); await sleep(1000); };   // 900 ms Sperre zwischen Lang-Aktionen
const menue = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
const aktion = async re => { await page.evaluate(r => [...__aktionen()].find(b => new RegExp(r).test(b.dataset.infoAktion))?.click(), re); await sleep(400); };
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n))?.click(), name); await sleep(400); };
const einst = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"));
const ordner = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_ordner") || "[]"));
// Kacheln des Listen-Rasters: Name → Platz in der Anzeige
const raster = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".listen-raster [data-raster-zelle]")]
  .filter(z => z.querySelector(".karte-zeile-name") || z.classList.contains("karte-zeile")).map(z => [(z.querySelector(".karte-zeile-name") || z).textContent.replace(/^📁\s*/, "").trim().split("\n")[0], z.dataset.rasterZelle])));
const gewaehlt = () => page.evaluate(() => [...document.querySelectorAll(".vok-zeile")].map((z, i) => z.querySelector(".checkbox.checked") ? i + 1 : null).filter(Boolean).join(","));
const kopfName = () => page.evaluate(() => __txt(document.querySelector("[data-slot-kopf-name]"))?.trim());

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear(); localStorage.setItem("vokabel_test_ohne_tagessperre", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name, w, ordner) => { localStorage.setItem(`vokabel_liste_${id}`, JSON.stringify({ id, name, sprache: "en", spalten: sp, naechste_id: w.length + 1,
    vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) })); return { id, name, sprache: "en", ...(ordner ? { ordner } : {}) }; };
  const b = liste("liste_1700000000001", "Beta", [["one","eins"],["two","zwei"],["three","drei"],["four","vier"],["five","fünf"],["six","sechs"]]);
  const a = liste("liste_1700000000002", "Alpha", [["red","rot"],["blue","blau"],["green","grün"]]);
  const g = liste("liste_1700000000003", "Gamma", [["cat","Katze"],["dog","Hund"]], "o1");
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ ...b, platz:{z:0,s:0} }, { ...a, platz:{z:1,s:0} }, { ...g, platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id:"o1", name:"Mappe", platz:{z:2,s:0}, spalten:1 }]));
  const k = ids => ({ listenIds: ids, vokabelAuswahl: [], bereichTyp:"alle", quizBereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[], gespeichert: [
    { id:"sB", name:"Teil B", timestamp:2, konfiguration:k(["liste_1700000000001"]), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"sA", name:"Teil A", timestamp:1, konfiguration:k(["liste_1700000000002"]), sessionFortschritt:null, platz:{z:1,s:0} }] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ gelerntSchwelle: 3, sprache: "alle", lueckenlos: false, ebenenSpalten: { liste: 1 } }));
});
await page.reload(); await sleep(900);

// ── 359: einmalige Umstellung auf automatisch, nach Name, 2 Spalten ──
const e0 = await einst(), o0 = await ordner();
ok(await page.evaluate(() => localStorage.getItem("vokabel_ansicht_v359")) === "1" && !("lueckenlos" in e0) && !e0.ebenenSpalten && !("spalten" in o0[0]),
  `359: einmalig umgestellt – eigene Spalten/Anordnung entfernt (${JSON.stringify({ e: e0.ebenenSpalten, l: e0.lueckenlos, o: o0[0] })})`);
await zuListen(page);
const anz = await page.evaluate(() => document.querySelector(".listen-raster")?.dataset.rasterSpaltenAnz);
let r = await raster();
console.log("     Raster:", JSON.stringify(r));
ok(anz === "2" && r.Mappe === "0|0" && r.Alpha === "1|0" && r.Beta === "0|1", `359: Standard 2 Spalten, Ordner zuerst, dann nach Name spaltenweise (${anz}, ${JSON.stringify(r)})`);

// Menü: Anordnen zeigt die aktuelle Anordnung; Fenster mit „Nur diese Ebene | Alle Ebenen“
await kontext("[data-alle-listen]");
const m = await menue();
ok(m.includes("⇅ Anordnen (Name)…") && !m.some(x => /Automatische Anordnung|Freie Anordnung/.test(x)), `359: Menü „⇅ Anordnen (Name)…“, kein eigener Schalter mehr (${m.join(" | ")})`);
await aktion("Anordnen");
const d1 = await page.evaluate(() => ({ ebene: document.querySelector("[data-ebenen-wahl]")?.dataset.ebenenWahl, aktiv: document.querySelector("[data-anordnen-aktiv]")?.dataset.anordnen }));
if (process.env.BILD) await page.screenshot({ path: `${process.env.BILD}/b359.png` });
ok(d1.ebene === "diese" && d1.aktiv === "name", `359: Fenster – „Nur diese Ebene“ vorgewählt, „Nach Name“ aktiv (${JSON.stringify(d1)})`);
await page.evaluate(() => document.querySelector('[data-anordnen="datum"]').click()); await sleep(400);
r = await raster();
ok((await einst()).ebenenSortierung?.liste === "datum" && r.Mappe === "0|0" && r.Beta === "1|0" && r.Alpha === "0|1", `359: nach Datum – bleibt so sortiert (${JSON.stringify(r)})`);

// Spalten für alle Ebenen
await kontext("[data-alle-listen]"); await aktion("Spalten");
await page.evaluate(() => document.querySelector('[data-ebenen="alle"]').click()); await sleep(200);
await page.evaluate(() => document.querySelector('[data-spalten-wahl="3"]').click()); await sleep(400);
ok((await einst()).ebenenSpalten?.liste === 3 && (await ordner())[0].spalten === 3, `359: „Alle Ebenen“ – 3 Spalten oben und im Ordner (${JSON.stringify((await einst()).ebenenSpalten)}, ${(await ordner())[0].spalten})`);
// Anordnen „Frei“ für alle Ebenen: die bisherige Reihenfolge wird zu festen Plätzen
await kontext("[data-alle-listen]"); await aktion("Anordnen");
await page.evaluate(() => document.querySelector('[data-ebenen="alle"]').click()); await sleep(200);
await page.evaluate(() => document.querySelector('[data-anordnen="frei"]').click()); await sleep(400);
const idx = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_listen_index")).map(l => [l.name, `${l.platz.z}|${l.platz.s}`])));
ok((await einst()).ebenenAnordnung?.liste === "frei" && (await ordner())[0].anordnung === "frei" && idx.Beta === "0|0" && idx.Alpha === "1|0",
  `359: „Frei“ für alle Ebenen – die eigenen Plätze bleiben (${JSON.stringify(idx)})`);
await kontext("[data-alle-listen]");
ok((await menue()).includes("⇅ Anordnen (Frei)…"), "359: Menü zeigt „Frei“");
await page.keyboard.press("Escape"); await page.mouse.click(5, 830); await sleep(300);

// ── 362/361: Vokabelauswahl – Abbrechen, Von–Bis per langem Druck, Auswahl umkehren ──
await tab("Quiz");
await listeWaehlen(page, "Beta");
await page.click("[data-kopf-anzahl]"); await sleep(500);
await page.evaluate(() => document.querySelectorAll(".vok-zeile")[0].click()); await sleep(200);
if (process.env.BILD) await page.screenshot({ path: `${process.env.BILD}/b362.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
ok(await page.$("[data-vok-abbrechen]") && await page.$("[data-vok-bestaetigen]:not([data-vok-zurueck])"), "362: nach einer Änderung „✕ Abbrechen“ neben „Bestätigen“");
await page.click("[data-vok-abbrechen]"); await sleep(400);
const nachAbbr = await page.evaluate(() => ({ zeilen: document.querySelectorAll(".vok-zeile").length, bereich: document.querySelector("[data-kopf-anzahl]")?.dataset.kopfBereich }));
ok(nachAbbr.zeilen === 0 && nachAbbr.bereich === "Alle", `362: Abbrechen verwirft die Änderung und schließt (${JSON.stringify(nachAbbr)})`);
await page.click("[data-kopf-anzahl]"); await sleep(500);
ok(await gewaehlt() === "" && await page.$("[data-vok-zurueck]") && !(await page.$("[data-vok-abbrechen]")), "362: unverändert nur „← Zurück“, nichts ausgewählt");
await page.evaluate(() => document.querySelectorAll(".vok-zeile")[1].click()); await sleep(200);   // Nr. 2 gewählt
await langZeile(1); await langZeile(4);
ok(await gewaehlt() === "1,3,4", `361: Von–Bis 1–4 per langem Druck kehrt um – 2 ab, 1/3/4 an (${await gewaehlt()})`);
await langZeile(5); await langZeile(5);
const nochVonBis = await page.evaluate(() => [...document.querySelectorAll("button")].some(b => /^(Von…|…Bis)$/.test(b.textContent.trim())));
ok(await gewaehlt() === "1,3,4" && !nochVonBis, `361: langer Druck auf den Anfang bricht Von–Bis ab (${await gewaehlt()}, ${nochVonBis})`);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Von–Bis")?.click()); await sleep(200);
await page.evaluate(() => document.querySelectorAll(".vok-zeile")[2].click()); await sleep(200);
await page.evaluate(() => document.querySelectorAll(".vok-zeile")[5].click()); await sleep(300);
ok(await gewaehlt() === "1,5,6", `361: Von–Bis per Antippen (3–6) kehrt ebenfalls um (${await gewaehlt()})`);
await page.click("[data-vok-bestaetigen]"); await sleep(400);

// ── 360: Multi-Quiz – kein „n V“-Knopf ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(600);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
await kurzHalten(page, '[data-slot-id="sA"]'); await kurzHalten(page, '[data-slot-id="sB"]');
await page.click("[data-wahl-fertig]"); await sleep(900);
const multi = await page.evaluate(() => ({ name: __txt(document.querySelector("[data-slot-kopf-name]")), anzahl: !!document.querySelector("[data-kopf-anzahl]") }));
ok(/🧩|Multiquiz/.test(multi.name) && !multi.anzahl, `360: Multi-Quiz ohne „n V / Alle“-Knopf (${JSON.stringify(multi)})`);

// ── 358: Statistik – ‹ › blättert durch die Quiz der Ebene (im Kreis), kein „n V“-Knopf ──
await tab("Statistik");
const st0 = await page.evaluate(() => ({ pfeile: document.querySelectorAll("[data-kopf-pfeil]").length, anzahl: !!document.querySelector("[data-kopf-anzahl]") }));
if (process.env.BILD) await page.screenshot({ path: `${process.env.BILD}/b358.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
ok(st0.pfeile === 2 && !st0.anzahl, `358: Statistik-Kopf mit ‹ › statt „n V“ (${JSON.stringify(st0)})`);
const weiter = async r => { await page.click(`[data-kopf-pfeil="${r > 0 ? "weiter" : "zurueck"}"]`); await sleep(700); return kopfName(); };
const folge = [await weiter(1), await weiter(1), await weiter(1), await weiter(-1)];
console.log("     Blättern:", JSON.stringify(folge));
ok(folge[0] === "Teil A" && folge[1] === "Teil B" && folge[2] === "Teil A" && folge[3] === "Teil B", `358: Teil A → Teil B → (von vorn) Teil A, zurück Teil B (${folge.join(" › ")})`);
await tab("Quiz");
ok(await kopfName() === "Teil B", `358: der Quiz-Tab wechselt mit (${await kopfName()})`);

// ── 357: Rückblick – Frage per langem Druck bearbeiten ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(200);
await page.evaluate(() => document.querySelector(".karte-btn-ja")?.click()); await sleep(1300);
await page.evaluate(() => { const s = document.querySelector(".sektion"); const t = (x, typ) => new Touch({ identifier: 1, target: s, clientX: x, clientY: 400 });
  s.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(60)], changedTouches: [t(60)] }));
  s.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [t(330)], changedTouches: [t(330)] }));
  s.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [t(330)] })); }); await sleep(400);
ok(await page.$("[data-rueckblick]"), "357: zurückgewischt – Rückblick");
await kontext("[data-rueck-frage]");
ok((await menue()).includes("✎ Frage bearbeiten"), `357: langer Druck auf die Frage – „✎ Frage bearbeiten“ (${(await menue()).join(" | ")})`);
await aktion("Frage bearbeiten"); await sleep(300);
const feld = await page.evaluate(() => { const f = document.querySelector(".modal input, .modal textarea"); return f ? f.value : null; });
ok(feld === "eins", `357: Bearbeiten-Fenster öffnet sich über dem Rückblick mit „eins“ (${feld})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
