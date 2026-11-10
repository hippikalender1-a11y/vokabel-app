import puppeteer from "puppeteer-core";

// Gemischte Antwortarten: Karte, MC, Tastatur und Akzente angehakt → je Frage zufällig eine;
// Akzente nur bei Wörtern mit Akzent und zählen für den Übersetzungs-Score
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
const W = { "Schüler": "élève", "Kaffee": "café", "Sommer": "été", "Katze": "chat", "Hund": "chien", "Buch": "livre" };
const MIT_AKZENT = ["Schüler", "Kaffee", "Sommer"];

await page.goto(URL);
await page.evaluate(W => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "einfach", gelerntSchwelle: 6, sprache: "alle" }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify({ id:"l_fr", name:"Mix", sprache:"fr", spalten: sp, naechste_id: 7,
    vokabeln: Object.entries(W).map(([d, e], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Mix", sprache:"fr" }]));
  const k = { listenIds:["l_fr"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g", name:"Mix", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
}, W);
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].find(c => c.textContent.includes("Mix")).click()); await sleep(700);

// Abfrage-Modus öffnen: Tastatur, MC und Akzente dazu anhaken
await page.click("[data-abfragemodus]"); await sleep(300);
const knoepfe = await page.evaluate(() => [...document.querySelectorAll("[data-modus-knopf]")].map(b => b.dataset.modusKnopf.split(":")[1]).join(","));
ok(knoepfe === "karte,mc,tippen,akzent,puzzle,luecke,artikel,satzfinden,satzbauen,lueckensatz,zuordnung,memory", `Antwortarten für E1 (Fremdsprache): Grund + Akzente, Wort, Satz, Runde – ohne Hören (${knoepfe})`);
for (const m of ["tippen", "mc", "akzent"]) { await page.click(`[data-modus-knopf="E1:${m}"]`); await sleep(100); }
const an = await page.evaluate(() => [...document.querySelectorAll("[data-modus-knopf].aktiv")].map(b => b.dataset.modusKnopf.split(":")[1]).join(","));
ok(an === "karte,mc,tippen,akzent", `alle vier angehakt (${an})`);
// nur Akzente übrig lassen geht nicht (mindestens eine andere Art bleibt)
for (const m of ["tippen", "mc", "karte"]) { await page.click(`[data-modus-knopf="E1:${m}"]`); await sleep(100); }
const rest = await page.evaluate(() => [...document.querySelectorAll("[data-modus-knopf].aktiv")].map(b => b.dataset.modusKnopf.split(":")[1]).join(","));
ok(rest === "karte,akzent", `letzte Art außer Akzente lässt sich nicht abwählen (${rest})`);
for (const m of ["tippen", "mc"]) { await page.click(`[data-modus-knopf="E1:${m}"]`); await sleep(100); }
const offenKnopf = await page.evaluate(() => document.querySelector("[data-abfragemodus]").innerText.trim());
ok(offenKnopf === "Bestätigen", `aufgeklappt: „Bestätigen“ (${offenKnopf})`);
await page.click("[data-abfragemodus]"); await sleep(300);
const knopf = await page.evaluate(() => { const b = document.querySelector("[data-abfragemodus]"); return `${b.querySelector(".zeile1")?.textContent}|${b.querySelector(".zeile2")?.textContent}`; });
await page.click("[data-abfragemodus]"); await sleep(300);
ok(knopf === "Gemischt|Karte – MC – Tastatur – Akzente", `Knopf: „Gemischt“ / „Karte – MC – Tastatur – Akzente“ (${knopf})`);
await page.click("[data-abfragemodus]"); await sleep(300);

// Abfrage-Ziel: jede Vokabel 3× → 18 Fragen
await page.click("[data-abfrageziel]"); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].find(b => b.textContent.trim() === "Anzahl").click()); await sleep(200);
await page.evaluate(() => [...document.querySelectorAll(".typ-btn")].find(b => b.textContent.trim() === "3×").click()); await sleep(200);
await page.click("[data-abfrageziel]"); await sleep(300);   // „Bestätigen“ – erst dann ist „Umfang“ wieder da
await page.click("[data-umfang]"); await sleep(200); await page.click('[data-umfang-wahl="alle"]'); await sleep(300);
await page.click("[data-start-knopf]"); await sleep(500);

const gesehen = { karte: 0, mc: 0, tippen: 0, akzent: 0 };
let akzentOhne = 0;
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim() || "");
for (let n = 0; n < 30; n++) {
  if (await page.$("[data-zur-auswertung]") || /Auswertung/.test(await page.evaluate(() => document.querySelector(".topbar-title")?.textContent || ""))) break;
  const f = await frage();
  if (!f) { await sleep(200); continue; }
  const modus = await page.evaluate(() => document.querySelector(".akzent-kachel") ? "akzent" : document.querySelector("[data-mc-raster]") ? "mc"
    : document.querySelector(".quiz-aktionen input.inp, .quiz-antwort-box input.inp") ? "tippen" : "karte");
  gesehen[modus]++;
  if (modus === "akzent" && !MIT_AKZENT.includes(f)) akzentOhne++;
  if (modus === "karte") {
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll(".karte-btn")].find(b => /Gewusst/.test(b.textContent) && !/Nicht/.test(b.textContent))?.click());
  } else if (modus === "mc") {
    await page.evaluate(w => [...document.querySelectorAll("[data-mc-knopf]")].find(b => b.textContent.trim() === w)?.click(), W[f]); await sleep(300);
  } else if (modus === "tippen") {
    await page.type(".quiz-aktionen input.inp, .quiz-antwort-box input.inp", W[f]); await page.keyboard.press("Enter"); await sleep(300);
  } else {
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Lösung anzeigen/.test(b.textContent))?.click()); await sleep(300);
  }
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^Weiter/.test(b.textContent.trim()) && !/Wiederholung/.test(b.textContent))?.click());
  for (let w = 0; w < 30 && await frage() === f && !(await page.$("[data-zur-auswertung]")); w++) await sleep(100);
}
console.log("     Antwortarten:", JSON.stringify(gesehen));
ok(Object.values(gesehen).filter(x => x > 0).length >= 3, "mindestens drei verschiedene Antwortarten kamen vor");
ok(akzentOhne === 0, "Akzente nur bei Wörtern mit Akzent");
const sc = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_fr")).vokabeln.map(v => [v.fortschritt?.score ?? null, v.akzentFortschritt?.score ?? null]));
console.log("     Scores [Ü, A]:", JSON.stringify(sc));
ok(sc.every(([u, a]) => u !== null && a === null), "alles zählt für den Übersetzungs-Score, kein Akzent-Score");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
