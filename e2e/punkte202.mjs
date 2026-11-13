import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// 202: Listen zeigen Beispielsätze (gesamt) und Synonyme – Kachel kurz, Info ausführlich; 203: Mindest-Spalten je Ebene
// (Listen: Knopf „Spalten“, Sessions: Menü „▥ Spalten“); 204: Quiz aus einer Liste → am Ende zurück zur Liste;
// 206: kein „nach oben“ in der Statistik-Kopfzeile; 208: „⇅ Anordnen…“; 209: Knopfzeile der Liste beginnt mit „Vokabeln“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const aktion = async re => { await page.evaluate(r => [...document.querySelectorAll("[data-info-aktion]")].find(b => new RegExp(r).test(b.dataset.infoAktion))?.click(), re); await sleep(400); };
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n))?.click(), name); await sleep(400); };
const idx = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_index")));
const quizUndZurueck = async () => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(300);
  await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
  const imQuiz = await page.evaluate(() => !!document.querySelector(".topbar-back"));
  await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(600);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(700);
  return imQuiz;
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage: [1, 1, 1, 1] }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch",i1:"Synonyme"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const alt = new Date(Date.now() - 86400000 * 10).toISOString();
  const liste = (id, name, mitSyn) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 4, vokabeln: [1, 2, 3].map(i => ({ id: i,
    E1: { wert: "big" + i, falsch: [] }, D1: { wert: "groß" + i, falsch: [] }, ...(mitSyn ? { i1: { wert: "large, huge", falsch: [] } } : {}),
    fortschritt: { score: i, letzteAbfrage: alt, stufeSeit: alt } })) });
  localStorage.setItem("vokabel_liste_liste_1700000000002", JSON.stringify(liste("liste_1700000000002", "Unit 10", true)));
  localStorage.setItem("vokabel_liste_liste_1700000000001", JSON.stringify(liste("liste_1700000000001", "Unit 2", false)));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"liste_1700000000002", name:"Unit 10", sprache:"en", platz:{z:0,s:0} }, { id:"liste_1700000000001", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
  const k = id => ({ listenIds:[id], bereichTyp:"alle", quizBereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert: [
    { id:"g_b", name:"Teil 10", timestamp: 2, konfiguration: k("liste_1700000000002"), sessionFortschritt: null, platz: { z: 0, s: 0 } },
    { id:"g_a", name:"Teil 2", timestamp: 1, konfiguration: k("liste_1700000000001"), sessionFortschritt: null, platz: { z: 2, s: 0 } }] }));
});
// Beispielsätze in IndexedDB: Unit 10 – 3 Vokabeln × 2 Sätze
await page.evaluate(() => new Promise(res => {
  const r = indexedDB.open("vokabel_saetze", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("saetze");
  r.onsuccess = () => { const tx = r.result.transaction("saetze", "readwrite"), st = tx.objectStore("saetze");
    [1, 2, 3].forEach(i => st.put([{ s: `A *big${i}* dog.`, u: "Ein großer Hund." }, { s: `So *big${i}*!`, u: "So groß!" }], `liste_1700000000002__${i}`));
    tx.oncomplete = () => { r.result.close(); res(); }; };
}));
await page.reload(); await sleep(900);

// ── 202: Kachel kurz, Info ausführlich ──
await zuListen(page);
const inhalt = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-liste-id]")].map(e => [e.dataset.listeId, e.querySelector("[data-listen-inhalt]")?.textContent.trim()])));
ok(inhalt.liste_1700000000002 === "· 💬 6 · ≈ 6" && inhalt.liste_1700000000001 === "", `202: Kachel „💬 6 · ≈ 6“, ohne Inhalt nichts (${JSON.stringify(inhalt)})`);

// ── 203: Knopf „Spalten“ (Listen) ──
const zeile = await page.evaluate(() => [...document.querySelectorAll('[data-einst-unter]')].map(b => b.dataset.einstUnter).join("|"));
ok(/sicherung\|erinnerung\|spalten/.test(zeile), `203: Knopfzeile Sicherung · Erinnerung · Spalten (${zeile})`);
await page.evaluate(() => document.querySelector('[data-einst-unter="spalten"]')?.click()); await sleep(300);
await page.evaluate(() => document.querySelector('[data-listen-spalten-wahl="3"]')?.click()); await sleep(400);
const anz = await page.evaluate(() => document.querySelector(".listen-raster")?.dataset.rasterSpaltenAnz);
ok(anz === "3", `203: mindestens 3 Spalten in „Alle Listen“ (${anz})`);

// ── 208: Anordnen nach Name (Unit 2 vor Unit 10, spaltenweise) ──
await kontext("[data-alle-listen]");
ok((await menue()).includes("⇅ Anordnen…"), "208: „⇅ Anordnen…“ im Menü von „Alle Listen“");
await aktion("Anordnen");
await page.evaluate(() => document.querySelector('[data-anordnen="name"]')?.click()); await sleep(500);
let ix = await idx();
const pl = Object.fromEntries(ix.map(l => [l.name, `${l.platz.z}|${l.platz.s}`]));
ok(pl["Unit 2"] === "0|0" && pl["Unit 10"] === "0|1", `208: nach Name (natürlich), spaltenweise bei 3 Spalten (${JSON.stringify(pl)})`);

// ── 202: Info ausführlich (kurz halten wählt) ──
const r = await page.evaluate(() => { const b = document.querySelector('[data-liste-id="liste_1700000000002"]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await page.mouse.move(r.x, r.y); await page.mouse.down(); await sleep(400); await page.mouse.up(); await sleep(400);
await page.evaluate(() => { if (document.querySelector("[data-slot-info-zu]")) document.querySelector("[data-liste-info]")?.click(); }); await sleep(300);
const info = await page.evaluate(() => document.querySelector("[data-liste-info-inhalt]")?.textContent.trim());
ok(info === "💬 6 Beispielsätze≈ 6 Synonyme", `202: Info „6 Beispielsätze · 6 Synonyme“ (${info})`);

// ── 209: Knopfzeile der geöffneten Liste ──
await page.evaluate(() => document.querySelector("[data-liste-oeffnen]")?.click()); await sleep(500);
const knoepfe = await page.evaluate(() => [...document.querySelectorAll("[data-listen-zeile] .quiz-zeile-label")].map(e => e.textContent.trim()).join("|"));
ok(knoepfe === "Vokabeln|Beispielsätze|Spalten|Fremdsprache", `209: Vokabeln | Beispielsätze | Spalten | Fremdsprache (${knoepfe})`);

// ── 204: „Quiz starten“ in der Liste → am Ende zurück in die Liste ──
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Quiz starten")?.click()); await sleep(600);
let imQuiz = await quizUndZurueck();
let zurueck = await page.evaluate(() => ({ zeile: !!document.querySelector("[data-listen-zeile]"), name: document.body.innerText.includes("Unit 10") }));
ok(imQuiz && zurueck.zeile && zurueck.name, `204: „Quiz starten“ → nach „Zur Übersicht“ wieder in „Unit 10“ (${JSON.stringify(zurueck)})`);

// ── 204: „🔁 Fällige wiederholen“ an der Kachel → zurück ins Listen-Raster, Liste gewählt ──
await zuListen(page);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(300);
await zuListen(page);
await kontext('[data-liste-id="liste_1700000000001"]');
await aktion("Fällige wiederholen");
imQuiz = await quizUndZurueck();
zurueck = await page.evaluate(() => ({ raster: !!document.querySelector('[data-liste-id="liste_1700000000001"]'), gewaehlt: document.querySelector("[data-liste-oeffnen]")?.dataset.listeOeffnen }));
ok(imQuiz && zurueck.raster && zurueck.gewaehlt === "liste_1700000000001", `204: Fällige an der Kachel → Listen-Raster, „Unit 2“ gewählt (${JSON.stringify(zurueck)})`);

// ── 203/208: Sessions – „▥ Spalten“ und „⇅ Anordnen…“ im Menü von „Alle Sessions“ ──
await tab("Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await kontext("[data-alle-sessions]");
const sm = await menue();
ok(sm.some(m => /^▥ Spalten/.test(m)) && sm.includes("⇅ Anordnen…"), `203/208: Sessions-Menü mit Spalten und Anordnen (${sm.join(" | ")})`);
await aktion("Anordnen");
await page.evaluate(() => document.querySelector('[data-anordnen="luecken"]')?.click()); await sleep(500);
const sp = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.map(x => [x.name, `${x.platz.z}|${x.platz.s}`])));
ok(sp["Teil 10"] === "0|0" && sp["Teil 2"] === "1|0", `208: Lücken schließen (Teil 2 rückt von Zeile 3 auf Zeile 2) (${JSON.stringify(sp)})`);
await kontext("[data-alle-sessions]");
await aktion("Spalten");
await page.evaluate(() => document.querySelector('[data-spalten-wahl="2"]')?.click()); await sleep(400);
const sAnz = await page.evaluate(() => document.querySelector(".slot-raster")?.dataset.rasterSpaltenAnz);
ok(sAnz === "2", `203: Sessions mindestens 2 Spalten (${sAnz})`);

// ── 206: Statistik-Kopfzeile ohne „nach oben“ ──
await tab("Statistik");
ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "nach oben"))), "206: kein „nach oben“-Knopf in der Statistik");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
