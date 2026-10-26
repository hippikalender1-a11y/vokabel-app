import puppeteer from "puppeteer-core";

const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1300 });
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
  if (!done) throw new Error(`nicht gefunden: ${sel} "${text}"`);
  await sleep(300);
};
const text = () => page.evaluate(() => document.body.innerText);
const listenZeilen = () => page.evaluate(() => (document.body.innerText.match(/\b(aller|venir|partir|sortir) – /g) || []).length);

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:5, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]},  D1:{wert:"gehen",falsch:[]},     fortschritt: f(3) },
    { id:2, E1:{wert:"venir",falsch:[]},  D1:{wert:"kommen",falsch:[]},    fortschritt: f(3) },
    { id:3, E1:{wert:"partir",falsch:[]}, D1:{wert:"abfahren",falsch:[]},  fortschritt: f(2) },
    { id:4, E1:{wert:"sortir",falsch:[]}, D1:{wert:"ausgehen",falsch:[]} },
  ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
});
await page.reload(); await sleep(500);

// ── Statistik der ganzen Liste ──
await clickText(".tab", "Statistik");
await sleep(400);
let t = await text();
console.log("     Kopf:", (t.match(/Lernfortschritt[\s\S]{0,80}/) || [""])[0].replace(/\n/g, " | "));
ok(/67 %/.test(t), "Lernfortschritt 67 % (100+100+67+0)/4");
ok(/2 \/ 4 gelernt/.test(t), "„2 / 4 gelernt“");
ok(await page.evaluate(() => [...document.querySelectorAll("svg g")].some(g => g.querySelectorAll("text")[0]?.textContent === "✓ Gelernt" && g.querySelectorAll("text")[1]?.textContent.startsWith("2 ·"))), "Kreis „✓ Gelernt 2“");
ok(await listenZeilen() === 4, "Liste zeigt alle 4 Vokabeln");
await page.screenshot({ path: "fortschritt_alle.png" });

await page.evaluate(() => [...document.querySelectorAll("svg g")].find(g => g.querySelector("text")?.textContent === "✓ Gelernt")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
await sleep(300);
t = await text();
ok(await listenZeilen() === 2, `Gelernt ausgeblendet: Liste zeigt 2 Vokabeln (${await listenZeilen()})`);
// ohne Gelernte: partir 67 %, sortir 0 % → 33 %
ok(/33 %/.test(t) && /0 \/ 2 gelernt/.test(t), "Lernfortschritt folgt dem Filter: 33 %, 0 / 2 gelernt");

// ── Quiz-Runde: gelernte sind ausgeblendet → partir + sortir, beide gewusst ──
await clickText(".tab", "Quiz");
await clickText(".quiz-setup-check", "Verbes");
await page.evaluate(() => { const b = [...document.querySelectorAll(".toggle-opt")].find(x => x.textContent.trim() === "Alle" && /Pakete|V\./.test(x.nextElementSibling?.textContent || "")); b?.click(); }); await sleep(300);
await clickText("button", "Quiz starten (2");
await sleep(400);
for (let k = 0; k < 2; k++) {
  await page.evaluate(() => document.querySelector(".sektion[style*='pointer']")?.click());
  await sleep(250);
  await clickText(".karte-btn", "Gewusst");
  await sleep(1200);
}
await clickText("button", "Zur Statistik");
await sleep(500);
t = await text();
console.log("     Runde:", (t.match(/Lernfortschritt[\s\S]{0,90}/) || [""])[0].replace(/\n/g, " | "));
// partir 2→3 (100 %), sortir –→1 (33 %): (100+33)/2 = 67 %, vorher (67+0)/2 = 33 % → +33
const kopfR = (t.match(/Lernfortschritt[\s\S]{0,60}/) || [""])[0];
ok(/67 %/.test(kopfR) && !/\+33|Session|Global/.test(kopfR), "Runden-Statistik: nur Prozent (67 %), kein „+“ und kein Global/Session");
ok(/1 \/ 2 gelernt/.test(t), "Runde: „1 / 2 gelernt“");
await page.screenshot({ path: "fortschritt_runde.png" });

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
