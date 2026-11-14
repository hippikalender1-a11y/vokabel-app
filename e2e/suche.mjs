import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { zuListen, neueEineSession, listenZu, listeBereich } from "./hilfen.mjs";

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

// ── Quiz: Einzelauswahl ──
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(400);
await listenZu(page);   // Listen-Auswahl zu → Quiz-Optionen sichtbar
await klickText(".toggle-opt", "Bereich"); await sleep(400);
ok(await page.$('[data-suchleiste="quiz"]'), "Quiz-Einzelauswahl: Suchleiste vorhanden");
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "MAISON");
ok(await anzahl("quiz") === "2", `„MAISON“: 2 Treffer (nicht in der Info-Spalte) (${await anzahl("quiz")})`);
let a = await aktuell("quiz");
ok(a && /la maison/.test(a.text) && !/petite/.test(a.text) && a.sichtbar, `erster Treffer „la maison“ angesprungen und sichtbar (${a?.text})`);
await page.click('[data-suchleiste="quiz"] [data-such-weiter]'); await sleep(700);
a = await aktuell("quiz");
ok(a && /la petite maison/.test(a.text) && a.sichtbar && await zaehler("quiz") === "2/2", `› : „la petite maison“ (2/2) (${a?.text})`);
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "ecole");
a = await aktuell("quiz");
ok(await anzahl("quiz") === "1" && /école/.test(a?.text || ""), "„ecole“ findet „l'école“ (Akzente egal)");
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "haus");
ok(await anzahl("quiz") === "2" && /das Haus/.test((await aktuell("quiz"))?.text || ""), "Suche auch in Deutsch: „haus“ → Haus, kleine Haus (Wortanfang zuerst)");
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "ort7");
const ort = await page.evaluate(() => [...document.querySelectorAll('[data-such-ziel="quiz"]')].find(e => /outline:/.test(e.getAttribute("style") || ""))?.textContent);
ok(await anzahl("quiz") === "10" && /Wort7\b/.test(ort || ""), `„enthält“: „ort7“ trifft Wort7, Wort71… (${await anzahl("quiz")})`);
// Von–Bis mit Suche und „nur Treffer“
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "maison");
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
ok(await zeilen("quiz") === 2, `„nur Treffer“: nur 2 Zeilen (${await zeilen("quiz")})`);
await klickText(".btn", "Von–Bis");
await page.evaluate(() => [...document.querySelectorAll('[data-such-ziel="quiz"]')].find(e => /la maison/.test(e.textContent) && !/petite/.test(e.textContent)).click()); await sleep(200);
await page.evaluate(() => [...document.querySelectorAll('[data-such-ziel="quiz"]')].find(e => /petite/.test(e.textContent)).click()); await sleep(300);
const auswahl = await page.evaluate(() => document.querySelector('[data-anzahl="auswahl"]')?.textContent);
ok(/\(39 V\.\)/.test(auswahl || ""), `Von–Bis über die Treffer wählt den ganzen Bereich 12–50 (${auswahl})`);
await page.click('[data-suchleiste="quiz"] [data-nur-treffer]'); await sleep(300);
ok(await zeilen("quiz") === 80, "„nur Treffer“ aus: wieder alle 80");
// 151: Sprung zu den gewählten Stücken – ein Stück (12–50) dazu ein zweites (Nr. 70) anhaken
await page.evaluate(() => [...document.querySelectorAll('[data-such-ziel="quiz"]')][69].click()); await sleep(900);   // Zeile bleibt erst im Blick
ok(await page.evaluate(() => document.querySelector("[data-auswahl-sprung]")?.dataset.auswahlSprung) === "1/2", "151: Sprung-Knopf „⇣ 1/2“ (zwei Stücke)");
await page.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => document.querySelectorAll("[data-vok-scroller]").forEach(s => s.scrollTop = 0));
await page.click("[data-auswahl-sprung]"); await sleep(700);
const sichtbarNr = nr => page.evaluate(n => { const e = [...document.querySelectorAll('[data-such-ziel="quiz"]')][n - 1]; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, nr);
ok(await sichtbarNr(12) && await page.evaluate(() => document.querySelector("[data-auswahl-sprung]").dataset.auswahlSprung) === "2/2", "Sprung: Anfang Stück 1 (Nr. 12) im Blick, Knopf zeigt jetzt 2/2");
await page.click("[data-auswahl-sprung]"); await sleep(700);
ok(await sichtbarNr(70), "nochmal: Stück 2 (Nr. 70) im Blick");
await page.evaluate(() => [...document.querySelectorAll('[data-such-ziel="quiz"]')][69].click()); await sleep(200);
ok(await page.evaluate(() => document.querySelector('[data-suchleiste="quiz"] [data-such-feld]').value) === "", "Von–Bis: Anfang gesetzt leert das Suchfeld");
await tippe('[data-suchleiste="quiz"] [data-such-feld]', "maison");
await page.click('[data-suchleiste="quiz"] [data-such-leeren]'); await sleep(300);
ok(await page.evaluate(() => document.querySelector('[data-suchleiste="quiz"] [data-such-feld]').value) === "" && !(await aktuell("quiz")), "✕ leert die Suche");

// ── Statistik: Einzelauswahl ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /Statistik/.test(t.textContent)).click()); await sleep(500);
if (!(await page.$('[data-suchleiste="statistik"]'))) { await klickText(".toggle-opt", "Bereich"); await sleep(400); }
ok(await page.$('[data-suchleiste="statistik"]'), "Statistik-Einzelauswahl: Suchleiste vorhanden");
await tippe('[data-suchleiste="statistik"] [data-such-feld]', "chat"); await sleep(1000);   // weiches Scrollen über eine weite Strecke
a = await aktuell("statistik");
ok(await anzahl("statistik") === "1" && /le chat/.test(a?.text || "") && a.sichtbar, `Statistik: „chat“ → „le chat“ angesprungen (${a?.text})`);

// ── Aufteilen: 🔍 bei Von und Bis ──
await zuListen(page);
await page.evaluate(() => { const el = document.querySelector('[data-liste-id="l_a"]'); const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 20 })); }); await sleep(300);
await page.evaluate(() => document.querySelector('[data-info-aktion="▦ In mehrere Quiz aufteilen"]').click()); await sleep(600);
ok(await page.$("[data-aufteilen]"), "Aufteilen-Kasten offen");
await page.click('[data-aufteilen-suche="von"]'); await sleep(300);
await tippe('[data-aufteilen-suchfeld="von"] [data-such-feld]', "maison");
const tr = await page.evaluate(() => [...document.querySelectorAll("[data-aufteilen-treffer]")].map(e => e.dataset.aufteilenTreffer).join(","));
ok(tr === "12,50", `Aufteilen-Suche: Treffer Nr. 12, 50 (${tr})`);
await page.click('[data-aufteilen-treffer="12"]'); await sleep(300);
ok(await page.evaluate(() => document.querySelector("[data-aufteilen-von]").value) === "12" && !(await page.$("[data-aufteilen-suchfeld]")), "Treffer antippen: Von = 12, Suche zu");
await page.click('[data-aufteilen-suche="bis"]'); await sleep(300);
await tippe('[data-aufteilen-suchfeld="bis"] [data-such-feld]', "katze");
await page.click('[data-aufteilen-treffer="70"]'); await sleep(300);
ok(await page.evaluate(() => document.querySelector("[data-aufteilen-bis]").value) === "70", "Bis = 70 über die Suche „katze“");
const woerter = await page.evaluate(() => [document.querySelector('[data-aufteilen-wort="von"]').textContent, document.querySelector('[data-aufteilen-wort="bis"]').textContent]);
ok(/Nr\. 12 · la maison – das Haus/.test(woerter[0]) && /Nr\. 70 · le chat – die Katze/.test(woerter[1]), `Anfang und Ende als Wort (${woerter.join(" | ")})`);
await page.click("[data-aufteilen-abbrechen]"); await sleep(300);

// ── Listenansicht ──
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(500); await listeOeffnen(page);
await listeBereich(page, "vokabeln");
ok(await page.$('[data-suchleiste="liste"]'), "Listenansicht: Suchleiste über den Vokabeln");
await tippe('[data-suchleiste="liste"] [data-such-feld]', "schule");
a = await aktuell("liste");
ok(await anzahl("liste") === "1" && /l'école/.test(a?.text || "") && a.sichtbar, `Listenansicht: „schule“ → „l'école“ angesprungen (${a?.text?.slice(0, 40)})`);
await page.click('[data-suchleiste="liste"] [data-nur-treffer]'); await sleep(300);
ok(await zeilen("liste") === 1, "Listenansicht: „nur Treffer“ zeigt nur die eine Vokabel");
const kleb = await page.evaluate(() => { window.scrollTo(0, 99999); return new Promise(r => setTimeout(() => r(document.querySelector('[data-suchleiste="liste"]').getBoundingClientRect().top), 300)); });
console.log("     Suchleiste oben bei", Math.round(kleb));

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
