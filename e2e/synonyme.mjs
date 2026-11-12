import puppeteer from "puppeteer-core";
import { listeOeffnen } from "./hilfen.mjs";
import { sessionLaden, zuListen, listeBereich } from "./hilfen.mjs";

// 117: Synonyme (Info-Spalte mit Art „Synonyme“, eigener Kasten, getipptes Synonym kein Fehler, Synonyme ergänzen)
// 121: „;“ = Alternativen (eine genügt, „auch: …“)
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(200); };
const tippe = async text => { await page.type("input.inp", text); await page.keyboard.press("Enter"); await sleep(400); };
const feedback = () => page.evaluate(() => document.querySelector(".quiz-feedback")?.textContent.trim() || "");
const frage = () => page.evaluate(() => document.querySelector(".quiz-frage-text")?.textContent.trim());
const beenden = async () => { await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Zur Übersicht|Übersicht/.test(b.textContent))?.click()); await sleep(300); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus: "schwer", gelerntSchwelle: 3 }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch",i1:"Synonyme"}[t] || "", aktiv: ["E1","D1","i1"].includes(t) }]));
  const l = { id:"l_en", name:"Words", sprache:"en", spalten: sp, naechste_id:4, vokabeln: [
    { id:1, E1:{wert:"hello; hi there",falsch:[]}, D1:{wert:"Hallo",falsch:[]}, i1:{wert:"hey, howdy",falsch:[]} },
    { id:2, E1:{wert:"big",falsch:[]}, D1:{wert:"groß",falsch:[]}, i1:{wert:"large; huge",falsch:[]} },
    { id:3, E1:{wert:"house",falsch:[]}, D1:{wert:"Haus",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:l.name, sprache:"en", platz:{z:0,s:0} }]));
  const basis = { listenIds:["l_en"], vokabelAuswahl:[], bereichTyp:"alle", quizInfoTypenSession:["i1"], quizZeigeInfo:{ i1:true }, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_2", name:"Deutsch-Englisch", timestamp:2, platz:{z:0,s:1}, sessionFortschritt:null,
      konfiguration:{ ...basis, quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{ E1:"tippen" } } },
    { id:"g_3", name:"Karte", timestamp:3, platz:{z:0,s:2}, sessionFortschritt:null,
      konfiguration:{ ...basis, quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{ E1:"karte" } } } ] }));
});
await page.reload(); await sleep(700);

// ── 121: Alternativen, 117: getipptes Synonym ist kein Fehler ──
await sessionLaden(page, "Deutsch-Englisch");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await frage() === "Hallo", `erste Frage Hallo (${await frage()})`);
await tippe("hi there");
const box = await page.evaluate(() => ({ richtig: document.querySelector(".quiz-antwort-box")?.className.includes("richtig"), auch: document.querySelector("[data-auch]")?.textContent.trim() }));
ok(box.richtig && /auch: hello/.test(box.auch || ""), `„hi there“ ist richtig (eine Alternative genügt), „auch: hello“ (${JSON.stringify(box)})`);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Weiter"))?.click()); await sleep(500);
ok(await frage() === "groß", `Frage groß (${await frage()})`);
await tippe("large");
ok(/Synonym/.test(await feedback()) && !(await page.evaluate(() => document.querySelector(".quiz-antwort-box")?.className.includes("falsch"))), `„large“: Hinweis Synonym, kein Fehler (${await feedback()})`);
await tippe("big");
ok(await page.evaluate(() => document.querySelector(".quiz-antwort-box")?.className.includes("richtig")), "danach „big“ richtig");
const sc = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_en")).vokabeln.find(v => v.id === 2).fortschritt?.score);
ok(sc === 1, `Synonym zählte nicht als Fehlversuch: Score +1 (${sc})`);
await beenden();

// ── 117: Synonym-Kasten in der Karte ──
await sessionLaden(page, "Karte");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(600);
ok(await page.$("[data-karte-syn-schalter]") && await page.$("[data-karte-syn]"), "Karte: Schalter „≈“ und Kasten Synonyme");
ok(!(await page.$("[data-karte-info]")), "kein Info-Kasten (die einzige Info-Spalte sind Synonyme)");
await klick("[data-karte-syn]");
const chips = await page.evaluate(() => [...document.querySelectorAll("[data-syn-chip]")].map(c => c.textContent).join(","));
ok(chips === "hey,howdy" || chips === "large,huge", `aufgeklappt: Synonyme als Felder (${chips})`);
await klick("[data-karte-syn-schalter]");
ok(!(await page.$("[data-karte-syn]")) && await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_einstellungen")).karteSyn === false), "„≈“ blendet die Synonyme dauerhaft aus");
await klick("[data-karte-syn-schalter]");
await beenden();

// ── 117: Spalten-Art und Synonyme ergänzen ──
await zuListen(page);
await page.evaluate(() => [...document.querySelectorAll(".karte-zeile")].find(e => e.textContent.includes("Words"))?.click()); await sleep(400); await listeOeffnen(page);
await listeBereich(page, "spalten");
ok(await page.evaluate(() => document.querySelector('[data-spalten-art="i1"] .toggle-opt.aktiv')?.dataset.spaltenArtWahl) === "synonyme", "Spalten: i1 „Synonyme“ (am Namen erkannt)");
await klick("[data-synonyme-ergaenzen]");
const stand = await page.evaluate(() => document.querySelector("[data-syn-stand]")?.textContent);
const prompt = await page.evaluate(() => document.querySelector("[data-syn-prompt]")?.value || "");
ok(/2 von 3/.test(stand) && /^3 \/\/ house \/\/ Haus$/m.test(prompt), `Fenster: Stand und Prompt nur für „house“ (${stand})`);
await page.type("[data-syn-antwort]", "3 // home, building"); await klick("[data-syn-uebernehmen]");
const v3 = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_liste_l_en")).vokabeln.find(v => v.id === 3).i1?.wert);
ok(v3 === "home, building" && /1 Vokabeln/.test(await page.evaluate(() => document.querySelector("[data-syn-meldung]")?.textContent)), `übernommen in die Synonym-Spalte (${v3})`);
ok(await page.$("[data-syn-fertig]"), "danach: alle Vokabeln haben Synonyme");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
