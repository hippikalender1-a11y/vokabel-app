import puppeteer from "puppeteer-core";

// Einstellungen: jeder Bereich hinter einer Kopfzeile, anfangs alle zu; antippen klappt auf, immer nur einer offen;
// erneut antippen klappt zu; Info mit Übersicht/Konzept/Anleitung
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
const offen = () => page.evaluate(() => [...document.querySelectorAll('[data-einst-kopf][data-offen="ja"]')].map(b => b.dataset.einstKopf).join(","));
const kopf = async key => { await page.click(`[data-einst-kopf="${key}"]`); await sleep(300); };

await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);

const koepfe = await page.evaluate(() => [...document.querySelectorAll("[data-einst-kopf]")].map(b => b.dataset.einstKopf).join(","));
ok(koepfe === "info,lernen,akzente,farben,konfig,listen,app,daten", `Kopfzeilen: Info, Lernen, Akzente, Farbschema, Konfigurationen, Listen, App, Daten (${koepfe})`);
ok(await offen() === "" && !(await page.$("[data-farbschema]")) && !(await page.$("[data-alles-sichern]")), "anfangs alle zugeklappt");

await kopf("farben");
ok(await offen() === "farben" && await page.$("[data-farbschema]"), "Farbschema aufgeklappt");
await kopf("daten");
ok(await offen() === "daten" && await page.$("[data-alles-sichern]") && !(await page.$("[data-farbschema]")), "Daten & Sicherung auf → Farbschema zu (nur einer offen)");
await kopf("daten");
ok(await offen() === "" && !(await page.$("[data-alles-sichern]")), "erneut antippen: zugeklappt");

// Info: Kopfleiste mit Übersicht / Konzept / Anleitung
await kopf("lernen");
await kopf("info");
ok(await offen() === "info" && await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].some(b => b.textContent.trim() === "Anleitung")), "Info auf: Übersicht / Konzept / Anleitung; Lernen zu");
ok(await page.evaluate(() => /Vokabel-Trainer/.test(document.body.innerText) && !document.querySelector('[data-einst-kopf="lernen"][data-offen="ja"]')), "Info zeigt die Übersicht");
await kopf("akzente");
ok(await offen() === "akzente" && !(await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].some(b => b.textContent.trim() === "Anleitung"))), "Akzente auf → Info zu");

// geöffneter Bereich bleibt beim Tab-Wechsel offen
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Listen")).click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
ok(await offen() === "akzente", "nach Tab-Wechsel: Akzente noch offen");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
