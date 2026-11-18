import puppeteer from "puppeteer-core";
import { zuListen, menueShim } from "./hilfen.mjs";

// 266: Mehrfach-Auswahl und Ordnerpfad – Antippen eines Pfad-Elements beendet die Auswahl und öffnet ggf. den Ordner;
// der aktuelle Ordner beendet nur die Auswahl (danach öffnet Antippen sofort); lang drücken: Menü wie sonst
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mitte = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const halte = async (sel, ms = 450) => { const p = await mitte(sel); await sleep(150); await finger("touchStart", p.x, p.y); await sleep(ms); await finger("touchEnd"); await sleep(450); };
const tippe = async sel => { const p = await mitte(sel); await page.touchscreen.tap(p.x, p.y); await sleep(450); };
const stand = () => page.evaluate(() => ({ nr: [...document.querySelectorAll("[data-multi-nr], [data-wahl-nr]")].length, tafel: !!document.querySelector("[data-auswahl-tafel]"),
  pfad: [...document.querySelectorAll("[data-ordner-pfad] button")].map(b => b.textContent.trim()).join(" › "), laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null }));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  for (const id of ["l_a", "l_b"]) localStorage.setItem(`vokabel_liste_${id}`, JSON.stringify({ id, name: id === "l_a" ? "Unit 1" : "Unit 2", sprache:"en", spalten: sp, naechste_id: 2, vokabeln:[{ id:1, E1:{wert:"dog",falsch:[]}, D1:{wert:"Hund",falsch:[]} }] }));
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id:"lo1", name:"Buch", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", ordner:"lo1", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
  const k = id => ({ listenIds:[id], vokabelAuswahl: [], bereichTyp:"alle", quizBereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[{ id:"o1", name:"Schule", platz:{z:0,s:0} }], gespeichert: [
    { id:"sA", name:"Teil A", timestamp:1, konfiguration:k("l_a"), sessionFortschritt:null, ordner:"o1", platz:{z:0,s:0} },
    { id:"sB", name:"Teil B", timestamp:2, konfiguration:k("l_b"), sessionFortschritt:null, platz:{z:1,s:0} }] }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400);
await page.evaluate(() => { const b = document.querySelector("[data-auswahl-umschalter]"); if (b && b.dataset.auswahlUmschalter !== "quiz") b.click(); }); await sleep(300);

// ── Quiz: im Ordner auswählen, dann „← Alle Quiz“ ──
await tippe('[data-ordner-id="o1"]');
let s = await stand();
ok(/Schule/.test(s.pfad), `im Ordner „Schule“ (${s.pfad})`);
await halte('[data-slot-id="sA"]');
s = await stand();
ok(s.nr === 1 && s.tafel, `Mehrfach-Auswahl gestartet (${JSON.stringify(s)})`);
await page.evaluate(() => document.querySelector("[data-ordner-zurueck]").click()); await sleep(400);
s = await stand();
ok(s.nr === 0 && !s.tafel && /^Alle Quiz/.test(s.pfad), `„← Alle Quiz“: Auswahl beendet, oberste Ebene offen (${JSON.stringify(s)})`);

// ── aktueller Ordner: beendet nur die Auswahl, danach öffnet Antippen sofort ──
await halte('[data-slot-id="sB"]');
ok((await stand()).nr === 1, "Auswahl auf der obersten Ebene");
// lang drücken auf den Pfad: Menü wie sonst
await page.evaluate(() => { const el = document.querySelector("[data-pfad-hier]"); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 5 })); }); await sleep(400);
const menue = await page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
ok(menue.includes("＋ Neues Quiz aus Listen"), `lang drücken auf den Pfad: Menü der Ebene (${menue.join(" | ")})`);
await page.mouse.click(5, 300); await sleep(300);
if ((await stand()).nr === 0) await halte('[data-slot-id="sB"]');
await page.evaluate(() => document.querySelector("[data-pfad-hier]").click()); await sleep(400);
s = await stand();
ok(s.nr === 0 && !s.tafel && /^Alle Quiz/.test(s.pfad), `aktueller Ordner angetippt: Auswahl beendet, Ebene bleibt (${JSON.stringify(s)})`);
await page.evaluate(() => document.querySelector('[data-slot-id="sB"]').click()); await sleep(600);
const kopf = await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText || "");
ok(/Teil B/.test(kopf), `danach öffnet Antippen sofort das Quiz („${kopf.replace(/\s+/g, " ")}“)`);

// ── Listen: im Ordner auswählen, Pfad „← Alle Listen“ ──
await zuListen(page);
await tippe('[data-lordner-id="lo1"]');
ok(/Buch/.test((await stand()).pfad), `Listen-Ordner „Buch“ offen (${(await stand()).pfad})`);
await halte('[data-liste-id="l_a"]');
ok((await stand()).nr === 1, "Listen-Auswahl gestartet");
await page.evaluate(() => document.querySelector("[data-ordner-zurueck]").click()); await sleep(400);
s = await stand();
ok(s.nr === 0 && !s.tafel && /^Alle Listen/.test(s.pfad), `Listen: „← Alle Listen“ beendet die Auswahl und öffnet die Ebene (${JSON.stringify(s)})`);

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
