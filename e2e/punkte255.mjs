import puppeteer from "puppeteer-core";
import { zuListen, menueShim } from "./hilfen.mjs";

// 255: Fortschritt „x/Gesamt“ – Gesamt richtet sich nach den Schaltern (Gelernte, heute); Start-Knopf = Gesamt − Fortschritt
// 256: Schalter „Lückenlos anzeigen“ – Kacheln in Lesereihenfolge ohne Lücken (nur Anzeige), eigene Anordnung bleibt
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const menue = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...__aktionen()].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear(); localStorage.setItem("vokabel_test_alte_ansicht", "1");
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const jetzt = new Date().toISOString(), gestern = new Date(Date.now() - 86400000).toISOString();
  // 10 Vokabeln: 0–1 gelernt (Stufe 2, nicht fällig), 2–4 heute schon abgefragt, 5–9 offen
  const f = i => i < 2 ? { score: 4, streak: 0, aufgedecktStreak: 0, letzteAbfrage: gestern, stufeSeit: gestern }
    : i < 5 ? { score: 1, streak: 0, aufgedecktStreak: 0, letzteAbfrage: jetzt } : undefined;
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 11,
    vokabeln: Array.from({length:10},(_, i) => ({ id: i+1, E1: { wert: "w"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] }, ...(f(i) ? { fortschritt: f(i) } : {}) })) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
  const k = { listenIds:["l_a"], vokabelAuswahl: [], bereichTyp:"alle", quizBereichTyp:"alle",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  // Quiz-Raster mit Lücken: A (0|0), B (3|0), C (1|1)
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[], gespeichert: [["A",0,0],["B",3,0],["C",1,1]].map(([n, z, s], i) =>
    ({ id:"s"+n, name:"Teil "+n, timestamp:i, konfiguration:k, sessionFortschritt:null, platz:{z, s} })) }));
});
await page.reload(); await sleep(800); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);

// ── 256: Lückenlos anzeigen ──
const lage = () => page.evaluate(() => Object.fromEntries(["sA","sB","sC"].map(id => { const r = document.querySelector(`[data-slot-id="${id}"]`)?.getBoundingClientRect(); return [id, r ? [Math.round(r.top), Math.round(r.left)] : null]; })));
const vorher = await lage();
ok(vorher.sB[0] > vorher.sC[0] && vorher.sC[0] > vorher.sA[0], `eigene Anordnung mit Lücken (${JSON.stringify(vorher)})`);
await kontext("[data-freier-platz]");
let m = await menue();
ok(m.includes("⇅ Anordnen (Frei)…"), `256/359: Anordnen im Menü der Ebene zeigt „Frei“ (${m.join(" | ")})`);
await aktion("⇅ Anordnen (Frei)…"); await page.evaluate(() => document.querySelector('[data-anordnen="name"]')?.click()); await sleep(300);   // 359: automatisch = nach Name
await page.mouse.click(5, 300); await sleep(300);
let nachher = await lage();
// 291/292: gewählte Spaltenzahl (hier 1) gilt – spaltenweise A (0|0), B (3|0), C (1|1) untereinander
ok(nachher.sA[1] === nachher.sC[1] && nachher.sC[1] === nachher.sB[1] && nachher.sA[0] < nachher.sB[0] && nachher.sB[0] < nachher.sC[0],
  `256/291/292: automatisch, 1 Spalte gewählt: A, B, C untereinander (${JSON.stringify(nachher)})`);
// 291: 2 Spalten gewählt → A, C | B
await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}"); e.ebenenSpalten = { ...(e.ebenenSpalten || {}), slot: 2 }; localStorage.setItem("vokabel_einstellungen", JSON.stringify(e)); });
await page.reload(); await sleep(800); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);
nachher = await lage();
ok(nachher.sA[0] === nachher.sC[0] && nachher.sC[1] > nachher.sA[1] && nachher.sB[0] > nachher.sA[0] && nachher.sB[1] === nachher.sA[1] && nachher.sB[0] < vorher.sB[0],
  `256/291/292: automatisch, 2 Spalten gewählt: A, B in Spalte 1, C in Spalte 2 (${JSON.stringify(nachher)})`);
// 292: „Anordnen…“ wirkt auch in der automatischen Anordnung – mit der gewählten Spaltenzahl (2), spaltenweise
await kontext("[data-freier-platz]");
await aktion("⇅ Anordnen (Name)…");
await page.evaluate(() => document.querySelector('[data-anordnen="name"]')?.click()); await sleep(400);
const plaetzeN = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.map(g => `${g.id}:${g.platz.z}|${g.platz.s}`).sort().join(","));
const lageN = await lage();   // 359: automatisch nach Name – nur die Anzeige, die eigenen Plätze bleiben
ok(plaetzeN === "sA:0|0,sB:3|0,sC:1|1" && lageN.sA[0] === lageN.sC[0] && lageN.sB[1] === lageN.sA[1] && lageN.sB[0] > lageN.sA[0],
  `292: Anordnen nach Name in 2 Spalten: A, B | C (${plaetzeN}, ${JSON.stringify(lageN)})`);
// zurück auf die Ausgangsplätze (für die folgenden Prüfungen)
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("vokabel_slots")); const p = { sA: {z:0,s:0}, sB: {z:3,s:0}, sC: {z:1,s:1} }; d.gespeichert.forEach(g => g.platz = p[g.id]); localStorage.setItem("vokabel_slots", JSON.stringify(d)); });
await page.reload(); await sleep(800); await page.evaluate(() => { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); }); await sleep(300);   // 289: Start mit Listen-Auswahl → Quiz
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
const plaetze = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.map(g => `${g.id}:${g.platz.z}|${g.platz.s}`).join(","));
ok(plaetze === "sA:0|0,sB:3|0,sC:1|1", `256: gespeicherte Plätze unverändert (${plaetze})`);
await kontext("[data-freier-platz]");
m = await menue();
ok(m.includes("⇅ Anordnen (Name)…"), "256/359: Menü zeigt die automatische Anordnung „Name“");
await aktion("⇅ Anordnen (Name)…"); await page.evaluate(() => document.querySelector('[data-anordnen="frei"]')?.click()); await sleep(300);
await page.mouse.click(5, 300); await sleep(300);
ok(JSON.stringify(await lage()) === JSON.stringify(vorher), "256: eigene Anordnung wieder da");

// ── 255: Fortschritt-Gesamt nach den Schaltern ──
await page.evaluate(() => document.querySelector('[data-slot-id="sA"]').click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-slot-laden]")?.click()); await sleep(900);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(500);
const stand = () => page.evaluate(() => ({ fort: (document.querySelector("[data-start-titel]")?.textContent.trim() || "").split(" ")[0], titel: document.querySelector("[data-start-titel]")?.textContent,
  knopf: document.querySelector("[data-start-knopf]")?.dataset.startRest ?? document.querySelector("[data-start-knopf]")?.dataset.startAnzahl }));
let s = await stand();
ok(s.fort === "0/5" && s.knopf === "5" && /5 Vokabeln/.test(s.titel), `255: ohne Gelernte und ohne heute: 0/5, Knopf 5 (${JSON.stringify(s)})`);
await page.evaluate(() => document.querySelector("[data-heute]")?.click()); await sleep(300);
s = await stand();
ok(s.fort === "0/8" && s.knopf === "8", `255: + heute: 0/8, Knopf 8 (${JSON.stringify(s)})`);
await page.evaluate(() => document.querySelector("[data-heute]")?.click()); await sleep(200);
await page.evaluate(() => document.querySelector("[data-gelernte]")?.click()); await sleep(300);
s = await stand();
ok(s.fort === "0/7" && s.knopf === "7", `255: nur + Gelernte: 0/7, Knopf 7 (${JSON.stringify(s)})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
