import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { zuListen, listeBereich, neueEineSession } from "./hilfen.mjs";

// Tabs Statistik | Quiz | Einstellungen; geöffnete Liste: Kopf = Namens-Knopf (antippen zurück, lang drücken Menü) mit Info-Zeile;
// Bereiche als Knopfzeile (Fremdsprache · Beispielsätze · Spalten · Vokabeln), immer nur einer offen; Vokabeln mit „Gelernte“ und ＋ in der Zeile;
// „↑“ nach weitem Scrollen; Mehrfach-Auswahl: gewählte Kachel und „☑ n ausgewählt“ leuchten kurz
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sichtbar = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null; }, sel);
const langDruck = sel => page.evaluate(s => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 10 })); }, sel);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], gelerntSchwelle: 2, sprache: "alle" }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vok = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, E1: { wert: `word${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] }, ...(i < 3 ? { fortschritt: { score: 3 } } : {}) }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 61, vokabeln: vok(60) }));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify({ id:"l_b", name:"Unit 2", sprache:"en", spalten: sp, naechste_id: 5, vokabeln: vok(4) }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
});
await page.reload(); await sleep(700);

// ── 75: Tab-Reihenfolge ──
const tabs = await page.evaluate(() => [...document.querySelectorAll(".tab")].map(t => t.textContent.trim()).join("|"));
ok(tabs === "Statistik|Quiz|Einstellungen", `Tabs: ${tabs}`);
ok(await page.evaluate(() => document.querySelector(".tab.aktiv")?.textContent.trim()) === "Quiz", "Start im Quiz");

// ── 76: Kopf ──
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(500); await listeOeffnen(page);
const kopf = await page.evaluate(() => ({ name: document.querySelector("[data-liste-kopf-name]")?.textContent, info: document.querySelector("[data-liste-kopf-info]")?.textContent,
  stift: !!document.querySelector(".liste-detail-header .btn-ghost-filled"), pfeil: !!document.querySelector(".liste-detail-header .btn-icon") }));
ok(kopf.name === "Unit 1" && /Englisch · 60 Vokabeln/.test(kopf.info) && !kopf.stift && !kopf.pfeil, `Kopf: Namens-Knopf mit Info-Zeile, ohne Pfeil und Stift (${JSON.stringify(kopf)})`);
await langDruck("[data-liste-kopf-name]"); await sleep(300);
const menue = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
ok(menue.includes("✎ Umbenennen") && menue.includes("⇲ Zusammenführen"), `lang drücken: Menü mit Umbenennen und Zusammenführen (${menue.length} Einträge)`);
await page.keyboard.press("Escape"); await page.mouse.click(5, 400); await sleep(200);

// ── 77: Knopfzeile ──
const zeile = await page.evaluate(() => [...document.querySelectorAll("[data-listen-zeile] .quiz-zeile-zelle")].map(z => `${z.querySelector(".quiz-zeile-label").textContent}=${z.querySelector("button").textContent}`).join(" | "));
ok(zeile === "Fremdsprache=🇬🇧 Englisch | Beispielsätze=💬 0/60 | Spalten=2 | Vokabeln=60", `Knopfzeile (${zeile})`);
ok(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Quiz starten")), "nichts offen: „Quiz starten“ sichtbar");
const breiteZu = await page.evaluate(() => [...document.querySelectorAll("[data-liste-bereich]")].map(b => Math.round(b.getBoundingClientRect().width)).join(","));
await listeBereich(page, "sprache");
const breite = () => page.evaluate(() => [...document.querySelectorAll("[data-liste-bereich]")].map(b => Math.round(b.getBoundingClientRect().width)).join(","));
ok(await page.evaluate(() => document.querySelector('[data-liste-bereich="sprache"]').innerText.includes("Bestätigen")) && await sichtbar('[data-liste-bereich="vokabeln"]') && await sichtbar("[data-liste-sprache-wahl]"),
  "Fremdsprache offen: „Bestätigen“, übrige Knöpfe bleiben, Auswahl sichtbar");
ok(await breite() === breiteZu, `Knöpfe behalten ihre Größe (${breiteZu} → ${await breite()})`);
ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Quiz starten" && b.offsetParent))), "offen: „Quiz starten“ ausgeblendet");
await page.evaluate(() => [...document.querySelectorAll("[data-liste-sprache-wahl] button")].find(b => /Französisch/.test(b.textContent)).click()); await sleep(150);
ok(await page.evaluate(() => document.querySelector('[data-liste-bereich="sprache"]').textContent) === "🇫🇷 Französisch" && !(await page.$("[data-liste-sprache-wahl]")), "Sprache antippen: übernommen und zu");
ok(await page.evaluate(() => document.querySelector('[data-liste-bereich="sprache"]').classList.contains("leuchten")), "… Knopf leuchtet kurz");
await sleep(800);
await listeBereich(page, "spalten");
ok(await page.evaluate(() => document.querySelector('[data-liste-bereich="spalten"]').textContent.includes("▲")) && await sichtbar("[data-liste-spalten]"), "Spalten offen: Name mit Pfeil");
await page.click('[data-liste-bereich="spalten"]'); await sleep(200);
ok(!(await page.$("[data-liste-spalten]")) && await sichtbar('[data-liste-bereich="vokabeln"]'), "Pfeil-Knopf klappt zu");

// Vokabeln: grüner Knopf mit Pfeil; „Gelernte“ und ＋ über der Liste, im Bild
await listeBereich(page, "vokabeln");
const kn = await page.evaluate(() => { const b = document.querySelector('[data-liste-bereich="vokabeln"]'); return { t: b.textContent, farbe: getComputedStyle(b).backgroundColor }; });
const gruen = await page.evaluate(() => { const d = document.createElement("div"); d.style.background = "var(--bestaetigen)"; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
ok(kn.t === "60▲" && kn.farbe === gruen, `Vokabeln offen: Knopf grün mit Pfeil (${JSON.stringify(kn)})`);
const leiste = await page.evaluate(() => ["[data-gelernte-ausblenden]", "[data-vokabel-neu]"].map(s => Math.round(document.querySelector(s).getBoundingClientRect().right)));
ok(leiste.every(r => r <= 390), `„Gelernte“ und ＋ im Bild (${leiste.join(", ")})`);
const zeilen = () => page.evaluate(() => document.querySelectorAll('[data-such-ziel="liste"]').length);
ok(await zeilen() === 60, `60 Vokabeln (${await zeilen()})`);
await page.click("[data-gelernte-ausblenden]"); await sleep(200);
ok(await zeilen() === 57 && await page.evaluate(() => document.querySelector("[data-gelernte-ausblenden]").textContent) === "✓ −3", `Gelernte ausgeblendet: 57 (${await zeilen()})`);
ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Zusammenführen"))), "kein „Zusammenführen“-Knopf mehr (im Lang-Druck-Menü)");

// ── 78: nach oben ──
ok(!(await page.$("[data-nach-oben]")), "oben: kein ↑");
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(300);
ok(await page.$("[data-nach-oben]"), "weit unten: ↑ erscheint");
const such = await page.evaluate(() => [Math.round(document.querySelector("[data-suchleiste]").getBoundingClientRect().top), Math.round(document.querySelector("[data-listen-zeile]").getBoundingClientRect().bottom)]);
ok(Math.abs(such[0] - such[1]) <= 1, `Suchleiste bleibt direkt unter der Knopfzeile stehen (${such.join(" / ")})`);
await page.click("[data-nach-oben]"); await sleep(200);
ok(await page.evaluate(() => window.scrollY) === 0 && !(await page.$("[data-nach-oben]")), "↑ springt an den Anfang");

// Kopf antippen: zurück zur Listen-Auswahl
await page.click("[data-liste-kopf-name]"); await sleep(400);
ok(await page.$('[data-liste-id="l_b"]'), "Namens-Knopf antippen: zurück zur Listen-Auswahl");

// ── 81: Mehrfach-Auswahl leuchtet ──
await langDruck('[data-liste-id="l_a"]'); await sleep(300);
await sleep(900);
await langDruck('[data-liste-id="l_b"]'); await sleep(60);   // 147: lang drücken nimmt dazu
const lw = await page.evaluate(() => ({ kachel: document.querySelector('[data-liste-id="l_b"]').classList.contains("leuchten"), hinweis: document.querySelector("[data-wahl-hinweis]")?.classList.contains("leuchten"), text: document.querySelector("[data-wahl-hinweis]")?.textContent }));
ok(lw.kachel && lw.hinweis && /2 ausgewählt/.test(lw.text), `Listen-Auswahl: Kachel und „☑ 2 ausgewählt“ leuchten (${JSON.stringify(lw)})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
