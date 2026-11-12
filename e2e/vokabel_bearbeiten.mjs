import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { slotLaden } from "./hilfen.mjs";
import { zuListen, listeBereich } from "./hilfen.mjs";

// Vokabeln in der App bearbeiten: Abfrage – Lang-Druck auf die Karte → nur die richtige Antwort (falsche bleiben);
// Statistik – Lang-Druck auf eine Zeile → Bearbeiten (alle Spalten) oder neue Vokabel in dieser Liste;
// Lernstände (auch Diktat/Akzente) bleiben beim Bearbeiten erhalten
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n)).click(), name); await sleep(400); };
const langDruck = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(250);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion).join("|"));
const aktion = async p => { await page.evaluate(p => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion.startsWith(p)).click(), p); await sleep(300); };
const feld = (typ, wert) => page.evaluate((typ, wert) => { const i = document.querySelector(`[data-vokabel-feld="${typ}"]`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, wert); i.dispatchEvent(new Event("input", { bubbles: true })); }, typ, wert);
const vok = id => page.evaluate(id => JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.find(v => v.id === id), id);
const ladeSlot = async (name, modus) => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
  await page.evaluate(n => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes(n)).click(), name); await sleep(700); await slotLaden(page);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 3, vokabeln: [
    { id: 1, E1: { wert: "aller", falsch: ["allé"] }, D1: { wert: "gehen", falsch: [] }, fortschritt: { score: 2, streak: 0 }, diktatFortschritt: { score: 3 }, akzentFortschritt: { score: 1 } },
    { id: 2, E1: { wert: "venir", falsch: [] }, D1: { wert: "kommen", falsch: [] } } ] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
  const k = modus => ({ listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:modus}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_k", name:"Karte", timestamp:1, konfiguration:k("karte"), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"g_t", name:"Tippen", timestamp:2, konfiguration:k("tippen"), sessionFortschritt:null, platz:{z:0,s:1} } ] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus:"schwer", gelerntSchwelle:6, sprache:"alle" }));
});
await page.reload(); await sleep(500);

// ── Abfrage (Karte): Lang-Druck → nur richtige Antwort ──
await tab("Quiz");
await ladeSlot("Karte");
await page.click("[data-start-knopf]"); await sleep(500);
ok(await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim()) === "gehen", "Abfrage: Frage „gehen“");
await langDruck("[data-karte-antwort]");
ok(await menue() === "✎ Richtige Antwort bearbeiten|🚫 Nicht mehr abfragen", `Lang-Druck auf die Karte: „✎ Richtige Antwort bearbeiten“, „🚫 Nicht mehr abfragen“ (${await menue()})`);
await aktion("✎ Richtige Antwort bearbeiten");
const ed = await page.evaluate(() => ({ art: document.querySelector("[data-vokabel-editor]")?.dataset.vokabelEditor,
  felder: [...document.querySelectorAll("[data-vokabel-feld]")].map(i => `${i.dataset.vokabelFeld}=${i.value}`).join(","), text: document.querySelector("[data-vokabel-editor]")?.textContent }));
console.log("     Dialog:", JSON.stringify(ed));
ok(ed.art === "antwort" && ed.felder === "E1=aller" && /Deutsch: gehen/.test(ed.text) && !/falsche Antworten/.test(ed.text), "Dialog: nur Französisch „aller“ (ohne falsche Antworten), Deutsch zur Orientierung");
await feld("E1", "aller (irr.)");
await page.click("[data-vokabel-speichern]"); await sleep(300);
let v = await vok(1);
ok(v.E1.wert === "aller (irr.)" && v.E1.falsch.join() === "allé" && v.fortschritt.score === 2 && v.diktatFortschritt.score === 3, "gespeichert: neue Antwort, falsche Antworten und Lernstand unverändert");
ok(!(await page.$("[data-vokabel-editor]")) && await page.$(".quiz-frage-text"), "Dialog zu, Abfrage läuft weiter");
await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(300);
ok(/aller \(irr\.\)/.test(await page.evaluate(() => document.querySelector("[data-karte-antwort]")?.textContent || "")), "aufgedeckte Karte zeigt die neue Antwort");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(400);

// ── Abfrage (Tippen): geänderte Antwort gilt sofort ──
await ladeSlot("Tippen");
await page.click("[data-start-knopf]"); await sleep(500);
await langDruck("[data-karte-antwort]"); await aktion("✎ Richtige Antwort bearbeiten");
await feld("E1", "aller");
await page.keyboard.press("Enter"); await sleep(300);
ok((await vok(1)).E1.wert === "aller" && !(await page.$("[data-vokabel-editor]")), "Enter im Dialog speichert (auch über der Frage-Karte)");
await page.type(".quiz-antwort-box input.inp, .quiz-aktionen input.inp", "aller"); await page.keyboard.press("Enter"); await sleep(400);
ok(await page.evaluate(() => /richtig|gelernt-blitz/.test(document.querySelector(".quiz-antwort-box")?.className || "")), "die geänderte Antwort wird sofort als richtig erkannt (ggf. gleich gelernt)");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(400);

// ── Statistik: Bearbeiten (alle Spalten) und neue Vokabel ──
await tab("Statistik");
if (await page.evaluate(() => document.querySelector("[data-statistik-liste-kopf]")?.dataset.statistikListeKopf === "zu")) { await page.click("[data-statistik-liste-kopf]"); await sleep(300); }
await langDruck('[data-statistik-vok="l_fr__1"]');
ok(await menue() === "✎ Bearbeiten|➕ Neue Vokabel in „Verbes“", `Statistik: Lang-Druck → Bearbeiten / Neue Vokabel (${await menue()})`);
await aktion("✎ Bearbeiten");
const ed2 = await page.evaluate(() => [...document.querySelectorAll("[data-vokabel-feld]")].map(i => `${i.dataset.vokabelFeld}=${i.value}`).join(","));
ok(ed2 === "E1=aller || allé,D1=gehen", `Statistik: Dialog mit allen Spalten inkl. falscher Antworten (${ed2})`);
await feld("D1", "gehen, fahren");
await page.click("[data-vokabel-speichern]"); await sleep(300);
v = await vok(1);
ok(v.D1.wert === "gehen, fahren" && v.E1.falsch.join() === "allé" && v.diktatFortschritt?.score === 3 && v.akzentFortschritt?.score === 1, "gespeichert; Diktat- und Akzent-Lernstand bleiben erhalten");
ok(/gehen, fahren/.test(await page.evaluate(() => document.querySelector('[data-statistik-vok="l_fr__1"]').textContent)), "Statistik-Zeile zeigt die Änderung");

await langDruck('[data-statistik-vok="l_fr__2"]'); await aktion("➕ Neue Vokabel");
ok(await page.evaluate(() => document.querySelector("[data-vokabel-editor]")?.dataset.vokabelEditor) === "neu", "Dialog „Neue Vokabel“");
await feld("E1", "partir");
await page.click("[data-vokabel-speichern]"); await sleep(300);
ok(await page.evaluate(() => /Mindestens zwei Spalten/.test(document.querySelector("[data-vokabel-editor]")?.textContent || "")), "nur eine Spalte: Hinweis, nichts angelegt");
await feld("D1", "weggehen");
await page.click("[data-vokabel-speichern]"); await sleep(300);
const liste = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_fr")));
ok(liste.vokabeln.length === 3 && liste.vokabeln[2].id === 3 && liste.vokabeln[2].E1.wert === "partir" && liste.naechste_id === 4, "neue Vokabel „partir – weggehen“ am Ende der Liste (Nr. 3)");
ok(await page.$('[data-statistik-vok="l_fr__3"]'), "Statistik zeigt die neue Vokabel");

// ── Listen: Bearbeiten erhält den Lernstand ──
await zuListen(page);
await page.evaluate(() => [...document.querySelectorAll(".karte-zeile")].find(z => z.textContent.includes("Verbes")).click()); await sleep(400); await listeOeffnen(page);
await listeBereich(page, "vokabeln");
await page.evaluate(() => document.querySelector('button[title="Vokabel bearbeiten"], .btn-icon[title="Bearbeiten"]').click()); await sleep(300);
ok(await page.evaluate(() => document.querySelector("[data-vokabel-editor]")?.dataset.vokabelEditor) === "voll", "Listen: Bearbeiten-Dialog wie bisher");
await feld("D1", "gehen");
await page.click("[data-vokabel-speichern]"); await sleep(300);
v = await vok(1);
ok(v.D1.wert === "gehen" && v.diktatFortschritt?.score === 3 && v.akzentFortschritt?.score === 1 && v.fortschritt?.score === 3, "Listen: gespeichert, alle Lernstände bleiben (Score 3 nach der Tippen-Runde)");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
