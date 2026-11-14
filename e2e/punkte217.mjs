import puppeteer from "puppeteer-core";
import { zuListen, kurzHalten } from "./hilfen.mjs";

// 217: Liste als Quiz (Kopf zeigt die Liste, kein Speichern, Fortschritt/Einstellungen je Liste, kein Verlauf),
// Quiz-Auswahl mit Umschalter „Quiz | Listen“, „Quiz erstellen“ aus der Liste (Bereich, Name, Ordner), Begriff „Quiz“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kopf = () => page.evaluate(() => { const b = document.querySelector("[data-slot-kopf-name]");
  return { zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, art: b?.dataset.kopfArt, text: b?.textContent.trim(), ungespeichert: !!document.querySelector("[data-nicht-gespeichert]") }; });
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const oeffneListe = async id => { await zuListen(page); await page.evaluate(() => { if (document.querySelector("[data-ordner-zurueck]")) document.querySelector("[data-ordner-zurueck]").click(); }); await sleep(200);
  await page.evaluate(i => document.querySelector(`[data-liste-id="${i}"]`)?.click(), id); await sleep(500); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 7, vokabeln: [1, 2, 3, 4, 5, 6].map(i => ({ id: i, E1: { wert: name.replace(" ", "") + "w" + i, falsch: [] }, D1: { wert: "W" + i, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unit 1")));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unit 2")));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf: [], ordner: [{ id: "o1", name: "Englisch", platz: { z: 0, s: 0 } }], gespeichert: [] }));
});
await page.reload(); await sleep(900);

// ── Liste › „Quiz starten“: Kopf zeigt die Liste, ohne „nicht gespeichert“, ohne Listenauswahl ──
await oeffneListe("l_a");
ok(await page.$("[data-liste-quiz-starten]") && await page.$("[data-liste-quiz-erstellen]"), "Liste: „Quiz starten“ und „Quiz erstellen“");
await page.evaluate(() => document.querySelector("[data-liste-quiz-starten]").click()); await sleep(700);
let k = await kopf();
ok(k.art === "liste" && /Unit 1/.test(k.text) && !k.ungespeichert && k.zustand !== "offen", `Kopf: Liste „Unit 1“, nicht „nicht gespeichert“ (${JSON.stringify(k)})`);
ok(!(await page.$("[data-listen-kopf]")), "keine Listenauswahl bei einer Liste als Quiz");

// eine Runde: Einstellungen und Fortschritt merkt sich die Liste, kein Verlauf
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(250);
await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => b.textContent.includes("Gewusst"))?.click()); await sleep(1200);
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(600);
let d = await slots();
const le = (d.listen || []).find(x => x.id === "l_a");
ok(le?.konfiguration?.listenIds?.[0] === "l_a" && (d.verlauf || []).length === 0, `Liste merkt sich die Einstellungen, kein Verlauf-Eintrag (${JSON.stringify({ konfig: !!le?.konfiguration, verlauf: d.verlauf.length })})`);

// ── Quiz-Tab: Kopf antippen → Listen-Auswahl (Umschalter „Quiz | Listen“) ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(400);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
const um = await page.evaluate(() => ({ listen: document.querySelector('[data-auswahl-umschalter="listen"]')?.classList.contains("aktiv"), raster: !!document.querySelector("[data-quiz-listen-raster]"),
  kacheln: [...document.querySelectorAll("[data-qliste-id]")].map(e => e.dataset.qlisteId).join(",") }));
ok(um.listen && um.raster && um.kacheln === "l_a,l_b", `Listen-Kopf → Listen-Auswahl mit Umschalter (${JSON.stringify(um)})`);
await page.evaluate(() => document.querySelector('[data-auswahl-umschalter]').click()); await sleep(300);   // 222: ein Knopf, wechselt
ok(await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]")?.dataset.auswahlUmschalter) === "quiz", "222: der Knopf zeigt jetzt „Quiz“");
ok(await page.$("[data-alle-sessions]") && !(await page.$("[data-quiz-listen-raster]")), "Umschalter „Quiz“ zeigt die gespeicherten Quiz");
ok((await page.evaluate(() => document.querySelector("[data-alle-sessions]")?.textContent.trim())) === "Alle Quiz", "Begriff: „Alle Quiz“ statt „Alle Sessions“");
await page.evaluate(() => document.querySelector('[data-auswahl-umschalter]').click()); await sleep(300);
// kurz halten wählt nur, antippen übernimmt
await kurzHalten(page, '[data-qliste-id="l_b"]');
k = await kopf();
ok(k.zustand === "offen" && /📋 Unit 2 laden/.test(k.text), `kurz halten: „📋 Unit 2 laden“ (${k.text})`);
await page.evaluate(() => document.querySelector("[data-slot-laden]").click()); await sleep(600);
k = await kopf();
ok(k.zustand !== "offen" && k.art === "liste" && /Unit 2/.test(k.text), `grüner Kopf lädt „Unit 2“ als Liste (${JSON.stringify(k)})`);

// ── „Quiz erstellen“: Bereich wählen, Name und Ordner ──
await oeffneListe("l_a");
await page.evaluate(() => document.querySelector("[data-liste-quiz-erstellen]").click()); await sleep(700);
k = await kopf();
ok(k.art === "erstellen" && /Quiz erstellen/.test(k.text) && !(await page.$("[data-listen-kopf]")), `Kopf „＋ Quiz erstellen“, keine Listenauswahl (${JSON.stringify(k)})`);
await page.evaluate(() => [...document.querySelectorAll(".vok-zeile")].slice(0, 2).forEach(e => e.click())); await sleep(400);   // Nr. 1–2
await page.evaluate(() => { const b = document.querySelector("[data-vok-bestaetigen]"); b?.click(); }); await sleep(400);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k?.dataset.slotKopf === "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").click()); await sleep(400);
const fenster = await page.evaluate(() => ({ da: !!document.querySelector("[data-erstellen-dialog]"), name: document.querySelector("[data-erstellen-name]")?.value,
  ordner: [...document.querySelectorAll("[data-erstellen-ordner-wahl]")].map(b => b.textContent.trim()) }));
ok(fenster.da && fenster.name === "Unit 1 · Nr. 1–2" && fenster.ordner.includes("📁 Englisch"), `Fenster „Quiz erstellen“: Name vorbelegt, Ordner wählbar (${JSON.stringify(fenster)})`);
await page.evaluate(() => document.querySelector('[data-erstellen-ordner-wahl="o1"]').click()); await sleep(200);
await page.evaluate(() => document.querySelector("[data-erstellen-ok]").click()); await sleep(600);
d = await slots();
const neu = d.gespeichert.find(x => /^Unit 1/.test(x.name));
ok(neu && neu.ordner === "o1" && neu.konfiguration?.vokabelAuswahl?.length === 2, `Quiz angelegt im Ordner „Englisch“ (${JSON.stringify(neu && { name: neu.name, ordner: neu.ordner, n: neu.konfiguration?.vokabelAuswahl?.length })})`);
k = await kopf();
ok(k.art === "quiz" && /^Unit 1/.test(k.text), `danach geladen (${k.text})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
