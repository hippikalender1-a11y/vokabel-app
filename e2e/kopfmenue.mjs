import puppeteer from "puppeteer-core";

// Lang drücken auf den Quiz-Namen im Kopf (zu und aufgeklappt): Speichern, Umbenennen, Duplizieren,
// Listen/Vokabeln ändern, Löschen – wie auf des Quiz-Kachel
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const langDruck = sel => page.evaluate(s => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 20, clientY: r.y + 10 })); }, sel);
const menue = () => page.evaluate(() => [...document.querySelectorAll("[data-info-aktion]")].map(b => b.dataset.infoAktion).filter(a => !/Farbe/.test(a)).join(" | "));
const zu = async () => { await page.keyboard.press("Escape"); await page.mouse.click(5, 300); await sleep(150); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const vokabeln = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, E1: { wert: `mot${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 5, vokabeln }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
  const k = { listenIds:["l_a"], vokabelAuswahl:[], bereichTyp:"alle", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1", quizAntwortTypenGeordnet:["E1"],
    quizInfoTypenSession:[], quizSpalteModus:{E1:"karte"}, quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" };
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[{ id:"g", name:"Mein Quiz", timestamp:1, konfiguration:k, sessionFortschritt:null, platz:{z:0,s:0} }] }));
});
await page.reload(); await sleep(600);
await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.click('[data-slot-id="g"]'); await sleep(900);   // 192: antippen lädt sofort

const ERWARTET = "💾 Speichern | ✎ Umbenennen | ⧉ Duplizieren | 📝 Listen/Vokabeln ändern | 🗑 Löschen";
// zugeklappt
ok(await page.evaluate(() => document.querySelector("[data-slot-kopf]").dataset.slotKopf) !== "offen", "Kopf zugeklappt");
await langDruck("[data-slot-kopf-name]"); await sleep(300);
ok(await menue() === ERWARTET, `zu: Menü wie auf der Kachel (${await menue()})`);
await zu(); await sleep(200);
// aufgeklappt
await page.click("[data-slot-kopf-name]"); await sleep(300);
ok(await page.evaluate(() => document.querySelector("[data-slot-kopf]").dataset.slotKopf) === "offen", "Kopf aufgeklappt");
await langDruck("[data-slot-kopf-name]"); await sleep(300);
ok(await menue() === ERWARTET, `auf: dasselbe Menü (${await menue()})`);
// Umbenennen öffnet das Fenster mit dem Namen
await page.click('[data-info-aktion="✎ Umbenennen"]'); await sleep(300);
const feld = await page.evaluate(() => [...document.querySelectorAll(".modal input")].map(i => i.value).join("|"));
ok(/Mein Quiz/.test(feld), `Umbenennen: Fenster mit dem Namen (${feld})`);
await zu(); await page.evaluate(() => document.querySelector(".overlay")?.click()); await sleep(300);
// Löschen fragt nach
await langDruck("[data-slot-kopf-name]"); await sleep(300);
await page.click('[data-info-aktion="🗑 Löschen"]'); await sleep(300);
ok(await page.evaluate(() => /löschen/i.test(document.querySelector(".modal")?.textContent || "")), "Löschen: Rückfrage");

// ohne gespeichertes Quiz: nur Speichern
await page.evaluate(() => document.querySelector(".overlay")?.click()); await sleep(200);
await page.evaluate(() => { localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[] })); localStorage.removeItem("vokabel_letzter_slot"); });
await page.reload(); await sleep(600);
await page.evaluate(() => { if (document.querySelector('[data-slot-kopf="offen"]')) document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300);
await page.evaluate(() => document.querySelector("[data-neue-session]") || null);
await langDruck("[data-slot-kopf-name]"); await sleep(300);
const m2 = await menue();
ok(!/Umbenennen|Löschen/.test(m2), `ungespeichert: keine Verwaltung (${m2 || "–"})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
