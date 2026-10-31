import puppeteer from "puppeteer-core";

// Quiz-Tab: immer nur ein Bereich offen – ein anderer Knopf schließt den vorherigen
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
// welche Bereiche sind offen?
const offen = () => page.evaluate(() => [
  document.querySelector("[data-slot-kopf]")?.dataset.slotKopf === "offen" && "kopf",
  document.querySelector("[data-abfragemodus]")?.classList.contains("offen") && "modus",
  document.querySelector("[data-reihenfolge]")?.classList.contains("offen") && "reihenfolge",
  document.querySelector("[data-umfang]")?.classList.contains("offen") && "umfang",
  document.querySelector("[data-abfrageziel]")?.classList.contains("offen") && "ziel",
].filter(Boolean).join(","));
const tippe = async sel => { await page.evaluate(sel => document.querySelector(sel).click(), sel); await sleep(300); };

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const w = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, E1: { wert: "w" + i, falsch: [] }, D1: { wert: "d" + i, falsch: [] }, ...(i < 3 ? { fortschritt: { score: 8 } } : {}) }));
  localStorage.setItem("vokabel_liste_l", JSON.stringify({ id:"l", name:"Englisch 6", sprache:"en", spalten: sp, naechste_id: 13, vokabeln: w }));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l", name:"Englisch 6", sprache:"en" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", gelerntSchwelle:6, sprache:"alle" }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent.includes("Quiz")).click()); await sleep(300);
await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(t => t.textContent.includes("Englisch")).click()); await sleep(300);
// Listen-Auswahl zu (falls offen)
await page.evaluate(() => window.scrollTo(0, 0));

await tippe("[data-umfang]");
ok(await offen() === "umfang", `Umfang offen (${await offen()})`);
await tippe("[data-reihenfolge]");
ok(await offen() === "reihenfolge", `Reihenfolge antippen schließt Umfang (${await offen()})`);
await tippe("[data-abfragemodus]");
ok(await offen() === "modus", `Modus antippen schließt Reihenfolge (${await offen()})`);
await tippe("[data-abfrageziel]");
ok(await offen() === "ziel", `Abfrage-Ziel antippen schließt Modus (${await offen()})`);
await tippe("[data-umfang]");
ok(await offen() === "umfang", `Umfang antippen schließt Abfrage-Ziel (${await offen()})`);
await tippe("[data-slot-kopf-name]");
ok(await offen() === "kopf", `Kopfzeile öffnen schließt Umfang (${await offen()})`);
await tippe("[data-reihenfolge]");
ok(await offen() === "reihenfolge", `Reihenfolge schließt die Kopfzeile (${await offen()})`);
await tippe("[data-stufe]");
ok(await offen() === "", `Leicht/Schwer antippen schließt den offenen Bereich (${await offen()})`);
await tippe("[data-abfrageziel]");
await tippe("[data-gelernte]");
ok(await offen() === "", `Gelernte antippen schließt den offenen Bereich (${await offen()})`);
await tippe("[data-reihenfolge]");
await tippe("[data-reihenfolge]");
ok(await offen() === "", "nochmal antippen schließt den eigenen Bereich");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
