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
const text = () => page.evaluate(() => document.body.innerText);
const box = async (label) => {
  const done = await page.evaluate(l => {
    // Filter jetzt über das Kreisdiagramm (Segment) bzw. den Knopf "Gesamt N"
    if (l === "Gesamt") { const b = [...document.querySelectorAll("button")].find(x => /^Gesamt \d+$/.test(x.textContent.trim())); b?.click(); return !!b; }
    const g = [...document.querySelectorAll("svg g")].find(x => x.querySelector("text")?.textContent === l);
    g?.dispatchEvent(new MouseEvent("click", { bubbles: true })); return !!g;
  }, label);
  if (!done) throw new Error("Box fehlt: " + label);
  await sleep(300);
};
const zeilen = () => page.evaluate(() => {
  return [...document.querySelectorAll("div")].filter(d => d.style.padding === "7px 12px").map(d => ({
    text: d.firstElementChild.textContent.split(" – ")[0],
    bg: d.style.background,
    rechts: d.lastElementChild.firstElementChild.textContent.trim(),
    balken: (() => { const b = d.children[1].firstElementChild; return b && (b.style.width || b.style.right) ? { left: b.style.left, right: b.style.right, width: b.style.width, farbe: b.style.background } : null; })(),
    nullLinie: d.children[1].lastElementChild.style.left,
  }));
});

await page.goto(URL);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("vokabel_statistik_liste_zu", "false");  // Vokabelliste offen
  const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
  const f = s => ({ score: s, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" });
  const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:6, vokabeln: [
    { id:1, E1:{wert:"aller",falsch:[]},  D1:{wert:"gehen",falsch:[]},    fortschritt: f(3) },
    { id:2, E1:{wert:"venir",falsch:[]},  D1:{wert:"kommen",falsch:[]},   fortschritt: f(4) },
    { id:3, E1:{wert:"partir",falsch:[]}, D1:{wert:"abfahren",falsch:[]}, fortschritt: f(2) },
    { id:4, E1:{wert:"sortir",falsch:[]}, D1:{wert:"ausgehen",falsch:[]} },
    { id:5, E1:{wert:"voir",falsch:[]},   D1:{wert:"sehen",falsch:[]},    fortschritt: f(-2) },
  ] };
  localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
  localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
  localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
});
await page.reload(); await sleep(500);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click());
await sleep(500);

let t = await text();
// (100 + 100 + 67 + 0 + 0) / 5 = 53 %
ok(/53 %/.test(t) && /2 \/ 5 gelernt/.test(t), "Lernfortschritt 53 %, 2 / 5 gelernt");
const boxen = await page.evaluate(() => [...document.querySelectorAll("svg g")].map(g => g.querySelectorAll("text")[0].textContent + "=" + g.querySelectorAll("text")[1].textContent.split(" ·")[0]));
console.log("     Kreis:", boxen.join(" | "));
ok(["Negativ=1", "Nie abgefragt=1", "In Arbeit=1", "✓ Gelernt=2"].every(b => boxen.includes(b)), "Kreis: Negativ 1, Nie 1, In Arbeit 1, Gelernt 2");

let z = await zeilen();
const zz = Object.fromEntries(z.map(r => [r.text, r]));
console.log("     Zeilen:", z.map(r => `${r.text}:${r.rechts}`).join(" | "));
ok(zz.aller.rechts === "✓ +3" && zz.venir.rechts === "✓ +4", "Gelernte rechts mit „✓ +3“ / „✓ +4“");
ok(zz.partir.rechts === "+2" && zz.voir.rechts === "-2", "Andere ohne Häkchen (+2, −2)");
ok(zz.aller.bg.includes("--haupt-flaeche") && zz.venir.bg.includes("--haupt-flaeche"), "Gelernte Zeilen hellgrün (Farbrolle Haupt-Fläche)");
ok(zz.voir.bg.includes("--falsch-flaeche"), "Negative Zeile hellrot (Farbrolle Falsch-Fläche)");
ok(!zz.partir.bg && !zz.sortir.bg, "In Arbeit / nie: ohne Hintergrund");
// Null bei 5/(5+3) = 62.5 %; aller voll (3/8 = 37.5 %), venir gekappt (37.5 %), partir 2/8 = 25 %, voir 2/8 links
ok(z.every(r => r.nullLinie === "62.5%"), "Nullpunkt in allen Zeilen bei 62.5 %");
const ganz = b => b && b.left === "0px" && b.right === "0px";
ok(ganz(zz.aller.balken) && ganz(zz.venir.balken), "Gelernte: ganzer Balken grün (auch negativer Bereich)");
ok(zz.partir.balken.width === "25%" && zz.voir.balken.width === "25%" && zz.voir.balken.right === "37.5%", "partir +2 und voir −2 richtig skaliert");
await page.screenshot({ path: "gruppen.png", fullPage: true });

// Box "Gelernt" abwählen → Liste ohne gelernte, Prozent bleibt
await box("✓ Gelernt");
z = await zeilen(); t = await text();
// ohne Gelernte: partir 67 %, sortir 0 %, voir 0 % → 22 %
ok(z.length === 3 && !z.some(r => r.rechts.startsWith("✓")) && /22 %/.test(t) && /0 \/ 3 gelernt/.test(t), "Gelernt ausgeblendet: 3 Zeilen, Lernfortschritt 22 %, 0 / 3");
await box("Gesamt");
z = await zeilen();
ok(z.length === 5, "Gesamt: wieder alle 5");

// Schwelle +5 → venir (4) nicht mehr gelernt
await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem("vokabel_einstellungen")); e.gelerntSchwelle = 5;
  localStorage.setItem("vokabel_einstellungen", JSON.stringify(e));
});
await page.reload(); await sleep(400);
await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click());
await sleep(400);
t = await text(); z = await zeilen();
ok(/0 \/ 5 gelernt/.test(t) && z.every(r => r.nullLinie === "50%"), "Schwelle +5: 0 / 5 gelernt, Null bei 50 %");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
