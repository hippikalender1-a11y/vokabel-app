import puppeteer from "puppeteer-core";
import { menueShim, zuListen } from "./hilfen.mjs";

// 267: Fällige (Langzeit-Wiederholung) – Schalter „🔁 Fällige“ (Standard: an, alle Listen der Sprache, 25 % zusätzlich
// zu den neuen), lang drücken: Herkunft + Anteil; Fällige anderer Listen werden abgefragt und dort gespeichert;
// „🔁 Nur Fällige“; Diktat ohne Fällige; „✗ Negative abfragen“ im Menü
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.evaluateOnNewDocument(() => { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const s = window.speechSynthesis; s.getVoices = () => []; s.speak = () => {}; s.cancel = () => {}; });
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const alt = "2026-01-01T10:00:00.000Z";
await page.goto(URL);
await page.evaluate(alt => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Fremd",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: alt, stufeSeit: alt });
  const liste = (id, name, sprache, w) => localStorage.setItem(`vokabel_liste_${id}`, JSON.stringify({ id, name, sprache, spalten: sp, naechste_id: w.length + 1,
    vokabeln: w.map(([e, d, sc], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(sc === undefined ? {} : { fortschritt: f(sc) }) })) }));
  // Unit 1 (Quiz): 8 neue, 2 fällige, 1 negative; Unit 2 (en): 3 fällige; Unité (fr): 2 fällige (andere Sprache)
  liste("l_a", "Unit 1", "en", [...Array.from({ length: 8 }, (_, i) => [`a${i}`, `A-Neu${i}`]), ["af1", "A-Fällig1", 3], ["af2", "A-Fällig2", 3], ["an", "A-Negativ", -2]]);
  liste("l_b", "Unit 2", "en", [["b1", "B-Fällig1", 3], ["b2", "B-Fällig2", 3], ["b3", "B-Fällig3", 4], ["bn", "B-Negativ", -2]]);
  liste("l_c", "Unité", "fr", [["c1", "C-Fällig1", 3], ["c2", "C-Fällig2", 3]]);
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} },
    { id:"l_c", name:"Unité", sprache:"fr", platz:{z:2,s:0} }]));
  const k = { listenIds:["l_a"], vokabelAuswahl: [], bereichTyp:"alle", quizBereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[], gespeichert: [{ id:"sA", name:"Teil A", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
}, alt);
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
const ladeQuiz = async () => {
  await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
  await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
  await page.evaluate(() => document.querySelector('[data-slot-id="sA"]').click()); await sleep(900);
};
await ladeQuiz();
const stand = () => page.evaluate(() => ({ knopf: __txt(document.querySelector("[data-faellig]")), an: document.querySelector("[data-faellig]")?.dataset.faellig,
  modus: document.querySelector("[data-faellig]")?.dataset.faelligModus, titel: __txt(document.querySelector("[data-start-titel]")),
  start: __txt(document.querySelector("[data-start-knopf] span")), nurF: document.querySelector("[data-nur-faellige]")?.dataset.nurFaellige || null }));

// ── Standard: an, alle Listen der Sprache (A 2 + B 3 = 5 fällig; fr nicht), 25 % von 9 neuen (8 + die negative) = 2 ──
let s = await stand();
ok(s.an === "an" && s.modus === "sprache" && s.knopf === "+ 🔁 2" && /Quiz mit 9 Vokabeln \+ 🔁 2/.test(s.titel), `Standard: Fällige an, alle der Sprache, 9 neue + 🔁 2 (${JSON.stringify(s)})`);

// ── lang drücken: Herkunft und Anteil ──
const lang = async () => { await page.evaluate(() => { const el = document.querySelector("[data-faellig]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 5 })); }); await sleep(400); };
await lang();
const menue = await page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
ok(menue.includes("◉ Alle Engl") && menue.includes("○ Nur dieses Quiz") && !!(await page.$("[data-info-regler]")), `Lang drücken: Herkunft + Regler Anteil (${menue.join(" | ")})`);
await page.evaluate(() => { const i = document.querySelector("[data-info-regler] input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "100"); i.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(300);
await page.mouse.click(5, 400); await sleep(300);
s = await stand();
ok(s.knopf === "+ 🔁 5", `Anteil 100 %: alle 5 Fälligen der Sprache (${s.knopf})`);
await lang();
await page.evaluate(() => __aktion("○ Nur dieses Quiz").click()); await sleep(300);
s = await stand();
ok(s.modus === "quiz" && s.knopf === "+ 🔁 2", `Nur dieses Quiz: 2 Fällige (${JSON.stringify(s)})`);
await lang();
await page.evaluate(() => __aktion("○ Alle Engl").click()); await sleep(300);
await page.evaluate(() => document.querySelector("[data-faellig]").click()); await sleep(200);
s = await stand();
ok(s.knopf === "🔁 5" && /^9 Vokabeln$/.test(s.start), `antippen: Fällige aus – nur die 9 neuen; Knopf zeigt weiter „🔁 5“ (273) (${JSON.stringify(s)})`);
ok(await page.evaluate(() => { const b = document.querySelector("[data-faellig]"), c = getComputedStyle(b); return c.backgroundColor !== c.color && !b.classList.contains("an"); }), "273: ausgeschaltet invertiert (Klasse ohne „an“)");
// 272: lang drücken zeigt die Fälligen je Sprache (Engl 5 hervorgehoben, Frz 0)
await lang();
const jeSprache = await page.evaluate(() => [...document.querySelectorAll("[data-faellig-sprache]")].map(x => `${x.dataset.faelligSprache}:${x.dataset.n}:${x.style.fontWeight || ""}`).join(","));
ok(/en:5:800/.test(jeSprache) && /fr:2:$/.test(jeSprache), `272: Info „Jetzt fällig“ je Sprache – Engl hervorgehoben (${jeSprache})`);
await page.mouse.click(5, 400); await sleep(300);
// 271: Fortschritt zweizeilig – Fällige in eigener Zeile
await page.evaluate(() => document.querySelector("[data-faellig]").click()); await sleep(200);
const zw = await page.evaluate(() => { const b = document.querySelector("[data-anzahl='faellig']"); const f = b?.closest(".start-fortschritt"); return f ? getComputedStyle(f).flexDirection : null; });
ok(zw === "column" || zw === null, `271: Fortschritt-Kachel zweizeilig (${zw})`);
await page.evaluate(() => document.querySelector("[data-faellig]").click()); await sleep(200);
await page.evaluate(() => document.querySelector("[data-faellig]").click()); await sleep(200);

// ── Runde: alle Abfragen (9 neue + 5 fällige, Fällige anderer Listen werden in ihrer Liste gespeichert) ──
s = await stand();
ok(/9 Vokabeln \+ 🔁 5/.test(s.start), `Start-Knopf: 9 Vokabeln + 🔁 5 (${s.start})`);
await page.evaluate(() => document.querySelector("[data-start-knopf]").click()); await sleep(800);
const gefragt = [];
for (let i = 0; i < 20; i++) {
  const f = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
  if (!f) break;
  gefragt.push(f);
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(150);
  await page.evaluate(() => [...document.querySelectorAll(".karte-btn-ja")].find(b => /Gewusst/.test(b.textContent))?.click()); await sleep(1300);
}
console.log("      gefragt:", gefragt.join(", "));
const neue = gefragt.filter(x => /A-Neu|A-Negativ/.test(x)).length, fae = gefragt.filter(x => /Fällig/.test(x));
ok(neue === 9 && fae.length === 5 && fae.filter(x => /^B-/.test(x)).length === 3 && !gefragt.some(x => /^C-/.test(x)), `Runde: 9 neue + 5 Fällige (3 aus Unit 2), keine französischen (${neue} + ${fae.length})`);
const posF = gefragt.map((x, i) => /Fällig/.test(x) ? i : null).filter(x => x !== null);
console.log("      Plätze der Fälligen:", posF.join(","));
const b = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_b")).vokabeln.map(v => v.fortschritt.score));
ok(b.join(",") === "4,4,5,-2", `Scores der Fälligen aus Unit 2 in Unit 2 gespeichert (${b.join(",")})`);

// ── 268: Auswertung – nach dem Paket knapp (Zahlen, „davon 🔁 5 Fällige“), am Ende Balken + Langzeit-Block ──
const paket = await page.evaluate(() => ({ zahlen: document.querySelector("[data-ergebnis-zahlen]")?.dataset.ergebnisZahlen, faellig: document.querySelector("[data-ergebnis-faellig]")?.dataset.ergebnisFaellig,
  kreis: !!document.querySelector("svg[data-ergebniskreis]") }));
ok(paket.zahlen === "14|0" && paket.faellig === "5" && !paket.kreis, `268: Paket-Ergebnis knapp: ✓ 14 · ✗ 0, davon 🔁 5 Fällige (${JSON.stringify(paket)})`);
await page.evaluate(() => document.querySelector("[data-zur-auswertung]")?.click()); await sleep(600);
const ausw = await page.evaluate(() => ({ balken: [...document.querySelectorAll("[data-ausw-balken]")].map(b => `${b.dataset.auswBalken}:${b.dataset.vorher}→${b.dataset.nachher}`).join(","),
  lang: document.querySelector("[data-ausw-langzeit]")?.dataset.auswLangzeit, weiter: document.querySelector('[data-ausw-faellig="weiter"] b')?.textContent,
  zusatz: document.querySelector("[data-zusatzdaten]")?.innerText.replace(/\s+/g, " ") }));
ok(ausw.balken === "negativ:1→0,arbeit:0→9,gelernt:0→0" && ausw.lang === "5" && ausw.weiter === "5",
  `268: Quiz-Auswertung – Balken vorher→nachher, „🔁 Langzeit trainiert · 5“, 5 ◆ weiter (${JSON.stringify(ausw)})`);
ok(/Ø Score/.test(ausw.zusatz) && /Verbessert/.test(ausw.zusatz) && /Auf Anhieb gewusst/.test(ausw.zusatz) && /Dauer/.test(ausw.zusatz) && /Paket/.test(ausw.zusatz), "268: Zusatzdaten bleiben (Ø Score, verbessert …, auf Anhieb, Dauer, Pakete)");

// ── Diktat: kein Fällige-Knopf ──
for (let i = 0; i < 3 && await page.$(".topbar-back"); i++) { await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Zur Übersicht|Weiter/.test(x.textContent))?.click()); await sleep(300); }
await page.evaluate(() => document.querySelector('[data-quiz-art="diktat"]')?.click()); await sleep(400);
ok(!(await page.$("[data-faellig]")), "Diktat: kein Fällige-Knopf");
await page.evaluate(() => document.querySelector('[data-quiz-art="uebersetzung"]')?.click()); await sleep(400);

// ── Nur Fällige: Quiz ohne neue Vokabeln ──
await page.evaluate(alt => { const l = JSON.parse(localStorage.getItem("vokabel_liste_l_c")); l.vokabeln.forEach(v => { v.fortschritt = { score: 3, streak: 0, aufgedecktStreak: 0, letzteAbfrage: alt, stufeSeit: alt }; });
  localStorage.setItem("vokabel_liste_l_c", JSON.stringify(l)); }, alt);
await zuListen(page);
await page.evaluate(() => document.querySelector('[data-liste-id="l_c"]').click()); await sleep(900);
await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(500);
s = await stand();
ok(s.nurF === "2", `Unité: keine neuen, 2 fällig – Knopf „🔁 Nur Fällige“ (${JSON.stringify(s)})`);
await page.evaluate(() => document.querySelector("[data-nur-faellige]").click()); await sleep(800);
const nf = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
ok(/^C-Fällig/.test(nf || ""), `Nur Fällige: Abfrage startet mit einer Fälligen (${nf})`);
for (let i = 0; i < 3 && await page.$(".topbar-back"); i++) { await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(x => /Zur Übersicht|Weiter/.test(x.textContent))?.click()); await sleep(300); }

// ── 290: Menü der Ebene „Alle Quiz“ ohne „✗ Negative abfragen“ (früher 267) ──
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);
await page.evaluate(() => { const el = document.querySelector("[data-alle-sessions]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 5 })); }); await sleep(400);
const lm = await page.evaluate(() => [...__aktionen()].map(x => x.dataset.infoAktion));
ok(!lm.some(x => /Negative abfragen|Fällige wiederholen/.test(x)), `290: Menü „Alle Quiz“ ohne „✗ Negative abfragen“ / „🔁 Fällige wiederholen“ – das machen die Schalter (${lm.join(" | ")})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
