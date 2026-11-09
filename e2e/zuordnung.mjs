import puppeteer from "puppeteer-core";
import { neueEineSession, listenZu, bereichZu } from "./hilfen.mjs";

// Antwortart „Zuordnung“: Kacheln der Frage- und Antwort-Spalte zuordnen. Sofort-Prüfung (Fehlgriff zählt für die Vokabel
// der ersten Karte, −1 nach Regel), Runden aus der Warteschlange, „am Ende“ mit farbigen Gruppen + „Prüfen“,
// Zeitablauf: nur vollständig Beantwortetes zählt, der Rest kommt in der nächsten Runde wieder.
const URL = "http://localhost:4199/vokabel-app/";
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-first-run"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
let fehler = 0;
const ok = (cond, msg) => { if (!cond) fehler++; console.log(cond ? "OK  " : "FAIL", msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const vorbereiten = async stufe => {
  await page.goto(URL);
  await page.evaluate(stufe => {
    localStorage.clear();
    const sp = Object.fromEntries(["E1","E2","E3","D1","D2","i1","i2"].map(t => [t, { name: {E1:"Französisch",D1:"Deutsch"}[t] || "", aktiv: ["E1","D1"].includes(t) }]));
    const vokabeln = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, E1: { wert: `mot${i + 1}`, falsch: [] }, D1: { wert: `Wort${i + 1}`, falsch: [] } }));
    localStorage.setItem("vokabel_liste_l_a", JSON.stringify({ id:"l_a", name:"Unité 1", sprache:"fr", spalten: sp, naechste_id: 13, vokabeln }));
    localStorage.setItem("vokabel_listen_index", JSON.stringify([{ id:"l_a", name:"Unité 1", sprache:"fr", platz:{z:0,s:0} }]));
    localStorage.setItem("vokabel_einstellungen", JSON.stringify({ modus: "schwer", stufen: { schwer: stufe } }));
  }, stufe);
  await page.reload(); await sleep(700);
  await neueEineSession(page);
  await page.evaluate(() => [...document.querySelectorAll(".quiz-setup-check")].find(e => e.textContent.includes("Unité 1"))?.click()); await sleep(300);
  await listenZu(page);
  await page.evaluate(() => document.querySelector("[data-abfragemodus]")?.click()); await sleep(300);
  const da = await page.evaluate(() => { const b = document.querySelector('[data-modus-knopf$=":zuordnung"]'); b?.click(); return !!b; }); await sleep(250);
  await bereichZu(page);
  await page.evaluate(() => document.querySelector("[data-start-knopf]")?.click()); await sleep(700);
  return da;
};
const karten = () => page.evaluate(() => [...document.querySelectorAll("[data-zuo-karte]")].map(b => { const [s, i] = b.dataset.zuoKarte.split(":").map(Number); return { s, i, id: b.dataset.zuoId, cls: b.className }; }));
const tippe = async (s, i) => { await page.click(`[data-zuo-karte="${s}:${i}"]`); await sleep(120); };
const score = id => page.evaluate(id => { const n = Number(String(id).split("__").pop()); return JSON.parse(localStorage.getItem("vokabel_liste_l_a")).vokabeln.find(v => v.id === n)?.fortschritt?.score ?? null; }, id);
const fortschritt = () => page.evaluate(() => document.querySelector("[data-zuo-fortschritt]")?.textContent.trim());
// eine Gruppe richtig zuordnen: Karte (0, zeile) + passende Karte in Spalte 1
const loese = async zeile => { const k = await karten(); const a = k.find(x => x.s === 0 && x.i === zeile); const b = k.find(x => x.s === 1 && x.id === a.id); await tippe(0, zeile); await tippe(1, b.i); return a.id; };

// ── 1) sofort prüfen, ohne Zeit, 4 je Runde ──
ok(await vorbereiten({ zuordnungAmEnde: false, zuordnungZeit: "aus", zuordnungPaare: 4, zuordnungAbzug: true }), "Modus-Knopf „Zuordnung“ vorhanden");
let k = await karten();
ok(await page.$("[data-zuordnung='sofort']") && k.length === 8 && new Set(k.map(x => x.s)).size === 2, `Runde 1: 2 Spalten × 4 Karten (${k.length})`);
ok(await fortschritt() === "0 / 12", `Fortschritt 0 / 12 – Standard: alle in einem Paket (${await fortschritt()})`);
// Fehlgriff: erste Karte bestimmt die Vokabel
const a = k.find(x => x.s === 0 && x.i === 0);
const falscheB = k.find(x => x.s === 1 && x.id !== a.id), richtigeB = k.find(x => x.s === 1 && x.id === a.id);
await tippe(0, 0); await tippe(1, falscheB.i);
ok((await karten()).find(x => x.s === 1 && x.i === falscheB.i).cls.includes("blink"), "Fehlgriff: falsche Karte blinkt rot");
await sleep(700);
ok((await karten()).find(x => x.s === 0 && x.i === 0).cls.includes("wahl"), "erste Karte bleibt gewählt");
await tippe(1, richtigeB.i);
ok((await karten()).find(x => x.s === 0 && x.i === 0).cls.includes("falsch-erl") && await score(a.id) === -1 && await score(falscheB.id) === null,
  `Gruppe vollständig nach Fehlgriff: Vokabel der ersten Karte −1 (${await score(a.id)}), die falsch getippte bleibt unberührt`);
const geloest = [];
for (const z of [1, 2, 3]) geloest.push(await loese(z));
ok((await Promise.all(geloest.map(score))).every(x => x === 1), "richtig zugeordnet: +1");
// Rundenende: Ergebnis bleibt stehen, Paare in eigenen Farben mit ✓ / ✗
await sleep(400);
const ergebnis = await page.evaluate(() => {
  const k = [...document.querySelectorAll('[data-zuo-karte^="0:"]')];
  return { weiter: !!document.querySelector("[data-zuo-weiter]"), marken: k.map(b => b.querySelector("[data-zuo-marke]")?.dataset.zuoMarke).sort().join(","),
    farben: new Set(k.map(b => b.style.borderColor)).size };
});
ok(ergebnis.weiter && ergebnis.marken === "falsch,richtig,richtig,richtig" && ergebnis.farben === 4,
  `Rundenende: „Weiter →“, je Paar ✓ bzw. ✗ und eigene Farbe statt alles grün (${JSON.stringify(ergebnis)})`);
ok(await fortschritt() === "4 / 12" && (await karten()).length === 8 && await page.$("[data-zuo-marke]"), "bleibt stehen, bis „Weiter →“ getippt wird");
await page.click("[data-zuo-weiter]"); await sleep(300);
ok(!(await page.$("[data-zuo-marke]")) && (await karten()).length === 8, "„Weiter →“: nächste Runde");
// Abwählen ohne Fehlgriff: erste Karte nochmal antippen
await tippe(0, 0); await tippe(0, 0);
ok(!(await karten()).some(x => x.cls.includes("wahl")), "erste Karte nochmal antippen: Gruppe aufgehoben");
for (const z of [0, 1, 2, 3]) await loese(z);
await page.click("[data-zuo-weiter]"); await sleep(300);
k = await karten();
ok(k.length === 8, `letzte Runde: 4 Vokabeln (${k.length / 2})`);
for (const z of [0, 1, 2, 3]) await loese(z);
ok(!(await page.$("[data-zuo-loesung]")), "alles richtig: kein „Lösung zeigen“");
await page.click("[data-zuo-weiter]"); await sleep(600);
ok(!(await page.$("[data-zuordnung]")), "alle beantwortet: Zuordnung beendet (Auswertung)");

// ── 2) am Ende prüfen: farbige Gruppen, automatisch geprüft, sobald alles verteilt ist ──
await vorbereiten({ zuordnungAmEnde: true, zuordnungZeit: "aus", zuordnungPaare: 3, zuordnungAbzug: true });
k = await karten();
ok(await page.$("[data-zuordnung='am-ende']") && k.length === 6 && !(await page.$("[data-zuo-pruefen]")), "am Ende: 3 Vokabeln je Runde, kein „Prüfen“-Knopf");
const z0 = k.find(x => x.s === 0 && x.i === 0), z1 = k.find(x => x.s === 0 && x.i === 1), z2 = k.find(x => x.s === 0 && x.i === 2);
const b = id => k.find(x => x.s === 1 && x.id === id).i;
await tippe(0, 0); await tippe(1, b(z1.id));   // falsch: z0 + z1
await tippe(0, 1); await tippe(1, b(z0.id));   // falsch: z1 + z0
const farben = await page.evaluate(() => [...document.querySelectorAll(".zuo-nr")].map(e => e.textContent).sort());
ok(farben.join(",") === "1,1,2,2" && !(await page.$("[data-zuo-marke]")), `Gruppen nummeriert, noch keine Rückmeldung (${farben})`);
// eingefärbte Karte antippen nimmt sie heraus, Gruppe wieder offen
await tippe(1, b(z0.id));
ok((await page.evaluate(() => [...document.querySelectorAll(".zuo-nr")].map(e => e.textContent))).length === 3, "eingefärbte Karte antippen: aus der Gruppe genommen");
await tippe(1, b(z0.id));
await tippe(0, 2); await tippe(1, b(z2.id));   // richtig – letzte Karte verteilt → automatisch geprüft
await sleep(300);
ok(await score(z2.id) === 1 && await score(z0.id) === -1 && await score(z1.id) === -1, `automatisch geprüft: richtige Gruppe +1, falsche: Vokabel der ersten Karte −1 (${await score(z2.id)}, ${await score(z0.id)}, ${await score(z1.id)})`);
const marken = await page.evaluate(() => [...document.querySelectorAll("[data-zuo-marke]")].map(e => e.dataset.zuoMarke).sort().join(","));
ok(marken === "falsch,falsch,falsch,falsch,richtig,richtig", `Gruppenfarben bleiben, dazu ✓ / ✗ (${marken})`);
await page.click("[data-zuo-loesung]"); await sleep(200);
const loesung = await page.evaluate(() => { const k = [...document.querySelectorAll("[data-zuo-karte]")]; const f = {}; k.forEach(b => { (f[b.dataset.zuoId] ||= new Set()).add(b.style.borderColor); }); return Object.values(f).every(s => s.size === 1) && !document.querySelector("[data-zuo-marke]"); });
ok(loesung, "„Lösung zeigen“: zusammengehörige Karten gleich gefärbt");
await page.click("[data-zuo-weiter]"); await sleep(300);
ok(await fortschritt() === "3 / 12" && (await karten()).length === 6, `„Weiter →“: nächste Runde (${await fortschritt()})`);

// ── 3) sofort mit Zeit je Paar: abgelaufen → nur Vollständiges zählt, der Rest kommt wieder ──
await vorbereiten({ zuordnungAmEnde: false, zuordnungZeit: "an", zuordnungSek: 3, zuordnungPaare: 3, zuordnungAbzug: true });
ok(await page.$("[data-zuo-zeit='an'] .zuo-zeit-balken"), "Zeitbalken läuft");
const erste = await loese(0);
k = await karten();
const offen = [...new Set(k.filter(x => x.id !== erste).map(x => x.id))];
await tippe(0, k.find(x => x.s === 0 && x.id === offen[0]).i);   // angefangen, nicht vollständig
await sleep(4500);
ok(await score(erste) === 1 && await score(offen[0]) === null && await score(offen[1]) === null && await page.$("[data-zuo-weiter]"),
  "Zeit je Paar abgelaufen: nur die vollständige Gruppe ist gewertet, Ergebnis bleibt stehen");
ok((await karten()).filter(x => x.cls.includes("offen-geblieben")).length === 4, "offen Gebliebene markiert");
await page.click("[data-zuo-weiter]"); await sleep(300);
k = await karten();
ok(offen.every(id => k.some(x => x.id === id)) && await fortschritt() === "1 / 12", `nicht beantwortete kommen in der nächsten Runde wieder (${await fortschritt()})`);

// ── 4) am Ende mit Zeit: gilt für die ganze Runde (3 × 3 s), danach automatisch geprüft ──
await vorbereiten({ zuordnungAmEnde: true, zuordnungZeit: "an", zuordnungSek: 3, zuordnungPaare: 3, zuordnungAbzug: true });
k = await karten();
const y0 = k.find(x => x.s === 0 && x.i === 0);
await tippe(0, 0); await tippe(1, k.find(x => x.s === 1 && x.id === y0.id).i);
await sleep(5000);
ok(!(await page.$("[data-zuo-weiter]")), "nach 5 s noch Zeit (Runde: 9 s)");
await sleep(5000);
ok(await page.$("[data-zuo-weiter]") && await score(y0.id) === 1, "Zeit der Runde abgelaufen: vollständige Gruppe geprüft und gewertet");

console.log(fehler ? `${fehler} FEHLER` : "ALLES OK");
await browser.close();
