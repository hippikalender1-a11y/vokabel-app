// Alle Browser-Tests parallel ausführen (Standard: 4 gleichzeitig; „node alle_parallel.mjs 6“ für 6).
// Voraussetzung wie bei alle.sh: „npm run build“ und „npx vite preview --port 4199 --strictPort“ laufen.
// Die Testliste kommt aus alle.sh (eine Quelle). Jeder Test startet seinen eigenen Browser mit leerem Profil,
// daher stören sie sich nicht. Fehlgeschlagene Tests laufen am Ende einmal allein nach (zeitkritische Tests
// können unter Last wackeln) – Ausgabe wie alle.sh: „== name: letzte Zeile“, nach Reihenfolge der Liste.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const parallel = Math.max(1, Number(process.argv[2]) || 4);
const sh = fs.readFileSync(path.join(dir, "alle.sh"), "utf8");
const tests = sh.match(/for t in ([^;]+);/)[1].trim().split(/\s+/);
const args = t => (t === "pakete" ? ["preset"] : []);

const lauf = t => new Promise(resolve => {
  const start = Date.now();
  const p = spawn(process.execPath, [`${t}.mjs`, ...args(t)], { cwd: dir });
  let out = "";
  p.stdout.on("data", d => { out += d; });
  p.stderr.on("data", d => { out += d; });
  p.on("close", () => {
    const zeilen = out.trim().split(/\r?\n/);
    resolve({ t, letzte: zeilen[zeilen.length - 1] || "", sek: (Date.now() - start) / 1000 });
  });
});
const gut = r => /^ALLES OK/.test(r.letzte) || /^OK\b/.test(r.letzte);

const start = Date.now();
const ergebnis = {};
let naechster = 0;
await Promise.all(Array.from({ length: parallel }, async () => {
  while (naechster < tests.length) { const t = tests[naechster++]; ergebnis[t] = await lauf(t); }
}));
// fehlgeschlagene einmal allein wiederholen
const nochmal = tests.filter(t => !gut(ergebnis[t]));
for (const t of nochmal) { const r = await lauf(t); if (gut(r)) r.letzte += "  (beim 2. Versuch)"; ergebnis[t] = r; }

for (const t of tests) console.log(`== ${t}: ${ergebnis[t].letzte}`);
const fehl = tests.filter(t => !gut(ergebnis[t]));
console.log(`\n${tests.length} Tests, ${parallel} parallel, ${Math.round((Date.now() - start) / 1000)} s` +
  (nochmal.length ? ` · wiederholt: ${nochmal.join(", ")}` : "") + (fehl.length ? ` · FEHLGESCHLAGEN: ${fehl.join(", ")}` : " · alle OK"));
const langsam = tests.map(t => ergebnis[t]).sort((a, b) => b.sek - a.sek).slice(0, 5);
console.log("langsamste:", langsam.map(r => `${r.t} ${Math.round(r.sek)} s`).join(", "));
console.log(`Summe der Einzelzeiten: ${Math.round(tests.reduce((s, t) => s + ergebnis[t].sek, 0))} s (≈ Dauer nacheinander)`);
