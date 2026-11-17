import puppeteer from "puppeteer-core";
import { zuListen, farbZeige } from "./hilfen.mjs";

// 265 (Schritt 1): Flächen – Hintergrund und Schriften gehören zusammen. Jede Text-Fläche hat eigene Schriften
// (kräftig, normal, leise, sehr leise); Farbfeld → Flächen-Editor mit Vorschau aller Schriften, Auswahl-Reihe,
// Rückgängig, Vorlage, Einklappen; „Nur dieses Element“ mit Vorschau; Schema-Editor ohne lose Schrift-Rollen
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const variable = n => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim(), n);
const farbe = sel => page.evaluate(sel => getComputedStyle(document.querySelector(sel)).color, sel);
const rgb = h => `rgb(${[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
const hex = async w => { await page.evaluate(w => { const i = document.querySelector("[data-farbrad-hex]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, w); i.dispatchEvent(new Event("input", { bubbles: true })); }, w); await sleep(150); };
const kontext = async sel => { await page.evaluate(sel => { const el = document.querySelector(sel); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect();
  document.elementFromPoint(r.x + 8, r.y + r.height / 2).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 8, clientY: r.y + r.height / 2 })); }, sel); await sleep(400); };
const SUB = '[data-liste-id="l_a"] .karte-zeile-sub';

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 2, vokabeln:[{ id:1, E1:{wert:"dog",falsch:[]}, D1:{wert:"Hund",falsch:[]} }] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
});
await page.reload(); await sleep(700);
await zuListen(page);

// ── ohne Änderung sieht alles aus wie bisher ──
const text2 = await variable("text2");
ok(await variable("karte-t2") === text2 && await variable("hintergrund-t2") === text2 && await farbe(SUB) === rgb(text2), `Start: Flächen-Schriften = allgemeine Schrift (${text2})`);

// ── Farbfeld: Schrift der Listen-Kachel gehört zur Fläche „Karten“ ──
await kontext(SUB);
await page.evaluate(() => document.querySelector("[data-info-farbe]")?.click()); await sleep(600);
const zeile = await page.evaluate(() => document.querySelector('[data-farbfeld-zeile="karte-t2"]')?.innerText.replace(/\s+/g, " "));
ok(/Karten · Leise/.test(zeile || ""), `Farbfeld: Text der Kachel = „Karten · Leise“ (${zeile})`);
await page.click('[data-farbfeld-zeile="karte-t2"]'); await sleep(400);
const ed = await page.evaluate(() => ({ teile: [...document.querySelectorAll("[data-flaeche-teil]")].map(b => b.textContent + (b.classList.contains("aktiv") ? "*" : "")).join("|"),
  proben: document.querySelectorAll("[data-flaeche-probe]").length, akzente: document.querySelector("[data-flaeche-akzente]")?.innerText.replace(/\s+/g, " "),
  titel: document.querySelector("[data-farbrad]")?.innerText.split("\n")[0] }));
ok(ed.teile === "Hintergrund|Kräftig|Normal|Leise*|Sehr leise" && ed.proben === 4 && /Hauptfarbe.*Richtig.*Falsch/.test(ed.akzente) && ed.titel === "Karten",
  `Flächen-Editor „Karten“: Auswahl-Reihe, Vorschau mit 4 Schriften und Akzenten (${JSON.stringify(ed)})`);

// ── live, Rückgängig ──
ok(await page.evaluate(() => document.querySelector("[data-farbrad-zurueck]").disabled), "Rückgängig zuerst aus");
await hex("#aa0000");
ok(await farbe(SUB) === "rgb(170, 0, 0)" && await page.evaluate(() => getComputedStyle(document.querySelector('[data-flaeche-probe="karte-t2"]')).color) === "rgb(170, 0, 0)",
  "Leise live: Kachel und Vorschau rot");
await page.click("[data-farbrad-zurueck]"); await sleep(250);
ok(await farbe(SUB) === rgb(text2) && await page.evaluate(() => document.querySelector("[data-farbrad-hex]").value) === text2, "↶ Rückgängig: wieder die alte Farbe");

// ── anderer Teil: Hintergrund; Vorschau folgt ──
await page.click('[data-flaeche-teil="karte"]'); await sleep(250);
await hex("#ffeecc");
ok(await page.evaluate(() => getComputedStyle(document.querySelector("[data-flaeche-vorschau]")).backgroundColor) === "rgb(255, 238, 204)", "Hintergrund gewählt: Vorschau-Karte färbt sich mit");

// ── Einklappen: nur Vorschau, Kreis weg ──
await page.click("[data-farbrad-klein-knopf]"); await sleep(200);
ok(!(await page.$("[data-farbrad-kreis]")) && await page.$("[data-flaeche-vorschau]"), "Einklappen: Farbkreis weg, Vorschau bleibt");
await page.click("[data-farbrad-klein-knopf]"); await sleep(200);
ok(!!(await page.$("[data-farbrad-kreis]")), "wieder aufgeklappt");

// ── Leise ändern, Anwenden: nur die Fläche „Karten“ ──
await page.click('[data-flaeche-teil="karte-t2"]'); await sleep(250);
await hex("#aa0000");
await page.click("[data-farbrad-anwenden]"); await sleep(400);
ok(await variable("karte-t2") === "#aa0000" && await variable("karte") === "#ffeecc" && await variable("text2") === text2 && await variable("hintergrund-t2") === text2,
  "Anwenden: Hintergrund und Leise der Karten geändert, allgemeine Schrift und Seite bleiben");
const pfad = await page.evaluate(() => {
  const grund = e => { for (let p = e; p; p = p.parentElement) { const b = getComputedStyle(p).backgroundColor; if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") return b; } return null; };
  const rot = [...document.querySelectorAll("*")].filter(e => getComputedStyle(e).color === "rgb(170, 0, 0)" && !e.closest("[data-farbmodus-ui]") && e.offsetParent && e.textContent.trim());
  const falsch = rot.find(e => grund(e) !== "rgb(255, 238, 204)");
  return { n: rot.length, falsch: falsch ? falsch.outerHTML.slice(0, 80) : null }; });
ok(pfad.n > 0 && !pfad.falsch, `die neue Schrift nur auf Karten-Hintergrund (${pfad.n} Stellen; ${pfad.falsch})`);

// ── Vorlage: Fläche zurück ──
await kontext(SUB);
await page.click('[data-farbfeld-zeile="karte-t2"]'); await sleep(400);
await page.click("[data-flaeche-vorlage]"); await sleep(250);
ok(await farbe(SUB) === rgb(text2), "↺ Vorlage: Schriften der Fläche wie in der Vorlage (live)");
await page.click("[data-farbrad-abbrechen]"); await sleep(300);
ok(await farbe(SUB) === "rgb(170, 0, 0)", "Abbrechen: gespeicherter Stand wieder da");
await page.evaluate(() => document.querySelector("[data-farbmodus-zuruecksetzen]")?.click()); await sleep(300);

// ── „Nur dieses Element“: Vorschau mit der Schrift des Elements ──
await kontext('[data-liste-id="l_a"]');
await page.evaluate(() => document.querySelector("[data-info-farbe]")?.click()); await sleep(600);
const el = await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld-element]")].map(b => b.dataset.farbfeldElement).find(x => x.endsWith("|background-color")));
if (el) { await page.click(`[data-farbfeld-element="${el}"]`); await sleep(300); }
ok(!!el && !!(await page.$("[data-paar-vorschau]")), `„Nur dieses Element“ (Hintergrund): Vorschau mit der Schrift (${el})`);
if (await page.$("[data-farbrad-abbrechen]")) { await page.click("[data-farbrad-abbrechen]"); await sleep(200); }
await page.evaluate(() => document.querySelector("[data-farbmodus-zuruecksetzen]")?.click()); await sleep(300);

// ── Schritt 2 · A: Ampel in der Vorschau, Rückfrage nur bei kräftig/normal (nie sperren) ──
await kontext(SUB);
await page.evaluate(() => document.querySelector("[data-info-farbe]")?.click()); await sleep(600);
await page.click('[data-farbfeld-zeile="karte-t2"]'); await sleep(400);
const ampeln = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-flaeche-probe]")].map(b => [b.dataset.flaecheProbe, b.parentElement.querySelector("[data-lesbar]")?.dataset.lesbar])));
ok(Object.values(await ampeln()).every(x => x === "ok"), `Ampel: Vorlage überall ✓ (${JSON.stringify(await ampeln())})`);
await page.click('[data-flaeche-teil="karte-t3"]'); await sleep(200);
await hex("#f4f2ee");
ok((await ampeln())["karte-t3"] === "warn", "„Sehr leise“ fast unsichtbar: ⚠");
await page.click('[data-flaeche-teil="karte-t"]'); await sleep(200);
await hex("#d8d2ca");
ok((await ampeln())["karte-t"] === "warn", "„Normal“ blass: ⚠");
await page.click('[data-flaeche-teil="karte-t2"]'); await sleep(200);
await hex("#e2ddd6");
await page.click("[data-farbrad-anwenden]"); await sleep(250);
ok(!!(await page.$("[data-lesbar-frage]")) && /„Normal“/.test(await page.evaluate(() => document.querySelector("[data-lesbar-frage]").innerText)) && !/Sehr leise/.test(await page.evaluate(() => document.querySelector("[data-lesbar-frage]").innerText)),
  "Anwenden: Rückfrage nennt nur „Normal“ (sehr leise darf blass sein)");
await page.click("[data-lesbar-zurueck]"); await sleep(200);
ok(!(await page.$("[data-lesbar-frage]")) && !!(await page.$("[data-farbrad-anwenden]")), "„Zurück“: weiter einstellen");
await page.click("[data-farbrad-anwenden]"); await sleep(200);
await page.click("[data-lesbar-trotzdem]"); await sleep(300);
ok(await variable("karte-t") === "#d8d2ca" && await variable("karte-t2") === "#e2ddd6" && await variable("karte-t3") === "#f4f2ee", "„Trotzdem anwenden“: übernommen – nichts gesperrt");

// ── Schritt 2 · E: Gesamtprüfung ──
await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld] button")].find(b => b.textContent.trim() === "Schließen")?.click()); await sleep(200);
await page.click("[data-farbmodus-pruefen]"); await sleep(300);
const pr = await page.evaluate(() => ({ art: document.querySelector("[data-pruefung]")?.dataset.pruefung, titel: document.querySelector("[data-pruefung-titel]")?.textContent,
  zeilen: [...document.querySelectorAll("[data-pruefung-treffer]")].map(z => z.innerText.replace(/\s+/g, " ")) }));
ok(pr.art === "seite" && pr.zeilen.some(z => /Listen-Kachel · „1 Vokabel/.test(z)) && !pr.zeilen.some(z => /„Unit 1“/.test(z)), `🔍 Prüfen: blasse Unterzeile der Kachel gemeldet, kräftiger Name nicht (${pr.titel}: ${pr.zeilen.join(" | ")})`);
const nr = pr.zeilen.findIndex(z => /Listen-Kachel · „1 Vokabel/.test(z));
await page.click(`[data-pruefung-treffer="${nr}"]`); await sleep(700);
ok(!(await page.$("[data-pruefung]")) && !!(await page.$('[data-farbfeld-zeile="karte-t2"]')), "Treffer antippen: Farbfeld dieser Stelle mit „Karten · Leise“");
await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld] button")].find(b => b.textContent.trim() === "Schließen")?.click()); await sleep(200);
await page.click("[data-farbmodus-uebernehmen]"); await sleep(400);
ok(await page.evaluate(() => document.querySelector("[data-pruefung]")?.dataset.pruefung) === "uebernehmen", "Übernehmen: Rückfrage – Stellen schlechter lesbar als vorher");
await page.click("[data-pruefung-trotzdem]"); await sleep(500);
const nachName = await page.$("[data-farb-name-speichern]");
if (nachName) { await page.click("[data-farb-name-speichern]"); await sleep(400); }
const gesp = await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen")); return (e.eigeneSchemata || []).find(x => x.id === e.farbschema)?.farben || {}; });
ok(gesp["karte-t"] === "#d8d2ca" && !(await page.$("[data-farbmodus-uebernehmen]")), "„Trotzdem übernehmen“: gespeichert, Farbmodus beendet");
// ohne neue Probleme: Übernehmen ohne Rückfrage
await kontext(SUB);
await page.evaluate(() => document.querySelector("[data-info-farbe]")?.click()); await sleep(600);
await page.click('[data-farbfeld-zeile="karte"]'); await sleep(300);
await hex("#ffffff");   // heller: nichts wird schlechter lesbar
await page.click("[data-farbrad-anwenden]"); await sleep(250);
if (await page.$("[data-lesbar-trotzdem]")) { await page.click("[data-lesbar-trotzdem]"); await sleep(250); }
await page.evaluate(() => [...document.querySelectorAll("[data-farbfeld] button")].find(b => b.textContent.trim() === "Schließen")?.click()); await sleep(200);
await page.click("[data-farbmodus-uebernehmen]"); await sleep(400);
ok(!(await page.$("[data-pruefung]")) && !(await page.$("[data-farbmodus-uebernehmen]")), "Übernehmen ohne schlechter gewordene Stellen: ohne Rückfrage gespeichert");

// ── Schema-Editor: Flächen statt loser Schriften ──
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Einstellungen"))?.click()); await sleep(300);
await farbZeige(page, "[data-farben-bearbeiten]"); await page.click("[data-farben-bearbeiten]"); await sleep(400);
const rollen = await page.evaluate(() => [...document.querySelectorAll("[data-schema-editor] [data-farbrolle]")].map(z => z.dataset.farbrolle));
ok(rollen.includes("karte") && rollen.includes("haupt") && !rollen.includes("text2") && !rollen.includes("text-stark") && !rollen.includes("auf-haupt") && !rollen.includes("dialog-schrift"),
  `Schema-Editor: Flächen (Karten, Hauptfarbe …), keine losen Schriften (${rollen.length} Zeilen)`);
await page.click('[data-schema-editor] [data-farbrolle="haupt"]'); await sleep(300);
ok((await page.evaluate(() => [...document.querySelectorAll("[data-flaeche-teil]")].map(b => b.textContent).join("|"))) === "Hintergrund|Schrift", "Hauptfarbe: Hintergrund und ihre Schrift");
await page.click('[data-flaeche-teil="auf-haupt"]'); await sleep(200);
await hex("#ffff00");
await page.click("[data-farbrad-anwenden]"); await sleep(300);
const sch = await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("vokabel_einstellungen")); return e.eigeneSchemata.find(x => x.id === e.farbschema)?.farben; });
ok(sch?.["auf-haupt"] === "#ffff00", "Schema-Editor: Schrift auf der Hauptfarbe gespeichert");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
