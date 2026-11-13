import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { zuListen } from "./hilfen.mjs";

// 190: Quiz schließen → Quiz-Tab mit offener Session-Auswahl; 191: „Alle Sessions“ gelb;
// 192: Gesten – antippen übernimmt sofort, kurz halten wählt (Blätter-Modus), lang halten startet die Mehrfach-Auswahl,
//      darin kurz halten = dazu, lang halten = übernehmen;
// 193/194: Ordner bis 3 Ebenen (Sessions und Listen), leere Ordner über Pfad, Ordner-Kachel und freien Platz;
// 195: Import in den geöffneten Listen-Ordner bzw. in einen neuen Ordner darin
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
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
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const aktion = async label => { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), label); await sleep(400); };
const ordnerAnlegen = async name => {
  await page.evaluate(n => { const f = document.querySelector("[data-in-gruppe-dialog] [data-ordner-name-feld]");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, n); f.dispatchEvent(new Event("input", { bubbles: true })); }, name);
  await sleep(150);
  await page.evaluate(() => document.querySelector("[data-ordner-neu]")?.click()); await sleep(400);
};
const slots = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")));
const kopf = () => page.evaluate(() => ({ zustand: document.querySelector("[data-slot-kopf]")?.dataset.slotKopf, name: document.querySelector("[data-slot-kopf-name]")?.textContent.trim(),
  laden: document.querySelector("[data-slot-laden]")?.dataset.slotLaden || null, multi: [...document.querySelectorAll("[data-multi-nr]")].map(b => b.dataset.slotId).join(",") }));
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(400); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const liste = (id, name) => ({ id, name, sprache:"en", spalten: sp, naechste_id: 11,
    vokabeln: Array.from({length:10},(_, i) => ({ id: i+1, E1: { wert: "word"+i, falsch: [] }, D1: { wert: "Wort"+i, falsch: [] } })) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify(liste("l_a", "Unit 1")));
  localStorage.setItem("vokabel_liste_l_b", JSON.stringify(liste("l_b", "Unit 2")));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }, { id:"l_b", name:"Unit 2", sprache:"en", platz:{z:1,s:0} }]));
  const k = (von, bis) => ({ listenIds:["l_a"], vokabelAuswahl: Array.from({length: bis - von + 1}, (_, i) => `l_a__${von + i}`), bereichTyp:"bereich", quizBereichTyp:"bereich",
    quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"], quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert: [1, 2, 3].map(i =>
    ({ id:"s"+i, name:"Teil "+i, timestamp:i, konfiguration:k(i * 3 - 2, i * 3), sessionFortschritt:null, platz:{z:i - 1,s:0} })) }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();

// ── 191: „Alle Sessions“ gelb ──
const farbe = await page.evaluate(() => getComputedStyle(document.querySelector("[data-alle-sessions]")).backgroundColor);
ok(farbe === "rgb(246, 196, 69)", `„Alle Sessions“ in Ordner-Gelb (${farbe})`);

// ── 192: antippen übernimmt sofort ──
await halte('[data-slot-id="s1"]', 60); await sleep(500);
let k = await kopf();
ok(k.zustand !== "offen" && /Teil 1/.test(k.name), `antippen lädt „Teil 1“ sofort, Auswahl zu (${JSON.stringify(k)})`);

// kurz halten: nur auswählen (Blätter-Modus) – danach wechselt antippen nur die Karte
await auswahlAuf();
await halte('[data-slot-id="s2"]', 450);
k = await kopf();
ok(k.zustand === "offen" && k.laden === "gespeichert:s2", `kurz halten wählt „Teil 2“ (nicht geladen) (${JSON.stringify(k)})`);
await halte('[data-slot-id="s3"]', 60);
k = await kopf();
ok(k.zustand === "offen" && k.laden === "gespeichert:s3", `danach antippen wechselt nur die Karte (${JSON.stringify(k)})`);

// lang halten: Mehrfach-Auswahl; kurz halten: dazu; lang halten: übernehmen (Multiquiz)
await halte('[data-slot-id="s1"]', 1100);
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].length && null);
k = await kopf();
ok(k.multi === "s1", `lang halten startet die Mehrfach-Auswahl mit „Teil 1“ (${k.multi})`);
await halte('[data-slot-id="s2"]', 450);
k = await kopf();
ok(k.multi === "s1,s2", `darin kurz halten nimmt „Teil 2“ dazu (${k.multi})`);
await halte('[data-slot-id="s3"]', 1100); await sleep(400);
k = await kopf();
ok(k.zustand !== "offen" && /Multiquiz/.test(k.name), `lang halten übernimmt die Auswahl samt „Teil 3“ als Multiquiz (${JSON.stringify(k)})`);

// ── 190: Quiz schließen → Session-Auswahl offen ──
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(800);
const imQuiz = await page.evaluate(() => !!document.querySelector(".topbar-back"));
await page.evaluate(() => document.querySelector(".topbar-back")?.click()); await sleep(600);   // Beenden → Auswertung
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Zur Übersicht")?.click()); await sleep(600);
k = await kopf();
ok(imQuiz && k.zustand === "offen", `nach „Zur Übersicht“: Quiz-Tab mit offener Session-Auswahl (${k.zustand})`);

// ── 193/194: leere Ordner, drei Ebenen ──
await kontext("[data-alle-sessions]");
ok((await menue()).includes("📁 Neuer Ordner"), "Lang-Druck auf „Alle Sessions“: „📁 Neuer Ordner“");
await aktion("📁 Neuer Ordner");
ok(await page.$('[data-in-gruppe-dialog="neu"]') !== null, "Dialog „Neuer Ordner“");
await ordnerAnlegen("A");
let d = await slots();
const oA = d.ordner?.find(o => o.name === "A");
ok(oA && !oA.ordner, "leerer Ordner „A“ oben angelegt");
await page.evaluate(id => document.querySelector(`[data-ordner-id="${id}"]`)?.click(), oA?.id); await sleep(400);
ok(await page.$("[data-freier-platz]") !== null, "leerer Ordner zeigt freie Plätze");
await kontext("[data-ordner-name]");
await aktion("📁 Neuer Ordner");
await ordnerAnlegen("B");
d = await slots();
const oB = d.ordner.find(o => o.name === "B");
ok(oB?.ordner === oA.id, "Lang-Druck auf den Ordnernamen: Unterordner „B“ in „A“");
await page.evaluate(id => document.querySelector(`[data-ordner-id="${id}"]`)?.click(), oB?.id); await sleep(400);
await kontext("[data-freier-platz]");
ok((await menue()).includes("📁 Neuer Ordner"), "Lang-Druck auf freien Platz: „📁 Neuer Ordner“");
await aktion("📁 Neuer Ordner");
await ordnerAnlegen("C");
d = await slots();
const oC = d.ordner.find(o => o.name === "C");
ok(oC?.ordner === oB.id && oC.platz?.z === 0 && oC.platz?.s === 0, `„C“ in „B“ auf dem gedrückten Platz (${JSON.stringify(oC?.platz)})`);
await page.evaluate(id => document.querySelector(`[data-ordner-id="${id}"]`)?.click(), oC?.id); await sleep(400);
const pfad = await page.evaluate(() => [...document.querySelectorAll("[data-ordner-pfad] > *")].map(e => e.textContent.trim()).join(" "));
ok(pfad === "← Alle Sessions › 📁 A › 📁 B › 📁 C", `Pfad mit drei Ebenen (${pfad})`);
await kontext("[data-ordner-name]");
ok(!(await menue()).includes("📁 Neuer Ordner"), "in der dritten Ebene kein weiterer Ordner");
await page.keyboard.press("Escape"); await sleep(200);
// Pfad-Teil antippen geht in diese Ebene
await page.evaluate(id => document.querySelector(`[data-ordner-pfad-teil="${id}"]`)?.click(), oA.id); await sleep(400);
if (!(await page.evaluate(() => document.querySelector("[data-ordner-name]")?.textContent.trim() === "› 📁 A"))) {   // der erste Tipp schloss nur das Menü
  await page.evaluate(id => document.querySelector(`[data-ordner-pfad-teil="${id}"]`)?.click(), oA.id); await sleep(400); }
const nachTipp = await page.evaluate(() => document.querySelector("[data-ordner-name]")?.textContent.trim());
ok(nachTipp === "› 📁 A", `Pfad-Teil „A“ antippen öffnet „A“ (${nachTipp})`);
// Session in den tiefsten Ordner (Dialog „In Ordner…“ mit Pfaden)
await page.evaluate(() => document.querySelector("[data-ordner-zurueck]")?.click()); await sleep(400);
await kontext('[data-slot-id="s3"]');
await aktion("📁 In Ordner…");
const ziele = await page.evaluate(() => [...document.querySelectorAll("[data-in-gruppe]")].map(b => b.querySelector("b").textContent));
ok(ziele.includes("📁 A › B › C"), `„In Ordner…“ zeigt die Pfade (${ziele.join(" | ")})`);
await page.evaluate(id => document.querySelector(`[data-in-gruppe="${id}"]`)?.click(), oC.id); await sleep(400);
d = await slots();
ok(d.gespeichert.find(x => x.id === "s3")?.ordner === oC.id, "„Teil 3“ liegt in „C“");
const anzahlA = await page.evaluate(id => document.querySelector(`[data-ordner-id="${id}"] [data-ordner-anzahl]`)?.dataset.ordnerAnzahl, oA.id);
ok(anzahlA === "1", `Ordner-Kachel „A“ zählt die Session in „C“ mit (${anzahlA})`);

// ── 193: Listen-Ordner ──
await zuListen(page);
const lFarbe = await page.evaluate(() => getComputedStyle(document.querySelector("[data-alle-listen]")).backgroundColor);
ok(lFarbe === "rgb(246, 196, 69)", `„Alle Listen“ gelb (${lFarbe})`);
await kontext("[data-alle-listen]");
await aktion("📁 Neuer Ordner");
await ordnerAnlegen("Englisch");
const lo = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_ordner") || "[]"));
const idx = () => page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_listen_index") || "[]"));
let lOrdner = await lo();
const oE = lOrdner.find(o => o.name === "Englisch");
ok(!!oE, "Listen-Ordner „Englisch“ angelegt");
await kontext('[data-liste-id="l_a"]');
await aktion("📁 In Ordner…");
await page.evaluate(id => document.querySelector(`[data-in-gruppe="${id}"]`)?.click(), oE?.id); await sleep(400);
ok((await idx()).find(l => l.id === "l_a")?.ordner === oE?.id, "„Unit 1“ liegt im Ordner „Englisch“");
const oben = await page.evaluate(() => ({ listen: [...document.querySelectorAll("[data-liste-id]")].map(e => e.dataset.listeId).join(","), ordner: document.querySelectorAll("[data-lordner-id]").length }));
ok(oben.listen === "l_b" && oben.ordner === 1, `oben: Ordner-Kachel + „Unit 2“ (${JSON.stringify(oben)})`);
await page.evaluate(id => document.querySelector(`[data-lordner-id="${id}"]`)?.click(), oE?.id); await sleep(400);
const drin = await page.evaluate(() => ({ listen: [...document.querySelectorAll("[data-liste-id]")].map(e => e.dataset.listeId).join(","), name: document.querySelector('[data-ordner-navi="liste"] [data-ordner-name]')?.textContent.trim() }));
ok(drin.listen === "l_a" && /Englisch/.test(drin.name || ""), `Ordner geöffnet: „Unit 1“, Pfad „Englisch“ (${JSON.stringify(drin)})`);
// Liste antippen öffnet sie sofort (192)
await halte('[data-liste-id="l_a"]', 60); await sleep(300);
const offen = await page.evaluate(() => !!document.querySelector("[data-liste-detail], [data-listen-bereich]") || !document.querySelector('[data-liste-id="l_a"]'));
ok(offen, "Liste antippen öffnet sie direkt");
await zuListen(page);
await page.evaluate(() => { document.querySelectorAll(".topbar-back").forEach(b => { if (/Zurück|Schließen|←/.test(b.textContent)) b.click(); }); }); await sleep(300);

// ── 195: Import in einen neuen Ordner im geöffneten Ordner ──
const datei = path.join(os.tmpdir(), "B9_alle_listen.json");
const jl = (id, name) => ({ id, name, sprache: "en", naechste_id: 2, spalten: { E1: { name: "Englisch", aktiv: true }, D1: { name: "Deutsch", aktiv: true } },
  vokabeln: [{ id: 1, E1: { wert: "cat", falsch: [] }, D1: { wert: "Katze", falsch: [] } }] });
fs.writeFileSync(datei, JSON.stringify([jl("x1", "B9-01"), jl("x2", "B9-02")]));
await page.evaluate(() => document.querySelector("[data-liste-neu]")?.click()); await sleep(500);
const input = await page.$('input[type="file"]');
await input.uploadFile(datei); await sleep(900);
ok(await page.$("[data-import-ordner]") !== null, "Import: Ordner-Wahl sichtbar");
await page.evaluate(() => document.querySelector("[data-import-neuer-ordner]")?.click()); await sleep(300);
const vorschlag = await page.evaluate(() => document.querySelector("[data-import-ordner-name]")?.value);
ok(vorschlag === "B9", `Ordnername aus dem Dateinamen vorbelegt (${vorschlag})`);
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Alle importieren/.test(b.textContent))?.click()); await sleep(800);
lOrdner = await lo();
const oB9 = lOrdner.find(o => o.name === "B9");
const neu = (await idx()).filter(l => /^B9-/.test(l.name));
ok(oB9?.ordner === oE?.id && neu.length === 2 && neu.every(l => l.ordner === oB9.id), `Import: 2 Listen im neuen Ordner „B9“ in „Englisch“ (${JSON.stringify(neu.map(l => l.ordner))})`);
fs.unlinkSync(datei);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
