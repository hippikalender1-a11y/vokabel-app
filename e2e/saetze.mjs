import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zuListen, neueEineSession, listenZu, bereichZu, listeBereich } from "./hilfen.mjs";

// Beispielsätze: „✨ Ergänzen“ in der Liste – Prompt je Portion, KI-Antwort einfügen („ID // Satz // Übersetzung“, *Wort*),
// gespeichert in IndexedDB (bleibt nach Neuladen), Anzeige „n von m Vokabeln“ und „Sätze ansehen“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setze = async (sel, wert) => page.evaluate((sel, wert) => { const el = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, wert); el.dispatchEvent(new Event("input", { bubbles: true })); }, sel, wert);

await page.goto(URL);
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise(r => { const d = indexedDB.deleteDatabase("vokabel_saetze"); d.onsuccess = d.onerror = d.onblocked = () => r(); });
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = [["la maison", "das Haus"], ["le chat", "die Katze"], ["aller", "gehen"], ["manger", "essen"]];
  const vokabeln = w.map(([e, d], i) => ({ id: i + 1, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 5, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(600);
await listeBereich(page, "saetze");
ok(/0 von 4/.test(await page.evaluate(() => document.querySelector("[data-liste-saetze-anzahl]")?.textContent)), "Liste: 💬 0 von 4 Vokabeln");
await page.click("[data-saetze-ergaenzen]"); await sleep(400);
await page.click('[data-satz-anzahl="1"]'); await sleep(200);
let prompt = await page.evaluate(() => document.querySelector("[data-satz-prompt]").value);
ok(/genau 1 kurze/.test(prompt) && /Französisch/.test(prompt) && /^1 \/\/ la maison \/\/ das Haus$/m.test(prompt) && /^4 \/\/ manger \/\/ essen$/m.test(prompt) && /\*maison\*/.test(prompt),
  "Prompt: Anzahl, Sprache, Zeilen „ID // Wort // Deutsch“, Beispiel mit *Sternchen*");
await setze("[data-satz-antwort]", "1 // Je rentre à la *maison*. // Ich gehe nach Hause.\nHier ist Unsinn\n2 // Le *chat* dort. // Die Katze schläft.\n9 // Fremde *ID*. // Gibt es nicht.");
await page.click("[data-satz-uebernehmen]"); await sleep(500);
ok(/2 Sätze für 2 Vokabeln/.test(await page.evaluate(() => document.querySelector("[data-satz-meldung]")?.textContent)), "Übernehmen: 2 Sätze für 2 Vokabeln (Unsinn und fremde ID ignoriert)");
ok(/2 von 4/.test(await page.evaluate(() => document.querySelector("[data-saetze-stand]")?.textContent)), "Stand: 2 von 4");
prompt = await page.evaluate(() => document.querySelector("[data-satz-prompt]").value);
ok(!/^1 \/\/ /m.test(prompt) && /^3 \/\/ aller/m.test(prompt), "nächste Portion: nur noch die offenen Vokabeln");
await setze("[data-satz-antwort]", "3 // Je *vais* à l'école. // Ich gehe zur Schule.\n4 | Nous *mangeons* ensemble. | Wir essen zusammen.");
await page.click("[data-satz-uebernehmen]"); await sleep(500);
ok(await page.$("[data-saetze-fertig]"), "alle Vokabeln haben Sätze: ✓");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "Schließen")?.click()); await sleep(300);
ok(/4 von 4/.test(await page.evaluate(() => document.querySelector("[data-liste-saetze-anzahl]")?.textContent)), "Liste: 💬 4 von 4");
await page.reload(); await sleep(800);
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(800);
await listeBereich(page, "saetze");
ok(/4 von 4/.test(await page.evaluate(() => document.querySelector("[data-liste-saetze-anzahl]")?.textContent)), "nach Neuladen: Sätze bleiben (IndexedDB)");
await listeBereich(page, "saetze");
ok(await page.evaluate(() => document.querySelector('[data-satz-vok="3"] b')?.textContent) === "vais", "„Sätze ansehen“: markiertes Wort fett (vais)");
ok(!(await page.evaluate(() => Object.keys(localStorage).some(k => (localStorage.getItem(k) || "").includes("*maison*")))), "Sätze liegen nicht im normalen Speicher (nur IndexedDB)");

// ── Datei laden, „Als Datei“, „📋 Einfügen“ ──
await page.evaluate(async () => { await new Promise(r => { const d = indexedDB.deleteDatabase("vokabel_saetze"); d.onsuccess = d.onerror = d.onblocked = () => r(); }); });
await page.reload(); await sleep(800);
await zuListen(page);
await page.click('[data-liste-id="l_a"]'); await sleep(600);
await listeBereich(page, "saetze");
await page.click("[data-saetze-ergaenzen]"); await sleep(400);
await page.click('[data-satz-weg-wahl="datei"]'); await sleep(200);
let p2 = await page.evaluate(() => document.querySelector("[data-satz-prompt]").value);
ok(/Textdatei/.test(p2) && /Die Datei enthält NUR Zeilen/.test(p2) && (p2.match(/^\d+ \/\/ /gm) || []).length === 4, "„Als Datei“: Prompt für eine Textdatei mit allen offenen Vokabeln");
const datei = path.join(os.tmpdir(), "saetze_test.txt");
fs.writeFileSync(datei, "1 // Je rentre à la *maison*. // Ich gehe nach Hause.\n2 // Le *chat* dort. // Die Katze schläft.\n3 // Je *vais* à l'école. // Ich gehe zur Schule.\n", "utf8");
const input = await page.$("[data-satz-datei]");
await input.uploadFile(datei); await sleep(800);
ok(/3 Sätze für 3 Vokabeln/.test(await page.evaluate(() => document.querySelector("[data-satz-meldung]")?.textContent)), "„📄 Datei laden“: 3 Sätze übernommen");
await browser.defaultBrowserContext().overridePermissions(URL, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
await page.evaluate(() => navigator.clipboard.writeText("4 // Nous *mangeons* ensemble. // Wir essen zusammen."));
await page.click("[data-satz-einfuegen]"); await sleep(600);
ok(await page.$("[data-saetze-fertig]") || /1 Sätze für 1 Vokabeln/.test(await page.evaluate(() => document.querySelector("[data-satz-meldung]")?.textContent)), "„📋 Einfügen“: Satz aus der Zwischenablage übernommen");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "Schließen")?.click()); await sleep(300);

// ── Antwortarten mit Beispielsätzen ──
const FORM = { "das Haus": "maison", "die Katze": "chat", "gehen": "vais", "essen": "mangeons" };
const SATZ = { "das Haus": "Je rentre à la maison.", "die Katze": "Le chat dort.", "gehen": "Je vais à l'école.", "essen": "Nous mangeons ensemble." };
const score = d => page.evaluate(d => JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.D1.wert === d)?.fortschritt?.score ?? null, d);
const starte = async art => {
  for (let k = 0; k < 3 && !(await page.$(".tab")); k++) {   // laufende Abfrage beenden
    await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(400);
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht|Beenden|Pause/.test(b.textContent))?.click()); await sleep(400);
  }
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(400);
  await neueEineSession(page);
  await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
  await listenZu(page);
  await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
  await page.evaluate(a => document.querySelector(`[data-modus-knopf="E1:${a}"]`)?.click(), art); await sleep(200);
  await page.evaluate(() => document.querySelector('[data-modus-knopf="E1:karte"].aktiv')?.click()); await sleep(200);
  await bereichZu(page);
  await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
};
const frage = () => page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
const weiter = async () => { await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click()); await sleep(1300); };

await starte("satzfinden");
let f = await frage();
ok(await page.evaluate(() => [...document.querySelectorAll("[data-satz-wort]")].map(b => b.textContent).join(" ")) === SATZ[f], `Satz finden: „${SATZ[f]}“`);
const lage = await page.evaluate(() => ({ breit: document.documentElement.scrollWidth, fenster: innerWidth, lauf: !!document.querySelector(".satz-lauf"),
  drin: [...document.querySelectorAll("[data-satz-wort]")].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }),
  ueb: !!document.querySelector("[data-satzfinden] .satz-ueb") }));
ok(!lage.lauf && lage.drin && lage.breit <= lage.fenster, `Satz steht komplett im Bild, kein Laufband, keine Überbreite (${JSON.stringify(lage)})`);
ok(!lage.ueb, "Satz finden: keine Übersetzung (Standard)");
await page.evaluate(() => [...document.querySelectorAll("[data-satz-wort]")].find(b => !b.hasAttribute("data-satz-ziel"))?.click()); await sleep(300);
ok(/Nicht richtig/.test(await page.evaluate(() => document.body.innerText)) && await score(f) === null, "falsches Wort: Fehlversuch");
await sleep(1600);
await page.click("[data-satz-ziel]"); await sleep(400);
ok(await score(f) === 1 && await page.evaluate(() => document.querySelector("[data-satz-loesung] b")?.textContent) === FORM[f], `richtiges Wort „${FORM[f]}“: +1, Satz mit markiertem Wort`);

await starte("lueckensatz");
f = await frage();
ok(/_{4,}/.test(await page.evaluate(() => document.querySelector("[data-lueckensatz-text]")?.textContent)), "Lückensatz: Satz mit Lücke");
ok(await page.$("[data-lueckensatz] .satz-ueb"), "Lückensatz: Übersetzung (Standard: an)");
await page.focus("[data-lueckensatz-eingabe]"); await page.keyboard.type(FORM[f]); await page.keyboard.press("Enter"); await sleep(400);
ok(await score(f) === 2 || await score(f) === 1, `Form „${FORM[f]}“ eingetippt: richtig (${await score(f)})`);

await starte("satzbauen");
f = await frage();
for (const w of SATZ[f].split(" ")) { await page.evaluate(w => [...document.querySelectorAll("[data-satz-kachel]:not([disabled])")].find(b => b.textContent === w)?.click(), w); await sleep(60); }
await sleep(400);
ok(!(await page.$("[data-satzbauen]")) && await page.$("[data-satz-loesung]"), `Satz bauen: „${SATZ[f]}“ in richtiger Reihenfolge → richtig`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
