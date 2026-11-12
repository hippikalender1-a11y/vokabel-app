import puppeteer from "puppeteer-core";
import { slotLaden } from "./hilfen.mjs";

// Abfrage: per Lang-Druck alles einzeln bearbeitbar – Frage, richtige Antwort, Info, schon beantwortete Spalten,
// eigene falsche MC-Antworten (falsche aus anderen Vokabeln nicht); jeweils nur das eine Feld
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
const langDruck = async (sel, x = 10) => {
  await page.evaluate((sel, x) => { const el = typeof sel === "string" ? document.querySelector(sel) : null; const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + x, clientY: r.y + 10 })); }, sel, x);
  await sleep(250);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion).join("|"));
const aktion = async p => { await page.evaluate(p => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion.startsWith(p)).click(), p); await sleep(300); };
const schliesseMenue = async () => { await page.mouse.click(5, 880); await sleep(200); };
const feld = (typ, wert) => page.evaluate((typ, wert) => { const i = document.querySelector(`[data-vokabel-feld="${typ}"]`);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(i), "value").set.call(i, wert); i.dispatchEvent(new Event("input", { bubbles: true })); }, typ, wert);
const editor = () => page.evaluate(() => ({ art: document.querySelector("[data-vokabel-editor]")?.dataset.vokabelEditor,
  titel: document.querySelector("[data-vokabel-editor] .modal-titel")?.textContent,
  felder: [...document.querySelectorAll("[data-vokabel-feld]")].map(i => `${i.dataset.vokabelFeld}=${i.value}`).join(",") }));
const speichern = async () => { await page.click("[data-vokabel-speichern]"); await sleep(300); };
const vok = id => page.evaluate(id => JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.find(v => v.id === id), id);
const ladeSlot = async name => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
  await page.evaluate(n => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes(n)).click(), name); await sleep(700); await slotLaden(page);
};
const beenden = async () => {
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(400);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Infinitif",E2:"Participe",D1:"Deutsch",i1:"Info"}[t] || "", aktiv: ["E1","E2","D1","i1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 4, vokabeln: [
    { id: 1, E1: { wert: "aller", falsch: ["allé", "allez"] }, E2: { wert: "allé", falsch: [] }, D1: { wert: "gehen", falsch: [] }, i1: { wert: "unregelmäßig", falsch: [] } },
    { id: 2, E1: { wert: "venir", falsch: [] }, E2: { wert: "venu", falsch: [] }, D1: { wert: "kommen", falsch: [] } },
    { id: 3, E1: { wert: "voir", falsch: [] }, E2: { wert: "vu", falsch: [] }, D1: { wert: "sehen", falsch: [] } } ] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
  const k = (antw, modi, info) => ({ listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1", ...antw], quizFrageTyp:"D1", quizAntwortTypenGeordnet:antw,
    quizInfoTypenSession:info, quizSpalteModus:modi, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_k", name:"Karte", timestamp:1, konfiguration:k(["E1","E2"], {E1:"karte",E2:"karte"}, ["i1"]), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"g_m", name:"Auswahl", timestamp:2, konfiguration:k(["E1"], {E1:"mc"}, []), sessionFortschritt:null, platz:{z:0,s:1} } ] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus:"schwer", gelerntSchwelle:6, sprache:"alle", karteInfoPin:true }));
});
await page.reload(); await sleep(500);
await tab("Quiz");

// ── Karte: Frage, Info, beantwortete Spalte ──
await ladeSlot("Karte");
await page.click("[data-start-knopf]"); await sleep(500);
await langDruck("[data-karte-frage]");
ok(await menue() === "✎ Frage bearbeiten", `Frage-Karte: „✎ Frage bearbeiten“ (${await menue()})`);
await aktion("✎ Frage bearbeiten");
let ed = await editor();
ok(ed.art === "frage" && ed.titel === "Frage bearbeiten" && ed.felder === "D1=gehen", `Dialog „Frage bearbeiten“ nur mit Deutsch (${JSON.stringify(ed)})`);
await feld("D1", "gehen, laufen"); await speichern();
ok((await vok(1)).D1.wert === "gehen, laufen" && await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text").textContent) === "gehen, laufen",
  "Frage gespeichert und sofort in der Abfrage sichtbar");

await langDruck("[data-karte-info]");
ok(await menue() === "✎ Info bearbeiten", `Info-Kasten: „✎ Info bearbeiten“ (${await menue()})`);
await aktion("✎ Info bearbeiten");
ed = await editor();
ok(ed.art === "info" && ed.felder === "i1=unregelmäßig" && await page.$("textarea[data-vokabel-feld]"), "Info: mehrzeiliges Feld mit dem Info-Text");
await feld("i1", "unregelmäßig\nwie aller"); await speichern();
ok((await vok(1)).i1.wert === "unregelmäßig\nwie aller" && /wie aller/.test(await page.evaluate(() => document.querySelector("[data-karte-info]").textContent)), "Info gespeichert und sichtbar");

await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-karte-weiter]").click()); await sleep(500);
ok(await page.$("[data-vorig]"), "zweite Spalte: erste Antwort steht als beantwortet darüber");
await langDruck("[data-vorig]");
ok(await menue() === "✎ Antwort bearbeiten", `beantwortete Spalte: „✎ Antwort bearbeiten“ (${await menue()})`);
await aktion("✎ Antwort bearbeiten");
ed = await editor();
ok(ed.art === "antwort" && ed.felder === "E1=aller", "Dialog mit der Antwort dieser Spalte (Infinitif)");
await feld("E1", "aller (irr.)"); await speichern();
ok((await vok(1)).E1.wert === "aller (irr.)" && /aller \(irr\.\)/.test(await page.evaluate(() => document.querySelector("[data-vorig]").textContent)), "gespeichert, die beantwortete Zeile zeigt den neuen Wert");
ok((await vok(1)).E1.falsch.join() === "allé,allez", "falsche Antworten unverändert");
await beenden();

// ── Auswahl (MC): eigene falsche Antwort bearbeiten, fremde nicht ──
await ladeSlot("Auswahl");
await page.click("[data-start-knopf]"); await sleep(500);
const knoepfe = await page.evaluate(() => [...document.querySelectorAll("[data-mc-knopf]")].map(b => b.textContent.trim()));
console.log("     MC:", knoepfe.join(" | "));
const idx = t => knoepfe.indexOf(t);
ok(idx("allé") >= 0 && idx("allez") >= 0, "MC zeigt die eigenen falschen Antworten");
await langDruck(`[data-mc-knopf]:nth-child(${idx("allez") + 1})`);
ok(await menue() === "✎ Falsche Antwort bearbeiten", `eigene falsche Antwort: „✎ Falsche Antwort bearbeiten“ (${await menue()})`);
await aktion("✎ Falsche Antwort bearbeiten");
ed = await editor();
ok(ed.art === "falsch" && ed.titel === "Falsche Antwort bearbeiten" && ed.felder === "E1=allez", "Dialog „Falsche Antwort bearbeiten“ mit „allez“");
await feld("E1", "allons"); await speichern();
const v1 = await vok(1);
ok(v1.E1.falsch.join() === "allé,allons" && v1.E1.wert === "aller (irr.)", "gespeichert: nur diese falsche Antwort geändert");
ok(await page.evaluate(() => [...document.querySelectorAll("[data-mc-knopf]")].some(b => b.textContent.trim() === "allons")), "MC-Knopf zeigt sofort „allons“");
const fremd = knoepfe.findIndex(t => !["aller (irr.)", "aller", "allé", "allez"].includes(t));
if (fremd >= 0) {
  await langDruck(`[data-mc-knopf]:nth-child(${fremd + 1})`);
  ok(await menue() === "" && /anderen Vokabel/.test(await page.evaluate(() => document.querySelector('[role="status"]')?.textContent || document.body.innerText)),
    "falsche Antwort aus einer anderen Vokabel: kein Bearbeiten, Hinweis");
  await schliesseMenue();
}
await beenden();

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
