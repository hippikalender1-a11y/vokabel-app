import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu } from "./hilfen.mjs";

// Zeilen-Knöpfe im Quiz-Tab: aufgeklappt „✓ Bestätigen“ in eigener Farbe, gleiche Größe und Position, übrige Knöpfe der Zeile bleiben;
// Stufe aufklappbar; lang drücken auf „Start“: Speichern-Menü wie beim Quiz-Namen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const text = sel => page.evaluate(s => document.querySelector(s)?.innerText.replace(/\s+/g, " ").trim(), sel);
const farbe = sel => page.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
const sichtbar = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
const haken = sel => page.evaluate(s => getComputedStyle(document.querySelector(s), "::before").content, sel);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, E1: { wert: `mot${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 7, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
await listenZu(page);

const zu = await farbe("[data-reihenfolge]");
await page.click("[data-reihenfolge]"); await sleep(300);
const bestFarbe = await farbe("[data-reihenfolge]");
ok(await text("[data-reihenfolge]") === "Bestätigen" && bestFarbe !== zu && /✓/.test(await haken("[data-reihenfolge]")),
  `Reihenfolge offen: nur „✓ Bestätigen“ in eigener Farbe (${await text("[data-reihenfolge]")}, ${zu} → ${bestFarbe})`);
ok(await sichtbar("[data-stufe]") && await sichtbar("[data-abfragemodus]") && await sichtbar("[data-reihenfolge]"), "übrige Knöpfe der Zeile bleiben sichtbar");
ok(!(await sichtbar("[data-umfang]")) && !(await sichtbar("[data-start-knopf]")), "Zeilen darunter ausgeblendet");
await page.click("[data-reihenfolge]"); await sleep(1300);   // nach dem kurzen Aufleuchten
ok(await text("[data-reihenfolge]") === "Schlechteste zuerst" && await farbe("[data-reihenfolge]") === zu && await sichtbar("[data-stufe]") && await sichtbar("[data-abfragemodus]"),
  "„Bestätigen“ klappt zu: wieder der volle Text, alte Farbe, alle Knöpfe da");
await page.click("[data-umfang]"); await sleep(300);
ok(await text("[data-umfang]") === "Bestätigen" && await farbe("[data-umfang]") === bestFarbe && await sichtbar("[data-abfrageziel]") && await sichtbar("[data-stufe]"), `Umfang offen: „Bestätigen“, Abfrage-Ziel und Zeile darüber bleiben (${await text("[data-umfang]")})`);
await page.click("[data-umfang]"); await sleep(300);
await page.click("[data-abfrageziel]"); await sleep(300);
ok(await text("[data-abfrageziel]") === "Bestätigen" && await sichtbar("[data-umfang]"), `Abfrage-Ziel offen: „Bestätigen“ (${await text("[data-abfrageziel]")})`);
await page.click("[data-abfrageziel]"); await sleep(300);
await page.click("[data-stufe]"); await sleep(300);
ok(await text("[data-stufe]") === "Bestätigen" && await page.$("[data-stufe-auswahl]"), "Stufe offen: „Bestätigen“ mit Auswahl darunter");
await page.click('[data-stufe-wahl="schwer"]'); await sleep(200);
ok(await page.$("[data-stufe-auswahl]"), "die schon gewählte Stufe antippen: bleibt offen (Regeln, Vorlesen erreichbar)");
await page.click('[data-stufe-wahl="einfach"]'); await sleep(300);
ok(await text("[data-stufe]") === "Leicht" && !(await page.$("[data-stufe-auswahl]")), "andere Stufe antippen: übernommen und zu");
ok(await page.evaluate(() => document.querySelector("[data-stufe]").classList.contains("leuchten")) && await farbe("[data-stufe]") === bestFarbe,
  `zugeklappt: Knopf sofort voll in der Bestätigen-Farbe (${await farbe("[data-stufe]")})`);
ok(await page.evaluate(() => getComputedStyle(document.querySelector("[data-stufe]")).animationName === "none" && getComputedStyle(document.querySelector("[data-stufe]")).transitionDuration === "0s"),
  "ohne Überblendung (keine Animation, kein Übergang)");
await sleep(900);
ok(!(await page.evaluate(() => document.querySelector("[data-stufe]").classList.contains("leuchten"))) && await farbe("[data-stufe]") === zu, "danach wieder die normale Farbe");
// Reihenfolge: Wahl antippen schließt
await page.click("[data-reihenfolge]"); await sleep(300);
await page.click('[data-reihenfolge-wahl="zufall"]'); await sleep(450);
ok(await text("[data-reihenfolge]") === "Zufällig" && !(await page.$('[data-reihenfolge-wahl]')), `Reihenfolge „Zufällig“ antippen: übernommen und zu (${await text("[data-reihenfolge]")})`);
// 139: aufgeklappt ist die aktuelle Wahl grün; neue Wahl bleibt 0,3 s sichtbar, dann zu
await page.click("[data-reihenfolge]"); await sleep(300);
const gruen = await page.evaluate(() => { const b = document.querySelector('[data-reihenfolge-wahl="zufall"]'); const d = document.createElement("div"); d.style.background = getComputedStyle(document.documentElement).getPropertyValue("--bestaetigen"); document.body.appendChild(d); const g = getComputedStyle(d).backgroundColor; d.remove(); return getComputedStyle(b).backgroundColor === g; });
ok(gruen, "139: aktuelle Wahl in der Auswahl-Farbe");
await page.evaluate(() => document.querySelector('[data-reihenfolge-wahl="listennr"]').click()); await new Promise(r => setTimeout(r, 120));
ok(await page.$('[data-reihenfolge-wahl="listennr"].aktiv'), "139: neue Wahl kurz sichtbar (noch offen)");
await new Promise(r => setTimeout(r, 400));
ok(!(await page.$("[data-reihenfolge-wahl]")) && await text("[data-reihenfolge]") === "Listenplatz", `… dann zu, Knopf „Listenplatz“ (${await text("[data-reihenfolge]")})`);
// Beschriftungen über den Knöpfen, gleich hohe Knöpfe
const labels = await page.evaluate(() => [...document.querySelectorAll(".quiz-zeile-label")].map(l => l.textContent).join("|"));
ok(/^Lern-Modus\|\w+ – \w+\|Reihenfolge\|Anzahl je Runde\|Wie oft/.test(labels), `Beschriftungen, über „Art der Antwort“ die Sprachen Frage – Antwort (${labels})`);
const hoehe = s => page.evaluate(s => Math.round(document.querySelector(s).getBoundingClientRect().height), s);
const zu1 = [await hoehe("[data-stufe]"), await hoehe("[data-abfragemodus]"), await hoehe("[data-reihenfolge]"), await hoehe("[data-umfang]")];
await page.click("[data-reihenfolge]"); await sleep(300);
const offen1 = await hoehe("[data-reihenfolge]");
ok(zu1.every(h => h === zu1[0]) && offen1 === zu1[0], `alle Knöpfe gleich hoch, Bestätigen auch (${zu1} / ${offen1})`);
await page.click("[data-reihenfolge]"); await sleep(300);
ok(!(await page.$("[data-start-fortschritt]")), "163: keine großen Kreise mehr im Quiz-Tab");

// Start: lang drücken → Speichern
await page.evaluate(() => { const el = document.querySelector("[data-start-knopf]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 10 })); }); await sleep(300);
ok(await page.$('[data-info-aktion="💾 Speichern"]'), "lang drücken auf „Start“: „💾 Speichern“");
await page.click('[data-info-aktion="💾 Speichern"]'); await sleep(300);
ok(await page.$("[data-slot-name-feld]"), "öffnet das Speichern-Fenster");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
