
// ── Styling ────────────────────────────────────────────────────────────────
export const C = {
  bg:"var(--hintergrund)", surface:"var(--karte)", border:"var(--rahmen)",
  accent:"var(--haupt)", accentHi:"var(--haupt)", danger:"var(--falsch)",
  text:"var(--text-stark)", muted:"var(--text2)", tag:"var(--haupt-flaeche)", tagText:"var(--haupt)",
};

/* FARBSCHEMATA-START */
// ── Farbschemata: Grundfarben je Rolle; Abstufungen (zart, Fläche, dunkel) werden daraus gemischt ──
export const FARB_ROLLEN = [
  ["leiste", "App-Leiste (System)", "Leiste ganz oben (Uhrzeit, Akku) und unten"],
  ["haupt", "Hauptfarbe", "Knöpfe, Kopfzeilen, aktive Auswahl"], ["haupt-hell", "Hauptfarbe hell", "Fortschrittsringe, Balken"],
  ["auf-haupt", "Schrift auf Hauptfarbe", "Text auf Knöpfen"],
  ["hintergrund", "Hintergrund", "nur die Seite selbst"],
  ["app-kopf", "App-Kopf", "Titelleiste und Tab-Leiste"],
  ["kopfzeile", "Bereichs-Kopfzeilen", "Kopf der Listenauswahl, Statistik, Konfiguration, Info, Einstellungs-Bereiche"],
  ["karte", "Karten", "Listen-Kacheln, Quiz-Bereiche, Einstellungs-Karten"],
  ["abfrage-karte", "Abfrage-Karten", "Frage-, Antwort- und Lernkarte"],
  ["dialog", "Dialoge", "Fenster zum Bearbeiten, Exportieren, Rückfragen"],
  ["knopf", "Knöpfe & Felder", "Eingabefelder, Umschalt-Knöpfe, Chips, Häkchen"],
  ["info-kasten", "Info-Kästen", "Info-Übersicht, Anleitung, Hinweise, Rückmeldung nach der Runde"],
  ["haupt-flaeche", "Ausgewählt / hervorgehoben", "aktive Kacheln und Kopfzeilen, richtige Antwort"],
  ["start", "Aktuelle Liste", "aktuelle Liste oben im Quiz-Tab"],
  ["auf-start", "Schrift auf aktueller Liste", "Text auf der aktuellen Liste"],
  ["auf-falsch", "Schrift auf Falsch", "Text auf roten Knöpfen und Markierungen (Nicht gewusst, geändertes Quiz)"],
  ["auf-gelb", "Schrift auf Hervorhebung", "Text auf gelben Markierungen (Info-Spalte)"],
  ["auf-haupt-hell", "Schrift auf Hauptfarbe hell", "Text auf hellen Haupt-Knöpfen (Antwortart der Spalte)"],
  ["auf-gelernt", "Schrift auf Statistik: Gelernt", "Häkchen auf 100 %-Kacheln"],
  ["bestaetigen", "Auswahl / Bestätigen", "Bestätigen-Knöpfe, Start-Knopf und alle Auswahl-Markierungen (Rahmen, Nummern, Ziele)"], ["auf-bestaetigen", "Schrift auf Auswahl / Bestätigen", "Text auf Bestätigen- und Start-Knopf, Auswahl-Nummern"],
  ["ordner", "Ordner", "„Alle Quiz“ / „Alle Listen“ im Pfad über den Kacheln"], ["auf-ordner", "Schrift auf Ordner", "Text auf dem Ordner-Knopf"],
  ["tab-aktiv", "Aktiver Tab", "Schrift und Unterstrich des gewählten Tabs"], ["app-kopf-schrift", "Schrift im App-Kopf", "Titel „Vokabel-Trainer“"], ["app-kopf-schrift-leise", "Schrift im App-Kopf leise", "nicht gewählte Tabs"],
  ["kopf-schrift", "Schrift auf Kopfzeilen", "Überschriften der Einstellungs-Köpfe, Quiz-, Listen- und Statistik-Kopf"],
  ["kopf-schrift-leise", "Schrift auf Kopfzeilen leise", "Unterzeilen und Pfeile der Kopfzeilen, Info-Zeile im Quiz-Kopf"],
  ["kopf-offen", "Geöffneter Kopf", "Hintergrund eines aufgeklappten Einstellungs-Kopfs"], ["kopf-offen-schrift", "Schrift auf geöffnetem Kopf", "Überschrift und Pfeil eines aufgeklappten Einstellungs-Kopfs"],
  ["dialog-schrift", "Schrift in Dialogen", "Titel und Text der Fenster"],
  ["abfrage-schrift", "Schrift auf Abfrage-Karten", "Frage und Antwort"], ["abfrage-schrift-leise", "Schrift auf Abfrage-Karten leise", "Spaltenname über Frage und Antwort"],
  ["flaeche", "Fläche grau", "leichte Hinterlegungen"],
  ["text-stark", "Text kräftig", "Überschriften, Eingaben"], ["text", "Text", "normaler Text"], ["text2", "Text leise", "Untertitel, Hinweise"], ["text3", "Text sehr leise", "Zahlen in Klammern"],
  ["rahmen", "Rahmen", "Linien und Ränder"],
  ["richtig", "Richtig", "gewusst / richtig beantwortet"], ["falsch", "Falsch", "nicht gewusst, Löschen"],
  ["gelb", "Hervorhebung", "Markierung, Sterne"], ["gelernt-effekt", "Gelernt-Effekt", "Aufleuchten, wenn eine Vokabel gelernt ist"],
  ["orange", "Warnung", "Hinweise"], ["info", "Info", "weitere Antwort, Info-Spalten"],
  ["fortschritt-balken", "Fortschrittsbalken: Hintergrund", "leerer Teil des Balkens im Statistik-Kopf"],
  ["fortschritt-gelernt", "Fortschrittsbalken: Gelernt", "Balken im Statistik-Kopf"], ["fortschritt-arbeit", "Fortschrittsbalken: In Arbeit", "Balken im Statistik-Kopf"],
  ["fortschritt-nie", "Fortschrittsbalken: Nie abgefragt", "Balken im Statistik-Kopf"], ["fortschritt-negativ", "Fortschrittsbalken: Negativ", "Balken im Statistik-Kopf"],
  ["gelernt", "Statistik: Gelernt", ""], ["arbeit", "Statistik: In Arbeit", ""], ["nie", "Statistik: Nie abgefragt", ""], ["negativ", "Statistik: Negativ", ""],
];
export const FARB_VORLAGEN = [
  { id: "natur", name: "Natur", farben: { "haupt": "#2d6a4f", "haupt-hell": "#52b788", "auf-haupt": "#fff", "hintergrund": "#f7f5f0", "karte": "#fff", "flaeche": "#f0ede8",
    "text-stark": "#1a1a1a", "text": "#3b3832", "text2": "#6b6560", "text3": "#9b9590", "rahmen": "#e0dbd2", "richtig": "#2d6a4f", "falsch": "#c0392b",
    "gelb": "#f9a825", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a1b9a", "gelernt": "#2d6a4f", "arbeit": "#e9c46a", "nie": "#d6d2cb", "negativ": "#e57373" } },
  { id: "freudig", name: "Freudig", farben: { "haupt": "#e8590c", "haupt-hell": "#ff922b", "auf-haupt": "#fff", "hintergrund": "#fff8f0", "karte": "#fff", "flaeche": "#fff0e0",
    "text-stark": "#2a1a10", "text": "#3d2c22", "text2": "#7a6152", "text3": "#a8917f", "rahmen": "#f3dcc8", "richtig": "#2b9348", "falsch": "#d62828",
    "gelb": "#fcbf49", "gelernt-effekt": "#fff176", "orange": "#f77f00", "info": "#7b2cbf", "gelernt": "#2b9348", "arbeit": "#fcbf49", "nie": "#e9dccf", "negativ": "#ef476f" } },
  { id: "pastelle", name: "Pastelle", farben: { "haupt": "#7d9d8c", "haupt-hell": "#a8c5b5", "auf-haupt": "#fff", "auf-start": "#24382d", "hintergrund": "#faf7fb", "karte": "#fff", "flaeche": "#f2eef6",
    "text-stark": "#2f2a3a", "text": "#4a4458", "text2": "#7d768a", "text3": "#a8a2b3", "rahmen": "#e6e0ec", "richtig": "#6fae8e", "falsch": "#d97a7a",
    "gelb": "#f4c97a", "gelernt-effekt": "#fff176", "orange": "#f2a679", "info": "#a48cc8", "gelernt": "#8fc1a5", "arbeit": "#f6d79a", "nie": "#e3dde8", "negativ": "#eea2a2" } },
  { id: "maedchen", name: "Mädchen", farben: { "haupt": "#c2185b", "haupt-hell": "#f06292", "auf-haupt": "#fff", "hintergrund": "#fff5f9", "karte": "#fff", "flaeche": "#fce4ec",
    "text-stark": "#2e1422", "text": "#4a2639", "text2": "#8a5a72", "text3": "#b48ea0", "rahmen": "#f6d3e1", "richtig": "#2e9e6b", "falsch": "#d32f2f",
    "gelb": "#ffb300", "gelernt-effekt": "#fff176", "orange": "#ff7043", "info": "#8e24aa", "gelernt": "#ab47bc", "arbeit": "#ffca6b", "nie": "#ead7e0", "negativ": "#ef5350" } },
  { id: "jungs", name: "Jungs", farben: { "haupt": "#1d5f8a", "haupt-hell": "#3a9bd5", "auf-haupt": "#fff", "hintergrund": "#f3f7fa", "karte": "#fff", "flaeche": "#e6eef4",
    "text-stark": "#111c26", "text": "#22313f", "text2": "#566778", "text3": "#8a9aa8", "rahmen": "#d5e0e9", "richtig": "#2e8b57", "falsch": "#c62828",
    "gelb": "#ff9f1c", "gelernt-effekt": "#fff176", "orange": "#f3722c", "info": "#5e35b1", "gelernt": "#2e8b57", "arbeit": "#ffbf47", "nie": "#d5dee6", "negativ": "#e5604d" } },
  { id: "dunkel", name: "Dunkel", farben: { "leiste": "#161816", "haupt": "#52b788", "haupt-hell": "#74c69d", "auf-haupt": "#10241a", "hintergrund": "#161816", "karte": "#222522", "flaeche": "#2c302c",
    "text-stark": "#f2f0eb", "text": "#e3e0da", "text2": "#b4b0a8", "text3": "#8a867f", "rahmen": "#3a3e3a", "richtig": "#52b788", "falsch": "#ef6f61",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#52b788", "arbeit": "#d9b44a", "nie": "#4a4f4a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "ozean", name: "Ozean", farben: { "haupt": "#0f6e7a", "haupt-hell": "#2bb3c0", "auf-haupt": "#fff", "hintergrund": "#f2f8f9", "karte": "#fff", "flaeche": "#e3eff1", "text-stark": "#0e1e22",
    "text": "#23363b", "text2": "#5a7076", "text3": "#8ea2a7", "rahmen": "#d3e3e6", "richtig": "#2a9d6f", "falsch": "#d1495b", "gelb": "#f4b942",
    "gelernt-effekt": "#fff176", "orange": "#f08a4b", "info": "#6c4ab6", "gelernt": "#2a9d8f", "arbeit": "#f2cc6b", "nie": "#d6e2e4", "negativ": "#e76f7a" } },
  { id: "lavendel", name: "Lavendel", farben: { "haupt": "#6a4c93", "haupt-hell": "#a68bd1", "auf-haupt": "#fff", "hintergrund": "#f8f6fc", "karte": "#fff", "flaeche": "#efeaf7", "text-stark": "#221a30",
    "text": "#3a3048", "text2": "#706582", "text3": "#a198b0", "rahmen": "#e2dbee", "richtig": "#3e9b74", "falsch": "#c94f6d", "gelb": "#f2b84b",
    "gelernt-effekt": "#fff176", "orange": "#ec8a5a", "info": "#3f6fb5", "gelernt": "#8b6cc4", "arbeit": "#f3d08a", "nie": "#e2dde9", "negativ": "#e88a9e" } },
  { id: "minze", name: "Minze", farben: { "haupt": "#1a7a63", "haupt-hell": "#5fd3b0", "auf-haupt": "#fff", "hintergrund": "#f3fbf8", "karte": "#fff", "flaeche": "#e2f4ee", "text-stark": "#102620",
    "text": "#22403a", "text2": "#5a7a72", "text3": "#8fada5", "rahmen": "#cfe9e0", "richtig": "#1f8a70", "falsch": "#e05263", "gelb": "#f7c548",
    "gelernt-effekt": "#fff176", "orange": "#f39a5b", "info": "#6b5bd2", "gelernt": "#2fb38a", "arbeit": "#f7d774", "nie": "#d5e7e1", "negativ": "#ef8a96" } },
  { id: "sand", name: "Sand", farben: { "haupt": "#a0522d", "haupt-hell": "#d4935f", "auf-haupt": "#fff", "hintergrund": "#fbf6ee", "karte": "#fffdf9", "flaeche": "#f2e9da", "text-stark": "#2b1d12",
    "text": "#45352a", "text2": "#7d6a5a", "text3": "#ab9a8a", "rahmen": "#e8dcc8", "richtig": "#5a8f3c", "falsch": "#b83a3a", "gelb": "#e0a526",
    "gelernt-effekt": "#fff176", "orange": "#d9772b", "info": "#7a4f9a", "gelernt": "#6b9a45", "arbeit": "#e8c071", "nie": "#e3d8c6", "negativ": "#d77a6a" } },
  { id: "beere", name: "Beere", farben: { "haupt": "#8e2c5a", "haupt-hell": "#d0679a", "auf-haupt": "#fff", "hintergrund": "#fcf5f8", "karte": "#fff", "flaeche": "#f6e6ee", "text-stark": "#2a1220",
    "text": "#452636", "text2": "#80596c", "text3": "#b08ea0", "rahmen": "#efd6e2", "richtig": "#2f9a6a", "falsch": "#d33f3f", "gelb": "#f5b031",
    "gelernt-effekt": "#fff176", "orange": "#f07b3f", "info": "#5a4fcf", "gelernt": "#b04d84", "arbeit": "#f5c86e", "nie": "#ebdce3", "negativ": "#e86a6a" } },
  { id: "olive", name: "Olive", farben: { "haupt": "#5f6f1f", "haupt-hell": "#9fb34a", "auf-haupt": "#fff", "hintergrund": "#f8f8f0", "karte": "#fff", "flaeche": "#eeefe0", "text-stark": "#1d200f",
    "text": "#33371f", "text2": "#6a6e54", "text3": "#9a9d85", "rahmen": "#e0e2cc", "richtig": "#3d8b3d", "falsch": "#c0392b", "gelb": "#e8b923",
    "gelernt-effekt": "#fff176", "orange": "#e07a2e", "info": "#7a4a9a", "gelernt": "#7f9a2e", "arbeit": "#e8cf6a", "nie": "#dfe0d0", "negativ": "#e07a6a" } },
  { id: "graphit", name: "Graphit", farben: { "haupt": "#3d4451", "haupt-hell": "#7a8494", "auf-haupt": "#fff", "hintergrund": "#f6f7f8", "karte": "#fff", "flaeche": "#eceef1", "text-stark": "#15181c",
    "text": "#2b3038", "text2": "#636a75", "text3": "#969ca6", "rahmen": "#dde0e5", "richtig": "#2e8b57", "falsch": "#c62828", "gelb": "#f2a900",
    "gelernt-effekt": "#fff176", "orange": "#ef6c00", "info": "#5c6bc0", "gelernt": "#3f8f63", "arbeit": "#e5c15a", "nie": "#dcdfe3", "negativ": "#e06060" } },
  { id: "kontrast", name: "Kontrast", farben: { "haupt": "#0033a0", "haupt-hell": "#1f5fe0", "auf-haupt": "#fff", "hintergrund": "#fff", "karte": "#fff", "flaeche": "#f0f0f0", "text-stark": "#000",
    "text": "#000", "text2": "#333", "text3": "#555", "rahmen": "#8a8a8a", "richtig": "#006b2d", "falsch": "#b00000", "gelb": "#ffc400",
    "gelernt-effekt": "#fff176", "orange": "#c55a00", "info": "#5b00b5", "gelernt": "#006b2d", "arbeit": "#e0a800", "nie": "#c8c8c8", "negativ": "#d00000" } },
  { id: "mitternacht", name: "Mitternacht", farben: { "leiste": "#0f1624", "haupt": "#5b8def", "haupt-hell": "#82a8f5", "auf-haupt": "#0b1220", "hintergrund": "#0f1624", "karte": "#182133", "flaeche": "#212c42",
    "text-stark": "#eef2fa", "text": "#dbe2ee", "text2": "#a8b3c7", "text3": "#7c889e", "rahmen": "#2c3850", "richtig": "#4cc38a", "falsch": "#ef6f6f",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b48ef0", "gelernt": "#4cc38a", "arbeit": "#d9b44a", "nie": "#3a4560", "negativ": "#e06c6c" }, dunkel: true },
  { id: "espresso", name: "Espresso", farben: { "leiste": "#1a1411", "haupt": "#d19a66", "haupt-hell": "#e3b98a", "auf-haupt": "#2a1a0e", "hintergrund": "#1a1411", "karte": "#251d18", "flaeche": "#30261f",
    "text-stark": "#f5ede4", "text": "#e6dccf", "text2": "#bba995", "text3": "#8f7e6c", "rahmen": "#3d3128", "richtig": "#7fbf6a", "falsch": "#e57060",
    "gelb": "#f0c050", "gelernt-effekt": "#fff176", "orange": "#e8924a", "info": "#c09ae0", "gelernt": "#7fbf6a", "arbeit": "#d9b44a", "nie": "#4a3d33", "negativ": "#d9675a" }, dunkel: true },
  // bunte Pastell-Vorlagen: Kopf, Kopfzeilen, Abfrage-Karten, Dialoge, Knöpfe, Info-Kästen und Start je eigener Ton
  { id: "sorbet", name: "Sorbet", farben: { "haupt": "#d9756c", "haupt-hell": "#f6c1b8", "auf-haupt": "#3a1f1c", "hintergrund": "#fff6f0", "karte": "#ffffff", "flaeche": "#fdeee6", "rahmen": "#f0d9cf", "app-kopf": "#cdeee2",
    "kopfzeile": "#e6dcf7", "abfrage-karte": "#fffbe8", "dialog": "#fdf4ff", "knopf": "#fff0e8", "info-kasten": "#e3f4ee", "haupt-flaeche": "#fbe1dc", "start": "#9fd8c4", "auf-start": "#1d3a31",
    "kopf-offen": "#d5c6f2", "kopf-offen-schrift": "#3d2a63", "text-stark": "#2e2420", "text": "#4a3c36", "text2": "#85736b", "text3": "#b3a39b", "richtig": "#5fae8c", "falsch": "#e0707a",
    "gelb": "#f7cf6b", "gelernt-effekt": "#fff176", "orange": "#f2a46b", "info": "#9b84d6", "gelernt": "#7cc4a4", "arbeit": "#f7d98c", "nie": "#ebe0da", "negativ": "#f09aa0" } },
  { id: "lagune", name: "Lagune", farben: { "haupt": "#3fa3a9", "haupt-hell": "#a6dfe2", "auf-haupt": "#0d2e31", "hintergrund": "#f1fafb", "karte": "#ffffff", "flaeche": "#e2f2f4", "rahmen": "#cfe6ea", "app-kopf": "#bfe6f5",
    "kopfzeile": "#ffe0d6", "abfrage-karte": "#ffffff", "dialog": "#f4fbff", "knopf": "#eef8fa", "info-kasten": "#fff1e8", "haupt-flaeche": "#d8f0f2", "start": "#f4a48e", "auf-start": "#4a1d12",
    "kopf-offen": "#ffcdbd", "kopf-offen-schrift": "#6a2a18", "text-stark": "#12272b", "text": "#2b4146", "text2": "#5f7a80", "text3": "#93aab0", "richtig": "#4bb08a", "falsch": "#e66b6b",
    "gelb": "#f6c85f", "gelernt-effekt": "#fff176", "orange": "#f39a6b", "info": "#7a8be0", "gelernt": "#4fb3a2", "arbeit": "#f6d27f", "nie": "#d9e7ea", "negativ": "#ef8f8f" } },
  { id: "blumenwiese", name: "Blumenwiese", farben: { "haupt": "#de7aa2", "haupt-hell": "#f8cadb", "auf-haupt": "#4a1830", "hintergrund": "#fbfdf2", "karte": "#ffffff", "flaeche": "#f2f6e4", "rahmen": "#e3e8cf", "app-kopf": "#fff2b8",
    "kopfzeile": "#d9f0c9", "abfrage-karte": "#fffdf6", "dialog": "#fff7fb", "knopf": "#f8fbec", "info-kasten": "#fff6d6", "haupt-flaeche": "#fde3ec", "start": "#b8e09a", "auf-start": "#213a12",
    "kopf-offen": "#f8cadb", "kopf-offen-schrift": "#5a1d3a", "text-stark": "#2a2a1c", "text": "#3f3f2c", "text2": "#75765c", "text3": "#a5a68c", "richtig": "#6cb36a", "falsch": "#e46f86",
    "gelb": "#f5c842", "gelernt-effekt": "#fff176", "orange": "#f4a259", "info": "#a17ad6", "gelernt": "#8acb6e", "arbeit": "#f6d56a", "nie": "#e8ead9", "negativ": "#ef8fa4" } },
  { id: "nordlicht", name: "Nordlicht", farben: { "haupt": "#8a78d6", "haupt-hell": "#cbc2f2", "auf-haupt": "#1b1440", "hintergrund": "#f6f5fd", "karte": "#ffffff", "flaeche": "#ecebf8", "rahmen": "#dddbf0", "app-kopf": "#c8ecdf",
    "kopfzeile": "#d6e6fb", "abfrage-karte": "#ffffff", "dialog": "#f9f8ff", "knopf": "#f2f1fb", "info-kasten": "#e5f5ef", "haupt-flaeche": "#e6e1fa", "start": "#8fd3b9", "auf-start": "#133a2c",
    "kopf-offen": "#c4d9f7", "kopf-offen-schrift": "#1f3c66", "text-stark": "#1f1d33", "text": "#36344d", "text2": "#6c6a86", "text3": "#9e9cb6", "richtig": "#4fae8a", "falsch": "#e07085",
    "gelb": "#f3c75d", "gelernt-effekt": "#fff176", "orange": "#f0a070", "info": "#6f8de0", "gelernt": "#7fc8ac", "arbeit": "#f1d488", "nie": "#e2e1ef", "negativ": "#ee8fa0" } },
  { id: "sommerfest", name: "Sommerfest", farben: { "haupt": "#d98330", "haupt-hell": "#fad3a6", "auf-haupt": "#3a2005", "hintergrund": "#fffaf2", "karte": "#ffffff", "flaeche": "#fdf0dd", "rahmen": "#f2dfc2", "app-kopf": "#ffd0dc",
    "kopfzeile": "#c9eef0", "abfrage-karte": "#fffdf8", "dialog": "#fff8fa", "knopf": "#fff4e6", "info-kasten": "#e6f6f7", "haupt-flaeche": "#fde6c9", "start": "#f28fab", "auf-start": "#4d1225",
    "kopf-offen": "#a9e2e6", "kopf-offen-schrift": "#134447", "text-stark": "#2d2116", "text": "#47372a", "text2": "#85705c", "text3": "#b5a28f", "richtig": "#56b07e", "falsch": "#e2606f",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#ee8a4b", "info": "#8f79d4", "gelernt": "#6cc196", "arbeit": "#f6cf72", "nie": "#efe4d6", "negativ": "#ec8a95" } },
  // ── zehn weitere Vorlagen ──
  { id: "kirschbluete", name: "Kirschblüte", farben: { "haupt": "#c45b7c", "haupt-hell": "#f2b5c8", "auf-haupt": "#fff", "hintergrund": "#fdf8f9", "karte": "#ffffff", "flaeche": "#f8ecf0", "rahmen": "#eedbe2",
    "app-kopf": "#fbe4ec", "kopfzeile": "#f6e9ee", "haupt-flaeche": "#fbe1ea", "start": "#c45b7c", "auf-start": "#fff", "kopf-offen": "#f2b5c8", "kopf-offen-schrift": "#5a1c30",
    "text-stark": "#2b1d22", "text": "#46333a", "text2": "#7f6870", "text3": "#ad9aa1", "richtig": "#5a9e7a", "falsch": "#d0465f",
    "gelb": "#e9b949", "gelernt-effekt": "#ffe3ee", "orange": "#e8875c", "info": "#8c6bc2", "gelernt": "#7cb69a", "arbeit": "#f1cf7f", "nie": "#ece3e6", "negativ": "#e98a9d" } },
  { id: "tiefsee", name: "Tiefsee", farben: { "leiste": "#06141c", "haupt": "#22c1c3", "haupt-hell": "#6fe0e1", "auf-haupt": "#04232a", "hintergrund": "#06141c", "karte": "#0d2330", "flaeche": "#123040",
    "app-kopf": "#081c27", "kopfzeile": "#0f2a38", "abfrage-karte": "#0f2b3a", "dialog": "#0d2330", "knopf": "#123040", "info-kasten": "#103446", "haupt-flaeche": "#0f3b45",
    "start": "#22c1c3", "auf-start": "#04232a", "text-stark": "#e8f8fb", "text": "#cfe9ef", "text2": "#93b9c3", "text3": "#6a909a", "rahmen": "#1d4152",
    "richtig": "#3fd19a", "falsch": "#ff6b81", "gelb": "#ffd166", "gelernt-effekt": "#9ff3ff", "orange": "#ff9f5a", "info": "#a99bff",
    "gelernt": "#3fd19a", "arbeit": "#e6c15a", "nie": "#25495a", "negativ": "#ff7a8c" }, dunkel: true },
  { id: "herbstlaub", name: "Herbstlaub", farben: { "haupt": "#a8431f", "haupt-hell": "#e08a4f", "auf-haupt": "#fff", "hintergrund": "#fbf6ef", "karte": "#ffffff", "flaeche": "#f4eadc", "rahmen": "#e7d6c0",
    "app-kopf": "#f3dcc0", "kopfzeile": "#f1e2cc", "haupt-flaeche": "#f8dfcc", "start": "#7b5b2a", "auf-start": "#fff6e8", "kopf-offen": "#e9c18f", "kopf-offen-schrift": "#4a2a0c",
    "text-stark": "#2b1d12", "text": "#47331f", "text2": "#806a52", "text3": "#ae9b85", "richtig": "#6b8f3a", "falsch": "#b83a2b",
    "gelb": "#e0a526", "gelernt-effekt": "#ffe08a", "orange": "#d9772b", "info": "#7d5aa8", "gelernt": "#8aa84a", "arbeit": "#e7b75a", "nie": "#e6dccd", "negativ": "#d4735f" } },
  { id: "gletscher", name: "Gletscher", farben: { "haupt": "#3c6e91", "haupt-hell": "#9cc7e4", "auf-haupt": "#fff", "hintergrund": "#f5f9fc", "karte": "#ffffff", "flaeche": "#e8f1f7", "rahmen": "#d4e3ee",
    "app-kopf": "#e2eff8", "kopfzeile": "#e9f3fa", "abfrage-karte": "#fbfdff", "haupt-flaeche": "#dcecf7", "start": "#3c6e91", "auf-start": "#fff", "kopf-offen": "#bcd9ee", "kopf-offen-schrift": "#14334a",
    "text-stark": "#12202b", "text": "#26394a", "text2": "#5d7386", "text3": "#93a6b5", "richtig": "#2f9c8f", "falsch": "#cc4b5c",
    "gelb": "#f0b93a", "gelernt-effekt": "#d8f3ff", "orange": "#e88a4a", "info": "#6a6fd0", "gelernt": "#5fb3a8", "arbeit": "#f1cd73", "nie": "#dde7ef", "negativ": "#e48795" } },
  { id: "terrakotta", name: "Terrakotta", farben: { "haupt": "#b5563a", "haupt-hell": "#e6a080", "auf-haupt": "#fff", "hintergrund": "#fbf4ee", "karte": "#fffaf6", "flaeche": "#f3e4d8", "rahmen": "#e8d2c2",
    "app-kopf": "#e9c9b3", "kopfzeile": "#efdccd", "haupt-flaeche": "#f5d8c9", "start": "#5f7d5a", "auf-start": "#fff", "kopf-offen": "#d99a7c", "kopf-offen-schrift": "#3d1a0d",
    "text-stark": "#2e1c14", "text": "#4a3227", "text2": "#82685b", "text3": "#b19c90", "richtig": "#5f7d5a", "falsch": "#b23a3a",
    "gelb": "#e3a93b", "gelernt-effekt": "#ffe2b8", "orange": "#d97b43", "info": "#8a5f9e", "gelernt": "#7e9c74", "arbeit": "#e8bf74", "nie": "#eadfd5", "negativ": "#d77a6e" } },
  { id: "retro", name: "Retro 70er", farben: { "haupt": "#c8641e", "haupt-hell": "#e8a54b", "auf-haupt": "#fff8e8", "hintergrund": "#f8f0dc", "karte": "#fffaf0", "flaeche": "#efe2c2", "rahmen": "#e0cc9f",
    "app-kopf": "#e0b23a", "app-kopf-schrift": "#3a2408", "app-kopf-schrift-leise": "#6b4d1c", "kopfzeile": "#9aa64a", "kopf-schrift": "#fffbe8", "kopf-schrift-leise": "#eef0c8",
    "haupt-flaeche": "#f6dcb0", "start": "#7a4a2a", "auf-start": "#fff3dc", "kopf-offen": "#c8641e", "kopf-offen-schrift": "#fff8e8",
    "text-stark": "#2e2210", "text": "#4a3a1e", "text2": "#7e6b48", "text3": "#ab9b78", "richtig": "#6f8a2a", "falsch": "#b5402a",
    "gelb": "#e0b23a", "gelernt-effekt": "#fff0a0", "orange": "#d9772b", "info": "#8a5a8a", "gelernt": "#8fa33f", "arbeit": "#e8c25a", "nie": "#e8dcc0", "negativ": "#d36a52" } },
  { id: "neon", name: "Neon", farben: { "leiste": "#0b0b14", "haupt": "#ff3fb4", "haupt-hell": "#ff8ad6", "auf-haupt": "#1a0012", "hintergrund": "#0b0b14", "karte": "#15152a", "flaeche": "#1e1e38", "rahmen": "#2c2c52",
    "app-kopf": "#0f0f22", "app-kopf-schrift": "#39f3ff", "kopfzeile": "#17172e", "kopf-schrift": "#39f3ff", "abfrage-karte": "#18183a", "dialog": "#15152a", "knopf": "#1e1e38",
    "info-kasten": "#1b1b40", "haupt-flaeche": "#2a1438", "start": "#39f3ff", "auf-start": "#001a1d",
    "text-stark": "#f4f2ff", "text": "#dcd8f5", "text2": "#a29ec8", "text3": "#76739c", "richtig": "#4dff9a", "falsch": "#ff4d6d",
    "gelb": "#fff04d", "gelernt-effekt": "#39f3ff", "orange": "#ffa24d", "info": "#b48cff", "gelernt": "#4dff9a", "arbeit": "#ffd84d", "nie": "#33335a", "negativ": "#ff4d6d" }, dunkel: true },
  { id: "matcha", name: "Matcha", farben: { "haupt": "#5b7f3a", "haupt-hell": "#a9c47f", "auf-haupt": "#fff", "hintergrund": "#f8f6ec", "karte": "#fffdf5", "flaeche": "#eef0dc", "rahmen": "#dfe2c4",
    "app-kopf": "#dfe8c6", "kopfzeile": "#e8eed4", "abfrage-karte": "#fffef8", "haupt-flaeche": "#e3edcf", "start": "#5b7f3a", "auf-start": "#fff", "kopf-offen": "#c3d69e", "kopf-offen-schrift": "#25330f",
    "text-stark": "#1f2414", "text": "#363d26", "text2": "#6b7356", "text3": "#9da58a", "richtig": "#5b7f3a", "falsch": "#c0504d",
    "gelb": "#e3b43c", "gelernt-effekt": "#eaffb0", "orange": "#e08a3c", "info": "#7a6aa8", "gelernt": "#87a85a", "arbeit": "#e6cb6e", "nie": "#e6e6d4", "negativ": "#dc8a80" } },
  { id: "tinte", name: "Tinte & Papier", farben: { "haupt": "#1f3a8a", "haupt-hell": "#6d85c9", "auf-haupt": "#fff", "hintergrund": "#f6f1e4", "karte": "#fffcf3", "flaeche": "#ede5d0", "rahmen": "#dccfae",
    "app-kopf": "#fffcf3", "kopfzeile": "#f1ead6", "abfrage-karte": "#fffdf6", "haupt-flaeche": "#e3e8f6", "start": "#1f3a8a", "auf-start": "#fff", "kopf-offen": "#d7def2", "kopf-offen-schrift": "#14275e",
    "text-stark": "#141a2e", "text": "#2a3048", "text2": "#5f6378", "text3": "#949096", "richtig": "#2d7a4e", "falsch": "#b3261e",
    "gelb": "#e7b02c", "gelernt-effekt": "#fff3a8", "orange": "#d4762c", "info": "#6a3f9e", "gelernt": "#4f8d68", "arbeit": "#e3c06a", "nie": "#e5dcc6", "negativ": "#d0645c" } },
  { id: "sonnenuntergang", name: "Sonnenuntergang", farben: { "haupt": "#6a3d9a", "haupt-hell": "#c39be3", "auf-haupt": "#fff", "hintergrund": "#fff6f1", "karte": "#ffffff", "flaeche": "#fbe8e2", "rahmen": "#f2d6d0",
    "app-kopf": "#ff9e7a", "app-kopf-schrift": "#3a1030", "app-kopf-schrift-leise": "#6e2f4a", "kopfzeile": "#ffd6b8", "kopf-schrift": "#4a1a3c", "kopf-schrift-leise": "#7a4a5c",
    "abfrage-karte": "#fffaf6", "haupt-flaeche": "#efe0fa", "start": "#e8567a", "auf-start": "#fff", "kopf-offen": "#c39be3", "kopf-offen-schrift": "#2e1048",
    "text-stark": "#2a1426", "text": "#45283e", "text2": "#7d5e72", "text3": "#ad93a3", "richtig": "#3f9e7a", "falsch": "#d33c5a",
    "gelb": "#ffb547", "gelernt-effekt": "#ffd9a8", "orange": "#ff8a4c", "info": "#6a3d9a", "gelernt": "#6cbc96", "arbeit": "#ffc977", "nie": "#f1e1e0", "negativ": "#ee7f95" } },
  // ── 19 experimentelle Vorlagen: kräftig farbige bzw. farbig-dunkle Hintergründe ──
  { id: "senf", name: "Senf", farben: { "haupt": "#2f4858", "haupt-hell": "#6e8fa3", "auf-haupt": "#fff", "hintergrund": "#e3b23c", "karte": "#fff8e6", "flaeche": "#f7ecd0", "rahmen": "#e6cf9a",
    "app-kopf": "#fff8e6", "kopfzeile": "#f7ecd0", "haupt-flaeche": "#f7ecd0", "start": "#2f4858", "auf-start": "#fff",
    "text-stark": "#1f1a0e", "text": "#3a3020", "text2": "#4f4428", "text3": "#6b5d3a", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#e6cf9a", "negativ": "#e06c6c" } },
  { id: "flamingo", name: "Flamingo", farben: { "haupt": "#1b7f5f", "haupt-hell": "#62b89a", "auf-haupt": "#fff", "hintergrund": "#f4a3b1", "karte": "#fff5f7", "flaeche": "#fde5ea", "rahmen": "#f1c4cd",
    "app-kopf": "#fff5f7", "kopfzeile": "#fde5ea", "haupt-flaeche": "#fde5ea", "start": "#1b7f5f", "auf-start": "#fff",
    "text-stark": "#2a1018", "text": "#45222c", "text2": "#5c3440", "text3": "#7a5260", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f1c4cd", "negativ": "#e06c6c" } },
  { id: "pistazie", name: "Pistazie", farben: { "haupt": "#6b2d5c", "haupt-hell": "#b07aa3", "auf-haupt": "#fff", "hintergrund": "#b5d99c", "karte": "#fbfff5", "flaeche": "#edf6e2", "rahmen": "#d3e6c0",
    "app-kopf": "#fbfff5", "kopfzeile": "#edf6e2", "haupt-flaeche": "#edf6e2", "start": "#6b2d5c", "auf-start": "#fff",
    "text-stark": "#18220f", "text": "#2e3b22", "text2": "#3f4f31", "text3": "#5a6b4b", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d3e6c0", "negativ": "#e06c6c" } },
  { id: "himmel", name: "Himmelblau", farben: { "haupt": "#d9481f", "haupt-hell": "#f08b66", "auf-haupt": "#fff", "hintergrund": "#9ecff0", "karte": "#f7fcff", "flaeche": "#e4f2fc", "rahmen": "#c3e0f4",
    "app-kopf": "#f7fcff", "kopfzeile": "#e4f2fc", "haupt-flaeche": "#e4f2fc", "start": "#d9481f", "auf-start": "#fff",
    "text-stark": "#0e1d2a", "text": "#20384c", "text2": "#2f4d66", "text3": "#4d6b85", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#c3e0f4", "negativ": "#e06c6c" } },
  { id: "lachs", name: "Lachs", farben: { "haupt": "#2b4162", "haupt-hell": "#6c84a8", "auf-haupt": "#fff", "hintergrund": "#f4a582", "karte": "#fff6f0", "flaeche": "#fde6da", "rahmen": "#f2c7b1",
    "app-kopf": "#fff6f0", "kopfzeile": "#fde6da", "haupt-flaeche": "#fde6da", "start": "#2b4162", "auf-start": "#fff",
    "text-stark": "#2a140a", "text": "#46281a", "text2": "#5c3828", "text3": "#7a5544", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f2c7b1", "negativ": "#e06c6c" } },
  { id: "lavendelfeld", name: "Lavendelfeld", farben: { "haupt": "#b86e00", "haupt-hell": "#e0a54d", "auf-haupt": "#fff", "hintergrund": "#b8a9e3", "karte": "#faf8ff", "flaeche": "#ece7fa", "rahmen": "#d6ccf0",
    "app-kopf": "#faf8ff", "kopfzeile": "#ece7fa", "haupt-flaeche": "#ece7fa", "start": "#b86e00", "auf-start": "#fff",
    "text-stark": "#1c1530", "text": "#30284a", "text2": "#41385e", "text3": "#5d5478", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d6ccf0", "negativ": "#e06c6c" } },
  { id: "zitrone", name: "Zitrone", farben: { "haupt": "#5a189a", "haupt-hell": "#9b6ad0", "auf-haupt": "#fff", "hintergrund": "#f5e65a", "karte": "#fffde8", "flaeche": "#fbf5c4", "rahmen": "#ece08c",
    "app-kopf": "#fffde8", "kopfzeile": "#fbf5c4", "haupt-flaeche": "#fbf5c4", "start": "#5a189a", "auf-start": "#fff",
    "text-stark": "#211d05", "text": "#3b3610", "text2": "#514a1c", "text3": "#6d6533", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#ece08c", "negativ": "#e06c6c" } },
  { id: "koralle", name: "Koralle", farben: { "haupt": "#134e6f", "haupt-hell": "#4f8fb3", "auf-haupt": "#fff", "hintergrund": "#ff7f6b", "karte": "#fff3f0", "flaeche": "#ffe1da", "rahmen": "#f6b9ad",
    "app-kopf": "#fff3f0", "kopfzeile": "#ffe1da", "haupt-flaeche": "#ffe1da", "start": "#134e6f", "auf-start": "#fff",
    "text-stark": "#2b0d08", "text": "#45180f", "text2": "#55211a", "text3": "#6e3a31", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f6b9ad", "negativ": "#e06c6c" } },
  { id: "tuerkis", name: "Türkis", farben: { "haupt": "#8e2c48", "haupt-hell": "#c46d88", "auf-haupt": "#fff", "hintergrund": "#48c9b0", "karte": "#f0fffb", "flaeche": "#d9f6ef", "rahmen": "#a9e4d6",
    "app-kopf": "#f0fffb", "kopfzeile": "#d9f6ef", "haupt-flaeche": "#d9f6ef", "start": "#8e2c48", "auf-start": "#fff",
    "text-stark": "#06231d", "text": "#103a31", "text2": "#164a3f", "text3": "#2a6357", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#a9e4d6", "negativ": "#e06c6c" } },
  { id: "pfirsich", name: "Pfirsich & Petrol", farben: { "haupt": "#00606f", "haupt-hell": "#4aa3b0", "auf-haupt": "#fff", "hintergrund": "#ffd3b5", "karte": "#fffaf6", "flaeche": "#ffeadb", "rahmen": "#f3cdb2",
    "app-kopf": "#fffaf6", "kopfzeile": "#ffeadb", "haupt-flaeche": "#ffeadb", "start": "#00606f", "auf-start": "#fff",
    "text-stark": "#2b1608", "text": "#47301e", "text2": "#5e4430", "text3": "#7e634d", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f3cdb2", "negativ": "#e06c6c" } },
  { id: "kaugummi", name: "Kaugummi", farben: { "haupt": "#3a0ca3", "haupt-hell": "#7b5ce0", "auf-haupt": "#fff", "hintergrund": "#ff9ecd", "karte": "#fff4fa", "flaeche": "#ffe0ef", "rahmen": "#f7bcd8",
    "app-kopf": "#fff4fa", "kopfzeile": "#ffe0ef", "haupt-flaeche": "#ffe0ef", "start": "#3a0ca3", "auf-start": "#fff",
    "text-stark": "#2c0718", "text": "#47142c", "text2": "#5c2340", "text3": "#7a3f5c", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f7bcd8", "negativ": "#e06c6c" } },
  { id: "mintschoko", name: "Mint & Schoko", farben: { "haupt": "#5d3a1a", "haupt-hell": "#9a6e48", "auf-haupt": "#fff", "hintergrund": "#a8e6cf", "karte": "#f6fffb", "flaeche": "#e2f7ee", "rahmen": "#bfe8d6",
    "app-kopf": "#f6fffb", "kopfzeile": "#e2f7ee", "haupt-flaeche": "#e2f7ee", "start": "#5d3a1a", "auf-start": "#fff",
    "text-stark": "#0d2219", "text": "#1d3a2d", "text2": "#2b4c3d", "text3": "#476b5a", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#bfe8d6", "negativ": "#e06c6c" } },
  { id: "aubergine", name: "Aubergine", farben: { "leiste": "#2d1b33", "haupt": "#f2a541", "haupt-hell": "#f7c47f", "auf-haupt": "#2d1b33", "hintergrund": "#2d1b33", "karte": "#3d2645", "flaeche": "#4a3054", "rahmen": "#5a3d66",
    "start": "#f2a541", "auf-start": "#2d1b33",
    "text-stark": "#f7eefa", "text": "#eadff0", "text2": "#c4b0cf", "text3": "#9b86a8", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#5a4566", "negativ": "#e06c6c" }, dunkel: true },
  { id: "tanne", name: "Tannengrün", farben: { "leiste": "#13291f", "haupt": "#e9c46a", "haupt-hell": "#f2d996", "auf-haupt": "#13291f", "hintergrund": "#13291f", "karte": "#1c3a2c", "flaeche": "#244634", "rahmen": "#2f5643",
    "start": "#e9c46a", "auf-start": "#13291f",
    "text-stark": "#eef6f0", "text": "#dcebe0", "text2": "#a9c4b2", "text3": "#7f9c89", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#35584a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "petrol", name: "Petrol", farben: { "leiste": "#0b3c49", "haupt": "#ffb4a2", "haupt-hell": "#ffd0c4", "auf-haupt": "#3a120a", "hintergrund": "#0b3c49", "karte": "#12505f", "flaeche": "#185e6f", "rahmen": "#22707f",
    "start": "#ffb4a2", "auf-start": "#3a120a",
    "text-stark": "#eefafc", "text": "#d9eef2", "text2": "#a6cbd3", "text3": "#7aa6b0", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#2b6c7a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "pflaume", name: "Pflaume", farben: { "leiste": "#4a1942", "haupt": "#9be3c4", "haupt-hell": "#c2f0dc", "auf-haupt": "#14382a", "hintergrund": "#4a1942", "karte": "#5e2453", "flaeche": "#6b2d60", "rahmen": "#7c3a70",
    "start": "#9be3c4", "auf-start": "#14382a",
    "text-stark": "#fbeef8", "text": "#f0dcec", "text2": "#d1b0ca", "text3": "#aa86a3", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#7a4a72", "negativ": "#e06c6c" }, dunkel: true },
  { id: "ochsenblut", name: "Ochsenblut", farben: { "leiste": "#3b0d11", "haupt": "#f4d58d", "haupt-hell": "#f8e5b6", "auf-haupt": "#3b0d11", "hintergrund": "#3b0d11", "karte": "#521419", "flaeche": "#5e1a20", "rahmen": "#702229",
    "start": "#f4d58d", "auf-start": "#3b0d11",
    "text-stark": "#fbeeee", "text": "#f0dcdc", "text2": "#d2aeb0", "text3": "#ad8487", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#6e3036", "negativ": "#e06c6c" }, dunkel: true },
  { id: "indigo", name: "Indigo", farben: { "leiste": "#1e1b4b", "haupt": "#ffd166", "haupt-hell": "#ffe29e", "auf-haupt": "#1e1b4b", "hintergrund": "#1e1b4b", "karte": "#2a2766", "flaeche": "#332f75", "rahmen": "#3f3a88",
    "start": "#ffd166", "auf-start": "#1e1b4b",
    "text-stark": "#f0efff", "text": "#dedcf7", "text2": "#aeabd8", "text3": "#8582b5", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#45428a", "negativ": "#e06c6c" }, dunkel: true },
  { id: "vulkan", name: "Vulkan", farben: { "leiste": "#1c1a1a", "haupt": "#ff5a36", "haupt-hell": "#ff8c70", "auf-haupt": "#1c0a05", "hintergrund": "#1c1a1a", "karte": "#2a2626", "flaeche": "#332e2d", "rahmen": "#433b39",
    "start": "#ff5a36", "auf-start": "#1c0a05",
    "text-stark": "#f6f1ef", "text": "#e6dfdc", "text2": "#b5aaa6", "text3": "#8c817d", "richtig": "#5cc98a", "falsch": "#ff6b6b",
    "gelb": "#f4c542", "gelernt-effekt": "#fff176", "orange": "#f39c4a", "info": "#b58ad6", "gelernt": "#5cc98a", "arbeit": "#d9b44a", "nie": "#4a413f", "negativ": "#e06c6c" }, dunkel: true },
  // ── Länder-Vorlagen (Farben der Flagge) – Standard für „Farben je Sprache“ ──
  { id: "sprache_en", name: "Englisch 🇬🇧", sprache: "en", farben: { "haupt": "#1d3c78", "haupt-hell": "#7b97cf", "auf-haupt": "#fff", "hintergrund": "#eff6ef", "karte": "#ffffff", "flaeche": "#e9eef7", "rahmen": "#d3dcec",
    "app-kopf": "#1d3c78", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#c9d6f0", "kopfzeile": "#e4eaf5", "haupt-flaeche": "#e1e8f5", "start": "#c8102e", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d3dcec", "negativ": "#e06c6c" } },
  { id: "sprache_fr", name: "Französisch 🇫🇷", sprache: "fr", farben: { "haupt": "#0055a4", "haupt-hell": "#6f9fd6", "auf-haupt": "#fff", "hintergrund": "#fcf0f3", "karte": "#ffffff", "flaeche": "#eaf0f8", "rahmen": "#d6e0ef",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#0055a4", "app-kopf-schrift-leise": "#6f8fb3", "kopfzeile": "#eaf0f8", "haupt-flaeche": "#e3ecf8", "start": "#ef4135", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d6e0ef", "negativ": "#e06c6c" } },
  { id: "sprache_es", name: "Spanisch 🇪🇸", sprache: "es", farben: { "haupt": "#c60b1e", "haupt-hell": "#e8707b", "auf-haupt": "#fff", "hintergrund": "#fdf3e8", "karte": "#ffffff", "flaeche": "#fdf0d6", "rahmen": "#f1dcb0",
    "app-kopf": "#c60b1e", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#ffd2d6", "kopfzeile": "#fff1cc", "haupt-flaeche": "#fde3e5", "start": "#ffc400", "auf-start": "#3a2200",
    "text-stark": "#2a1508", "text": "#432a18", "text2": "#76604f", "text3": "#a69381", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f1dcb0", "negativ": "#e06c6c" } },
  { id: "sprache_it", name: "Italienisch 🇮🇹", sprache: "it", farben: { "haupt": "#008c45", "haupt-hell": "#5fbf8a", "auf-haupt": "#fff", "hintergrund": "#eef4fb", "karte": "#ffffff", "flaeche": "#eef4ee", "rahmen": "#d8e5d9",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#008c45", "app-kopf-schrift-leise": "#6aa585", "kopfzeile": "#e9f4ec", "haupt-flaeche": "#e0f1e6", "start": "#cd212a", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d8e5d9", "negativ": "#e06c6c" } },
  { id: "sprache_la", name: "Latein 🏛️", sprache: "la", farben: { "haupt": "#6b1f5c", "haupt-hell": "#b07aa3", "auf-haupt": "#fff", "hintergrund": "#f4effa", "karte": "#fffdf8", "flaeche": "#efe8da", "rahmen": "#e0d5c0",
    "app-kopf": "#6b1f5c", "app-kopf-schrift": "#f6e7b0", "tab-aktiv": "#f6e7b0", "app-kopf-schrift-leise": "#d9b9cf", "kopfzeile": "#f1e6d0", "haupt-flaeche": "#f1e1ec", "start": "#c9a227", "auf-start": "#2a1d00",
    "text-stark": "#24171f", "text": "#3d2c36", "text2": "#6f5d66", "text3": "#a08e97", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#e0d5c0", "negativ": "#e06c6c" } },
  { id: "sprache_nl", name: "Niederländisch 🇳🇱", sprache: "nl", farben: { "haupt": "#e86a10", "haupt-hell": "#f4a76e", "auf-haupt": "#fff", "hintergrund": "#f6f0e9", "karte": "#ffffff", "flaeche": "#fdeee2", "rahmen": "#f2d8c4",
    "app-kopf": "#e86a10", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#ffe0c9", "kopfzeile": "#fde9da", "haupt-flaeche": "#fde5d3", "start": "#21468b", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f2d8c4", "negativ": "#e06c6c" } },
  { id: "sprache_pt", name: "Portugiesisch 🇵🇹", sprache: "pt", farben: { "haupt": "#046a38", "haupt-hell": "#58ab7f", "auf-haupt": "#fff", "hintergrund": "#ecf7f6", "karte": "#ffffff", "flaeche": "#e9f2ea", "rahmen": "#d2e3d5",
    "app-kopf": "#046a38", "app-kopf-schrift": "#ffe08a", "tab-aktiv": "#ffe08a", "app-kopf-schrift-leise": "#b8dcc5", "kopfzeile": "#e7f1e8", "haupt-flaeche": "#dfeee3", "start": "#da291c", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d2e3d5", "negativ": "#e06c6c" } },
  { id: "sprache_ru", name: "Russisch 🇷🇺", sprache: "ru", farben: { "haupt": "#0039a6", "haupt-hell": "#6f8fd4", "auf-haupt": "#fff", "hintergrund": "#eff2f6", "karte": "#ffffff", "flaeche": "#e9eef8", "rahmen": "#d4dcee",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#0039a6", "app-kopf-schrift-leise": "#7d8fb8", "kopfzeile": "#e8edf8", "haupt-flaeche": "#e1e8f7", "start": "#d52b1e", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#d4dcee", "negativ": "#e06c6c" } },
  { id: "sprache_tr", name: "Türkisch 🇹🇷", sprache: "tr", farben: { "haupt": "#e30a17", "haupt-hell": "#f07a82", "auf-haupt": "#fff", "hintergrund": "#f3eff5", "karte": "#ffffff", "flaeche": "#fde7e8", "rahmen": "#f4cfd1",
    "app-kopf": "#e30a17", "app-kopf-schrift": "#ffffff", "tab-aktiv": "#ffffff", "app-kopf-schrift-leise": "#ffd0d3", "kopfzeile": "#fde8e9", "haupt-flaeche": "#fde0e2", "start": "#a3000b", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#f4cfd1", "negativ": "#e06c6c" } },
  { id: "sprache_pl", name: "Polnisch 🇵🇱", sprache: "pl", farben: { "haupt": "#dc143c", "haupt-hell": "#ec8197", "auf-haupt": "#fff", "hintergrund": "#f7eeee", "karte": "#ffffff", "flaeche": "#f8e9ec", "rahmen": "#efd3d9",
    "app-kopf": "#ffffff", "app-kopf-schrift": "#dc143c", "app-kopf-schrift-leise": "#c98894", "kopfzeile": "#f9e8ec", "haupt-flaeche": "#fbe1e7", "start": "#dc143c", "auf-start": "#fff",
    "text-stark": "#1b1d24", "text": "#33363f", "text2": "#626673", "text3": "#9599a6", "richtig": "#2e8b57", "falsch": "#c0392b",
    "gelb": "#f2b134", "gelernt-effekt": "#fff176", "orange": "#e67e22", "info": "#6a4c93", "gelernt": "#2e8b57", "arbeit": "#efc35a", "nie": "#efd3d9", "negativ": "#e06c6c" } },
];
export function hexZuRgb(h) {
  h = (h || "#000").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0);
}
// a nach b mischen: t = Anteil von b (0 … 1)
export function mische(a, b, t) {
  const x = hexZuRgb(a), y = hexZuRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
// relative Helligkeit 0…1 (für lesbare Schrift auf einer Farbe)
export function helligkeit(hex) {
  const [r, g, b] = hexZuRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Liste & Start: etwas heller und kräftiger als die Hauptfarbe
export function hervorgehoben(hex) {
  const { h, s, v } = hexZuHsv(hex);
  return hsvZuHex(h, Math.min(1, s * 1.12 + 0.06), Math.min(1, v * 1.12 + 0.07));
}
export function farbenAus(f) {
  const k = f.karte;
  const start = f.start || hervorgehoben(f.haupt);
  // Bestätigen: die Richtig-Farbe – liegt sie zu nah an der Hauptfarbe, ein kräftiges Orange, damit der Knopf heraussticht
  const farbAbstand = (x, y) => { const a = hexZuHsv(x), b = hexZuHsv(y); const d = Math.abs(a.h - b.h) % 360; return Math.min(d, 360 - d) + (Math.abs(a.s - b.s) + Math.abs(a.v - b.v)) * 60; };
  const bestaetigen = f.bestaetigen || (farbAbstand(f.richtig, f.haupt) >= 45 ? f.richtig : "#e07a10");
  // Schrift auf Liste & Start: gewählte Farbe, sonst wie auf der Hauptfarbe (keine automatische Umstellung)
  return { ...f, "start": start, "auf-start": f["auf-start"] || f["auf-haupt"],
    "auf-falsch": f["auf-falsch"] || f["auf-haupt"], "auf-gelb": f["auf-gelb"] || f["auf-haupt"],
    "auf-haupt-hell": f["auf-haupt-hell"] || f["auf-haupt"], "auf-gelernt": f["auf-gelernt"] || f["auf-haupt"],
    "app-kopf-schrift": f["app-kopf-schrift"] || f["text-stark"], "app-kopf-schrift-leise": f["app-kopf-schrift-leise"] || f.text2,
    "kopf-schrift": f["kopf-schrift"] || f["text-stark"], "kopf-schrift-leise": f["kopf-schrift-leise"] || f.text2,
    "kopf-offen-schrift": f["kopf-offen-schrift"] || f.haupt, "tab-aktiv": f["tab-aktiv"] || f.haupt,
    "bestaetigen": bestaetigen, "auf-bestaetigen": f["auf-bestaetigen"] || (helligkeit(bestaetigen) > 0.45 ? "#1a1a1a" : "#ffffff"),
    "ordner": f.ordner || "#f6c445", "auf-ordner": f["auf-ordner"] || (helligkeit(f.ordner || "#f6c445") > 0.45 ? "#4a3500" : "#ffffff"),   // 191: Ordner-Gelb
    "fortschritt-balken": f["fortschritt-balken"] || f.flaeche, "fortschritt-gelernt": f["fortschritt-gelernt"] || f.gelernt,
    "fortschritt-arbeit": f["fortschritt-arbeit"] || f.arbeit, "fortschritt-nie": f["fortschritt-nie"] || f.nie, "fortschritt-negativ": f["fortschritt-negativ"] || f.negativ,
    "dialog-schrift": f["dialog-schrift"] || f["text-stark"],
    "abfrage-schrift": f["abfrage-schrift"] || f["text-stark"], "abfrage-schrift-leise": f["abfrage-schrift-leise"] || f.text2, "leiste": f.leiste || f.haupt, "gelernt-effekt": f["gelernt-effekt"] || "#fff176",
    // eigene Rollen für Flächen; ohne eigenen Wert wie bisher bzw. mit einem Hauch der Hauptfarbe
    "app-kopf": f["app-kopf"] || k, "kopfzeile": f.kopfzeile || mische(f["haupt-hell"], k, 0.93),
    "abfrage-karte": f["abfrage-karte"] || k, "dialog": f.dialog || k,
    "knopf": f.knopf || f.hintergrund, "info-kasten": f["info-kasten"] || mische(f["haupt-hell"], k, 0.9),
    "haupt-zart": mische(f["haupt-hell"], k, 0.5), "haupt-flaeche": f["haupt-flaeche"] || mische(f["haupt-hell"], k, 0.88), "kopf-offen": f["kopf-offen"] || f["haupt-flaeche"] || mische(f["haupt-hell"], k, 0.88),
    "richtig-dunkel": mische(f.richtig, f["text-stark"], 0.35), "richtig-flaeche": mische(f.richtig, k, 0.9),
    "text4": mische(f.text3, k, 0.35), "flaeche-hell": mische(f.flaeche, k, 0.7),
    "falsch-dunkel": mische(f.falsch, f["text-stark"], 0.2), "falsch-zart": mische(f.falsch, k, 0.55), "falsch-flaeche": mische(f.falsch, k, 0.92),
    "gelb-dunkel": mische(f.gelb, f["text-stark"], 0.45), "gelb-zart": mische(f.gelb, k, 0.5), "gelb-flaeche": mische(f.gelb, k, 0.9),
    "info-flaeche": mische(f.info, k, 0.9),
  };
}
// Schriften und Flächen, die (noch ohne eigenen Wert) von einer anderen Rolle übernommen werden – eine Schrift gilt nur
// auf ihrem Hintergrund: Ändert man eine Rolle, werden die davon abhängigen vorher mit ihrem bisherigen Wert festgeschrieben
export const FESTE_ROLLEN = ["auf-start", "auf-bestaetigen", "auf-ordner", "auf-falsch", "auf-gelb", "auf-haupt-hell", "auf-gelernt", "app-kopf-schrift", "app-kopf-schrift-leise",
  "kopf-schrift", "kopf-schrift-leise", "kopf-offen", "kopf-offen-schrift", "dialog-schrift", "abfrage-schrift", "abfrage-schrift-leise",
  "fortschritt-balken", "fortschritt-gelernt", "fortschritt-arbeit", "fortschritt-nie", "fortschritt-negativ"];
export function mitFestenSchriften(basis, rolle, hex) {
  const alt = farbenAus(basis), danach = farbenAus({ ...basis, [rolle]: hex }), neu = { ...basis };
  FESTE_ROLLEN.forEach(r => { if (r !== rolle && !basis[r] && alt[r] !== danach[r]) neu[r] = alt[r]; });
  neu[rolle] = hex;
  return neu;
}
// abgestufte Rollen werden über ihre Grundfarbe geändert
export const FARB_BASIS = { "haupt-zart": "haupt-hell", "richtig-dunkel": "richtig", "richtig-flaeche": "richtig",
  "text4": "text3", "flaeche-hell": "flaeche", "falsch-dunkel": "falsch", "falsch-zart": "falsch", "falsch-flaeche": "falsch",
  "gelb-dunkel": "gelb", "gelb-zart": "gelb", "gelb-flaeche": "gelb", "info-flaeche": "info" };
// Zufällige Pastell-Farben: zufälliger Grundton, Begleittöne nach einer zufälligen Harmonie
// (benachbart, Gegenfarbe, Dreiklang); Schrift jeweils dunkel im Ton der Fläche
export function hslZuHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
export function zufallsFarben(zufall = Math.random) {
  const z = (a, b) => a + zufall() * (b - a);
  const h0 = z(0, 360);
  const harmonie = [[30, -30], [180, 150], [120, 240], [60, 200]][Math.floor(zufall() * 4)];
  const h1 = h0 + harmonie[0], h2 = h0 + harmonie[1];
  const satt = z(55, 75);
  const c = (h, s, l) => hslZuHex(h, s, l);
  return {
    "haupt": c(h0, satt, z(56, 61)), "haupt-hell": c(h0, satt, 82), "auf-haupt": c(h0, 50, 13),
    "hintergrund": c(h0, 60, 97), "karte": "#ffffff", "flaeche": c(h0, 40, 93), "rahmen": c(h0, 30, 86),
    "app-kopf": c(h1, 60, 88), "kopfzeile": c(h2, 60, 90), "abfrage-karte": c(h1, 70, 98), "dialog": c(h2, 60, 98),
    "knopf": c(h0, 60, 95), "info-kasten": c(h1, 50, 93), "haupt-flaeche": c(h0, 60, 91),
    "start": c(h2, satt, z(68, 74)), "auf-start": c(h2, 45, 17), "kopf-offen": c(h1, 55, 82), "kopf-offen-schrift": c(h1, 45, 20),
    "text-stark": c(h0, 20, 14), "text": c(h0, 15, 25), "text2": c(h0, 10, 45), "text3": c(h0, 8, 64),
    "richtig": c(150, 38, 52), "falsch": c(355, 65, 64), "gelb": c(43, 88, 64), "gelernt-effekt": "#fff176",
    "orange": c(25, 82, 66), "info": c(255, 55, 66), "gelernt": c(150, 40, 60), "arbeit": c(45, 80, 76), "nie": c(h0, 15, 89), "negativ": c(355, 75, 76),
  };
}
/* FARBSCHEMATA-ENDE */
// aktuelle Farben (beim Rendern gesetzt); SVG-Attribute kennen kein var() → fv() setzt die Farbe ein
export let F = farbenAus(FARB_VORLAGEN[0].farben);
export function setzeF(wert) { F = wert; }   // die Komponente setzt den Wert neu
export const fv = v => typeof v === "string" && v.includes("var(--") ? v.replace(/var\(--([\w-]+)\)/g, (_, k) => F[k] ?? "#000") : v;
export function setzeSystemLeiste(farbe) {
  if (typeof document === "undefined") return;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
  if (m.getAttribute("content") !== farbe) m.setAttribute("content", farbe);
}
// Element-Farben: eigene Farbe je Element-Art, unabhängig von den Rollen – { selektor: { "background-color": "#…", color, … } }
export const TEIL_EIGENSCHAFT = { Hintergrund: "background-color", Schrift: "color", Rahmen: "border-color", Füllung: "fill", "Ring/Linie": "stroke", Linie: "stroke" };
export const elementCSS = el => Object.entries(el || {}).map(([sel, p]) => `${sel}{${Object.entries(p).map(([k, v]) => `${k}:${v} !important;`).join("")}}`).join("");
export const farbeZuHex = c => { const m = c && c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] < 0.05)) return null;
  return "#" + [m[1], m[2], m[3]].map(v => Math.round(+v).toString(16).padStart(2, "0")).join(""); };
// Farbfeld: verständlicher Name eines Elements (erste passende Art, vom Element nach außen gesucht); Seite zuletzt
export const ELEMENT_NAMEN = [
  ["[data-start-knopf]", "Start-Knopf"], ["[data-slot-kopf-name]", "Aktuelle Quiz"], ["[data-naechstes-paket]", "Knopf „Nächstes Paket“"],
  ["[data-liste-id]", "Listen-Kachel"], [".raster-chip", "Quiz-Kachel"], [".slot-chip", "Quiz-Chip"], [".einst-kopf", "Einstellungs-Kopf"],
  ["[data-quiz-art]", "Fortschritts-Kreis"], [".mini-kreise", "Mini-Kreis"], [".tab", "Tab"], [".tabs", "Tab-Leiste"], [".topbar", "Titelleiste"],
  [".quiz-frage-box", "Frage-Karte"], [".quiz-antwort-box", "Antwort-Karte"], [".quiz-vorig", "Beantwortete Spalte"], ["[data-mc-knopf]", "Auswahl-Antwort"],
  [".karte-btn", "Bewertungs-Knopf"], [".akzent-kachel", "Akzent-Buchstabe"], [".lernen-karte", "Lernkarte"],
  [".neue-session-knopf", "Knopf „Neues Quiz“"], [".neue-session-wahl", "Auswahl im Dialog"],
  [".btn-primary", "Haupt-Knopf"], [".btn-ghost-filled", "Knopf (gefüllt)"], [".btn-ghost", "Knopf (umrandet)"], [".btn-icon", "Symbol-Knopf"],
  [".typ-btn", "Auswahl-Knopf"], [".toggle-opt", "Umschalt-Knopf"], [".checkbox", "Häkchen"], [".inp", "Eingabefeld"],
  [".meldung-info", "Hinweis-Kasten"], [".modal", "Dialog"], [".slot-kopf", "Kopfzeile Quiz-Tab"], [".liste-detail-header", "Kopfzeile"],
  [".start-bereich", "Start-Bereich"], [".karte-zeile", "Zeile"], [".karte", "Karte"], [".sektion", "Bereich"],
];
export const TEIL_NAMEN = { Schrift: "Text", Hintergrund: "Hintergrund", Rahmen: "Rahmen", Füllung: "Füllung", "Ring/Linie": "Ring/Linie", Linie: "Linie" };
export function elementName(el) {
  if (!el || el === document.body) return "Seite";
  for (const [sel, name] of ELEMENT_NAMEN) { try { if (el.closest(sel)) return name; } catch { /* */ } }
  if (el instanceof SVGElement) return "Grafik";
  if (el.querySelector?.(":scope > .topbar")) return "App-Kopf";
  const info = el.closest("[data-info]")?.getAttribute("data-info");
  return info ? info.split(/[–:]/)[0].trim().slice(0, 30) : "Element";
}
// Teil-Name im Farbfeld; Start-Knopf: großer und kleiner Text getrennt
export function teilName(el, teil) {
  if (teil === "Schrift" && el?.closest?.("[data-start-knopf]") && !el.matches("[data-start-knopf]")) return el.tagName.toLowerCase() === "b" ? "Text groß" : "Text klein";
  return TEIL_NAMEN[teil] || teil;
}

// Schlüssel einer Element-Art: kennzeichnendes data-Attribut, sonst die Klassen (ohne Zustände), sonst Eltern-Schlüssel > Tag
export const SCHLUESSEL_OHNE = new Set(["data-info", "data-liste-id", "data-slot-id", "data-raster-zelle", "data-multi-nr", "data-wahl-nr", "data-auswahl-nr",
  "data-statistik-vok", "data-offen", "data-anzahl", "data-pct", "data-kachel-balken", "data-sichtbar", "data-lernen-phase"]);
export const ZUSTAND_KLASSEN = new Set(["aktiv", "offen", "checked", "richtig", "falsch", "aufgedeckt", "weitere", "gelernt-blitz", "aktiv-kachel", "voll", "spalte-ok", "sichtbar", "lernen-ein", "leuchten"]);
export function elementSchluessel(el, tiefe = 0) {
  if (!el || el === document.body || el === document.documentElement) return "body";
  const attr = [...el.attributes].map(a => a.name).find(n => n.startsWith("data-") && !SCHLUESSEL_OHNE.has(n));
  if (attr) return `[${attr}]`;
  const klassen = [...el.classList].filter(k => !ZUSTAND_KLASSEN.has(k) && /^[\w-]+$/.test(k));
  if (klassen.length) return "." + klassen.join(".");
  if (tiefe >= 3) return el.tagName.toLowerCase();
  return `${elementSchluessel(el.parentElement, tiefe + 1)} > ${el.tagName.toLowerCase()}`;
}
export const farbVariablen = (f, dunkel) => `:root{${Object.entries(f).map(([k, v]) => `--${k}:${v};`).join("")}color-scheme:${dunkel ? "dark" : "light"};}`;
// gewähltes Schema: Vorlage oder eigenes (einstellungen.eigeneSchemata)
export function schemaVon(einst) {
  const id = einst?.farbschema || "natur";
  return (einst?.eigeneSchemata || []).find(x => x.id === id) || FARB_VORLAGEN.find(x => x.id === id) || FARB_VORLAGEN[0];
}
// ── Farbwähler: großer Farbkreis (außen kräftig, zur Mitte weniger gesättigt), Helligkeitsregler,
// Vorher/Neu, Hex-Eingabe, Verlauf der letzten Farben; beiLive(hex) beim Ziehen, Anwenden/Abbrechen ──
export function hexZuHsv(hex) {
  const [r, g, b] = hexZuRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
export function hsvZuHex(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
