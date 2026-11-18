import puppeteer from "puppeteer-core";
import { zuListen, menueShim, neueEineSession, listenZu, bereichZu, listeOeffnen, listeBereich, listeWaehlen } from "./hilfen.mjs";

// 260: Satz finden – mehrteilige Lösung: alle Teile antippen (Reihenfolge egal)
// 261: Menü der Ebene – Spalten, Anordnen, Lückenlos unter „🖼 Ansicht ›“
// 262: Lang drücken auf eine Liste – „🎯 Quiz mit Auswahl…“ (Quiz-Tab, Bereich, Vokabelliste offen)
// 263: Listen ganz eckig (auch Auswahlrahmen, Kopf beim Listen-Paket), Quiz abgerundet
// 264: Sprach-Kürzel im Verlauf-Namen („Engl · …“)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.evaluateOnNewDocument(() => {
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const s = window.speechSynthesis; s.getVoices = () => []; s.speak = () => {}; s.cancel = () => {};
});
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mitte = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const halte = async (sel, ms = 450) => { const p = await mitte(sel); await sleep(150); await finger("touchStart", p.x, p.y); await sleep(ms); await finger("touchEnd"); await sleep(450); };
const ecke = sel => page.evaluate(sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).borderTopLeftRadius : null; }, sel);
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots") || "{}"));
const setze = async (sel, wert) => page.evaluate((sel, wert) => { const el = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, wert); el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, wert);

await page.goto(URL);
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise(r => { const d = indexedDB.deleteDatabase("vokabel_saetze"); d.onsuccess = d.onerror = d.onblocked = () => r(); });
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name, w) => ({ id, name, sprache:"en", spalten: sp, naechste_id: w.length + 1,
    vokabeln: w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unit 1", [["exciting – more exciting – the most exciting", "spannend – spannender – am spannendsten"]])));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unit 2", [["dog", "Hund"], ["cat", "Katze"], ["house", "Haus"]])));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
  const k = { listenIds:["l_b"], vokabelAuswahl: [], bereichTyp:"alle", quizBereichTyp:"alle",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[], gespeichert: [{ id:"sA", name:"Teil A", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
});
await page.reload(); await sleep(800);

// ── 263: Formen – Quiz-Kachel abgerundet, Listen-Kachel ganz eckig ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
const quizEcke = await ecke('[data-slot-id="sA"]');
ok(quizEcke && parseFloat(quizEcke) >= 6, `263: Quiz-Kachel abgerundet (${quizEcke})`);
await zuListen(page);
ok(await ecke('[data-liste-id="l_a"]') === "0px", `263: Listen-Kachel ganz eckig (${await ecke('[data-liste-id="l_a"]')})`);

// ── 261: Menü der Ebene – „🖼 Ansicht ›“ mit Spalten, Anordnen, Lückenlos ──
await page.evaluate(() => { const el = document.querySelector("[data-freier-platz]"); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }); await sleep(350);
let m = await menue();
ok(m.includes("🖼 Ansicht ›") && !m.includes("⇅ Anordnen…") && !m.some(x => x.startsWith("▥ Spalten")) && !m.includes("▤ Automatische Anordnung"), `261: Hauptebene mit „🖼 Ansicht ›“ statt der drei Punkte (${m.join(" | ")})`);
await page.evaluate(() => document.querySelector('[data-info-aktion="🖼 Ansicht ›"]')?.click()); await sleep(250);
m = await menue();
ok(m.join("|") === "‹ zurück|▥ Spalten (1)|⇅ Anordnen…|▤ Automatische Anordnung", `261: Ansicht – ${m.join(" | ")}`);
await page.evaluate(() => document.querySelector('[data-info-aktion="▤ Automatische Anordnung"]')?.click()); await sleep(300);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen") || "{}").lueckenlos) === true, "261: „Lückenlos anzeigen“ aus dem Untermenü schaltet um");
await page.mouse.click(5, 300); await sleep(300);

// ── 263: Auswahlrahmen eckig, Kopf eckig ── / ── 262: Quiz mit Auswahl ──
await halte('[data-liste-id="l_b"]');
const gew = await page.evaluate(() => { const el = document.querySelector('[data-liste-id="l_b"]'); return { gew: el.classList.contains("kachel-gewaehlt"), ecke: getComputedStyle(el).borderTopLeftRadius,
  nr: getComputedStyle(el.querySelector(".auswahl-nr")).borderTopLeftRadius, kopf: document.querySelector("[data-slot-kopf-name]").classList.contains("eckig") }; });
ok(gew.gew && gew.ecke === "0px" && gew.nr === "0px" && gew.kopf, `263: ausgewählte Liste – Rahmen und Nummer eckig, Kopf eckig (${JSON.stringify(gew)})`);
m = await page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
ok(m.includes("🎯 Quiz mit Auswahl…"), "262: „🎯 Quiz mit Auswahl…“ im Menü der Liste (unter Lernen)");
await page.evaluate(() => __aktion("🎯 Quiz mit Auswahl…").click()); await sleep(900);
const qa = await page.evaluate(() => ({ tab: document.querySelector(".tab.aktiv")?.textContent.trim(), bestaetigen: !!document.querySelector("[data-vok-bestaetigen]"),
  zeilen: document.querySelectorAll('.vok-zeile[data-such-ziel="quiz"]').length, wahl: !!document.querySelector("[data-wahl-fertig]") }));
ok(/Quiz/.test(qa.tab) && qa.bestaetigen && qa.zeilen === 3 && !qa.wahl, `262: Quiz-Tab, Vokabelliste von „Unit 2“ offen zum Auswählen (${JSON.stringify(qa)})`);
await page.click('.vok-zeile[data-such-id="l_b__2"]'); await sleep(200);
await page.click("[data-vok-bestaetigen]"); await sleep(400);
const anz = await page.evaluate(() => document.querySelector('[data-anzahl="auswahl"]')?.textContent);
ok(anz === "(1 V.)", `262: eine Vokabel ausgewählt – Quiz mit 1 Vokabel (${anz})`);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const fr = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
ok(fr === "Katze", `262: abgefragt wird nur die gewählte Vokabel (${fr})`);

// ── 264: Verlauf-Eintrag mit Sprach-Kürzel ──
const v0 = (await slots()).verlauf?.[0]?.name || "";
ok(/^Engl · \d\d\.\d\d\.\d\d, \d\d:\d\d$/.test(v0), `264: Verlauf-Name mit Sprach-Kürzel („${v0}“)`);
await page.evaluate(() => document.querySelector("[data-quiz-pause]")?.click()); await sleep(600);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(700);

// ── 263: Kopf beim Listen-Paket eckig, beim gespeicherten Quiz abgerundet ──
await zuListen(page);
await halte('[data-liste-id="l_a"]'); await halte('[data-liste-id="l_b"]');
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(800);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(500);
const kopfP = await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf-name]"); return { text: k.innerText, eckig: k.classList.contains("eckig"), ecke: getComputedStyle(k).borderTopLeftRadius }; });
ok(/📋 Engl · 2 Listen/.test(kopfP.text) && kopfP.eckig && kopfP.ecke === "0px", `263/264: Listen-Paket – Kopf „📋 Engl · 2 Listen“, eckig (${JSON.stringify(kopfP)})`);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
await page.evaluate(() => document.querySelector('[data-slot-id="sA"]').click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-slot-laden]")?.click()); await sleep(900);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(500);
const kopfQ = await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf-name]"); return { text: k.innerText, eckig: k.classList.contains("eckig"), ecke: getComputedStyle(k).borderTopLeftRadius }; });
ok(/Teil A/.test(kopfQ.text) && !kopfQ.eckig && parseFloat(kopfQ.ecke) >= 6, `263: gespeichertes Quiz – Kopf abgerundet (${JSON.stringify(kopfQ)})`);

// ── 260: Satz finden mit mehrteiliger Lösung ──
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(600); await listeOeffnen(page);
await listeBereich(page, "saetze");
await page.click("[data-saetze-ergaenzen]"); await sleep(400);
await setze("[data-satz-antwort]", "1 // That was the *most exciting* day of my life. // Das war der spannendste Tag meines Lebens.");
await page.click("[data-satz-uebernehmen]"); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "Schließen")?.click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(400);
await neueEineSession(page);
await listeWaehlen(page, "Unit 1"); await sleep(300);
await listenZu(page);
await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
await page.evaluate(() => document.querySelector('[data-modus-knopf="E1:satzfinden"]')?.click()); await sleep(200);
await page.evaluate(() => document.querySelector('[data-modus-knopf="E1:karte"].aktiv')?.click()); await sleep(200);
await bereichZu(page);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const ziele = await page.evaluate(() => [...document.querySelectorAll("[data-satz-ziel]")].map(b => b.textContent));
ok(ziele.join(" ") === "the most exciting", `260: Ziel = „the most exciting“ (markiert „most exciting“ + „the“ aus der Lösung) – ${ziele.join(" ")}`);
const wortNr = w => page.evaluate(w => [...document.querySelectorAll("[data-satz-wort]")].find(b => b.textContent === w)?.dataset.satzWort, w);
const score = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln[0].fortschritt?.score ?? null);
await page.click(`[data-satz-wort="${await wortNr("most")}"]`); await sleep(250);
const zw = await page.evaluate(() => ({ gew: [...document.querySelectorAll(".satz-wort.gewaehlt")].map(b => b.textContent).join(" "), noch: !!document.querySelector("[data-satzfinden]"), falsch: /Nicht richtig/.test(document.body.innerText) }));
ok(zw.gew === "most" && zw.noch && !zw.falsch && await score() === null, `260: „most“ angetippt – markiert, noch keine Wertung (${JSON.stringify(zw)})`);
await page.click(`[data-satz-wort="${await wortNr("exciting")}"]`); await sleep(150);
await page.click(`[data-satz-wort="${await wortNr("the")}"]`); await sleep(500);
ok(await score() === 1, `260: alle drei Teile (beliebige Reihenfolge) – richtig, Score 1 (${await score()})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
