import puppeteer from "puppeteer-core";

// Multiquiz: Lang-Druck auf eine Kachel → „🧩 Multiquiz“, weitere Kacheln antippen, unten starten;
// Vokabeln zusammen (auch verschiedene Sprachen), Einstellungen von Nr. 1, Kopfzeile „Multiquiz“, speicherbar, Statistik zusammen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
page.on("dialog", d => { console.log("FAIL Browser-Fenster erschienen:", d.message()); d.dismiss(); });
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await sleep(300); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const langDruck = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(250);
};
const aktionen = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const startText = () => page.evaluate(() => document.querySelector("[data-multi-starten]")?.textContent.trim());
const oeffneKopf = () => page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); });

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = name => Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:name,D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name, sprache, w) => ({ id, name, sprache, spalten: sp(name), naechste_id: w.length + 1,
    vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) });
  const fr = liste("l_fr", "Verbes", "fr", [["aller","gehen"],["venir","kommen"],["voir","sehen"],["faire","machen"],["dire","sagen"]]);
  const en = liste("l_en", "Animals", "en", [["dog","Hund"],["cat","Katze"]]);
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(fr));
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(en));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:"Verbes", sprache:"fr" }, { id:"l_en", name:"Animals", sprache:"en" }]));
  const basis = { quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell" };
  const kA = { ...basis, listenIds:["l_fr"], vokabelAuswahl:["l_fr__1","l_fr__2","l_fr__3"], bereichTyp:"bereich", quizBereichTyp:"bereich", quizReihenfolge:"listennr" };
  const kB = { ...basis, listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle", quizBereichTyp:"alle", quizReihenfolge:"zufall" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_a", name:"Teil A", timestamp:1, konfiguration:kA, sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"g_b", name:"Teil B", timestamp:2, konfiguration:kB, sessionFortschritt:null, platz:{z:0,s:1} } ] }));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Quiz");
await oeffneKopf(); await sleep(300);

// Lang-Druck auf „Teil A“ → Menü mit „🧩 Multiquiz“
await langDruck('[data-slot-id="g_a"]');
const menue = await aktionen();
console.log("     Menü:", menue.join(" | "));
ok(menue.includes("🧩 Multiquiz"), "Lang-Druck auf eine Kachel: „🧩 Multiquiz“ im Menü");
await page.evaluate(() => document.querySelector('[data-info-aktion="🧩 Multiquiz"]').click()); await sleep(300);
ok(await page.$("[data-multi-leiste]") && await page.$("[data-multi-hinweis]"), "Multiquiz-Modus: Hinweis und Leiste unten");
ok(/\(1 Quiz · 3 Vokabeln\)/.test(await startText() || ""), `Leiste: 1 Quiz · 3 Vokabeln (${await startText()})`);
await page.click('[data-slot-id="g_b"]'); await sleep(250);
ok(/\(2 Quiz · 5 Vokabeln\)/.test(await startText() || ""), `Teil B dazu: 2 Quiz · 5 Vokabeln (${await startText()})`);
ok(await page.evaluate(() => [...document.querySelectorAll("[data-multi-nr]")].map(b => b.dataset.slotId + ":" + b.dataset.multiNr).join(",")) === "g_a:1,g_b:2", "Kacheln nummeriert (1, 2)");
await page.click('[data-slot-id="g_b"]'); await sleep(250);
ok(/\(1 Quiz · 3 Vokabeln\)/.test(await startText() || ""), "nochmal antippen nimmt die Kachel heraus");
ok(await page.evaluate(() => document.querySelector("[data-slot-kopf]")?.dataset.slotKopf) === "offen" && !(await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").textContent.trim() !== "Neu")), "Antippen lädt im Multiquiz-Modus nichts");
// Abbrechen
await clickText("[data-multi-leiste] button", "Abbrechen", true);
ok(!(await page.$("[data-multi-leiste]")), "Abbrechen beendet den Multiquiz-Modus");

// nochmal: A + B, starten
await langDruck('[data-slot-id="g_a"]');
await page.evaluate(() => document.querySelector('[data-info-aktion="🧩 Multiquiz"]').click()); await sleep(300);
await page.click('[data-slot-id="g_b"]'); await sleep(250);
await page.click("[data-multi-starten]"); await sleep(800);
ok(await page.$(".quiz-frage-text"), "„Multiquiz starten“ startet das Quiz sofort");
const fragen = [];
for (let k = 0; k < 6; k++) {
  const f = await page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
  if (!f) break;
  fragen.push(f);
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(200);
  await clickText(".karte-btn", "Gewusst"); await sleep(1300);
}
console.log("     Fragen:", fragen.join(", "));
ok(fragen.length === 5 && ["gehen","kommen","sehen","Hund","Katze"].every(w => fragen.some(f => f.includes(w))), "Multiquiz fragt die 5 Vokabeln beider Teile ab (Französisch + Englisch)");
ok(fragen.slice(0, 3).join(",").includes("gehen") && fragen[0].includes("gehen") && fragen[1].includes("kommen"), "Einstellungen von Nr. 1: Reihenfolge Listen-Nr.");
await clickText("button", "Zur Übersicht");
await sleep(400);

// Kopfzeile: „Multiquiz“, Info-Zeile nennt die Teile
const kopfName = await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.textContent.trim());
ok(kopfName === "Multiquiz", `Kopfzeile: „Multiquiz“ (${kopfName})`);
ok(await page.evaluate(() => document.querySelectorAll("[data-slot-kopf] [data-quiz-art]").length) >= 1, "Kopfzeile: Kreise der zusammengesetzten Auswahl");
await oeffneKopf(); await sleep(300);
const info = await page.evaluate(() => document.querySelector("[data-kopf-info]")?.textContent.trim());
console.log("     Info:", info);
ok(info === "🧩 Teil A + Teil B · 5 Vokabeln", "Info-Zeile: Teile + Anzahl");
const sl = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
ok(sl.verlauf.length === 1 && sl.verlauf[0].multi?.map(t => t.name).join("+") === "Teil A+Teil B", "genau ein Verlauf-Eintrag mit den Teilen");
ok(await page.evaluate(() => [...document.querySelectorAll(".slot-chip")].some(c => c.textContent.includes("🧩"))), "Verlauf-Chip mit 🧩");
ok(await page.evaluate(() => document.querySelector("[data-reihenfolge]")?.textContent.trim()) === "Nach Listen-Platz", "Reihenfolge von Teil A übernommen");

// Speichern: Name-Vorschlag „Multiquiz: Teil A + Teil B“
await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").click()); await sleep(300);
await langDruck("[data-slot-kopf-name]");
await page.evaluate(() => document.querySelector('[data-info-aktion="💾 Speichern"]').click()); await sleep(300);
const vorschlag = await page.evaluate(() => document.querySelector(".modal input.inp")?.value);
ok(vorschlag === "Multiquiz: Teil A + Teil B", `Namensvorschlag (${vorschlag})`);
await page.evaluate(() => [...document.querySelectorAll(".modal .btn-primary")].pop()?.click()); await sleep(400);
const sl2 = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const g = sl2.gespeichert.find(x => x.name === "Multiquiz: Teil A + Teil B");
ok(g && g.multi?.length === 2 && g.konfiguration.vokabelAuswahl.length === 5, "gespeichert: mit Teilen und allen 5 Vokabeln");
await oeffneKopf(); await sleep(300);
ok(await page.evaluate(id => document.querySelector(`[data-slot-id="${id}"] .raster-name`)?.textContent.includes("🧩"), g?.id), "Kachel des gespeicherten Multiquiz mit 🧩");

// Statistik: gemeinsame Statistik
await clickText(".tab", "Statistik"); await sleep(400);
const t = await page.evaluate(() => document.body.innerText);
ok(/GESAMT\s*\n?\s*5/i.test(t), "Statistik: Multiquiz zusammen (5 Vokabeln)");
ok(!(await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].length)), "kein Menü offen");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
