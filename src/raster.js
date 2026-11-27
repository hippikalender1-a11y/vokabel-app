// ── Raster der gespeicherten Konfigurationen und der Listen: jeder Eintrag hat einen Platz {z, s} ──
// Zeilen gibt es nicht als Einstellung: das Raster ist nach unten offen; beim Verschieben stehen unter dem
// untersten Eintrag immer RASTER_FREI_ZEILEN freie Zeilen bereit (wachsen mit, verschwinden danach wieder)
// 196: auch seitlich offen – jede Ebene zeigt so viele Spalten, wie belegt sind (beim Verschieben eine freie dazu), höchstens 5
export const RASTER_MAX_SPALTEN = 5, RASTER_ZEILEN_OFFEN = 100000, RASTER_FREI_ZEILEN = 2;
export const MISCH_ARTEN = [["karte", "Karte"], ["mc", "MC"], ["hoeren", "Hören"], ["akzent", "Akzente"], ["tippen", "Tastatur"], ["puzzle", "Puzzle"], ["luecke", "Lücken"], ["artikel", "Artikel"], ["satzfinden", "Satz finden"], ["lueckensatz", "Lückensatz"], ["satzbauen", "Satz bauen"], ["zuordnung", "Zuordnung"], ["memory", "Memory"]];
export function rasterGroesse() {   // 196: keine Einstellung mehr – Plätze bis RASTER_MAX_SPALTEN, Zeilen offen
  return { zeilen: RASTER_ZEILEN_OFFEN, spalten: RASTER_MAX_SPALTEN };
}
// 196: angezeigte Spalten einer Ebene: belegte (mind. 1), beim Verschieben eine freie dazu
// 203: min = gewählte Mindest-Spaltenzahl der Ebene (belegte Spalten können mehr ergeben)
export function ebenenSpalten(eintraege, frei = false, min = 1) {
  const belegt = eintraege.reduce((m, x) => Math.max(m, (x.platz?.s ?? 0) + 1), Math.max(1, min || 1));
  return Math.min(RASTER_MAX_SPALTEN, belegt + (frei ? 1 : 0));
}
export const nachPlatz = (a, b) => a.platz.z - b.platz.z || a.platz.s - b.platz.s;
// Liste in Quiz-Gruppen aufteilen: Nummern von..bis (1-basiert) in Gruppen zu je groesse;
// restAnhaengen: eine kleinere letzte Gruppe wird an die vorletzte angehängt
export const AUFTEILEN_GROESSEN = [10, 20, 25, 50, 75, 100];
export function aufteilenGruppen(anzahl, von, bis, groesse, restAnhaengen) {
  von = Math.max(1, Math.min(anzahl, von)); bis = Math.max(von, Math.min(anzahl, bis));
  if (!anzahl || !(groesse >= 1)) return [];
  const g = [];
  for (let a = von; a <= bis; a += groesse) g.push([a, Math.min(a + groesse - 1, bis)]);
  if (restAnhaengen && g.length > 1 && g[g.length - 1][1] - g[g.length - 1][0] + 1 < groesse) {
    const rest = g.pop(); g[g.length - 1][1] = rest[1];
  }
  return g;
}
// Neue Einträge (ohne Platz) kommen untereinander in die erste Spalte, ab der Zeile unter dem untersten
// belegten Platz. Gültige, freie Plätze bleiben; ungültige (z. B. nach Verkleinern) kommen auf den ersten
// freien Platz (zeilenweise). Reicht das Raster nicht, wächst es um Zeilen (zeilen im Ergebnis).
export function ordneRaster(gespeichert, { zeilen, spalten }) {
  const belegt = new Set();
  const key = p => `${p.z}|${p.s}`;
  const imRaster = p => p && p.z < zeilen && p.s < spalten;
  let ab = gespeichert.reduce((m, e) => imRaster(e.platz) ? Math.max(m, e.platz.z + 1) : m, 0);
  const ohnePlatz = gespeichert.some(e => !e.platz);
  gespeichert = gespeichert.map(e => e.platz ? e : { ...e, platz: { z: ab++, s: 0 } });
  let z = Math.max(zeilen, ab);
  const gueltig = p => p && Number.isInteger(p.z) && Number.isInteger(p.s) && p.z >= 0 && p.s >= 0 && p.s < spalten && p.z < z;
  const behalten = gespeichert.map(e => {
    if (gueltig(e.platz) && !belegt.has(key(e.platz))) { belegt.add(key(e.platz)); return true; }
    return false;
  });
  let geaendert = ohnePlatz;
  const neu = gespeichert.map((e, i) => {
    if (behalten[i]) return e;
    geaendert = true;
    let p = null;
    for (let zz = 0; !p; zz++) {
      if (zz >= z) z = zz + 1;
      for (let s = 0; s < spalten && !p; s++) if (!belegt.has(`${zz}|${s}`)) p = { z: zz, s };
    }
    belegt.add(key(p));
    return { ...e, platz: p };
  });
  return { gespeichert: neu, zeilen: z, geaendert };
}
// Gruppe (ids in Reihenfolge) untereinander ab Platz ziel setzen; Einträge im Weg rücken in ihrer Spalte nach unten (242)
export function platziereGruppe(eintraege, ids, ziel) {
  const gruppe = ids.map(id => eintraege.find(e => e.id === id)).filter(Boolean);
  if (gruppe.length === 0) return eintraege;
  const gruppenIds = new Set(gruppe.map(e => e.id));
  // die Gruppe untereinander ab dem Zielplatz
  const neu = new Map(gruppe.map((e, i) => [e.id, { z: ziel.z + i, s: ziel.s }]));
  // 242: Platz machen statt tauschen – die übrigen Einträge der Zielspalte ab der Zielzeile rücken nach unten,
  // jeweils nur so weit wie nötig (freie Plätze darunter bleiben frei, solange niemand hineinrücken muss)
  let naechste = ziel.z + gruppe.length;
  eintraege.filter(e => !gruppenIds.has(e.id) && e.platz && e.platz.s === ziel.s && e.platz.z >= ziel.z)
    .sort((x, y) => x.platz.z - y.platz.z)
    .forEach(e => { const z = Math.max(e.platz.z, naechste); if (z !== e.platz.z) neu.set(e.id, { z, s: ziel.s }); naechste = z + 1; });
  return eintraege.map(e => neu.has(e.id) ? { ...e, platz: neu.get(e.id) } : e);
}
// 246: Vorschau beim Ziehen – wer beim Ablegen auf zielKey („z|s“) nach unten rücken würde
export function rueckendeIds(eintraege, ids, zielKey) {
  if (!ids.length || !zielKey || zielKey.startsWith("raus")) return new Set();
  const [z, s] = zielKey.split("|").map(Number);
  const alt = new Map(eintraege.map(e => [e.id, e.platz]));
  return new Set(platziereGruppe(eintraege, ids, { z, s })
    .filter(e => !ids.includes(e.id) && e.platz && alt.get(e.id) && alt.get(e.id).z !== e.platz.z).map(e => e.id));
}
// 242: Zeilen, die eine Ebene nach dem Platzieren braucht
export const belegteZeilen = eintraege => eintraege.reduce((m, e) => e.platz ? Math.max(m, e.platz.z + 1) : m, 0);
// Quiz-Gruppen (Ordner): slots.ordner = [{ id, name, platz }]; Quiz darin tragen ordner: id und einen Platz
// im Raster der Gruppe. Oberste Ebene = Gruppen + Quiz ohne Gruppe (beide mit Platz im Haupt-Raster).
// 193: Ordner können in Ordnern liegen (o.ordner = Eltern-Id), bis ORDNER_TIEFE_MAX Ebenen. Gleiches Modell für
// Listen-Ordner: dort ist data = { ordner: Listen-Ordner, gespeichert: Listen-Index }.
export const ORDNER_TIEFE_MAX = 5;   // 198
export function ebeneVon(data, ordnerId) {
  const ordner = data.ordner || [];
  const gibt = new Set(ordner.map(o => o.id));
  const hier = p => ordnerId ? p === ordnerId : !p || !gibt.has(p);
  return [...ordner.filter(o => o.id !== ordnerId && hier(o.ordner)).map(o => ({ ...o, istOrdner: true })), ...data.gespeichert.filter(x => hier(x.ordner))];
}
// 208: Ebene automatisch anordnen – Ordner zuerst, dann die Einträge (je nach wert sortiert; ohne wert: bisherige
// Reihenfolge spaltenweise = Lücken schließen); spaltenweise füllen: erst nach unten, dann die nächste Spalte
export function ordneEbeneAn(data, ordnerId, vergleich, spalten) {
  const ebene = ebeneVon(data, ordnerId);
  const p = x => x.platz || { z: Infinity, s: Infinity };
  const bisher = (a, b) => p(a).s - p(b).s || p(a).z - p(b).z;
  const sortiert = arr => [...arr].sort(vergleich ? (a, b) => vergleich(a, b) || bisher(a, b) : bisher);
  const reihe = [...sortiert(ebene.filter(x => x.istOrdner)), ...sortiert(ebene.filter(x => !x.istOrdner))];
  const sp = Math.max(1, Math.min(RASTER_MAX_SPALTEN, spalten));
  const zeilen = Math.max(1, Math.ceil(reihe.length / sp));
  return setzeEbene(data, reihe.map((x, i) => ({ ...x, platz: { z: i % zeilen, s: Math.floor(i / zeilen) } })));
}
const ZAHL_DE = new Intl.NumberFormat("de-DE");   // 238: einmal anlegen (toLocaleString legt es jedes Mal neu an)
export const zahlDe = n => ZAHL_DE.format(Number(n || 0));   // 210: 4.000
export const nameVergleich = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de", { numeric: true, sensitivity: "base" });
// 359: Ansicht einer Ebene (oberste Ebene: Einstellungen, sonst der Ordner) – Standard automatisch, nach Name, 2 Spalten
export const ANSICHT_SPALTEN = 2;
// nur für ältere Tests (freie Anordnung, 1 Spalte als Standard): localStorage „vokabel_test_alte_ansicht“
const ALTE_ANSICHT = (() => { try { return localStorage.getItem("vokabel_test_alte_ansicht") === "1"; } catch { return false; } })();
export function ansichtVon(einst, ordnerListe, art, ordnerId) {
  const o = ordnerId ? (ordnerListe || []).find(x => x.id === ordnerId) : null;
  const anordnung = (o ? o.anordnung : einst?.ebenenAnordnung?.[art]) || (ALTE_ANSICHT ? "frei" : "auto");
  return { auto: anordnung !== "frei",
    sort: (o ? o.sortierung : einst?.ebenenSortierung?.[art]) || "name",
    spalten: (o ? o.spalten : einst?.ebenenSpalten?.[art]) || (ALTE_ANSICHT ? 1 : ANSICHT_SPALTEN) };
}
// 359: Vergleich für die automatische Sortierung (name | datum); lernstand bzw. ohne: die gespeicherten Plätze
export const datumVon = (x, art) => art === "liste" ? Number(String(x.id).match(/(\d{10,})/)?.[1] || 0) : (x.timestamp || 0);
export function sortVergleich(sort, art) {
  return sort === "name" ? nameVergleich
    : sort === "datum" ? (a, b) => (a.istOrdner || b.istOrdner ? nameVergleich(a, b) : datumVon(a, art) - datumVon(b, art)) : null;
}
// 359: automatische Anordnung – Ordner zuerst, dann die Einträge, je nach Sortierung (sonst Plätze spaltenweise)
export function autoReihe(eintraege, sort, art) {
  const p = x => x.platz || { z: Infinity, s: Infinity };
  const bisher = (a, b) => p(a).s - p(b).s || p(a).z - p(b).z;
  const v = sortVergleich(sort, art);
  const s = arr => [...arr].sort(v ? (a, b) => v(a, b) || bisher(a, b) : bisher);
  return [...s(eintraege.filter(x => x.istOrdner)), ...s(eintraege.filter(x => !x.istOrdner))];
}
// Pfad von oben bis zum Ordner id (Ordner-Objekte); [] = oberste Ebene
export function ordnerPfad(ordner, id) {
  const pfad = [], gesehen = new Set();
  let o = id ? (ordner || []).find(x => x.id === id) : null;
  while (o && !gesehen.has(o.id)) { gesehen.add(o.id); pfad.unshift(o); o = o.ordner ? ordner.find(x => x.id === o.ordner) : null; }
  return pfad;
}
// Ordner id und alle darin (rekursiv)
export function ordnerUnter(ordner, id) {
  const ids = new Set([id]);
  for (let neu = true; neu;) { neu = false; (ordner || []).forEach(o => { if (o.ordner && ids.has(o.ordner) && !ids.has(o.id)) { ids.add(o.id); neu = true; } }); }
  return ids;
}
// Ebenen eines Ordners samt Unterordnern (1 = ohne Unterordner)
export function ordnerHoehe(ordner, id) {
  const kinder = (ordner || []).filter(o => o.ordner === id && o.id !== id);
  return 1 + (kinder.length ? Math.max(...kinder.map(k => ordnerHoehe(ordner, k.id))) : 0);
}
// passt Ordner id (mit seinen Unterordnern) in den Ordner ziel (null = oberste Ebene)?
export function ordnerPasst(ordner, id, ziel) {
  if (ziel && ordnerUnter(ordner, id).has(ziel)) return false;
  return ordnerPfad(ordner, ziel).length + ordnerHoehe(ordner, id) <= ORDNER_TIEFE_MAX;
}
// Einträge (Quiz bzw. Listen) in einem Ordner samt Unterordnern
export function eintraegeImOrdner(data, id) {
  const ids = ordnerUnter(data.ordner, id);
  return data.gespeichert.filter(x => x.ordner && ids.has(x.ordner));
}
// Einträge bzw. Ordner (ids) in den Ordner ziel (null = oberste Ebene) legen – sie kommen dort ans Ende;
// Ordner, die nicht passen (zu tief, in sich selbst), bleiben, wo sie sind
export function legeInOrdner(data, ids, ziel) {
  const set = new Set(ids), ohne = ({ platz: _p, ordner: _o, ...r }) => r;   // eslint-disable-line no-unused-vars
  const hin = x => ziel ? { ...ohne(x), ordner: ziel } : ohne(x);
  return { ...data,
    ordner: (data.ordner || []).map(o => set.has(o.id) && o.id !== ziel && ordnerPasst(data.ordner, o.id, ziel) && (o.ordner || null) !== ziel ? hin(o) : o),
    gespeichert: data.gespeichert.map(x => set.has(x.id) && (x.ordner || null) !== ziel ? hin(x) : x) };
}
// neuer Ordner in eltern (null = oben) aus ids (leer = leerer Ordner); er nimmt den Platz des ersten bzw. platz ein
export function neuerOrdnerIn(data, { id, name, eltern = null, ids = [], platz = null }) {
  const erste = ebeneVon(data, eltern).find(x => x.id === ids[0]);
  const p = platz || erste?.platz || null;
  const neu = { ...data, ordner: [...(data.ordner || []), { id, name: name.trim() || "Ordner", ...(eltern ? { ordner: eltern } : {}), ...(p ? { platz: p } : {}) }] };
  return ids.length ? legeInOrdner(neu, ids, id) : neu;
}
// Ordner auflösen: Inhalt (Einträge und Unterordner) eine Ebene hinauf, der erste auf den Platz des Ordners
export function loeseOrdnerDaten(data, id) {
  const o = (data.ordner || []).find(x => x.id === id);
  if (!o) return data;
  const eltern = o.ordner || null;
  let erste = !!o.platz;
  const hoch = x => {
    if (x.ordner !== id) return x;
    const { platz: _p, ordner: _o, ...r } = x;   // eslint-disable-line no-unused-vars
    const n = eltern ? { ...r, ordner: eltern } : r;
    if (erste) { erste = false; return { ...n, platz: o.platz }; }
    return n;
  };
  return { ...data, ordner: data.ordner.filter(x => x.id !== id).map(hoch), gespeichert: data.gespeichert.map(hoch) };
}
// Verweise auf nicht mehr vorhandene Ordner lösen (Eintrag/Ordner kommt auf die oberste Ebene)
export function ordnerBereinigen(data) {
  const gibt = new Set((data.ordner || []).map(o => o.id));
  const fix = x => x.ordner && !gibt.has(x.ordner) ? (({ ordner: _o, platz: _p, ...r }) => r)(x) : x;   // eslint-disable-line no-unused-vars
  return { ...data, ordner: (data.ordner || []).map(fix), gespeichert: data.gespeichert.map(fix) };
}
// Reihenfolge: oberste Ebene nach Platz, ein Ordner jeweils mit seinem ganzen Inhalt an seiner Stelle
export function nachOrdnerBaum(data) {
  const aus = [];
  const p = x => x.platz || { z: Infinity, s: 0 };
  const ebene = oid => [...ebeneVon(data, oid)].sort((a, b) => p(a).z - p(b).z || p(a).s - p(b).s).forEach(x => { if (x.istOrdner) ebene(x.id); else aus.push(x); });
  ebene(null);
  const drin = new Set(aus.map(x => x.id));
  return [...aus, ...data.gespeichert.filter(x => !drin.has(x.id))];
}
export function setzeEbene(data, eintraege) {
  const map = new Map(eintraege.map(e => [e.id, e]));
  const ohneMarke = ({ istOrdner: _i, ...o }) => o;   // eslint-disable-line no-unused-vars
  return { ...data,
    ordner: (data.ordner || []).map(o => map.has(o.id) ? ohneMarke(map.get(o.id)) : o),
    gespeichert: data.gespeichert.map(x => map.has(x.id) ? map.get(x.id) : x) };
}
// Name einer neuen Gruppe: gemeinsamer Namensanfang der Quiz (ohne angeschnittene Zahl), sonst „Gruppe n“
export function gruppenName(namen, vorhandene = []) {
  let p = namen.reduce((a, n) => { let i = 0; while (i < a.length && i < n.length && a[i] === n[i]) i++; return a.slice(0, i); });
  while (/\d$/.test(p) && namen.some(n => /\d/.test(n[p.length] || ""))) p = p.slice(0, -1);
  p = p.replace(/[^\p{L}\p{N})\]]+$/u, "").trim();
  if (p.length >= 2) return p;
  let i = 1;
  while (vorhandene.includes(`Gruppe ${i}`)) i++;
  return `Gruppe ${i}`;
}
// Ziel unter dem Finger beim Ziehen im Raster: Platz „z|s“ oder „raus“ (auf „← Alle Quiz“: aus der Gruppe)
export function zielUnter(x, y) {
  const el = document.elementFromPoint(x, y);
  // 193: Ordner im Pfad („← Alle Quiz“ = oberste Ebene, „› 📁 Name“ = dieser Ordner): „raus“ bzw. „raus:<id>“
  const pfad = el?.closest("[data-ordner-zurueck], [data-ordner-ziel]");
  if (pfad) return pfad.dataset.ordnerZiel ? `raus:${pfad.dataset.ordnerZiel}` : "raus";
  return el?.closest("[data-raster-zelle]")?.dataset.rasterZelle || null;
}
export const GRUPPE_VERWEILEN_MS = 1200;
// 191: „Alle Quiz“ / „Alle Listen“ im Pfad – gelb wie der Ordner
export const ORDNER_KNOPF = { background: "var(--ordner)", color: "var(--auf-ordner)", borderColor: "color-mix(in srgb, var(--ordner) 70%, var(--text-stark))", fontWeight: 700 };
// 234: Kachel-Gesten (Touch): sofort wischen scrollt; so lange halten färbt die Kachel ein – loslassen wählt sie aus
// (Auswahl beginnt bzw. dazu/heraus), weiterfahren sammelt weitere ein …
export const KACHEL_WAEHLEN_MS = 250;
// … und so lange halten hebt sie an (Rückmeldung am Finger): ziehen verschiebt (ausgewählte: die ganze Auswahl)
export const KACHEL_ZIEHEN_MS = 1000;
// 232/234: Rückmeldung am Finger, wenn das lange Halten die Kachel zum Verschieben anhebt (Einstellungen › App › Halten)
export const HALTEN_HAPTIK = { doppel: { label: "Doppel-Tipp", muster: [8, 70, 8] }, tick: { label: "Tick", muster: [6] },
  kurz: { label: "Vibration", muster: [20] }, aus: { label: "Aus", muster: null } };
export const haltenHaptik = art => { const m = (HALTEN_HAPTIK[art] || HALTEN_HAPTIK.doppel).muster; if (m) navigator.vibrate?.(m); };
export const KACHEL_LASSO_FREI = false;   // Einsammeln von einer freien Stelle aus (167: aus)   // so lange über einer Kachel halten, bis Loslassen eine Gruppe bildet
// Vokabel-Suche: nur Fremdsprache (E1–E3) und Deutsch (D1–D2), „enthält“, Groß/klein und Akzente egal;
// Treffer am Wortanfang zuerst, sonst in Listen-Reihenfolge. Ergebnis: [{ id, i (Position in voks), rang }]
export const SUCH_SPALTEN = ["E1", "E2", "E3", "D1", "D2"];
export function suchNorm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
export function sucheVokabeln(voks, text) {
  const q = suchNorm(text).trim();
  if (!q) return [];
  const treffer = [];
  voks.forEach((v, i) => {
    let rang = 2;
    for (const t of SUCH_SPALTEN) {
      const w = suchNorm(v[t]?.wert);
      for (let p = w.indexOf(q); p >= 0 && rang > 0; p = w.indexOf(q, p + 1)) rang = p === 0 || !/[\p{L}\p{N}]/u.test(w[p - 1]) ? 0 : Math.min(rang, 1);
    }
    if (rang < 2) treffer.push({ id: v.id, i, rang });
  });
  return treffer.sort((a, b) => a.rang - b.rang || a.i - b.i);
}
export const SUCHE_LEER = { text: "", nr: 0, nurTreffer: false };
