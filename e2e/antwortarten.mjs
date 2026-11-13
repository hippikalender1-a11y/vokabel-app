import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, bereichZu, fremdAlsFrage } from "./hilfen.mjs";
import { auswahlZu } from "./hilfen.mjs";

// Neue Antwortarten: „Hören“ (Frage verdeckt + vorgelesen, Antwort per MC), „Puzzle“ (Buchstaben-Kacheln),
// „Lücken“ (fehlende Buchstaben ergänzen, der erste bleibt stehen)
const URL = "http://localhost:4199/vokabel-app/";
const WOERTER = ["école", "maison", "garçon", "château", "élève", "forêt"];
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => {
  window.__gesprochen = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; this.rate = 1; } };
  const s = window.speechSynthesis; s.getVoices = () => []; s.speak = u => window.__gesprochen.push(u.text); s.cancel = () => {};
});
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const score = wort => page.evaluate(w => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.E1.wert === w)?.fortschritt?.score ?? null, wort);
const zielVon = frage => WOERTER[Number(frage.replace("Wort", "")) - 1];

const starte = async (art, woerter = WOERTER) => {
  await page.goto(URL);
  await page.evaluate(w => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const vokabeln = w.map((x, i) => ({ id: i + 1, E1: { wert: x, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
    localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: w.length + 1, vokabeln }));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
  }, woerter);
  await page.reload(); await sleep(700);
  await neueEineSession(page);
  await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
  await listenZu(page);
  await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
  if (art === "hoeren") await fremdAlsFrage(page);   // Hören gibt es nur mit deutscher Antwort
  const sp = art === "hoeren" ? "D1" : "E1";
  const da = await page.evaluate((a, sp) => { const b = document.querySelector(`[data-modus-knopf="${sp}:${a}"]`); b?.click(); return !!b; }, art, sp); await sleep(200);
  await page.evaluate(() => document.querySelector('[data-modus-knopf$=":karte"].aktiv')?.click()); await sleep(200);
  await bereichZu(page);
  await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
  return da;
};
const frageText = () => page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());

// ── Hören ──
// „Hören“ (Französisch → Deutsch): Französisch wird vorgelesen, Deutsch gewählt
ok(await starte("hoeren"), "Modus-Knopf „Hören“");
ok(await page.$("[data-hoer-verdeckt]"), "Frage verdeckt (🔊)");
const gehoert = await page.evaluate(() => window.__gesprochen[window.__gesprochen.length - 1]);
ok(WOERTER.includes(gehoert), `die französische Frage wird beim Erscheinen vorgelesen (${gehoert})`);
await page.evaluate(z => [...document.querySelectorAll("[data-mc-raster] button")].find(b => b.textContent.trim() === z)?.click(), `Wort${WOERTER.indexOf(gehoert) + 1}`); await sleep(400);
ok(!(await page.$("[data-hoer-verdeckt]")) && await frageText() === gehoert, "richtig gewählt: Frage wird sichtbar");
ok(await score(gehoert) === 1, "Hören: richtig +1");

// ── Puzzle ──
ok(await starte("puzzle"), "Modus-Knopf „Puzzle“");
let frage = await frageText(), ziel = zielVon(frage);
const kacheln = await page.evaluate(() => [...document.querySelectorAll("[data-puzzle-kachel]")].map(b => b.textContent));
ok(kacheln.length === [...ziel].length && [...kacheln].sort().join("") === [...ziel].sort().join(""), `Kacheln = Buchstaben von „${ziel}“ gemischt (${kacheln.join("")})`);
// erst falsch: umgekehrte Reihenfolge
for (const c of [...ziel].reverse()) await page.evaluate(c => [...document.querySelectorAll("[data-puzzle-kachel]:not([disabled])")].find(b => b.textContent === c)?.click(), c);
await sleep(300);
ok(/Nicht richtig/.test(await page.evaluate(() => document.body.innerText)) && await score(ziel) === null, "falsche Reihenfolge: „Nicht richtig.“, neuer Versuch");
await sleep(1600);
for (const c of [...ziel]) { await page.evaluate(c => [...document.querySelectorAll("[data-puzzle-kachel]:not([disabled])")].find(b => b.textContent === c)?.click(), c); await sleep(40); }
await sleep(400);
ok(!(await page.$("[data-puzzle]")) && await score(ziel) === 1, `richtig gelegt: „${ziel}“, Score +1`);

// ── Lücken ──
ok(await starte("luecke"), "Modus-Knopf „Lücken“");
frage = await frageText(); ziel = zielVon(frage);
const felder = await page.evaluate(() => [...document.querySelectorAll("[data-luecke-wort] span")].map(s => s.hasAttribute("data-luecke-feld") ? "_" : s.textContent));
ok(felder.length === [...ziel].length && felder[0] !== "_" && felder.includes("_"), `„${ziel}“ mit Lücken, erster Buchstabe steht (${felder.join("")})`);
const fehlend = [...ziel].filter((c, i) => felder[i] === "_").join("");
await page.focus("[data-luecke-eingabe]"); await page.keyboard.type(fehlend, { delay: 30 }); await sleep(400);
ok(await score(ziel) === 1, `fehlende Buchstaben „${fehlend}“ eingetippt: richtig, +1`);

// ── Memory ──
ok(await starte("memory"), "Modus-Knopf „Memory“");
let mk = await page.evaluate(() => [...document.querySelectorAll("[data-memory-karte]")].map(b => ({ i: +b.dataset.memoryKarte, id: b.dataset.memoryId, seite: b.dataset.memorySeite, text: b.textContent.trim() })));
ok(mk.length === 12 && mk.every(k => k.text === "?"), `12 verdeckte Karten (6 Vokabeln × Frage/Antwort): ${mk.length}`);
const a1 = mk[0], b1 = mk.find(k => k.id !== a1.id);
await page.click(`[data-memory-karte="${a1.i}"]`); await sleep(100); await page.click(`[data-memory-karte="${b1.i}"]`); await sleep(150);
const offen2 = await page.evaluate(() => [...document.querySelectorAll(".memory-karte.auf")].length);
ok(offen2 === 2 && await page.$(".memory-karte.falsch"), "zwei verschiedene aufgedeckt: kurz rot");
await sleep(1300);
ok(await page.evaluate(() => document.querySelectorAll(".memory-karte.auf").length) === 0, "danach wieder verdeckt");
const ids = [...new Set(mk.map(k => k.id))];
for (const id of ids) {
  const [x, y] = mk.filter(k => k.id === id);
  await page.click(`[data-memory-karte="${x.i}"]`); await sleep(80); await page.click(`[data-memory-karte="${y.i}"]`); await sleep(150);
}
await sleep(300);
const st = await page.evaluate(() => [...document.querySelectorAll("[data-zuo-reihe]")].map(r => r.dataset.zuoStatus));
const scores = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.map(v => v.fortschritt?.score ?? null));
ok(st.length === 6 && st.every(x => x === "richtig") && scores.every(x => x === 1), `alle Paare gefunden: Ergebnis-Zeilen ✓, je +1, Fehlversuch ohne Abzug (${scores})`);

// ── Artikel ──
const ARTW = ["la maison", "le chat", "l'école", "la forêt", "le garçon", "une voiture"];
ok(await starte("artikel", ARTW), "Modus-Knopf „Artikel“");
let artikelGesehen = 0, ohneArtikel = 0;
for (let k = 0; k < ARTW.length; k++) {
  const frage = await frageText(), w = ARTW[Number(frage.replace("Wort", "")) - 1];
  const wort = await page.evaluate(() => document.querySelector("[data-artikel-wort]")?.textContent.trim());
  if (wort) {
    artikelGesehen++;
    const knoepfe = await page.evaluate(() => [...document.querySelectorAll("[data-mc-raster] button")].map(b => b.textContent.trim()).join("|"));
    const richtig = /^(la|une) /.test(w) ? "la" : "le";
    if (k === 0) ok(knoepfe === "le|la" || knoepfe === "la|le", `Knöpfe le / la (${knoepfe}), Wort ohne Artikel „${wort}“`);
    ok(wort === w.replace(/^\S+ /, ""), `„${w}“ → angezeigt „${wort}“`);
    await page.evaluate(r => [...document.querySelectorAll("[data-mc-raster] button")].find(b => b.textContent.trim() === r)?.click(), richtig); await sleep(400);
    ok(await page.evaluate(w => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.E1.wert === w)?.fortschritt?.score, w) === 1, `richtig „${richtig}“: +1`);
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(1300);
  } else {
    ohneArtikel++;
    ok(/^l'/.test(w), `„${w}“ ohne erkennbaren Artikel: andere Antwortart`);
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent))?.click()); await sleep(1300);
  }
}
ok(artikelGesehen === 5 && ohneArtikel === 1, `5 Wörter mit Artikel, 1 ohne (${artikelGesehen}/${ohneArtikel})`);

// ── Serie und Blitzrunde (Abfrage-Ziel) ──
const mitZiel = async ziel => {
  await starte("karte");   // Karte bleibt (nur „karte“ angehakt)
  await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht|Beenden/.test(b.textContent))?.click()); await sleep(400);
  await auswahlZu(page);   // 190: Session-Auswahl ist offen
  await page.evaluate(() => document.querySelector("[data-abfrageziel]")?.click()); await sleep(300);
  await page.evaluate(z => [...document.querySelectorAll(".typ-btn")].find(b => b.textContent.includes(z))?.click(), ziel); await sleep(200);
  await page.evaluate(() => document.querySelector("[data-abfrageziel]")?.click()); await sleep(300);
  await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
};
const karte = async gewusst => {
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(250);
  await page.evaluate(g => [...document.querySelectorAll(".karte-btn")].find(b => g ? /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent) : /Nicht/.test(b.textContent))?.click(), gewusst);
  await sleep(1300);
};
await mitZiel("Serie");
ok(await page.evaluate(() => document.querySelector("[data-spiel-zaehler]")?.textContent.trim()) === "🔥 0", "Serie: Zähler 🔥 0 statt „1 / n“");
for (let k = 0; k < 8; k++) await karte(true);   // mehr als 6 Vokabeln: sie kommen wieder
ok(await page.evaluate(() => document.querySelector("[data-spiel-zaehler]")?.textContent.trim()) === "🔥 8", "8 richtig am Stück (Vokabeln kommen immer wieder)");
await karte(false);
ok(await page.evaluate(() => document.querySelector("[data-spiel-ergebnis]")?.textContent.trim()) === "8" && /Erster Rekord/.test(await page.evaluate(() => document.querySelector("[data-spiel-rekord]")?.textContent)),
  "erster Fehler beendet die Serie: 8, „Erster Rekord!“");
await page.click("[data-spiel-weiter]"); await sleep(400);
ok(!(await page.$("[data-spiel-ende]")), "„Weiter →“: zur Auswertung");

await mitZiel("Blitzrunde");
ok(await page.$("[data-blitz-zeit] .zuo-zeit-balken") && await page.evaluate(() => document.querySelector("[data-spiel-zaehler]")?.textContent.trim()) === "⚡ 0", "Blitzrunde: Zeitbalken, Zähler ⚡ 0");
await karte(true); await karte(true); await karte(false); await karte(true);
ok(await page.evaluate(() => document.querySelector("[data-spiel-zaehler]")?.textContent.trim()) === "⚡ 3", "Fehler beenden die Blitzrunde nicht: ⚡ 3");
await sleep(56000);
ok(await page.evaluate(() => document.querySelector("[data-spiel-ergebnis]")?.textContent.trim()) === "3" && /richtig in 60 Sekunden/.test(await page.evaluate(() => document.body.innerText)),
  "nach 60 s: 3 richtig in 60 Sekunden");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
