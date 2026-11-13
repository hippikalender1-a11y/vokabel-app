import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { zuListen, neueEineSession, listenZu, quizEinstellungen } from "./hilfen.mjs";

// Runde 3: Speichern-Fenster (Knöpfe oben, Eingabetaste), Vokabelbereich einer gespeicherten Session ändern (rot,
// Überspeichern / Verwerfen), Gruppen bleiben bestehen, geladene Session im Raster sichtbar, Multiquiz + „Fertig“ (auch Statistik),
// Exportieren-Fenster, Listen-Menü statt Aktionszeile, keine Erklärzeilen, Antippen liest vor, Stimmen, Farben-Bereich
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
const lang = async sel => { const da = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })); return true; }, sel); await sleep(300); return da; };
const aktionen = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const aktion = async label => { const da = await page.evaluate(l => { const b = document.querySelector(`[data-info-aktion="${l}"]`); b?.click(); return !!b; }, label); await sleep(350); return da; };
const klickText = async (sel, text) => { const da = await page.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim() === text); el?.click(); return !!el; }, sel, text); await sleep(400); return da; };
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots") || "{}"));
const schliesseTafel = async () => { await page.mouse.click(5, 120); await sleep(250); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, E1: { wert: `mot${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 31, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(800);

// ── 18: Speichern-Fenster – Namensfeld, direkt darunter die Knöpfe; Eingabetaste speichert ──
await neueEineSession(page);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
await listenZu(page);
const speichereAls = async name => {
  await lang("[data-slot-kopf-name]"); await aktion("💾 Speichern");
  await page.evaluate(n => { const f = document.querySelector("[data-slot-name-feld]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
};
await speichereAls("S1");
const lage = await page.evaluate(() => { const f = document.querySelector("[data-slot-name-feld]"), k = document.querySelector("[data-slot-speichern-neu]");
  return { feld: f.getBoundingClientRect().bottom, knopf: k.getBoundingClientRect().top }; });
ok(lage.knopf > lage.feld && lage.knopf - lage.feld < 60, `Speichern-Knopf direkt unter dem Namensfeld (${Math.round(lage.knopf - lage.feld)} px)`);
await page.focus("[data-slot-name-feld]"); await page.keyboard.press("Enter"); await sleep(400);
let sl = await slots();
ok(!(await page.$(".modal")) && sl.gespeichert?.some(x => x.name === "S1"), "Eingabetaste speichert die Session „S1“");
await speichereAls("S2");
await page.click("[data-slot-speichern-neu]"); await sleep(400);
sl = await slots();
const id1 = sl.gespeichert.find(x => x.name === "S1").id, id2 = sl.gespeichert.find(x => x.name === "S2").id;
ok(!!id2, "„S2“ gespeichert");
await lang("[data-slot-kopf-name]"); await aktion("💾 Speichern");
ok(await page.$("[data-ersetzen-liste]") && await page.evaluate(() => document.querySelector("[data-slot-speichern-neu]").getBoundingClientRect().top < document.querySelector("[data-ersetzen-liste]").getBoundingClientRect().top),
  "Liste „Andere Session ersetzen“ steht unter den Knöpfen");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "Abbrechen")?.click()); await sleep(300);

// ── 17: gespeicherte Session – „Alle | Bereich“ sichtbar, Änderung → rot, lang drücken: Überspeichern / Verwerfen ──
ok(!(await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "Bereich"))), "geladene gespeicherte Session: keine Zeile „Vokabel-Auswahl“");
await lang("[data-slot-kopf-name]"); await aktion("📝 Listen/Vokabeln ändern");
ok(await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "Bereich")) && await page.$("[data-aendern-bestaetigen]") && !(await page.$("[data-start-knopf]")),
  "„Listen/Vokabeln ändern“: Listen- und Vokabel-Zeile, Name wird „Bestätigen“, darunter ausgeblendet");
await klickText(".toggle-opt", "Bereich");
await page.evaluate(() => { const z = [...document.querySelectorAll("[data-such-ziel='quiz']")]; z[0]?.click(); }); await sleep(250);
await page.evaluate(() => { const z = [...document.querySelectorAll("[data-such-ziel='quiz']")]; z[1]?.click(); }); await sleep(250);
await page.click("[data-vok-bestaetigen]"); await sleep(400);
await page.click("[data-aendern-bestaetigen]"); await sleep(400);
ok(await page.$("[data-start-knopf]") && !(await page.evaluate(() => [...document.querySelectorAll(".toggle-opt")].some(b => b.textContent.trim() === "Bereich"))), "„Bestätigen“: Ändern beendet, Start wieder da");
let rot = await page.evaluate(() => { const b = document.querySelector("[data-slot-kopf-name]"); return { geaendert: b.hasAttribute("data-geaendert"), bg: b.getAttribute("style") || "" }; });
ok(rot.geaendert && /--falsch/.test(rot.bg), `Vokabelauswahl geändert: Name-Knopf rot (${rot.bg})`);
ok(!(await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Zurücksetzen"))), "kein eigener „Zurücksetzen“-Knopf mehr");
await lang("[data-slot-kopf-name]");
let ak = await aktionen();
ok(ak.includes("💾 Überspeichern „S2“") && ak.includes("💾 Als neue Session speichern") && ak.includes("↺ Verwerfen"), `Menü: ${ak.join(" | ")}`);
await aktion("💾 Überspeichern „S2“");
sl = await slots();
ok(!(await page.$("[data-slot-kopf-name][data-geaendert]")) && sl.gespeichert.find(x => x.id === id2).konfiguration.vokabelAuswahl.length === 2, "Überspeichern: S2 hat 2 Vokabeln, Kopf nicht mehr rot");
await lang("[data-slot-kopf-name]"); await aktion("📝 Listen/Vokabeln ändern");
await klickText(".toggle-opt", "Bereich");
await page.evaluate(() => { const z = [...document.querySelectorAll("[data-such-ziel='quiz']")]; z[5]?.click(); }); await sleep(250);
await page.click("[data-vok-bestaetigen]"); await sleep(400);
await page.click("[data-aendern-bestaetigen]"); await sleep(400);
await lang("[data-slot-kopf-name]"); await aktion("↺ Verwerfen");
sl = await slots();
ok(!(await page.$("[data-slot-kopf-name][data-geaendert]")) && sl.gespeichert.find(x => x.id === id2).konfiguration.vokabelAuswahl.length === 2, "Verwerfen: zurück auf die gespeicherte Auswahl");

// ── 16 + 15: Gruppe mit S1 und S2 ──
await page.evaluate((a, b) => {
  const d = JSON.parse(localStorage.getItem("vokabel_slots"));
  d.ordner = [{ id: "o1", name: "Gruppe G", platz: { z: 0, s: 0 } }];
  d.gespeichert = d.gespeichert.map(x => x.id === a || x.id === b ? (({ platz, ...r }) => ({ ...r, ordner: "o1" }))(x) : x);
  localStorage.setItem("vokabel_slots", JSON.stringify(d));
  localStorage.setItem("vokabel_letzter_slot", JSON.stringify(b));
}, id1, id2);
await page.reload(); await sleep(900);
// 15: App-Start mit geladener S2 (in Gruppe G): Auswahl öffnen zeigt die Gruppe
await page.click("[data-slot-kopf-name]"); await sleep(400);
ok(await page.$(`[data-slot-id="${id2}"]`) && /Gruppe G/i.test(await page.evaluate(() => document.body.innerText)), "App-Start, Auswahl geöffnet: Gruppe der geladenen Session ist offen, Kachel sichtbar");
await klickText("button", "← Alle Sessions");
ok(!(await page.$(`[data-slot-id="${id2}"]`)), "„← Alle Sessions“: oberste Ebene");
await page.click("[data-slot-kopf-name]"); await sleep(300);   // zu Einstellungen
await page.click("[data-slot-kopf-name]"); await sleep(400);   // wieder Auswahl
ok(await page.$(`[data-slot-id="${id2}"]`), "Auswahl wieder geöffnet: springt in die Gruppe der geladenen Session");
// 16: eine Session aus der Gruppe → Gruppe bleibt; beide raus → leere Gruppe bleibt, Menü „Ordner löschen“
await lang(`[data-slot-id="${id1}"]`); await aktion("↑ Aus dem Ordner");
sl = await slots();
ok(sl.ordner.some(o => o.id === "o1") && sl.gespeichert.filter(x => x.ordner === "o1").length === 1, "eine Session übrig: Gruppe bleibt bestehen");
await lang(`[data-slot-id="${id2}"]`); await aktion("↑ Aus dem Ordner");
sl = await slots();
ok(sl.ordner.some(o => o.id === "o1") && sl.gespeichert.filter(x => x.ordner === "o1").length === 0, "keine Session übrig: leere Gruppe bleibt bestehen");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Alle Sessions"))?.click()); await sleep(300);
await lang('[data-ordner-id="o1"]');
ak = await aktionen();
ok(ak.includes("🗑 Ordner löschen") && !ak.includes("📤 Ordner auflösen"), `leere Gruppe: „Ordner löschen“ (${ak.join(" | ")})`);
await schliesseTafel();

// ── 14: Auswahl-Modus zeigt nur den Zustand ──
let txt = await page.evaluate(() => document.body.innerText);
ok(!/Lang drücken: Menü/.test(txt), "keine Erklärzeile über dem Raster");
await lang(`[data-slot-id="${id1}"]`); await lang(`[data-slot-id="${id2}"]`);   // 147: lang drücken nimmt dazu
const hinweis = await page.evaluate(() => document.querySelector("[data-wahl-hinweis]")?.innerText.trim());
ok(/^2 ausgewählt · \d+ Vokabeln$/.test(hinweis || ""), `Auswahl: nur „${hinweis}“`);
ok(!(await page.evaluate(() => document.querySelector("[data-auswahl-tafel]")?.innerText || "")).includes("Weitere antippen"), "Tafel ohne Zusatzzeile");

// ── 13: Quiz: „Fertig“ mit 2 → Multiquiz eingestellt, nicht gestartet ──
await page.click("[data-wahl-fertig]"); await sleep(600);
let name = await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.textContent.trim());
ok(name === "Multiquiz" && !(await page.$(".quiz-frage-box")), `Quiz: „Fertig“ stellt das Multiquiz ein (${name}), ohne zu starten`);
// Statistik: Multiquiz über „Fertig“
await klickText(".tab", "Statistik");
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf-name]"); if (!document.querySelector("[data-raster-zelle]")) k?.click(); }); await sleep(400);
if (!(await page.$(`[data-slot-id="${id1}"]`))) { await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Alle Sessions"))?.click()); await sleep(300); }
await lang(`[data-slot-id="${id1}"]`); await lang(`[data-slot-id="${id2}"]`);
ak = await aktionen();
ok(ak.includes("🧩 Multiquiz (2)"), `Statistik: Menü der Auswahl mit „🧩 Multiquiz (2)“ (${ak.join(" | ")})`);
await schliesseTafel();
if (!(await page.$("[data-wahl-fertig]"))) { await lang(`[data-slot-id="${id1}"]`); await lang(`[data-slot-id="${id2}"]`); }
await page.click("[data-wahl-fertig]"); await sleep(600);
name = await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.textContent.trim());
ok(name === "Multiquiz", `Statistik: „Fertig“ lädt das Multiquiz (${name})`);
// „Fertig“ mit genau einer → diese Session laden
await klickText(".tab", "Quiz");
await page.evaluate(() => { if (!document.querySelector("[data-raster-zelle]")) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(400);
if (!(await page.$(`[data-slot-id="${id1}"]`))) { await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Alle Sessions"))?.click()); await sleep(300); }
await lang(`[data-slot-id="${id1}"]`);
await page.click("[data-wahl-fertig]"); await sleep(700);
name = await page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.textContent.trim());
ok(name === "S1", `„Fertig“ mit einer Session lädt sie (${name})`);

// ── 19: Antippen von Frage/Lösung liest vor, Karte deckt dabei nicht auf ──
await page.evaluate(() => { window.__gesprochen = []; window.speechSynthesis.speak = u => window.__gesprochen.push(u.text); });
await page.evaluate(() => { if (document.querySelector("[data-quiz-ansicht='auswahl']")) document.querySelector("[data-slot-kopf-name]")?.click(); }); await sleep(300);
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const frage = await page.evaluate(() => document.querySelector("[data-karte-frage] .quiz-frage-text")?.textContent.trim());
await page.evaluate(() => document.querySelector("[data-karte-frage]")?.click()); await sleep(300);
const gesprochen = await page.evaluate(() => window.__gesprochen);
ok(frage && gesprochen.some(t => t === frage), `Frage antippen liest vor („${frage}“ → ${JSON.stringify(gesprochen)})`);
ok(!(await page.evaluate(() => [...document.querySelectorAll("[data-karte-frage] button:not([data-stimme-wechsel]):not([data-spalte-vorlesen])")].some(b => /vorlesen/i.test(b.getAttribute("data-info") || "")))), "kein Vorlese-Knopf in der Frage-Karte außer Stimme und Lautsprecher je Spalte");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Beenden|✕/.test(b.textContent) && b.closest(".topbar"))?.click()); await sleep(300);
await page.goto(URL); await sleep(800);

// ── 11 + 12: Listen-Menü, Exportieren-Fenster, Listenkopf ohne Aktionszeile ──
await zuListen(page);
await lang("[data-liste-id]");
ak = await aktionen();
ok(["📤 Exportieren", "＋ Vokabeln importieren", "( ) → Info"].every(a => ak.includes(a)), `Listen-Menü: ${ak.join(" | ")}`);
await aktion("📤 Exportieren");
let art = await page.evaluate(() => document.querySelector("[data-export-art].aktiv")?.dataset.exportArt);
ok(art === "json" && await page.evaluate(() => document.querySelector("[data-export-was]")?.textContent === "Unité 1"), `Export-Fenster: JSON vorausgewählt, nennt „Unité 1“ (${art})`);
await page.click('[data-export-art="txt"]'); await sleep(300);
ok(await page.$('[data-datei-export="txt"]') && await page.evaluate(() => document.querySelector("[data-export-art].aktiv")?.dataset.exportArt === "txt"), "TXT gewählt: Dateiname-Fenster mit Art-Wahl");
await page.click('[data-export-art="kopieren"]'); await sleep(300);
ok(await page.$("[data-kopier-export]"), "Kopieren gewählt: Fenster mit „📋 Kopieren“");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "Abbrechen")?.click()); await sleep(300);
await lang("[data-liste-id]"); await aktion("📤 Exportieren");
ok(await page.$("[data-kopier-export]"), "zuletzt gewählte Art (Kopieren) ist beim nächsten Mal vorausgewählt");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => b.textContent.trim() === "Abbrechen")?.click()); await sleep(300);
await page.click("[data-liste-id]"); await sleep(300); await listeOeffnen(page); await sleep(200);
ok(!(await page.$(".liste-detail-header .btn-toggle")) && !(await page.$("[data-klammern-werkzeug]")), "geöffnete Liste: keine Aktionszeile, kein Pfeil-Knopf");
await lang("[data-liste-kopf-name]");
ak = await aktionen();
ok(ak.includes("📤 Exportieren") && ak.includes("🗑 Löschen") && !ak.includes("⇄ Verschieben") && !ak.includes("☑ Auswählen"), `Listenkopf lang drücken: ${ak.join(" | ")}`);
await aktion("( ) → Info");
ok(await page.evaluate(() => /Klammer/i.test(document.querySelector(".modal")?.innerText || "")), "„( ) → Info“ öffnet das Klammer-Werkzeug");
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => /Abbrechen|Schließen/.test(b.textContent))?.click()); await sleep(300);

// ── 20: Einstellungen › Stimmen ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen")).click()); await sleep(300);
await page.click('[data-einst-kopf="stimmen"]'); await sleep(300);
ok(await page.$('[data-einst-unter="sp:de"]') && await page.$('[data-einst-unter="sp:fr"]'), "Stimmen: Knöpfe Deutsch und Französisch");
await page.click('[data-einst-unter="tempo"]'); await sleep(250);
await page.evaluate(() => { const r = document.querySelector("[data-stimmen-tempo-regler]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(r, "1.3"); r.dispatchEvent(new Event("input", { bubbles: true })); r.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(300);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("geraet_stimmen") || "{}").tempo === 1.3 && document.querySelector("[data-stimmen-tempo]").textContent === "1,3×"), "Tempo 1,3× gespeichert (je Gerät)");

// ── 21 + 22: Farben als eigener Bereich mit Tabs, 31 Vorlagen ──
await page.click('[data-einst-kopf="farben"]'); await sleep(300);
await page.click('[data-farb-tab="vorlagen"]'); await sleep(250);   // Knopfzeile: anfangs nichts offen
const vorlagen = await page.evaluate(() => document.querySelectorAll("[data-farbschema]").length);
ok(await page.$("[data-farb-tabs]") && vorlagen === 60, `Farben: Tabs, ${vorlagen} Vorlagen`);
ok(!(await page.$("[data-farbmodus-start]")), "Werkzeuge nur im Tab „Werkzeuge“");
await page.click('[data-farbschema="neon"]'); await sleep(300);
ok(await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).farbschema === "neon"), "neue Vorlage „Neon“ wählbar");
await page.click('[data-farb-tab="werkzeuge"]'); await sleep(300);
ok(await page.$("[data-farbmodus-start]") && !(await page.$("[data-farbschema]")), "Tab „Werkzeuge“: Farbmodus");
await page.click('[data-farb-tab="eigene"]'); await sleep(300);
const ersteEigene = await page.evaluate(() => document.querySelector("[data-farb-tabs] ~ .karte .farb-raster")?.firstElementChild?.hasAttribute("data-farbschema-zufall"));
ok(ersteEigene, "Tab „Eigene“: „🎲 Zufall“ steht an erster Stelle");
await page.click("[data-farbschema-zufall]"); await sleep(300);
ok(await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen")); return e.eigeneSchemata.some(x => x.zufall && x.id === e.farbschema); }), "„🎲 Zufall“ antippen: Zufallsschema erzeugt und verwendet");
await page.click('[data-einst-kopf="app"]'); await sleep(300);
ok(!(await page.$("[data-farbschema]")), "App-Bereich ohne Farbschemata");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
