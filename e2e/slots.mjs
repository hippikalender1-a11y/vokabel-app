import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1200 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots") || "{}"));
const heute = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]}, D1:{wert:"gehen",falsch:[]} },
    { id:2, E1:{wert:"venir",falsch:[]}, D1:{wert:"kommen",falsch:[]} },
    { id:3, E1:{wert:"voir",falsch:[]},  D1:{wert:"sehen",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Verbes");
await page.evaluate(() => { const b = [...document.querySelectorAll(".toggle-opt")].find(x => x.textContent.trim() === "Alle" && /Pakete|V\./.test(x.nextElementSibling?.textContent || "")); b?.click(); }); await sleep(300);

// ── 1) Normales Quiz → Verlauf-Eintrag ──
const quizRunde = async () => {
  await clickText("button", "Quiz starten (");
  await sleep(400);
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
    await sleep(250);
    await clickText(".karte-btn", "Gewusst");
    await sleep(1200);
  }
  await clickText("button", "Zur Übersicht");
  await sleep(300);
};
await quizRunde();
let sl = await slots();
ok(sl.verlauf?.length === 1 && sl.verlauf[0].startScores && Object.keys(sl.verlauf[0].startScores).length === 3, "Normales Quiz: Verlauf-Eintrag mit Start-Scores");
await quizRunde();
sl = await slots();
ok(sl.verlauf.length === 1, `Gleiche Konfiguration nochmal: kein doppelter Eintrag (${sl.verlauf.length})`);

// ── 2) Namensvorschlag ──
const speichern = async () => {
  await clickText("button", "Speichern", true);
  const vorschlag = await page.$eval(".modal input.inp", e => e.value);
  await page.evaluate(() => [...document.querySelectorAll(".modal .btn-primary")].pop()?.click());
  await sleep(300);
  return vorschlag;
};
const v1 = await speichern();
ok(v1 === `Französisch ${heute}`, `Namensvorschlag: „${v1}“`);
const v2 = await speichern();
ok(v2 === `Französisch ${heute} (2)`, `Zweiter Vorschlag eindeutig: „${v2}“`);
const v3 = await speichern();
sl = await slots();
console.log("     Gespeichert:", sl.gespeichert.map(x => x.name).join(" | "));

// ── 3) Trennung sichtbar ──
await page.evaluate(() => window.scrollTo(0, 0));
const sektionAuf = await page.evaluate(() => document.body.innerText.includes("📌 GESPEICHERT") || document.body.innerText.includes("📌 Gespeichert"));
if (!sektionAuf) await clickText("button", v3);
await sleep(300);
let t = await page.evaluate(() => document.body.innerText);
ok(/📌 Gespeichert/i.test(t) && /🕘 Verlauf/i.test(t), "Bereiche „📌 Gespeichert“ und „🕘 Verlauf“ getrennt");
const verlaufKlasse = await page.evaluate(() => [...document.querySelectorAll(".slot-chip.verlauf")].length);
ok(verlaufKlasse === 1, "Verlauf-Chip mit eigenem Stil (gestrichelt)");
await page.screenshot({ path: "slots.png" });

// ── 4) Drag & Drop: letzten Eintrag an den Anfang ziehen ──
const vorher = (await slots()).gespeichert.map(x => x.name);
await clickText("button", "↕ Sortieren");
const pos = await page.evaluate((a, b) => {
  const box = n => { const r = [...document.querySelectorAll("[data-slot-id]")].find(e => e.textContent.trim() === "⠿ " + n).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  return { von: box(a), nach: box(b) };
}, vorher[2], vorher[0]);
await page.mouse.move(pos.von.x, pos.von.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(pos.von.x + (pos.nach.x - pos.von.x) * i / 8, pos.von.y + (pos.nach.y - pos.von.y) * i / 8); await sleep(40); }
await page.mouse.up();
await sleep(300);
const nachher = (await slots()).gespeichert.map(x => x.name);
console.log("     vorher:", vorher.join(" | "));
console.log("     nachher:", nachher.join(" | "));
ok(nachher[0] === vorher[2] && nachher.length === 3, "Drag & Drop: Reihenfolge geändert und gespeichert");
await page.screenshot({ path: "slots_sortieren.png" });
await clickText("button", "Fertig", true);
await page.reload(); await sleep(400);
const nachReload = (await slots()).gespeichert.map(x => x.name);
ok(JSON.stringify(nachReload) === JSON.stringify(nachher), "Reihenfolge bleibt nach Neuladen erhalten");

// ── 5) Statistik: Verlauf-Eintrag zeigt Session-Modus ──
await clickText(".tab", "Statistik");
await sleep(300);
const offen = await page.evaluate(() => /🕘 Verlauf/i.test(document.body.innerText));
if (!offen) await clickText("button", "Neu", true);
await page.evaluate(() => document.querySelector(".slot-chip.verlauf")?.click());
await sleep(400);
t = await page.evaluate(() => document.body.innerText);
const kopf = (t.match(/(Lernfortschritt|Ø Score)[\s\S]{0,80}/) || [""])[0].split("\n").join(" | ");
console.log("     Statistik-Kopf:", kopf);
ok(!/Session|Global/.test(kopf) && /Ø Score/.test(kopf), "Statistik: Verlauf-Eintrag lädt, Kopfzeile ohne Global/Session");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
