import puppeteer from "puppeteer-core";
import { quizEinstellungen, listenZu } from "./hilfen.mjs";

// Quiz-Tab: immer nur ein Bereich offen – ein anderer Knopf schließt den vorherigen
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
// welche Bereiche sind offen?
const offen = () => page.evaluate(() => [
  document.querySelector("[data-slot-kopf]")?.dataset.slotKopf === "offen" && "kopf",
  document.querySelector("[data-stufe]")?.classList.contains("offen") && "stufe",
  document.querySelector("[data-abfragemodus]")?.classList.contains("offen") && "modus",
  document.querySelector("[data-reihenfolge]")?.classList.contains("offen") && "reihenfolge",
  document.querySelector("[data-umfang]")?.classList.contains("offen") && "umfang",
  document.querySelector("[data-abfrageziel]")?.classList.contains("offen") && "ziel",
].filter(Boolean).join(","));
const tippe = async sel => { await page.evaluate(sel => document.querySelector(sel).click(), sel); await sleep(300); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, E1: { wert: "w" + i, falsch: [] }, D1: { wert: "d" + i, falsch: [] }, ...(i < 3 ? { fortschritt: { score: 8 } } : {}) }));
  localStorage.setItem("vokabel_liste_l", JSON.stringify({ id:"l", name:"Englisch 6", sprache:"en", spalten: sp, naechste_id: 13, vokabeln: w }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l", name:"Englisch 6", sprache:"en" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", gelerntSchwelle:6, sprache:"alle" }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300); await quizEinstellungen(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(t => t.textContent.includes("Englisch")).click()); await sleep(300);
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
// Listen-Auswahl zu (falls offen)
await page.evaluate(() => window.scrollTo(0, 0));

const da = sel => page.evaluate(sel => !!document.querySelector(sel), sel);
const fokus = () => page.evaluate(() => document.querySelector("[data-quiz-fokus]")?.dataset.quizFokus);
await tippe("[data-umfang]");
ok(await offen() === "umfang", `Umfang offen (${await offen()})`);
ok(await fokus() === "zeile2" && !(await da("[data-reihenfolge]")) && !(await da("[data-start-knopf]")) ,
  "Fokus: nur Zeile 2 + Umfang, Zeile 1 und Start ausgeblendet");
await tippe("[data-abfrageziel]");
ok(await offen() === "ziel", `Abfrage-Ziel (gleiche Zeile) wechselt von Umfang (${await offen()})`);
await tippe("[data-abfrageziel]");
ok(await offen() === "" && await da("[data-reihenfolge]") && await da("[data-start-knopf]"), "Abfrage-Ziel nochmal: zu, alles wieder sichtbar");
await tippe("[data-reihenfolge]");
ok(await offen() === "reihenfolge" && await fokus() === "zeile1" && !(await da("[data-umfang]")), `Reihenfolge offen, Zeile 2 ausgeblendet (${await offen()})`);
await tippe("[data-abfragemodus]");
ok(await offen() === "modus", `Modus (gleiche Zeile) wechselt von Reihenfolge (${await offen()})`);
await tippe("[data-abfragemodus]");
await tippe("[data-slot-kopf-name]");
ok(await offen() === "kopf" && !(await page.$("[data-reihenfolge]")), `Kopfzeile öffnen: nur die Auswahl, Einstellungen ausgeblendet (${await offen()})`);
await tippe("[data-slot-kopf-name]");
await tippe("[data-reihenfolge]");
ok(await offen() === "reihenfolge", `Kopf zu, Reihenfolge auf (${await offen()})`);
await tippe("[data-stufe]");
ok(await offen() === "stufe", `Stufe antippen: Reihenfolge zu, Stufe auf (${await offen()})`);
await tippe("[data-stufe]");
ok(await offen() === "", `Stufe nochmal antippen („Bestätigen“): zu (${await offen()})`);
const titel = () => page.evaluate(() => document.querySelector("[data-start-titel]")?.textContent.trim());
const startRest = () => page.evaluate(() => document.querySelector("[data-start-knopf]")?.dataset.startAnzahl);
ok(/ mit 9 Vokabeln$/.test(await titel()) && await startRest() === "9", `Überschrift „… mit 9 Vokabeln“, Start 9 (3 gelernte ausgeblendet) (${await titel()})`);
await tippe("[data-abfrageziel]");
await tippe("[data-gelernte]");
ok(/ mit 12 Vokabeln$/.test(await titel()) && await startRest() === "12", `Gelernte eingeschaltet: zählen trotz Score-Grenze „Schlechteste“ mit (${await titel()}, Start ${await startRest()})`);
ok(await offen() === "", `Gelernte antippen schließt den offenen Bereich (${await offen()})`);
await tippe("[data-reihenfolge]");
await tippe("[data-reihenfolge]");
ok(await offen() === "", "nochmal antippen schließt den eigenen Bereich");

// ohne offenen Bereich: nur Kopf, Tabs und Session-Leiste bleiben stehen, der Rest scrollt
await page.setViewport({ width: 375, height: 500 }); await sleep(300);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
const lage = () => page.evaluate(() => ({ kopf: Math.round(document.querySelector("[data-slot-kopf]").getBoundingClientRect().top),
  listen: Math.round(document.querySelector(".liste-detail-header").getBoundingClientRect().top), zeile1: Math.round(document.querySelector("[data-reihenfolge]").getBoundingClientRect().top) }));
const v = await lage();
await page.evaluate(() => window.scrollTo(0, 150)); await sleep(300);
const n = await lage();
ok(n.kopf === v.kopf && n.listen === v.listen - 150 && n.zeile1 === v.zeile1 - 150, `Session-Leiste bleibt, Listen-Zeile und Zeile 1 scrollen mit (${JSON.stringify(v)} → ${JSON.stringify(n)})`);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
await tippe("[data-reihenfolge]");
await page.evaluate(() => window.scrollTo(0, 150)); await sleep(300);
const z1 = await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]").getBoundingClientRect(); const z = document.querySelector("[data-reihenfolge]").getBoundingClientRect(); return Math.round(z.top - k.bottom); });
ok(Math.abs(z1) <= 12, `offener Bereich: seine Zeile klebt unter der Session-Leiste (Abstand ${z1})`);
await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
