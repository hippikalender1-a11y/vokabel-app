import puppeteer from "puppeteer-core";

// Session-Durchlauf geschafft: große Überschrift („Geschafft!“ o. ä.) unter dem Balken, Knopf „Nochmal!“ startet die Session neu
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 900 });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, text, exact = false) => {
  const done = await page.evaluate((sel, text, exact) => {
    const el = [...document.querySelectorAll(sel)].find(e => exact ? e.textContent.trim() === text : e.textContent.trim().includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text, exact);
  // Ende eines Durchlaufs: „Weiter →“ führt zur Session-Auswertung mit den Knöpfen
  if (!done && await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); return clickText(sel, text, exact); }
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const titel = () => page.evaluate(() => document.querySelector(".topbar-title")?.textContent.trim());
const alleGewusst = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.$(".karte-aufdecken"))) break;
    await page.evaluate(() => document.querySelector(".sektion").click()); await sleep(250);
    await clickText(".karte-btn-ja", "Gewusst"); await sleep(1200);
  }
};

const weiterZurAuswertung = async () => { if (await page.$("[data-zur-auswertung]")) { await page.evaluate(() => document.querySelector("[data-zur-auswertung]").click()); await new Promise(r => setTimeout(r, 300)); } };
await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = [["aller","gehen"],["venir","kommen"],["voir","sehen"],["faire","machen"]];
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:5, vokabeln: w.map(([e, d], i) => ({ id:i+1, E1:{wert:e,falsch:[]}, D1:{wert:d,falsch:[]} })) };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
});
await page.reload(); await sleep(500);
await clickText(".tab", "Listen");
await clickText(".karte-zeile", "Verbes");
await clickText("button", "Quiz starten", true);
await clickText("[data-start-knopf]", "");
await sleep(300);
ok(await titel() === "1 / 4", `Session mit 4 Vokabeln (${await titel()})`);
await alleGewusst();

const jubel = await page.evaluate(() => {
  const j = document.querySelector("[data-jubel]"); if (!j) return null;
  const balken = [...document.querySelectorAll("div")].find(d => d.style.height === "10px" && d.style.borderRadius === "8px");
  return { titel: j.querySelector(".jubel-titel").textContent.trim(), sub: j.querySelector(".jubel-sub").textContent.trim(),
    groesse: parseFloat(getComputedStyle(j.querySelector(".jubel-titel")).fontSize),
    unterBalken: balken ? balken.getBoundingClientRect().bottom <= j.getBoundingClientRect().top : false };
});
console.log("     Jubel:", JSON.stringify(jubel));
ok(await titel() === "Durchlauf abgeschlossen", "Durchlauf abgeschlossen");
ok(["Geschafft!", "Super gemacht!", "Session gemeistert!", "Stark!", "Ziel erreicht!", "Bravo!", "Klasse!", "Alles durch!"].includes(jubel?.titel), "große Überschrift aus der Auswahl");
ok(jubel?.groesse >= 28 && jubel.unterBalken, "Überschrift groß und unter dem Balken");
ok(/Alle 4 Vokabeln/.test(jubel?.sub || ""), "Unterzeile: alle 4 Vokabeln");
await sleep(600);
await page.screenshot({ path: "jubel.png" });

ok(await page.$("[data-zur-auswertung]") && !(await page.$("[data-nochmal]")), "erster Bildschirm: nur „Weiter →“, kein „Nochmal!“");
await weiterZurAuswertung();
const ausw = await page.evaluate(() => ({ titel: document.querySelector(".topbar-title")?.textContent.trim(), text: document.querySelector("[data-session-auswertung]")?.innerText.replace(/\s+/g, " ") || "",
  balken: [...document.querySelectorAll("[data-balken]")].map(b => b.dataset.balken).join(",") }));
console.log("     Auswertung:", ausw.text.slice(0, 260));
ok(ausw.titel === "Session-Auswertung" && ausw.balken === "Start,Ende", "„Weiter →“: Session-Auswertung mit Balken Start/Ende");
ok(/Ganze Session · 4 Vokabeln/i.test(ausw.text) && /Neu gelernt/.test(ausw.text) && /Lernfortschritt 0 % → 33 %/.test(ausw.text), "Kennzahlen: ganze Session, Lernfortschritt 0 % → 33 %");
ok(/Auf Anhieb gewusst 4 von 4/.test(ausw.text) && /Vokabeln 4 in 1 Paket/.test(ausw.text) && /Dauer/.test(ausw.text), "Zusatzdaten: auf Anhieb 4 von 4, 1 Paket, Dauer");
ok(await page.$("[data-nochmal]"), "darunter die gewohnten Knöpfe (Nochmal!)");
await page.click("[data-nochmal]"); await sleep(600);
ok(await titel() === "1 / 4", `„Nochmal!“: Session startet neu mit 4 Vokabeln (${await titel()})`);
await alleGewusst();
ok(await titel() === "Durchlauf abgeschlossen" && await page.$("[data-jubel]"), "zweiter Durchlauf wieder bis zum Ende");
await clickText("button", "Zur Übersicht"); await sleep(400);
ok(!(await page.$('[data-anzahl="fortschritt"]')) || await page.evaluate(() => document.querySelector('[data-anzahl="fortschritt"]').textContent.trim().startsWith("0")),
  "danach: Abgefragt-Stand wieder bei 0");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
