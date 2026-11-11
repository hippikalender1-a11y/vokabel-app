import puppeteer from "puppeteer-core";

// Einstellungen: Listen (mit Sicherung), Lernen (Schwelle + Akzente), Raster, App (Aktualisieren, Farbschema, Info);
// anfangs alle zu, immer nur einer offen; Info über App, „‹ Info“ zurück
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
ok(koepfe === "listen,lernen,stimmen,raster,farben,app", `Kopfzeilen: Listen, Lernen, Stimmen, Raster, Farben, App (${koepfe})`);
ok(await offen() === "" && !(await page.$("[data-farbschema]")) && !(await page.$("[data-alles-sichern]")), "anfangs alle zugeklappt");

// Listen: Raster der Listen, „+ Neu“ und die Sicherung
await kopf("listen");
ok(await offen() === "listen" && await page.$("[data-liste-neu]") && await page.$('[data-einst-unter="sicherung"]') && await page.$('[data-einst-unter="erinnerung"]'), "Listen: Knopfzeile Sicherung · Erinnerung · ＋ Neu");
// Lernen: Gelernt-Schwelle und Akzente
await kopf("lernen");
ok(await offen() === "lernen" && await page.$('[data-einst-unter="akzente"]') && !(await page.$('[data-einst-unter="sicherung"]')), "Lernen mit Knopf „Akzente“; Listen zu (nur einer offen)");
// Raster: beide Raster-Einstellungen
await kopf("raster");
ok(await offen() === "raster" && await page.evaluate(() => [...document.querySelectorAll("[data-einst-unter]")].map(d => d.dataset.einstUnter).join("|")) === "sessions|listenraster", "Raster: Knöpfe Sessions und Listen");
// Farben: eigener Bereich mit Tabs
await kopf("farben");
ok(await offen() === "farben" && await page.$("[data-farb-tabs]") && !(await page.$("[data-farbschema]")), "Farben: Knopfzeile, nichts offen");
// App: Aktualisieren, Info (ohne Farbschemata)
await kopf("app");
ok(await offen() === "app" && !(await page.$("[data-farbschema]")) && await page.$("[data-info-oeffnen]") && await page.$('[data-einst-unter="version"]'), "App: Version, Info");
await kopf("app");
ok(await offen() === "", "erneut antippen: zugeklappt");

// Info: über App öffnen, „‹ Info“ führt zurück zu App
await kopf("app");
await page.click("[data-info-oeffnen]"); await sleep(300);
ok(await offen() === "info" && await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].some(b => b.textContent.trim() === "Anleitung")), "Info: Übersicht / Konzept / Anleitung");
ok(await page.evaluate(() => /Vokabel-Trainer/.test(document.body.innerText)), "Info zeigt die Übersicht");
await kopf("info");
ok(await offen() === "app" && await page.$("[data-info-oeffnen]"), "„‹ Info“: zurück zu App");

// geöffneter Bereich bleibt beim Tab-Wechsel offen
await kopf("lernen");
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
ok(await offen() === "lernen", "nach Tab-Wechsel: Lernen noch offen");
ok(await page.evaluate(() => [...document.querySelectorAll(".tab")].map(t => t.textContent).join(",")) === "Statistik,Quiz,Einstellungen", "Tabs: Statistik, Quiz, Einstellungen");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
