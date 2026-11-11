import puppeteer from "puppeteer-core";
import { quizEinstellungen } from "./hilfen.mjs";

// 109–113: Session-Auswahl – antippen wählt nur aus (Info darunter), grüner Kopf-Knopf lädt; Vokabeln ansehen mit Listen-Nr. und Lücken;
// Namensvorschlag „Engl 11.11.“; Duplizieren im Ordner
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(250); };
const kopf = () => page.evaluate(() => document.querySelector("[data-slot-kopf-name]")?.innerText.trim());
const kopfOffen = () => page.evaluate(() => document.querySelector("[data-slot-kopf]")?.dataset.slotKopf === "offen");

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ gelerntSchwelle: 2 }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, E1: { wert: `word${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] },
    ...(i < 2 ? { fortschritt: { score: 3, letzteAbfrage: "2026-11-01T10:00:00Z" } } : i === 2 ? { fortschritt: { score: -1, letzteAbfrage: "2026-11-05T10:00:00Z" } } : {}) }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 11, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
  const k = sel => ({ listenIds:["l_a"], vokabelAuswahl: sel.map(n => `l_a__${n}`), bereichTyp: sel.length ? "bereich" : "alle", quizAusgewaehlt:["E1","D1"], quizFrageTyp:"D1",
    quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{ E1:"karte" }, quizInfoTypenSession:[], quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], ordner:[{ id:"o_1", name:"Gruppe", platz:{z:1,s:0} }], gespeichert:[
    { id:"g_1", name:"Stücke", timestamp:1, platz:{z:0,s:0}, sessionFortschritt:null, konfiguration: k([1,2,3,4,8,9]) },
    { id:"g_2", name:"Ganze Liste", timestamp:2, platz:{z:0,s:1}, sessionFortschritt:null, konfiguration: k([]) },
    { id:"g_3", name:"Im Ordner", timestamp:3, ordner:"o_1", platz:{z:0,s:0}, sessionFortschritt:null, konfiguration: k([5]) } ] }));
});
await page.reload(); await sleep(700);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await quizEinstellungen(page);
if (!(await kopfOffen())) { await klick("[data-slot-kopf-name]"); }
ok(await kopfOffen(), "Session-Auswahl offen");

// ── 109: antippen wählt nur aus ──
await klick('[data-slot-id="g_1"]');
ok(await kopfOffen() && await page.$('[data-slot-vorschau="g_1"]') && await page.$('[data-slot-id="g_1"][data-vorschau]'), "Kachel antippen: Auswahl bleibt offen, Kachel markiert, Info darunter");
ok(/✓ Stücke laden/.test(await kopf() || "") && await page.$('[data-slot-laden="gespeichert:g_1"]'), `Kopf: grüner Knopf „✓ Stücke laden“ (${await kopf()})`);
// ── 110: Info ──
const info = await page.evaluate(() => ({
  listen: document.querySelector("[data-vorschau-listen]")?.innerText.trim(),
  zahlen: document.querySelector("[data-vorschau-zahlen]")?.innerText.trim(),
  gruppen: document.querySelector("[data-vorschau-gruppen]")?.innerText.trim(),
  zuletzt: document.querySelector("[data-vorschau-zuletzt]")?.innerText.trim(),
  einst: document.querySelector("[data-vorschau-einst]")?.innerText.trim(),
  kreise: document.querySelectorAll("[data-slot-vorschau] .mini-kreise [data-mini-kreis]").length,
}));
console.log("     Info:", JSON.stringify(info));
ok(/Unit 1/.test(info.listen) && /Nr\. 1–4, 8–9/.test(info.listen), "Info: Liste mit Bereichen „Nr. 1–4, 8–9“");
ok(/6 Vokabeln/.test(info.zahlen) && /33 % gelernt/.test(info.zahlen), `Info: 6 Vokabeln, 33 % gelernt (${info.zahlen})`);
ok(/2 gelernt/.test(info.gruppen) && /1 in Arbeit|3 nie/.test(info.gruppen) && /1 negativ/.test(info.gruppen), `Info: Gruppen (${info.gruppen})`);
ok(/Zuletzt abgefragt/.test(info.zuletzt) && !/noch nie/.test(info.zuletzt), `Info: zuletzt abgefragt (${info.zuletzt})`);
ok(/Deutsch → Englisch/.test(info.einst) && /Karte/.test(info.einst), `Info: Einstellungen kurz (${info.einst})`);
ok(info.kreise >= 1, "Info: Ü/D/A-Kreise");
// ── 111: Vokabeln ansehen ──
await klick("[data-vorschau-vokabeln]");
const liste = await page.evaluate(() => [...document.querySelectorAll("[data-vorschau-vokliste] > div > *")].map(e => e.dataset.vorschauNr || `L${e.dataset.vorschauLuecke}`).join(","));
ok(liste === "1,2,3,4,L5-7,8,9,L10-10", `Vokabeln: nur enthaltene mit Nr., Lücken als Trennzeile (${liste})`);
// andere Kachel antippen: wechselt
await klick('[data-slot-id="g_2"]');
ok(/✓ Ganze Liste laden/.test(await kopf() || "") && !(await page.$("[data-vorschau-vokliste]")), `andere Kachel: wechselt, Liste wieder zu (${await kopf()})`);
ok(/alle 10/.test(await page.evaluate(() => document.querySelector("[data-vorschau-listen]")?.innerText)), "ganze Liste: „alle 10“");
// laden über den Kopf
await klick("[data-slot-laden]"); await sleep(600);
ok(!(await kopfOffen()) && /Ganze Liste/.test(await kopf() || ""), `grüner Knopf lädt die Session und schließt die Auswahl (${await kopf()})`);

// ── 113: Duplizieren im Ordner ──
await klick("[data-slot-kopf-name]");
await klick('[data-ordner-id="o_1"]');
await page.evaluate(() => { const el = document.querySelector('[data-slot-id="g_3"]'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === "⧉ Duplizieren")?.click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".modal button")].find(b => /Duplizieren|Speichern|OK/.test(b.textContent))?.click()); await sleep(400);
const kopie = await page.evaluate(() => JSON.parse(localStorage.getItem("vokabel_slots")).gespeichert.find(g => g.name.includes("Kopie")));
ok(kopie && kopie.ordner === "o_1", `Duplikat liegt im selben Ordner (${JSON.stringify(kopie && { name: kopie.name, ordner: kopie.ordner })})`);

// ── 112: Namensvorschlag ──
const vorschlag = await page.evaluate(() => {
  const heute = new Date(); return `Engl ${String(heute.getDate()).padStart(2, "0")}.${String(heute.getMonth() + 1).padStart(2, "0")}.`;
});
await page.evaluate(() => document.querySelector("[data-ordner-zurueck]")?.click()); await sleep(200);
await page.evaluate(() => { const el = document.querySelector("[data-slot-kopf-name]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(300);
await klick("[data-slot-id=\"g_2\"]");
await klick("[data-slot-laden]"); await sleep(500);
// Neues Quiz → Speichern
await page.evaluate(() => { const el = document.querySelector("[data-slot-kopf-name]"); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 })); }); await sleep(300);
const aktionen = await page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion));
const speichern = aktionen.find(a => /Als neue Session|Speichern/.test(a));
if (speichern) { await page.evaluate(l => [...document.querySelectorAll("[data-info-aktion]")].find(b => b.dataset.infoAktion === l)?.click(), speichern); await sleep(300); }
const feld = await page.evaluate(() => document.querySelector(".modal input")?.value || "");
ok(feld === vorschlag, `Namensvorschlag „${vorschlag}“ (${feld || "kein Speichern-Fenster: " + aktionen.join("|")})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
