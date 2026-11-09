import puppeteer from "puppeteer-core";
import { zuListen, neueEineSession } from "./hilfen.mjs";

// Vokabel-Suche: Einzelauswahl (Quiz + Statistik), Aufteilen (🔍 bei Von/Bis), Listenansicht.
// Nur Fremdsprache + Deutsch, „enthält“, Groß/klein + Akzente egal, Wortanfang zuerst; springen ‹ › oder „nur Treffer“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tippe = async (sel, text) => {
  await page.evaluate((sel, text) => { const i = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, text); i.dispatchEvent(new Event("input", { bubbles: true })); }, sel, text);
  await sleep(500);
};
const klickText = async (sel, text) => { const ok = await page.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === text); el?.click(); return !!el; }, sel, text); await sleep(400); return ok; };
const anzahl = art => page.evaluate(a => document.querySelector(`[data-suchleiste="${a}"] [data-such-anzahl]`)?.dataset.suchAnzahl ?? null, art);
const zaehler = art => page.evaluate(a => document.querySelector(`[data-suchleiste="${a}"] [data-such-anzahl]`)?.textContent ?? null, art);
// aktueller Treffer: Zeile mit kräftigem Rahmen; sichtbar im Fenster?
const aktuell = art => page.evaluate(a => {
  const z = [...document.querySelectorAll(`[data-such-ziel="${a}"]`)].find(e => /outline:/.test(e.getAttribute("style") || ""));
  if (!z) return null;
  const r = z.getBoundingClientRect();
  return { text: z.textContent, sichtbar: r.top >= 0 && r.bottom <= innerHeight };
}, art);
const zeilen = art => page.evaluate(a => document.querySelectorAll(`[data-such-ziel="${a}"]`).length, art);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch",i1:"Info"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const besonders = { 12: ["la maison", "das Haus"], 45: ["l'école", "die Schule"], 50: ["la petite maison", "das kleine Haus"], 70: ["le chat", "die Katze"] };
  const vokabeln = Array.from({ length: 80 }, (_, i) => {
    const n = i + 1, [e, d] = besonders[n] || [`mot${n}`, `Wort${n}`];
    return { id: n, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, i1: { wert: n === 3 ? "maison de campagne" : "", falsch: [] } };
  });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 81, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(800);

// ── Neue Session: „Neues Quiz · nicht gespeichert“, Listen-Auswahl ohne Liste: Hinweis statt Knopf ──
await neueEineSession(page);
const kopf = await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf-name]"); return { text: k.textContent, ng: !!k.querySelector("[data-nicht-gespeichert]") }; });
ok(/^Neues Quiz/.test(kopf.text) && kopf.ng, `Kopf: „Neues Quiz“ + „nicht gespeichert“ (${kopf.text})`);
const rechts = () => page.evaluate(() => { const h = document.querySelector(".liste-detail-header"); return { hinweis: h.querySelector("[data-listen-hinweis]")?.textContent ?? null, knopf: h.querySelector(".zeile-rechts")?.textContent ?? null }; });
let re = await rechts();
ok(re.hinweis === "Liste auswählen" && re.knopf === null && await page.$(".quiz-setup-check"), `ohne Liste: rechts nur Hinweis, kein Knopf, Listen offen (${JSON.stringify(re)})`);
await page.evaluate(() => document.querySelector("[data-listen-hinweis]").click()); await sleep(300);
ok(await page.$(".quiz-setup-check") && !/Bitte Liste auswählen/.test(await page.evaluate(() => document.body.innerText)), "Hinweis antippen schließt nichts");
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(400);
re = await rechts();
ok(re.knopf === "Unité 1" && re.hinweis === null, `Liste gewählt: Knopf mit dem Namen (${JSON.stringify(re)})`);
await page.evaluate(() => document.querySelector(".liste-detail-header .zeile-rechts").click()); await sleep(400);
ok(!(await page.$(".quiz-setup-check")), "Knopf antippen klappt die Listen-Auswahl zu");
await klickText(".toggle-opt", "Bereich"); await sleep(400);
// ── Lang-Druck auf eine Vokabel startet Von–Bis ──
const cdp = await page.createCDPSession();
const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const tafel = () => page.evaluate(() => { const t = document.querySelector("[data-auswahl-tafel]"); return t ? [...t.querySelectorAll("button")].map(b => b.textContent).join(" | ") : null; });
const sichtbar = sel => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.offsetParent !== null; }, sel);
const feld = art => page.evaluate(a => document.querySelector(`[data-suchleiste="${a}"] [data-such-feld]`).value, art);
const zeile = (art, nr) => `[data-such-ziel="${art}"][data-such-id="${nr}"], [data-such-ziel="${art}"][data-such-id$="__${nr}"]`;
const gelb = (art, nr) => page.evaluate(s => /→/.test(document.querySelector(s)?.textContent || ""), zeile(art, nr));
const auswahlText = () => page.evaluate(() => document.querySelector('[data-anzahl="auswahl"]')?.textContent);
const tipp = (art, nr) => page.evaluate(s => document.querySelector(s).click(), zeile(art, nr)).then(() => sleep(400));

// ── Bereich: Liste maximiert ──
ok(!(await sichtbar("[data-slot-kopf]")) && !(await sichtbar(".liste-detail-header")) && !(await page.$("[data-start-knopf]")) && !(await page.$(".quiz-zeile")),
  "Bereich offen: Session-Leiste, Listen-Auswahl, Optionen und Start ausgeblendet");
ok(await sichtbar('[data-suchleiste="quiz"]') && await zeilen("quiz") === 80, "nur „Alle | Bereich“, Suche und die Liste sind da");
ok(!(await sichtbar(".topbar")) && !(await sichtbar(".tab")), "auch Kopfzeile „Vokabel-Trainer“ und Tabs ausgeblendet");
// nur die Liste scrollt: Zeile „Alle | Bereich“ und Suche bleiben stehen
const lage = () => page.evaluate(() => ({ zeile: Math.round(document.querySelector(".toggle-opt.aktiv").getBoundingClientRect().top), suche: Math.round(document.querySelector('[data-suchleiste="quiz"]').getBoundingClientRect().top), sy: scrollY }));
const l0 = await lage();
await page.evaluate(() => document.querySelector("[data-vok-scroller]").scrollBy(0, 900)); await sleep(300);
const l1 = await lage();
ok(await page.$("[data-vok-scroller]") && l0.zeile === l1.zeile && l0.suche === l1.suche && l1.sy === 0, `Liste scrollt allein, „Alle | Bereich“ und Suche bleiben stehen (${JSON.stringify(l0)} → ${JSON.stringify(l1)})`);
await page.evaluate(() => document.querySelector("[data-vok-scroller]").scrollTo(0, 0)); await sleep(300);
const fs = await page.evaluate(() => getComputedStyle(document.querySelector('[data-suchleiste="quiz"] [data-such-feld]')).fontSize);
ok(fs === "16px", `Suchfeld auf Touch-Geräten 16 px (kein iOS-Zoom beim Antippen) (${fs})`);
// langer Druck mit Toleranz: kleine Bewegung bricht nicht ab, große schon
let rr = await page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + 200, y: b.y + b.height / 2 }; }, zeile("quiz", 3));
await finger("touchStart", rr.x, rr.y); await sleep(150); await finger("touchMove", rr.x + 6, rr.y + 4); await sleep(700); await finger("touchEnd"); await sleep(400);
ok(await gelb("quiz", 3), "langer Druck auf dem Text mit 6 px Zittern: Von–Bis-Anfang");
await page.evaluate(() => document.querySelector('[data-info-aktion="✕ Von–Bis abbrechen"]').click()); await sleep(400);
await finger("touchStart", rr.x, rr.y); await sleep(150); await finger("touchMove", rr.x + 25, rr.y); await sleep(700); await finger("touchEnd"); await sleep(400);
ok(!(await gelb("quiz", 3)) && !(await tafel()), "25 px Bewegung bricht den langen Druck ab");
// Häkchen setzen schließt die Tastatur der Suche
await page.focus('[data-suchleiste="quiz"] [data-such-feld]');
await tipp("quiz", 4);
ok(await page.evaluate(() => !document.activeElement?.matches("[data-such-feld]")), "Häkchen setzen: Suchfeld verliert den Fokus (Tastatur zu)");
await tipp("quiz", 4);

await tippe('[data-suchleiste="quiz"] [data-such-feld]', "mot5"); await sleep(400);
let r = await page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + 80, y: b.y + b.height / 2 }; }, zeile("quiz", 5));
await finger("touchStart", r.x, r.y); await sleep(800); await finger("touchEnd"); await sleep(500);
ok(await gelb("quiz", 5), "Lang-Druck auf Nr. 5: ist Anfang (→)");
const t = await tafel();
ok(t === "✕ Von–Bis abbrechen | 🎨 Farbe ändern" && !(await page.$("[data-info-blase]")), `Tafel unten nur mit Knöpfen, ohne Erklärtext (${t})`);
ok(await feld("quiz") === "", "Anfang gesetzt: Suchfeld geleert (für die Suche nach dem Ende)");
ok(await page.evaluate(() => document.querySelectorAll('[data-such-ziel="quiz"] .checkbox.checked').length) === 1, "Loslassen wählt nichts aus (nur der Anfang ist markiert)");
// Suche bleibt bedienbar, Ende über die Suche finden
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "chat");
ok(await anzahl("quiz") === "1" && await tafel(), "Suche während Von–Bis: Treffer, Tafel bleibt");
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
ok(await zeilen("quiz") === 1 && await tafel(), "„nur Treffer“ geht während Von–Bis");
await tipp("quiz", 70);
ok(/\(66 V\.\)/.test(await auswahlText() || ""), `Ende Nr. 70 antippen: Bereich 5–70 gewählt (${await auswahlText()})`);
ok(!(await tafel()) && !(await page.$("[data-info-blase]")), "Tafel nach dem Ende zu");
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
await page.click('[data-suchleiste="quiz"] [data-such-leeren]'); await sleep(300);
// Zeile im Blick: „nur Treffer“, Anfang auf Nr. 70 → Liste wieder ganz, Nr. 70 bleibt sichtbar (über der Tafel)
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "chat");
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
await page.evaluate(s => { const el = document.querySelector(s); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("quiz", 70)); await sleep(1300);
const blick = await page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); const t = document.querySelector("[data-auswahl-tafel]").getBoundingClientRect();
  const l = document.querySelector('[data-suchleiste="quiz"]').getBoundingClientRect(); return { oben: Math.round(b.top), unten: Math.round(b.bottom), leiste: Math.round(l.bottom), tafel: Math.round(t.top) }; }, zeile("quiz", 70));
ok(await zeilen("quiz") === 80 && blick.oben >= blick.leiste && blick.unten <= blick.tafel, `Anfang Nr. 70: Liste wieder ganz, Zeile zwischen Suche und Tafel sichtbar (${JSON.stringify(blick)})`);
await page.evaluate(() => document.querySelector('[data-info-aktion="✕ Von–Bis abbrechen"]').click()); await sleep(400);
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
// Abbrechen über die Tafel
await page.evaluate(s => { const el = document.querySelector(s); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("quiz", 2)); await sleep(400);
ok(await gelb("quiz", 2) && await tafel(), "Rechtsklick (= Lang-Druck) auf Nr. 2: Anfang");
await page.evaluate(() => document.querySelector('[data-info-aktion="✕ Von–Bis abbrechen"]').click()); await sleep(400);
ok(!(await gelb("quiz", 2)) && !(await tafel()) && /\(66 V\.\)/.test(await auswahlText() || ""), "✕ Von–Bis abbrechen: Anfang weg, Auswahl unverändert");
// Antippen außerhalb wird verschluckt, Tippen auf die Tafel bricht ab
await page.evaluate(s => { const el = document.querySelector(s); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("quiz", 3)); await sleep(400);
await klickText(".btn", "…Bis");
ok(!(await gelb("quiz", 3)) && !(await tafel()), "„…Bis“-Knopf oben beendet Von–Bis, Tafel zu");
// Bereich antippen schließt die Liste, die Session-Optionen sind wieder da
await klickText(".toggle-opt", "Bereich"); await sleep(400);
ok(!(await page.$('[data-suchleiste="quiz"]')) && await page.$("[data-start-knopf]") && await sichtbar("[data-slot-kopf]") && await sichtbar(".liste-detail-header"),
  "„Bereich“ antippen: Liste zu, Session-Leiste, Listen-Auswahl und Start wieder sichtbar");

// ── Statistik ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /Statistik/.test(t.textContent)).click()); await sleep(500);
if (!(await page.$('[data-suchleiste="statistik"]'))) { await klickText(".toggle-opt", "Bereich"); await sleep(400); }
const statZahl = () => page.evaluate(() => document.querySelectorAll('[data-such-ziel="statistik"] .checkbox.checked').length);
const vorher = await statZahl();
await page.evaluate(s => { const el = document.querySelector(s); el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, zeile("statistik", 1)); await sleep(500);
ok(await gelb("statistik", 1) && /Von–Bis abbrechen/.test(await tafel() || ""), "Statistik: Lang-Druck auf Nr. 1 ist Anfang");
await tipp("statistik", 4);
ok(await statZahl() - vorher === 4 && !(await tafel()), `Statistik: Ende Nr. 4 → 4 Vokabeln dazu, Tafel zu (${vorher} → ${await statZahl()})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
