import puppeteer from "puppeteer-core";
import { zuListen } from "./hilfen.mjs";

// Auswahl-Modus für Listen und gespeicherte Konfigurationen: Lang-Druck → „☑ Auswählen“, antippen wählt aus/ab,
// Lang-Druck → Aktionen für die Auswahl (Listen: JSON, TXT, Kopieren, Verschieben, Löschen; Konfigurationen:
// Multiquiz, Verschieben, Löschen); Löschen fragt mit allen Namen nach
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
page.on("dialog", d => { console.log("FAIL Browser-Fenster erschienen:", d.message()); d.dismiss(); });
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tab = async name => { await page.evaluate(n => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes(n)).click(), name); await sleep(400); };
const langDruck = async sel => {
  await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); }, sel);
  await sleep(250);
};
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion).join("|"));
const blase = () => page.evaluate(() => document.querySelector("[data-info-menue]")?.previousElementSibling?.textContent || "");
const aktion = async p => { await page.evaluate(p => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion.startsWith(p)).click(), p); await sleep(300); };
const klick = async sel => { await page.evaluate(sel => document.querySelector(sel).click(), sel); await sleep(250); };
const anzahl = () => page.evaluate(() => document.querySelector("[data-wahl-anzahl]")?.dataset.wahlAnzahl || null);
const index = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_index") || "[]"));

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const L = (id, name) => ({ id, name, sprache:"fr", spalten: sp, naechste_id: 2, vokabeln: [{ id: 1, E1: { wert: "mot", falsch: [] }, D1: { wert: "Wort", falsch: [] } }] });
  const listen = [["l_a", "Unité A"], ["l_b", "Unité B"], ["l_c", "Unité C"]];
  listen.forEach(([id, n]) => localStorage.setItem("vokabel_liste_" + id, JSON.stringify(L(id, n))));
  localStorage.setItem("vokabel_listen_index", JSON.stringify(listen.map(([id, name], i) => ({ id, name, sprache:"fr", platz:{ z:i, s:0 } }))));
  const k = id => ({ listenIds:[id], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g1", name:"Quiz A", timestamp:1, konfiguration:k("l_a"), sessionFortschritt:null, platz:{z:0,s:0} },
    { id:"g2", name:"Quiz B", timestamp:2, konfiguration:k("l_b"), sessionFortschritt:null, platz:{z:0,s:1} },
    { id:"g3", name:"Quiz C", timestamp:3, konfiguration:k("l_c"), sessionFortschritt:null, platz:{z:1,s:0} } ] }));
});
await page.reload(); await sleep(500);

// ── Listen (147: lang drücken nimmt auf/heraus, antippen = Einzelauswahl) ──
await zuListen(page);
await langDruck('[data-liste-id="l_a"]');
ok(await anzahl() === "1" && await page.$('[data-liste-id="l_a"] [data-wahl-nr="1"]'), "lang drücken: Unité A ausgewählt (Nr. 1)");
ok(!(await menue()).includes("☑ Auswählen") && (await menue()).includes("✕ Auswahl beenden") && !(await page.$("[data-info-blase]")), `Menü ohne schwarze Box, ohne „☑ Auswählen“ (${await menue()})`);
await langDruck('[data-liste-id="l_b"]');
ok(await anzahl() === "2" && await page.evaluate(() => !document.querySelector(".liste-detail-header-name")?.textContent.includes("Unité")), "lang drücken auf Unité B: kommt dazu, öffnet nichts");
await langDruck('[data-liste-id="l_a"]');
ok(await anzahl() === "1" && !(await page.$('[data-liste-id="l_a"] [data-wahl-nr]')), "nochmal lang drücken nimmt Unité A heraus");
await klick("[data-wahl-alle]");
ok(await anzahl() === "3", "„Alle“: drei ausgewählt");
ok(await menue() === "📤 Exportieren (3)|🔁 Keine fälligen Vokabeln|⇄ Verschieben|📁 In Ordner… (3)|🗑 Löschen (3)|↔ Von–Bis|✕ Auswahl beenden", `Aktionen für die Auswahl (${await menue()})`);
await klick('[data-liste-id="l_c"]');
ok(await anzahl() === null && await page.$('[data-liste-oeffnen="l_c"]'), "antippen: Einzelauswahl (nur Unité C, öffnen über den grünen Knopf)");
await langDruck('[data-liste-id="l_a"]');
ok(await anzahl() === "1", "159: lang drücken – die vorher angetippte Liste kommt NICHT mit (nur A)");
await aktion("✕ Auswahl beenden");
ok(await anzahl() === null, "„Auswahl beenden“");

// Verschieben mit der Auswahl
await langDruck('[data-liste-id="l_a"]'); await langDruck('[data-liste-id="l_b"]');
ok(await anzahl() === "2", "zwei per lang drücken");
await aktion("⇄ Verschieben");
ok(await page.$("[data-listen-fertig]") && await page.evaluate(() => document.querySelectorAll("[data-auswahl-nr]").length) === 2 && await anzahl() === null,
  "„Verschieben“: Verschieben-Modus mit beiden markiert");
await klick('[data-raster-zelle="4|0"]');
let idx = await index();
ok(idx.find(l => l.id === "l_a").platz.z === 4 && idx.find(l => l.id === "l_b").platz.z === 5, "beide an den freien Platz (untereinander)");
await klick("[data-listen-fertig]");

// mehrere löschen
await langDruck('[data-liste-id="l_a"]'); await langDruck('[data-liste-id="l_b"]');
await aktion("🗑 Löschen");
const namen = await page.evaluate(() => document.querySelector('[data-auswahl-loeschen="liste"] [data-auswahl-namen]')?.textContent);
ok(namen === "„Unité A“, „Unité B“" && await page.evaluate(() => /2 Listen löschen\?/.test(document.querySelector("[data-auswahl-loeschen]").textContent) && /Vorher sichern/.test(document.querySelector("[data-auswahl-loeschen]").textContent)),
  `Rückfrage „2 Listen löschen?“ mit Namen und „Vorher sichern“ (${namen})`);
await klick("[data-auswahl-loeschen-ok]");
idx = await index();
ok(idx.map(l => l.id).join(",") === "l_c" && await page.evaluate(() => !localStorage.getItem("vokabel_liste_l_a") && !localStorage.getItem("vokabel_liste_l_b")) && await anzahl() === null,
  "Unité A und B gelöscht, Unité C bleibt, Auswahl beendet");

// ── Konfigurationen (Quiz-Tab) ──
await tab("Quiz");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await langDruck('[data-slot-id="g1"]'); await langDruck('[data-slot-id="g2"]');
ok(await menue() === "🧩 Multiquiz starten (2)|🔁 Keine fälligen Vokabeln|📁 In Ordner… (2)|⇄ Verschieben|🗑 Löschen (2)|↔ Von–Bis|✕ Auswahl beenden", `Konfigurationen: Aktionen für die Auswahl (${await menue()})`);
ok(/2 Sessions ausgewählt/.test(await page.evaluate(() => document.querySelector("[data-slot-info]")?.innerText || "")), "148: Info zeigt die Auswahl zusammengefasst");
await aktion("🗑 Löschen");
ok(await page.evaluate(() => /2 Konfigurationen löschen\?/.test(document.querySelector('[data-auswahl-loeschen="slot"]')?.textContent || "")
  && document.querySelector("[data-auswahl-namen]").textContent === "„Quiz A“, „Quiz B“"), "Rückfrage „2 Konfigurationen löschen?“ mit Namen");
await klick("[data-auswahl-loeschen-ok]");
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.map(g => g.id).join(",")) === "g3" && !(await page.$("[data-wahl-hinweis]")),
  "Quiz A und B gelöscht, Quiz C bleibt, Auswahl beendet");

// Statistik-Tab: kein Multiquiz
await tab("Statistik");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await langDruck('[data-slot-id="g3"]');
ok(!/Multiquiz/.test(await menue()) && /📁 In Ordner…/.test(await menue()), `Statistik: Menü ohne Multiquiz (${await menue()})`);
await aktion("✕ Auswahl beenden");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
