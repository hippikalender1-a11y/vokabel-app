import puppeteer from "puppeteer-core";
import { zuListen, auswahlEnde, menueShim } from "./hilfen.mjs";

// 244–250: Paket bleibt Paket nach dem Start/Pausieren, „Pausieren“, Vorschau beim Ziehen, Ebenen-Menüs (Pfad, freier Platz), Kopf „📋 n Listen“, zurück in die Listen-Auswahl
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(menueShim);
await page.evaluateOnNewDocument(menueShim);
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mitte = sel => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const halte = async (sel, ms) => { const p = await mitte(sel); await sleep(150); await finger("touchStart", p.x, p.y); await sleep(ms); await finger("touchEnd"); await sleep(450); };
const kontext = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(350);
};
const menue = () => page.evaluate(() => [...__aktionen()].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...__aktionen()].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const ordnerAnlegen = async name => {
  await page.evaluate(n => { const f = document.querySelector("[data-in-gruppe-dialog] [data-ordner-name-feld]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
  await page.evaluate(() => document.querySelector("[data-ordner-neu]")?.click()); await sleep(400);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim(),
  laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null, multi: [...document.querySelectorAll("[data-multi-nr]")].sort((a, b) => a.dataset.multiNr - b.dataset.multiNr).map(b => b.dataset.slotId).join(",") }));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); { const u = document.querySelector('[data-auswahl-umschalter="listen"]'), n = document.querySelector("[data-slot-kopf-name]"); if (u && n && /Liste oder Quiz wählen/.test(n.textContent)) u.click(); } }); await sleep(400); };

await page.goto(URL);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 11,
    vokabeln: Array.from({length:10},(_, i) => ({ id: i+1, E1: { wert: id+"w"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  ["l_a","l_b","l_c"].forEach((id, i) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify(liste(id, "Unit " + (i + 1)))));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} },
    { id:"l_c", name:"Unit 3", sprache:"en", ordner:"lo1", platz:{z:0,s:0} }]));
  localStorage.setItem("vokabel_listen_ordner", JSON.stringify([{ id:"lo1", name:"Kiste", platz:{z:2,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[{ id:"o1", name:"Mappe", platz:{z:3,s:0} }], gespeichert: [1, 2, 3, 4].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 2 - 1, i * 2), sessionFortschritt:null, ...(i === 4 ? { ordner:"o1", platz:{z:0,s:0} } : { platz:{z:i - 1,s:0} }) })) }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();
await page.evaluate(() => { window._vib = []; navigator.vibrate = m => { window._vib.push(JSON.stringify(m)); return true; }; });
const kopfText = () => page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText.replace(/\s+/g, " ").trim());
const seite = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const einstellungenAuf = async () => { await page.evaluate(() => { if (document.querySelector('[data-quiz-ansicht="auswahl"]')) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(500); };
const startePausiere = async () => {
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /starten/.test(b.textContent))?.click()); await sleep(800);
  const knopf = await page.evaluate(() => document.querySelector("[data-quiz-pause]")?.textContent.trim());
  await page.evaluate(() => document.querySelector("[data-quiz-pause]")?.click()); await sleep(800);
  return knopf;
};

// ── 244/245: Multiquiz starten, pausieren – bleibt ein Paket ohne Listen-/Bereichsauswahl ──
await halte('[data-slot-id="s1"]', 450); await halte('[data-slot-id="s2"]', 450);
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(700);
await einstellungenAuf();
ok(/Multiquiz/.test(await kopfText()), `Multiquiz geladen (${await kopfText()})`);
const knopf = await startePausiere();
ok(knopf === "Pausieren", `245: Knopf im Quiz „Pausieren“ (${knopf})`);
await einstellungenAuf();
let t = await seite();
ok(/Multiquiz/.test(await kopfText()) && !/Listen-Auswahl/.test(t) && !/Vokabel-Auswahl/.test(t), `244: nach dem Pausieren weiter Multiquiz, keine Listen-/Vokabel-Auswahl (${await kopfText()})`);
const v = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).verlauf);
ok(v.length === 1 && v[0].multi, `244: kein zusätzlicher Verlaufseintrag (${v.length})`);

// ── 249/250/244: zwei Listen übernehmen → „📋 2 Listen“, nach dem Start weiter Paket, Kopf führt zu den Listen ──
await zuListen(page);
await halte('[data-liste-id="l_a"]', 450); await halte('[data-liste-id="l_b"]', 450);
await page.evaluate(() => document.querySelector("[data-wahl-fertig]")?.click()); await sleep(700);
await einstellungenAuf();
ok(/📋 Engl · 2 Listen/.test(await kopfText()), `249: Kopf „📋 2 Listen“ (${await kopfText()})`);
await startePausiere();
await einstellungenAuf();
t = await seite();
ok(/📋 Engl · 2 Listen/.test(await kopfText()) && !/Listen-Auswahl/.test(t), `244: Listen-Paket nach dem Start weiter ohne Listen-Auswahl (${await kopfText()})`);
await page.evaluate(() => document.querySelector("[data-slot-kopf-name]").click()); await sleep(600);
ok(await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]")?.dataset.auswahlUmschalter) === "listen", "250: Kopf antippen öffnet die Listen-Auswahl");
ok(/2 Listen ausgewählt/.test(await seite()) && await page.evaluate(() => [...document.querySelectorAll("[data-wahl-nr]")].map(e => e.closest("[data-liste-id]")?.dataset.listeId + e.dataset.wahlNr).sort().join()) === "l_a1,l_b2",
  "251: Kopf antippen – die Listen des Pakets sind wieder ausgewählt (Info: 2 Listen ausgewählt)");

// ── 247: freier Platz = Menü der Ebene; 248: Ordner darüber im Pfad nur Fällige + Gelernte ──
await page.evaluate(() => document.querySelector("[data-auswahl-umschalter]").click()); await sleep(500);   // zu den Quiz
await kontext('[data-freier-platz]');
let m = await menue();
ok(m.includes("＋ Neues Quiz aus Listen") && m.includes("📁 Neuer Ordner") && m.some(x => x.startsWith("▥ Spalten")) && m.includes("⇅ Anordnen…") && m.some(x => /Gelernte/.test(x)) && !m.some(x => /[Ff]ällig/.test(x)),   // 290: ohne Fällige
  `247: freier Platz – Menü der Ebene (${m.join(" | ")})`);
await page.keyboard.press("Escape"); await page.mouse.click(5, 300); await sleep(300);
await page.evaluate(() => document.querySelector('[data-slot-id="o1"]').click()); await sleep(500);   // in die Mappe
await kontext("[data-alle-sessions]");
m = await menue();
ok(m.length === 1 && m.some(x => /Gelernte/.test(x)), `248/290: „← Alle Quiz“ im Ordner – nur Gelernte (${m.join(" | ")})`);
await page.mouse.click(5, 300); await sleep(300);
await kontext("[data-pfad-hier]");
m = await menue();
ok(m.includes("＋ Neues Quiz aus Listen") && m.includes("⇅ Anordnen…"), `248: aktueller Ordner im Pfad – volles Menü (${m.join(" | ")})`);
await page.mouse.click(5, 300); await sleep(300);
await page.evaluate(() => document.querySelector("[data-alle-sessions]").click()); await sleep(500);

// ── 246: Vorschau beim Ziehen – Abbild folgt dem Finger, wer rücken würde, rutscht ein Stück ──
const a = await mitte('[data-slot-id="s3"]'), b = await mitte('[data-slot-id="s1"]');
await finger("touchStart", a.x, a.y); await sleep(1300);
for (let i = 1; i <= 8; i++) { await finger("touchMove", a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8); await sleep(40); }
await sleep(200);
const geist = await page.evaluate(() => { const g = document.querySelector("[data-zug-geist]"); if (!g) return null; const r = g.getBoundingClientRect(); return { y: Math.round(r.top + r.height / 2) }; });
ok(geist && Math.abs(geist.y - b.y) < 40, `246: Abbild folgt dem Finger (${JSON.stringify(geist)} / Finger ${Math.round(b.y)})`);
const rueckt = await page.evaluate(() => [...document.querySelectorAll("[data-rueckt]")].map(e => e.dataset.slotId).sort().join(","));
ok(rueckt === "s1,s2", `246: Teil 1 und 2 würden rücken – vorab markiert (${rueckt})`);
await finger("touchEnd"); await sleep(600);
ok(!(await page.$("[data-zug-geist]")) && !(await page.$("[data-rueckt]")), "246: nach dem Ablegen kein Abbild, keine Markierung");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
