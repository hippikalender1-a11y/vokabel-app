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
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
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
await page.click("[data-umfang]"); await sleep(200); await page.click('[data-umfang-wahl="alle"]'); await sleep(300);

// ── 1) Normales Quiz → Verlauf-Eintrag ──
const quizRunde = async () => {
  await clickText("[data-start-knopf]", "");
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
  await page.evaluate(() => { const el = document.querySelector("[data-slot-kopf-name]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await new Promise(r => setTimeout(r, 250)); await page.evaluate(() => document.querySelector('[data-info-aktion="💾 Speichern"]').click()); await new Promise(r => setTimeout(r, 300));
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

// ── 4) Raster: Plätze, Verschieben per Antippen und Ziehen (belegt → tauschen) ──
const plaetze = async () => Object.fromEntries((await slots()).gespeichert.map(x => [x.name, x.platz ? `${x.platz.z}|${x.platz.s}` : "-"]));
const [n1, n2, n3] = [v1, v2, `Französisch ${heute} (3)`];
let pl = await plaetze();
console.log("     Plätze:", JSON.stringify(pl));
ok(pl[n1] === "0|0" && pl[n2] === "1|0" && pl[n3] === "2|0", "Neue Einträge untereinander in der ersten Spalte (Raster 10 × 2)");
ok(await page.evaluate(() => getComputedStyle(document.querySelector(".slot-raster")).gridTemplateColumns.split(" ").length === 2), "Raster mit 2 Spalten");
ok(await page.evaluate(() => { const neu = [...document.querySelectorAll(".slot-kopf-knoepfe .slot-chip")].find(b => b.textContent.trim() === "Neu"); return !!neu && !neu.closest(".slot-raster"); }),
  "„Neu“ klein oben, nicht im Raster");
t = await page.evaluate(() => document.body.innerText);
ok(!t.includes("⇄ Verschieben") && /Lang drücken: umbenennen, verschieben oder löschen/.test(t) && !(await page.$("svg + svg")),
  "Kein Verschieben-Knopf mehr, stattdessen Hinweis auf den Lang-Druck");
// Lang-Druck (am Rechner: Rechtsklick) → Erklärung mit Menü
const menue = async key => { await page.evaluate(k => { const el = document.querySelector(`[data-raster-zelle="${k}"]`); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, key); await sleep(200); };
const aktion = async label => { await page.evaluate(l => document.querySelector(`[data-info-aktion="${l}"]`).click(), label); await sleep(250); };
await menue("2|0");
const knoepfe = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.textContent.trim()));
const blase = await page.evaluate(() => document.querySelector('[role="status"]')?.innerText || "");
console.log("     Menü:", knoepfe.join(" | "));
ok(blase.startsWith(n3) && knoepfe.join("|") === "✎ Umbenennen|⧉ Duplizieren|⇄ Verschieben|📝 Listen/Vokabeln ändern|🗑 Löschen", "Lang-Druck: voller Name + Umbenennen / Duplizieren / Verschieben / Listen ändern / Löschen");
await aktion("⇄ Verschieben");
const tippZelle = key => page.evaluate(k => document.querySelector(`[data-raster-zelle="${k}"]`).click(), key);
ok(!(await page.$('[role="status"]')) && /1 markiert – freien Platz antippen/.test(await page.evaluate(() => document.body.innerText)),
  "„Verschieben“: Menü zu, Verschieben-Modus mit diesem Paket markiert");
await tippZelle("3|1"); await sleep(250);
pl = await plaetze();
ok(pl[n3] === "3|1", "freien Platz antippen: verschoben");
// mehrere markieren (Nummern 1, 2) → freier Platz: untereinander eingesetzt
await tippZelle("0|0"); await sleep(150); await tippZelle("1|0"); await sleep(200);
ok(await page.evaluate(() => [...document.querySelectorAll("[data-auswahl-nr]")].map(n => n.textContent).join(",")) === "1,2", "zwei markiert: Nummern 1 und 2");
await tippZelle("5|1"); await sleep(250);
pl = await plaetze();
console.log("     Gruppe:", JSON.stringify(pl));
ok(pl[n1] === "5|1" && pl[n2] === "6|1", "markierte Gruppe auf freien Platz: untereinander (5|1, 6|1)");
ok(!(await page.$("[data-auswahl-nr]")), "danach keine Markierung mehr");
// Ziehen einer markierten Gruppe: n1 + n2 markieren, n2 auf 0|0 ziehen → n1 0|0, n2 1|0
await tippZelle("5|1"); await sleep(150); await tippZelle("6|1"); await sleep(200);
{
  const b = k => page.evaluate(k => { const r = document.querySelector(`[data-raster-zelle="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, k);
  const v = await b("6|1"), n = await b("0|0");
  await page.mouse.move(v.x, v.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(v.x + (n.x - v.x) * i / 10, v.y + (n.y - v.y) * i / 10); await sleep(40); }
  await page.mouse.up(); await sleep(300);
}
pl = await plaetze();
console.log("     Gruppe gezogen:", JSON.stringify(pl));
ok(pl[n1] === "0|0" && pl[n2] === "1|0" && pl[n3] === "3|1", "markierte Gruppe gezogen: wandert zusammen (0|0, 1|0)");
// Ziehen (einzeln): n3 (3|1) auf n2 (1|0) → Tausch
const box = k => page.evaluate(k => { const r = document.querySelector(`[data-raster-zelle="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, k);
const von = await box("3|1"), nach = await box("1|0");
await page.mouse.move(von.x, von.y); await page.mouse.down();
// wie nach einem Lang-Druck: Erklärung offen – sie muss beim Ziehen sofort verschwinden
await page.evaluate(() => window.dispatchEvent(new CustomEvent("vokabel-info", { detail: { text: "Test-Erklärung", x: 100, y: 300 } })));
await sleep(100);
const infoVorher = await page.evaluate(() => !!document.querySelector('[role="status"]'));
await page.mouse.move(von.x + (nach.x - von.x) / 10, von.y + (nach.y - von.y) / 10); await sleep(80);
ok(infoVorher && !(await page.evaluate(() => !!document.querySelector('[role="status"]'))), "Lang-Druck-Erklärung verschwindet, sobald gezogen wird");
for (let i = 2; i <= 10; i++) { await page.mouse.move(von.x + (nach.x - von.x) * i / 10, von.y + (nach.y - von.y) * i / 10); await sleep(40); }
await page.mouse.up(); await sleep(300);
pl = await plaetze();
console.log("     nach Ziehen:", JSON.stringify(pl));
ok(pl[n3] === "1|0" && pl[n2] === "3|1", "Ziehen auf belegten Platz: tauschen");
await page.screenshot({ path: "slots_raster.png" });
await clickText("button", "Fertig", true);
const lang = await page.evaluate(n => document.querySelector(`[data-slot-id] [class="raster-name"]`) && [...document.querySelectorAll("[data-slot-id]")].find(b => b.textContent.includes(n))?.getAttribute("data-info"), n3);
ok((lang || "").startsWith(n3), "Info-Text (Lang-Druck) nennt den kompletten Namen");
await page.reload(); await sleep(400);
ok(JSON.stringify(await plaetze()) === JSON.stringify(pl), "Plätze bleiben nach Neuladen erhalten");

// Umbenennen über das Menü: Name ändert sich, Platz bleibt; doppelter Name wird abgelehnt
await clickText(".tab", "Quiz");
if (!(await page.$("[data-raster-zelle]"))) await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.click());
await sleep(300);
const platzN1 = pl[n1];
await menue(platzN1);
await aktion("✎ Umbenennen");
const setzeFeld = async v => page.evaluate(v => { const f = document.querySelector("[data-umbenennen-feld]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, v); f.dispatchEvent(new Event("input", { bubbles: true })); }, v);
await setzeFeld(n2); await sleep(150);
ok(await page.evaluate(() => document.querySelector("[data-umbenennen-speichern]").disabled) && /Diesen Namen gibt es schon/.test(await page.evaluate(() => document.body.innerText)),
  "Umbenennen: vorhandener Name wird abgelehnt");
await setzeFeld("Meine Verben"); await sleep(150);
await page.click("[data-umbenennen-speichern]"); await sleep(250);
pl = await plaetze();
ok(pl["Meine Verben"] === platzN1 && !(n1 in pl), "Umbenennen: neuer Name, gleicher Platz");
// Duplizieren: Vorschlag „… (Kopie)“, gleiche Konfiguration, kein Fortschritt, untereinander unten
await menue(platzN1);
await aktion("⧉ Duplizieren");
const vorschlag = await page.evaluate(() => document.querySelector("[data-umbenennen-feld]").value);
ok(vorschlag === "Meine Verben (Kopie)" && /Duplizieren/.test(await page.evaluate(() => document.querySelector(".modal-titel").textContent)), `Duplizieren: Fenster mit Vorschlag „${vorschlag}“`);
await setzeFeld("Meine Verben 2"); await sleep(150);
await page.click("[data-umbenennen-speichern]"); await sleep(250);
const alle = (await slots()).gespeichert;
const orig = alle.find(x => x.name === "Meine Verben"), dup = alle.find(x => x.name === "Meine Verben 2");
pl = await plaetze();
console.log("     nach Duplizieren:", JSON.stringify(pl));
ok(dup && dup.id !== orig.id && JSON.stringify(dup.konfiguration) === JSON.stringify(orig.konfiguration) && !dup.sessionFortschritte?.uebersetzung,
  "Duplikat: eigene Kennung, gleiche Konfiguration, ohne Fortschritt");
ok(pl["Meine Verben 2"] === "4|0" && pl["Meine Verben"] === platzN1, `Duplikat untereinander unter dem untersten Eintrag (4|0), Original bleibt (${pl["Meine Verben 2"]})`);
// für den weiteren Ablauf wieder entfernen
await menue("4|0"); await aktion("🗑 Löschen"); await clickText(".modal .btn-danger", "Löschen", true);

// Einstellungen: 3 Spalten, Zeilen verkleinern → Einträge rücken nach, voll → beim Speichern automatisch eine Zeile mehr
await clickText(".tab", "Einstellungen");
await page.evaluate(() => document.querySelector('[data-raster-spalten="3"]').click()); await sleep(200);
for (let i = 0; i < 12; i++) { const weiter = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "−" && x.nextElementSibling?.hasAttribute("data-raster-zeilen")); if (!b || b.disabled) return false; b.click(); return true; }); if (!weiter) break; await sleep(80); }
const zeilen = await page.evaluate(() => document.querySelector("[data-raster-zeilen]").textContent.trim());
pl = await plaetze();
console.log("     1 Zeile × 3:", JSON.stringify(pl));
ok(zeilen === "1" && Object.values(pl).every(p => p.startsWith("0|")) && new Set(Object.values(pl)).size === 3, "Verkleinern auf 1 × 3: alle Einträge in Zeile 1, keiner doppelt");
await clickText(".tab", "Quiz");
await speichern();
const einst = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).slotRaster);
pl = await plaetze();
console.log("     nach 4. Speichern:", JSON.stringify(einst), JSON.stringify(pl));
ok(einst.zeilen === 2 && Object.values(pl).includes("1|0"), "Raster voll: neuer Eintrag → automatisch eine Zeile mehr (1|0)");
// Löschen über das Menü (mit Rückfrage)
if (!(await page.$('[data-raster-zelle="1|0"]'))) await page.evaluate(() => document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv")?.click());
await sleep(300);
await menue("1|0");
await aktion("🗑 Löschen");
await clickText(".modal .btn-danger", "Löschen", true);
pl = await plaetze();
ok(Object.keys(pl).length === 3 && !Object.values(pl).includes("1|0"), "Löschen über das Menü: Eintrag weg");
// für den Statistik-Teil wieder Standard (10 × 2)
await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen")); e.slotRaster = { zeilen: 10, spalten: 2 }; localStorage.setItem("vokabel_einstellungen", JSON.stringify(e)); });
await page.reload(); await sleep(400);

// ── 5) Statistik: Verlauf-Eintrag zeigt Session-Modus ──
await clickText(".tab", "Statistik");
await sleep(300);
const offen = await page.evaluate(() => /🕘 Verlauf/i.test(document.body.innerText));
// Kopf-Knopf öffnen (zeigt „Neu“ oder – nach Auto-Laden – den Namen der zuletzt gewählten Konfiguration)
if (!offen) { await page.evaluate(() => [...document.querySelectorAll("div")].find(d => d.firstElementChild?.textContent.trim().startsWith("Verlauf & Gespeichert") && d.querySelector("button.toggle-opt.aktiv"))?.querySelector("button.toggle-opt.aktiv").click()); await sleep(300); }
await page.evaluate(() => document.querySelector(".slot-chip.verlauf")?.click());
await sleep(400);
t = await page.evaluate(() => document.body.innerText);
const kopf = (t.match(/(Lernfortschritt|Ø Score)[\s\S]{0,80}/) || [""])[0].split("\n").join(" | ");
console.log("     Statistik-Kopf:", kopf);
ok(!/Session|Global/.test(kopf) && /Ø Score|Lernfortschritt/.test(kopf), "Statistik: Verlauf-Eintrag lädt, Kopfzeile ohne Global/Session");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
