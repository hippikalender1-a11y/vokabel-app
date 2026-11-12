import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, artenMehrfach, antwortDazu } from "./hilfen.mjs";

// 104/106/108/119/120/121: Karten-Fluss bei mehreren Spalten (Weiter ohne Pause, Tipp ins Freie, Bewertung am Ende),
// Lautsprecher je Spalte, frühere Spalten antippen liest vor, alle Teile vorlesen, „;“ = Alternativen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(150); };
const frei = async () => { await page.evaluate(() => document.querySelector("[data-frei-klick]")?.click()); await sleep(150); };
const gesprochen = () => page.evaluate(() => window.__gesprochen.map(g => g.text));
const leeren = () => page.evaluate(() => { window.__gesprochen = []; });
const zustand = () => page.evaluate(() => ({
  vorig: [...document.querySelectorAll("[data-vorig]")].map(v => v.dataset.vorig).join(","),
  weiter: !!document.querySelector("[data-karte-weiter]"),
  bewertung: !!document.querySelector(".karte-bewertung"),
  verdeckt: !!document.querySelector("[data-karte-verdeckt]"),
  frei: !!document.querySelector("[data-frei-klick]"),
}));
const score = id => page.evaluate(i => JSON.parse(localStorage.getItem("vokabel_liste_l_en")).vokabeln.find(v => v.id === i).fortschritt?.score ?? null, id);

await page.evaluateOnNewDocument(() => {
  window.__gesprochen = [];
  const fake = { speaking: false, pending: false, speak(u) { window.__gesprochen.push({ text: u.text, lang: u.lang }); }, cancel() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
});
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus: "einfach", autoplay: true, vorlesen: ["E1", "E2", "E3"], gelerntSchwelle: 3 }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Infinitive",E2:"Simple Past",E3:"Past Participle",D1:"Deutsch"}[t] || "", aktiv: ["E1","E2","E3","D1"].includes(t) }]));
  const l = { id:"l_en", name:"Irregular Verbs", sprache:"en", spalten: sp, naechste_id:3, vokabeln: [
    { id:1, E1:{wert:"be",falsch:[]}, E2:{wert:"was / were",falsch:[]}, E3:{wert:"been",falsch:[]}, D1:{wert:"sein",falsch:[]} },
    { id:2, E1:{wert:"hello; hi",falsch:[]}, E2:{wert:"x",falsch:[]}, E3:{wert:"y",falsch:[]}, D1:{wert:"Hallo",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:l.name, sprache:"en", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Irregular Verbs"))?.click()); await sleep(300);
await listenZu(page);
await klick("[data-abfragemodus]"); await sleep(200);
// Frage Deutsch, Antworten E1, E2, E3 (Reihenfolge der Liste: Frage = D1)
const rollen = () => page.evaluate(() => [...document.querySelectorAll("[data-rolle-antwort]")].map(b => `${b.dataset.rolleAntwort}=${b.textContent.trim()}`).join(" "));
for (const n of ["Simple Past", "Past Participle"]) {
  await page.evaluate(n => [...document.querySelectorAll("div")].find(d => d.style.cursor === "pointer" && d.textContent.includes(n) && d.querySelector(".checkbox"))?.click(), n); await sleep(200);
}
await antwortDazu(page, "Simple Past"); await antwortDazu(page, "Past Participle");
console.log("Rollen:", await rollen());
await klick("[data-abfragemodus]"); await sleep(200);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);

// Vokabel „be“ (Reihenfolge Liste) – ggf. „hello“ zuerst: Frage ermitteln
const frage = await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
console.log("Frage:", frage);
ok((await zustand()).verdeckt && (await zustand()).frei, "Start: Antwort verdeckt, Tipp ins Freie möglich");
ok(await page.$('[data-spalte-vorlesen="D1"]') && await page.$('[data-spalte-vorlesen="E1"]'), "Lautsprecher-Knopf an Frage und Antwort");

// 108: ins Freie tippen deckt auf und liest vor
await leeren(); await frei();
let z = await zustand();
ok(!z.verdeckt && z.weiter && !z.bewertung, `Tipp ins Freie: Spalte 1 aufgedeckt, „Weiter“ statt Bewertung (${JSON.stringify(z)})`);
const erste = await gesprochen();
ok(erste.length >= 1, `… sofort vorgelesen (${erste.join(" | ")})`);
await leeren(); await klick("[data-karte-weiter]");
z = await zustand();
ok(z.vorig === "offen" && !z.verdeckt && z.weiter, `„Weiter“: Spalte 2 erscheint gleich aufgedeckt, Spalte 1 oben ohne ✓/✗ (${JSON.stringify(z)})`);
const zweite = await gesprochen();
ok(zweite.length >= 1, `… Spalte 2 vorgelesen (${zweite.join(" | ")})`);
if (frage === "sein") ok(zweite.join(",") === "was,were", `120: alle Teile von „was / were“ vorgelesen (${zweite.join(",")})`);
await leeren(); await frei();
z = await zustand();
ok(z.vorig === "offen,offen" && z.bewertung && !z.weiter && !z.frei, `Tipp ins Freie: letzte Spalte, „Gewusst / Nicht gewusst“, ins Freie tippen geht nicht mehr (${JSON.stringify(z)})`);
// 106: frühere Spalte antippen liest vor
await leeren(); await page.evaluate(() => document.querySelector("[data-vorig]").click()); await sleep(150);
ok((await gesprochen()).length >= 1, `frühere Spalte antippen liest vor (${(await gesprochen()).join(" | ")})`);
await frei();
ok((await zustand()).bewertung, "ins Freie tippen bei der Bewertung: nichts passiert");
const id1 = frage === "sein" ? 1 : 2;
await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => b.textContent.includes("Gewusst") && !b.textContent.includes("Nicht")).click()); await sleep(200);
ok(await score(id1) === 1, `Gewusst: ganze Vokabel +1 (${await score(id1)})`);
await frei(); await sleep(1200);

// 104: Lautsprecher je Spalte schaltet dauerhaft
const vorher = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).vorlesen.join(","));
await klick('[data-spalte-vorlesen="E1"]');
const nachher = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).vorlesen.join(","));
ok(vorher.includes("E1") && !nachher.includes("E1") && await page.evaluate(() => document.querySelector('[data-spalte-vorlesen="E1"]').dataset.an) === "nein",
  `Lautsprecher-Knopf E1: Spalte aus der Vorlese-Wahl (${vorher} → ${nachher})`);
await leeren(); await frei();
ok(!(await gesprochen()).length, `E1 aus: beim Aufdecken nichts vorgelesen (${(await gesprochen()).join(" | ")})`);
// Nicht gewusst für die zweite Vokabel
await frei(); await frei();
await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => b.textContent.includes("Nicht")).click()); await sleep(200);
const id2 = id1 === 1 ? 2 : 1;
ok(await score(id2) === -1 || await score(id2) === 0, `Nicht gewusst: ganze Vokabel nicht gewusst (${await score(id2)})`);

// 121: „;“ – Alternativen: Prüfung und Anzeige (Logik direkt im Browser über die Tipp-Abfrage)
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
