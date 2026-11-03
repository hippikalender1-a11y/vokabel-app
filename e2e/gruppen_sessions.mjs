import puppeteer from "puppeteer-core";

// Session-Gruppen (Ordner): „📁 In Gruppe…“ (neu / vorhanden), Gruppen-Kachel öffnet die Gruppe („← Alle Sessions“),
// „↑ Aus der Gruppe“, Gruppe umbenennen / auflösen, Multiquiz der Gruppe, Aufteilen legt eine Gruppe an
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
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kacheln = () => page.evaluate(() => [...document.querySelectorAll(".raster-chip")].map(b => b.querySelector(".raster-name").textContent.trim()));
const langDruck = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(250);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const aktion = async p => { await page.evaluate(p => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion.startsWith(p)).click(), p); await sleep(300); };
const kachel = name => `[data-slot-id="${name}"]`;

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 41,
    vokabeln: Array.from({length:40},(_, i) => ({ id: i+1, E1: { wert: "mot"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"s1", name:"Teil 1", timestamp:1, konfiguration:k(1, 10), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"s2", name:"Teil 2", timestamp:2, konfiguration:k(11, 20), sessionFortschritt:null, platz:{z:1,s:0} },
    { id:"s3", name:"Teil 3", timestamp:3, konfiguration:k(21, 30), sessionFortschritt:null, platz:{z:2,s:0} } ] }));
});
await page.reload(); await sleep(600);

// Neue Gruppe aus Teil 1
await langDruck(kachel("s1"));
ok((await menue()).includes("📁 In Gruppe…"), "Session-Menü: „📁 In Gruppe…“");
await aktion("📁 In Gruppe…");
ok(await page.$("[data-in-gruppe-dialog]"), "Dialog „In Gruppe“");
await page.type("[data-ordner-name-feld]", "Kapitel A");
await page.click("[data-ordner-neu]"); await sleep(400);
let d = await slots();
const ordner = d.ordner?.[0];
ok(ordner?.name === "Kapitel A" && d.gespeichert.find(x => x.id === "s1").ordner === ordner.id, "Gruppe „Kapitel A“ angelegt, Teil 1 darin");
ok(ordner.platz?.z === 0 && ordner.platz?.s === 0, "Gruppe nimmt den Platz von Teil 1 ein");
let k = await kacheln();
ok(k.some(t => t.startsWith("📁 Kapitel A")) && !k.includes("Teil 1") && k.includes("Teil 2"), `oberste Ebene: Gruppe statt Teil 1 (${k.join(" | ")})`);

// Auswahl-Modus: Teil 2 + Teil 3 in die vorhandene Gruppe
await langDruck(kachel("s2")); await aktion("☑ Auswählen");
await page.click(kachel("s3")); await sleep(200);
await langDruck(kachel("s3"));
ok((await menue()).some(m => m.startsWith("📁 In Gruppe… (2)")), "Auswahl-Menü: „📁 In Gruppe… (2)“");
await aktion("📁 In Gruppe…");
await page.click(`[data-in-gruppe="${ordner.id}"]`); await sleep(400);
d = await slots();
ok(["s1", "s2", "s3"].every(id => d.gespeichert.find(x => x.id === id).ordner === ordner.id), "alle drei Teile in „Kapitel A“");
ok(await page.evaluate(() => document.querySelector("[data-ordner-anzahl]")?.dataset.ordnerAnzahl) === "3", "Gruppen-Kachel zeigt 3");

// Öffnen, Laden, zurück
await page.click(`[data-ordner-id="${ordner.id}"]`); await sleep(300);
ok(await page.$("[data-ordner-zurueck]") && /Kapitel A/.test(await page.evaluate(() => document.querySelector("[data-ordner-pfad]").textContent)), "Gruppe geöffnet: „← Alle Sessions › 📁 Kapitel A“");
k = await kacheln();
ok(k.join("|") === "Teil 1|Teil 2|Teil 3", `in der Gruppe: Teil 1–3 (${k.join(" | ")})`);
await page.click(kachel("s2")); await sleep(900);
ok(await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").textContent.trim()) === "Teil 2", "Session aus der Gruppe geladen");
await page.click("[data-slot-kopf-name]"); await sleep(300);
ok(await page.$("[data-ordner-zurueck]"), "Auswahl wieder offen: noch in der Gruppe");
// Aus der Gruppe nehmen
await langDruck(kachel("s3")); await aktion("↑ Aus der Gruppe");
d = await slots();
ok(!d.gespeichert.find(x => x.id === "s3").ordner, "Teil 3 aus der Gruppe genommen");
await page.click("[data-ordner-zurueck]"); await sleep(300);
k = await kacheln();
ok(k.includes("Teil 3") && k.some(t => t.startsWith("📁 Kapitel A")), `oberste Ebene: Gruppe + Teil 3 (${k.join(" | ")})`);
// Session auf die Gruppen-Kachel ziehen und 1,2 s halten → in die Gruppe
await langDruck(kachel("s3")); await aktion("⇄ Verschieben");
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
const p1 = await page.evaluate(() => { const r = document.querySelector('[data-slot-id="s3"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const p2 = await page.evaluate(id => { const r = document.querySelector(`[data-ordner-id="${id}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, ordner.id);
await page.mouse.move(p1.x, p1.y); await page.mouse.down(); await page.mouse.move(p1.x + 20, p1.y + 20, { steps: 3 }); await page.mouse.move(p2.x, p2.y, { steps: 6 }); await sleep(2800); await page.mouse.up(); await sleep(400);
d = await slots();
ok(d.gespeichert.find(x => x.id === "s3").ordner === ordner.id, "Session auf die Gruppen-Kachel gezogen → in der Gruppe");
await page.evaluate(() => [...document.querySelectorAll(".typ-btn.aktiv")].find(b => b.textContent.trim() === "Fertig")?.click()); await sleep(200);

// Gruppen-Menü: Multiquiz, Umbenennen, Auflösen
await langDruck(`[data-ordner-id="${ordner.id}"]`);
const m = await menue();
console.log("     Gruppen-Menü:", m.join(" | "));
ok(m.includes("📂 Öffnen") && m.some(x => x.startsWith("🧩 Multiquiz der Gruppe (")) && m.includes("✎ Umbenennen") && m.includes("📤 Gruppe auflösen"), "Gruppen-Menü: Öffnen, Multiquiz, Umbenennen, Auflösen");
await aktion("✎ Umbenennen");
await page.evaluate(() => { const i = document.querySelector("[data-ordner-name-feld]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "Kapitel B"); i.dispatchEvent(new Event("input", { bubbles: true })); });
await page.click("[data-ordner-umbenennen-ok]"); await sleep(300);
ok((await slots()).ordner[0].name === "Kapitel B", "umbenannt: „Kapitel B“");
await langDruck(`[data-ordner-id="${ordner.id}"]`); await aktion("🧩 Multiquiz der Gruppe");
ok(await page.$(".quiz-frage-text"), "Multiquiz der Gruppe gestartet");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Beenden")?.click()); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht/.test(b.textContent))?.click()); await sleep(400);
if (await page.evaluate(() => document.querySelector("[data-quiz-ansicht]")?.dataset.quizAnsicht !== "auswahl")) { await page.click("[data-slot-kopf-name]"); await sleep(300); }
if (await page.$("[data-ordner-zurueck]")) { await page.click("[data-ordner-zurueck]"); await sleep(300); }
await langDruck(`[data-ordner-id="${ordner.id}"]`); await aktion("📤 Gruppe auflösen");
d = await slots();
ok((d.ordner || []).length === 0 && d.gespeichert.every(x => !x.ordner), "aufgelöst: keine Gruppe mehr, alle Sessions oben");
k = await kacheln();
ok(["Teil 1", "Teil 2", "Teil 3"].every(n => k.includes(n)), `oberste Ebene: alle drei Teile (${k.join(" | ")})`);

// Aufteilen legt gleich eine Gruppe an
await page.click("[data-neue-session]"); await sleep(300);
await page.click('[data-neue-session-art="mehrere"]'); await sleep(300);
await page.click('[data-aufteilen-liste="l_a"]'); await sleep(500);
ok(await page.evaluate(() => document.querySelector("[data-aufteilen-gruppe]")?.checked), "Aufteilen: „In Gruppe zusammenfassen“ ist angehakt");
await page.click("[data-aufteilen-anlegen]"); await sleep(500);
d = await slots();
const g2 = d.ordner?.find(o => o.name === "Unité 1");
ok(g2 && d.gespeichert.filter(x => x.ordner === g2.id).length === 2, "Aufteilen: Gruppe „Unité 1“ mit 2 Sessions");
ok(await page.$("[data-ordner-zurueck]"), "danach ist die neue Gruppe geöffnet");

// Statistik-Tab zeigt die Gruppen ebenfalls
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Statistik")).click()); await sleep(400);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf] button.toggle-opt.aktiv, [data-slot-kopf-name]")?.click(); }); await sleep(300);
if (await page.$("[data-ordner-zurueck]")) { await page.click("[data-ordner-zurueck]"); await sleep(300); }
ok(await page.$(`[data-ordner-id="${g2.id}"]`), "Statistik-Tab: Gruppen-Kachel vorhanden");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
