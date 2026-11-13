import puppeteer from "puppeteer-core";

// 189: Tagesstand auf der Kachel ohne ruhende Gelernte (voll, wenn alles außer den Gelernten heute dran war);
// Paket-Ende: heute schon abgefragte zählen nicht als Rest → „Für heute geschafft“ statt eines toten „Letzte N Vokabeln“
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const klick = async sel => { await page.evaluate(s => document.querySelector(s)?.click(), sel); await sleep(300); };
const auswahlAuf = async () => { await page.evaluate(() => { const k = document.querySelector("[data-slot-kopf]"); if (k && k.dataset.slotKopf !== "offen") document.querySelector("[data-slot-kopf-name]").click(); }); await sleep(300); };
const laden = async id => { await auswahlAuf(); await klick(`[data-slot-id="${id}"]`); await klick("[data-slot-laden]"); await sleep(300); };
const heute = id => page.evaluate(i => document.querySelector(`[data-slot-id="${i}"]`)?.dataset.heute, id);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_stufen_v1", "1");
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ wiederholTage:[3650,3650,3650,3650], modus: "schwer" }));
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const jetzt = new Date().toISOString(), gestern = new Date(Date.now() - 86400000 * 1.5).toISOString(), alt = new Date(Date.now() - 86400000 * 10).toISOString();
  const w = (id, e, d, f) => ({ id, E1: { wert: e, falsch: [] }, D1: { wert: d, falsch: [] }, ...(f ? { fortschritt: f } : {}) });
  localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unit 1", sprache:"en", spalten: sp, naechste_id: 6, vokabeln: [
    w(1, "one", "eins", { score: 1, letzteAbfrage: jetzt }),
    w(2, "two", "zwei", { score: 1, letzteAbfrage: gestern }),
    w(3, "three", "drei"),
    w(4, "four", "vier", { score: 3, letzteAbfrage: alt, stufeSeit: alt }),
    w(5, "five", "fünf", { score: 3, letzteAbfrage: jetzt, stufeSeit: alt })] }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unit 1", sprache:"en", platz:{z:0,s:0} }]));
  const k = ids => ({ listenIds:["l_a"], vokabelAuswahl: ids.map(i => `l_a__${i}`), bereichTyp:"bereich", quizBereichTyp:"bereich", quizAusgewaehlt:["D1","E1"], quizFrageTyp:"D1",
    quizAntwortTypenGeordnet:["E1"], quizSpalteModus:{ E1:"karte" }, quizInfoTypenSession:[], quizZeigeInfo:{}, quizModus:"sequenziell", quizReihenfolge:"listennr" });
  localStorage.setItem("vokabel_slots", JSON.stringify({ verlauf:[], gespeichert:[
    { id:"g_a", name:"Heute + gelernt", timestamp:1, platz:{z:0,s:0}, sessionFortschritt:null, konfiguration:k([1, 4]) },
    { id:"g_b", name:"Gemischt", timestamp:2, platz:{z:1,s:0}, sessionFortschritt:null, konfiguration:k([1, 2, 4, 5]) },
    { id:"g_c", name:"Paket", timestamp:3, platz:{z:2,s:0}, sessionFortschritt:null, konfiguration:k([1, 2, 3]) }] }));
});
await page.reload(); await sleep(800);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz"))?.click()); await sleep(300);
await auswahlAuf();

// ── Kachel: ruhende Gelernte zählen nicht ──
ok(await heute("g_a") === "100", `heute abgefragt + ruhende gelernte: Kachel ganz gefüllt (${await heute("g_a")})`);
ok(await heute("g_b") === "67", `„eins“ + „fünf“ (heute) von „eins“, „zwei“, „fünf“ (ohne ruhende „vier“): 67 % (${await heute("g_b")})`);

// ── Paket-Ende: der Rest ist heute schon abgefragt ──
await laden("g_c");
await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
for (let i = 0; i < 6; i++) {
  if (!(await page.$("[data-karte-verdeckt]"))) break;
  await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(250);
  await page.evaluate(() => [...document.querySelectorAll(".karte-btn-ja")].find(b => b.textContent.includes("Gewusst"))?.click()); await sleep(1200);
}
const ende = await page.evaluate(() => ({ titel: document.querySelector(".topbar-title")?.textContent.trim(), fertig: document.querySelector("[data-heute-fertig]")?.textContent.trim(),
  weiter: !!document.querySelector("[data-naechstes-paket]"), pause: !!document.querySelector("[data-pause]"), stand: document.querySelector(".quiz-fortschritt")?.textContent.trim() }));
ok(ende.titel === "Für heute fertig" && /Für heute geschafft · 1 morgen/.test(ende.fertig || "") && !ende.weiter && ende.pause && ende.stand === "2/3",
  `Paket-Ende: „Für heute fertig“, kein „Letzte 1 Vokabel“, Pause bleibt, Stand 2/3 (${JSON.stringify(ende)})`);

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
