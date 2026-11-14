import puppeteer from "puppeteer-core";
import { neueListe } from "./hilfen.mjs";
import { listeOeffnen } from "./hilfen.mjs";
import { zuListen } from "./hilfen.mjs";

// Listen unter Einstellungen › Listen: Liste öffnet bildschirmfüllend (Tab „Einstellungen“ bleibt markiert),
// Pfeil zurück; „+ Neu“ → Import mit Pfeil zurück; leere App: Hinweis „Liste importieren“ in des Quiz-Auswahl
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
const aktiverTab = () => page.evaluate(() => document.querySelector(".tab.aktiv")?.textContent);
const offen = () => page.evaluate(() => [...document.querySelectorAll('[data-einst-kopf][data-offen="ja"]')].map(b => b.dataset.einstKopf).join(","));

// leere App
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(500);
ok(await aktiverTab() === "Quiz" && await page.$("[data-keine-listen]"), "leere App: Quiz-Tab mit Hinweis „Noch keine Listen“");
await page.click("[data-liste-importieren]"); await sleep(400);
ok(await aktiverTab() === "Einstellungen" && /Importieren/.test(await page.evaluate(() => document.body.innerText)), "„Liste importieren“ öffnet den Import (Tab Einstellungen)");
await page.click("[data-zurueck-listen]"); await sleep(400);
ok(await offen() === "listen" && await page.$("[data-alle-listen]"), "Pfeil zurück: Einstellungen › Listen");

// mit Listen
await page.evaluate(() => {
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 2, vokabeln: [{ id: 1, E1: { wert: "mot", falsch: [] }, D1: { wert: "Wort", falsch: [] } }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(500);
ok(!(await page.$("[data-keine-listen]")), "mit Listen: kein Hinweis");
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(400); await listeOeffnen(page);
ok(await aktiverTab() === "Einstellungen" && await page.$("[data-zurueck-listen]") && /Unité 1/.test(await page.evaluate(() => document.querySelector(".liste-detail-header")?.textContent)),
  "Liste antippen: Liste bildschirmfüllend, Tab Einstellungen bleibt markiert");
await page.click("[data-zurueck-listen]"); await sleep(400);
ok(await offen() === "listen" && await page.$('[data-liste-id="l_a"]'), "Pfeil zurück: wieder Einstellungen › Listen");
await neueListe(page); await sleep(100);
ok(/Importieren/.test(await page.evaluate(() => document.querySelector(".liste-detail-header")?.textContent)) && await page.$("[data-zurueck-listen]"), "„+ Neu“: Import mit Pfeil zurück");
await page.click("[data-zurueck-listen]"); await sleep(400);
ok(await offen() === "listen", "zurück aus dem Import");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
