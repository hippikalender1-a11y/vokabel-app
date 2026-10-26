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

async function lade(scores) {
  await page.goto(URL);
  await page.evaluate((scores) => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const w = [["aller","gehen"],["venir","kommen"],["partir","abfahren"],["sortir","ausgehen"],["voir","sehen"]];
    const l = { id:"l_fr", name:"Verbes", sprache:"fr", spalten: sp, naechste_id:6,
      vokabeln: scores.map((sc, i) => ({ id: i + 1, E1:{wert:w[i][0],falsch:[]}, D1:{wert:w[i][1],falsch:[]},
        ...(sc === null ? {} : { fortschritt: { score: sc, streak: 0, aufgedecktStreak: 0, letzteAbfrage: "2026-10-20T10:00:00.000Z" } }) })) };
    localStorage.setItem("vokabel_liste_l_fr", JSON.stringify(l));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_fr", name:l.name, sprache:"fr" }]));
    localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus:"schwer", autoplay:false, vorlesen:["E1"], gelerntSchwelle:3, sprache:"alle" }));
  }, scores);
  await page.reload(); await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll(".tab")].find(t => t.textContent === "Statistik").click());
  await sleep(500);
}
const kreis = () => page.evaluate(() => {
  const svg = [...document.querySelectorAll("svg")].find(s => s.getAttribute("viewBox") === "0 0 400 230");
  if (!svg) return null;
  return [...svg.querySelectorAll("g")].map(g => ({
    name: g.querySelectorAll("text")[0].textContent, wert: g.querySelectorAll("text")[1].textContent,
    blass: Number((g.querySelector("path,circle")).getAttribute("opacity")) < 1,
    y: Number(g.querySelectorAll("text")[0].getAttribute("y")), rechts: g.querySelectorAll("text")[0].getAttribute("text-anchor") === "start",
  }));
});
const zeilen = () => page.evaluate(() => [...document.querySelectorAll("div")].filter(d => d.style.padding === "7px 12px").length);
const klickGruppe = name => page.evaluate(n => [...document.querySelectorAll("svg g")].find(g => g.querySelector("text")?.textContent === n)?.dispatchEvent(new MouseEvent("click", { bubbles: true })), name);

// 1) Alle vier Gruppen: aller 3, venir 4, partir 2, sortir nie, voir −2
await lade([3, 4, 2, null, -2]);
let k = await kreis();
console.log("     Segmente:", k?.map(x => `${x.name} ${x.wert}`).join(" | "));
ok(!!k, "Kreisdiagramm ist die Standard-Ansicht");
ok(k?.length === 4 && k.some(x => x.name === "✓ Gelernt" && x.wert === "2 · 40 %") && k.some(x => x.name === "Negativ" && x.wert === "1 · 20 %"), "4 Segmente mit Anzahl und Prozent");
ok(!(await page.evaluate(() => /NIE ABGEFRAGT\s*\n\s*1/i.test(document.body.innerText.split("SORTIERUNG")[0].split("Segment antippen")[1] || ""))), "Filter-Boxen entfernt");
const abstaende = side => k.filter(x => x.rechts === side).map(x => x.y).sort((a, b) => a - b).every((y, i, a) => i === 0 || y - a[i - 1] >= 30);
ok(abstaende(true) && abstaende(false), "Beschriftungen überlappen nicht");
await page.screenshot({ path: "kreis.png" });

// Nie abgefragt ausblenden → übrige drei teilen sich den Kreis (4 Vokabeln: 2 · 50 %, 1 · 25 %, 1 · 25 %)
await klickGruppe("Nie abgefragt"); await sleep(300);
k = await kreis();
console.log("     ohne Nie:", k.map(x => `${x.name} ${x.wert}`).join(" | "));
ok(k.length === 3 && !k.some(x => x.name === "Nie abgefragt") && k.find(x => x.name === "✓ Gelernt").wert === "2 · 50 %" && k.find(x => x.name === "Negativ").wert === "1 · 25 %",
  "Ausgeblendetes Segment fehlt, Rest teilt sich den Kreis neu");
ok(await zeilen() === 4, "Liste ohne „Nie abgefragt“ (4)");
const leg = await page.evaluate(() => { const b = document.querySelector('[data-legende="nie"]'); return b ? { text: b.textContent.trim(), durch: b.style.textDecoration } : null; });
ok(leg && leg.durch.includes("line-through") && /Nie abgefragt 1/.test(leg.text), "Legende zeigt „Nie abgefragt 1“ durchgestrichen");
const t = await page.evaluate(() => document.body.innerText);
// (100 + 100 + 67 + 0) / 4 = 67 %
ok(/2 \/ 4 gelernt/.test(t) && /67 %/.test(t), "Lernfortschritt folgt dem Filter: 67 %, 2 / 4 gelernt");
await page.screenshot({ path: "kreis_gefiltert.png" });
// über die Legende wieder einblenden
await page.evaluate(() => document.querySelector('[data-legende="nie"]').click()); await sleep(300);
k = await kreis();
ok(k.length === 4 && await zeilen() === 5, "Legende antippen: wieder eingeblendet (4 Segmente, 5 Zeilen)");
// alle ausblenden über die Legende → Hinweis, „Gesamt“ stellt alles wieder her
await page.evaluate(() => ["gelernt", "arbeit", "nie", "negativ"].forEach(g => document.querySelector(`[data-legende="${g}"]`)?.click())); await sleep(300);
ok(await kreis() === null && /Alle Gruppen ausgeblendet/.test(await page.evaluate(() => document.body.innerText)), "Alles ausgeblendet: Hinweis statt Kreis");
await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /^Gesamt \d+$/.test(b.textContent.trim()))?.click()); await sleep(300);
ok(await zeilen() === 5 && (await kreis()).length === 4, "„Gesamt 5“: alles wieder eingeblendet");

// Linie/Balken entfernt; Vollbild-Knopf oben rechts in der Kreisfläche
const knoepfe = await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.textContent.trim()));
ok(!knoepfe.includes("Linie") && !knoepfe.includes("Balken") && !knoepfe.some(k => k.includes("Kreis")), "Keine Ansicht-Knöpfe Linie/Balken mehr");
const vb = await page.evaluate(() => {
  const svg = document.querySelector('svg[viewBox="0 0 400 230"]');
  const box = svg.closest('div[style*="border-radius: 12px"]');
  const btn = [...box.querySelectorAll("button")].find(b => b.querySelector("svg") && !b.textContent.trim());
  if (!btn) return null;
  const r = btn.getBoundingClientRect(), k = box.getBoundingClientRect();
  return { obenRechts: r.top - k.top < 20 && k.right - r.right < 20 };
});
ok(vb?.obenRechts, "Vollbild-Knopf oben rechts in der Kreisfläche");
await page.evaluate(() => {
  const box = document.querySelector('svg[viewBox="0 0 400 230"]').closest('div[style*="border-radius: 12px"]');
  [...box.querySelectorAll("button")].find(b => b.querySelector("svg") && !b.textContent.trim())?.click();
});
await sleep(300);
const imVollbild = await page.evaluate(() => !document.querySelector(".tabs") && !!document.querySelector('svg[viewBox="0 0 400 230"]'));
ok(imVollbild, "Vollbild: Tabs ausgeblendet, Kreis bleibt");
await page.screenshot({ path: "kreis_vollbild.png" });

// 2) Gruppen mit 0 fehlen: kein negativ, kein nie
await lade([3, 4, 2, 1, 0]);
k = await kreis();
console.log("     Segmente:", k?.map(x => `${x.name} ${x.wert}`).join(" | "));
ok(k.length === 2 && !k.some(x => x.name === "Negativ" || x.name === "Nie abgefragt"), "Leere Gruppen erscheinen nicht");
await page.screenshot({ path: "kreis2.png" });

// 3) Nur eine Gruppe → voller Kreis
await lade([null, null, null, null, null]);
k = await kreis();
ok(k.length === 1 && k[0].wert === "5 · 100 %" && await page.evaluate(() => !!document.querySelector('svg[viewBox="0 0 400 230"] circle')), "Eine Gruppe: voller Kreis, 100 %");

await browser.close();
console.log(fehler ? `\n${fehler} FEHLER` : "\nALLES OK");
process.exit(fehler ? 1 : 0);
