import puppeteer from "puppeteer-core";

// Statistik „Akzente“ ohne Wörter mit Akzent: bleibt in der Statistik, Hinweis statt Kreis, Mitte „Akzente ⇄“ schaltet weiter
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
const mitte = async () => { await page.evaluate(() => document.querySelector("[data-kreismitte]").dispatchEvent(new MouseEvent("click", { bubbles: true }))); await sleep(300); };
const art = () => page.evaluate(() => document.querySelector("[data-kreismitte]")?.textContent.replace("⇄", "").trim());

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Englisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const l = { id:"l_en", name:"English", sprache:"en", spalten: sp, naechste_id:3, vokabeln: [
    { id:1, E1:{wert:"house",falsch:[]}, D1:{wert:"Haus",falsch:[]} },
    { id:2, E1:{wert:"tree",falsch:[]},  D1:{wert:"Baum",falsch:[]} } ] };
  localStorage.setItem("vokabel_liste_l_en", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_en", name:l.name, sprache:"en" }]));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click()); await sleep(400);

ok(await art() === "Übersetzung", "Start: Übersetzung");
await mitte(); await mitte();
const t = await page.evaluate(() => document.body.innerText);
ok(await art() === "Akzente", `Mitte zeigt „Akzente“ (${await art()})`);
ok(/Für diese Session sind keine Akzente vorhanden\./.test(t), "Hinweis: keine Akzente in dieser Session");
ok(!(await page.$("svg [data-kreismitte], svg path, svg circle")) && !/Zur Übersetzungs-Statistik/.test(t), "kein Kreisdiagramm, kein Wechsel-Knopf");
ok(/Vokabel-Auswahl/.test(t), "Statistik-Kopfzeilen bleiben");
await page.screenshot({ path: "keineakzente.png" });
await mitte();
ok(await art() === "Übersetzung" && await page.$("svg circle"), "Mitte antippen: weiter zu Übersetzung mit Kreis");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
