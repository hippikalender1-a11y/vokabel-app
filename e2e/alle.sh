#!/usr/bin/env bash
# Alle Browser-Tests nacheinander ausführen.
# Voraussetzung: im Projektordner "npm run build" und "npx vite preview --port 4199 --strictPort"
# laufen lassen; in diesem Ordner einmal "npm install" (puppeteer-core, kein Browser-Download nötig).
cd "$(dirname "$0")"
for t in sprachen export quiz0 score pakete gelernt statistik fortschritt gruppen bilanz slots neu karte bremse standard wiederholung kreis vollbild import_kodierung einfuegen ipad_export info akzente session_arten langdruck tabwechsel spaltenansicht karteninfo gruppenquiz jubel keineakzente antwortreihenfolge antwortstapel langdruck_ipad listenraster aufteilen arten gelerntblitz sessionauswertung akzentbegrenzung farbschema farbmodus mc falschabzug vorlesen klammern multiquiz einbereich lernen lernen_akzente akzentsprachen gemischt sicherung lernen_pause einst_bereiche auswahl vokabel_bearbeiten farbrollen elementfarben autovorlesen alles_bearbeiten uebersicht_zurueck listen_einstellungen neue_session farbfeld_namen schrift_hintergrund zufallsfarben gruppen_sessions statistik_kopf gruppen_gesten suche vonbis_langdruck runde3 zuordnung stimmen sprachfarben knoepfe antwortarten saetze richtung farbwechsel aufleuchten kopfmenue listenansicht antwortwahl kartenfluss synonyme sessionwahl wischen stufen punkte168; do
  arg=""; [ "$t" = "pakete" ] && arg="preset"
  echo "== $t: $(node $t.mjs $arg 2>&1 | tail -1)"
done
