import puppeteer from "puppeteer-core";

// Lernen: Stufe Lernen → Leicht → Schwer; „Lernen starten“ zeigt Wort (vorgelesen), nach der Pause die Übersetzung + Info,
// dann die nächste Vokabel; antippen überspringt, Pause / zurück / vor / beenden; kein Score, kein Session-Fortschritt
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
await page.evaluateOnNewDocument(() => {
  const stimmen = [{ name: "Amelie", lang: "fr-FR", default: true, localService: true }, { name: "Anna", lang: "de-DE", default: false, localService: true }];
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; } };
  Object.defineProperty(window, "speechSynthesis", { value: {
    getVoices: () => stimmen, cancel() {}, addEventListener() {}, speaking: false,
    speak(u) { window.__gesprochen.push({ text: u.text, lang: u.lang }); },
  } });
});
const stand = () => page.evaluate(() => ({
  stand: document.querySelector("[data-lernen-stand]")?.textContent.trim(),
  phase: document.querySelector("[data-lernen-karte]")?.dataset.lernenPhase,
  wort: document.querySelector("[data-lernen-wort] .lernen-wort")?.textContent.trim(),
  uebersetzung: document.querySelector("[data-lernen-uebersetzung] .lernen-wort")?.textContent.trim() || null,
  info: document.querySelector("[data-lernen-info]")?.textContent.trim() || null,
}));
// wartet, bis die Bedingung gilt; gibt die verstrichene Zeit in ms zurück (oder -1)
const warteAuf = async (fn, max = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await fn()) return Date.now() - t0; await sleep(50); } return -1; };
const stufe = () => page.evaluate(() => { const b = document.querySelector("[data-stufe]"); return `${b.dataset.stufe}|${b.textContent.trim()}`; });
const langDruck = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(250);
};

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch",i1:"Hinweis"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const w = [["aller","gehen","unregelmäßig"],["venir","kommen",""],["voir","sehen",""],["faire","machen",""],["dire","sagen",""],["prendre","nehmen",""],["mettre","legen",""]];
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id: 8,
    vokabeln: w.map(([e, d, h], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(h ? { i1: { wert: h } } : {}) })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }]));
  const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{i1:true}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g_1", name:"Verben", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", gelerntSchwelle:6, sprache:"alle", lernen: { halte: 1 } }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes("Verben")).click()); await sleep(600);
await page.click("[data-umfang]"); await sleep(200); await page.click('[data-umfang-wahl="5"]'); await sleep(300);

// Stufe: Schwer → Lernen → Leicht → Schwer → Lernen
ok(await stufe() === "schwer|Schwer", "Start: Schwer");
await page.click("[data-stufe]"); await sleep(200);
ok(await stufe() === "lernen|Lernen", "antippen: Lernen");
await page.click("[data-stufe]"); await sleep(200);
ok(await stufe() === "einfach|Leicht", "antippen: Leicht");
await page.click("[data-stufe]"); await sleep(200);
ok(await stufe() === "schwer|Schwer", "antippen: Schwer");
await page.click("[data-stufe]"); await sleep(200);
const start = await page.evaluate(() => document.querySelector("[data-start-knopf]")?.textContent.trim());
ok(start === "Lernen starten5 Vokabeln", `Start-Knopf: „Lernen starten / 5 Vokabeln“ (${start})`);

// Lang-Druck: „Lernen einstellen“
await langDruck("[data-stufe]");
const menue = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
ok(menue.includes("🎬 Lernen einstellen") && menue.includes("⚙ Regeln Leicht / Schwer") && menue.includes("🔊 Vorlesen"), `Lang-Druck: Regeln, Lernen, Vorlesen (${menue.join(" | ")})`);
await page.evaluate(() => document.querySelector('[data-info-aktion="🎬 Lernen einstellen"]').click()); await sleep(300);
ok(await page.$("[data-lernen-einst]") && await page.$('[data-lernen-zuerst="fremd"].aktiv') && await page.$('[data-lernen-vorlesen1="true"].aktiv'), "Fenster „Lernen einstellen“: zuerst Fremdsprache, Wort vorlesen");
await page.evaluate(() => document.querySelector("[data-lernen-einst]").closest(".overlay").click()); await sleep(200);

// Lernen starten
await page.click("[data-start-knopf]"); await sleep(250);
let z = await stand();
console.log("     Start:", JSON.stringify(z));
ok(z.stand === "1 / 5" && z.phase === "0" && z.wort === "aller" && z.uebersetzung === null, "erst nur das Wort (aller), noch keine Übersetzung");
const g = await page.evaluate(() => window.__gesprochen);
ok(g.some(x => x.text === "aller" && x.lang.startsWith("fr")), "Wort wird französisch vorgelesen");
// Wort vorgelesen → 1 s Ruhe → Übersetzung
let ms = await warteAuf(async () => (await stand()).phase === "1");
z = await stand();
console.log("     Übersetzung nach", ms, "ms");
ok(z.uebersetzung === "gehen" && z.info === null && ms > 900 && ms < 2200, `nach Vorlesen + 1 s: Übersetzung, noch ohne Zusatzinfo (${ms} ms)`);
ok(!(await page.evaluate(() => window.__gesprochen)).some(x => x.text === "gehen"), "Übersetzung nicht vorgelesen (Standard)");
// Übersetzung: Lesezeit + 1 s → Zusatzinfo
ms = await warteAuf(async () => (await stand()).phase === "2");
z = await stand();
console.log("     Zusatzinfo nach", ms, "ms");
ok(/unregelmäßig/.test(z.info || "") && ms > 1300 && ms < 2600, `danach versetzt die Zusatzinfo (${ms} ms)`);
// Zusatzinfo: Lesezeit + Pause (1 s) → nächste Vokabel
ms = await warteAuf(async () => (await stand()).stand === "2 / 5");
z = await stand();
console.log("     nächste Vokabel nach", ms, "ms");
ok(z.phase === "0" && z.wort === "venir" && ms > 1800, `dann Lesezeit + Pause → nächste Vokabel (${ms} ms)`);
// antippen überspringt die Pause
await page.click("[data-lernen-karte]"); await sleep(150);
z = await stand();
ok(z.phase === "1" && z.uebersetzung === "kommen", "antippen: Übersetzung sofort");
await page.click("[data-lernen-karte]"); await sleep(150);
ok((await stand()).stand === "3 / 5", "nochmal antippen: nächste Vokabel");
// Pause
await page.click("[data-lernen-pause]"); await sleep(2500);
z = await stand();
ok(z.stand === "3 / 5" && z.phase === "0" && await page.$('[data-lernen-pause="an"]'), "Pause: bleibt stehen");
await page.click("[data-lernen-pause]"); await sleep(150);
await page.click("[data-lernen-vor]"); await sleep(150);
ok((await stand()).stand === "4 / 5", "⏭ vor: nächste Vokabel");
await page.click("[data-lernen-zurueck]"); await sleep(150);
ok((await stand()).stand === "3 / 5" && (await stand()).phase === "0", "⏮ zurück: vorige Vokabel");
// Zusatzinfo aus: nach der Übersetzung direkt die nächste Vokabel
await page.click('[data-lernen-info-schalter="aus"]'); await sleep(150);
await page.click("[data-lernen-zurueck]"); await sleep(150);
await page.click("[data-lernen-zurueck]"); await sleep(150);
await page.click("[data-lernen-zurueck]"); await sleep(150);
ok((await stand()).wort === "aller", "zurück zu „aller“");
await page.click("[data-lernen-pause]"); await sleep(100);
await page.click("[data-lernen-karte]"); await sleep(150);
await page.click("[data-lernen-karte]"); await sleep(150);
z = await stand();
ok(z.stand === "2 / 5" && z.info === null, `Zusatzinfo aus: nach der Übersetzung gleich die nächste Vokabel (${z.stand})`);
await page.click('[data-lernen-info-schalter="an"]'); await sleep(150);
// Regler „Pause“
await page.evaluate(() => { const r = document.querySelector("[data-lernen-halte]"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(r, "4.5"); r.dispatchEvent(new Event("input", { bubbles: true })); });
await sleep(150);
const halte = await page.evaluate(() => ({ text: document.querySelector("[data-lernen-halte-wert]")?.textContent.trim(), gespeichert: JSON.parse(localStorage.getItem("vokabel_einstellungen")).lernen?.halte }));
ok(halte.text === "4,5 s" && halte.gespeichert === 4.5, `Regler „Pause“: 4,5 s, gespeichert (${JSON.stringify(halte)})`);
await page.click("[data-lernen-pause]"); await sleep(100);

// zu Ende tippen
for (let i = 0; i < 8 && !(await page.$("[data-lernen-fertig]")); i++) { await page.click("[data-lernen-karte]"); await sleep(120); }
ok(await page.$("[data-lernen-fertig]"), "Ende: „5 Vokabeln angesehen“");
const daten = await page.evaluate(() => ({ scores: JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.filter(v => v.fortschritt).length,
  session: localStorage.getItem("vokabel_session_aktiv") }));
ok(daten.scores === 0 && !daten.session, `kein Score, kein Session-Fortschritt (${JSON.stringify(daten)})`);
await page.click("[data-lernen-nochmal]"); await sleep(150);
ok((await stand()).stand === "1 / 5", "Nochmal: von vorn");
await page.click("[data-lernen-beenden]"); await sleep(300);
ok(await page.$("[data-stufe]") && !(await page.$("[data-lernen-karte]")), "Beenden: zurück im Quiz-Tab");

// Zuerst Deutsch
await langDruck("[data-stufe]");
await page.evaluate(() => document.querySelector('[data-info-aktion="🎬 Lernen einstellen"]').click()); await sleep(300);
await page.click('[data-lernen-zuerst="deutsch"]'); await sleep(200);
await page.evaluate(() => document.querySelector("[data-lernen-einst]").closest(".overlay").click()); await sleep(200);
await page.click("[data-start-knopf]"); await sleep(250);
z = await stand();
ok(z.wort === "gehen", `Zuerst Deutsch: erst „gehen“ (${z.wort})`);
await page.click("[data-lernen-karte]"); await sleep(150);
ok((await stand()).uebersetzung === "aller", "dann „aller“");
await page.click("[data-lernen-beenden]"); await sleep(300);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
