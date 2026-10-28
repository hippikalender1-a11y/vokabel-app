#!/usr/bin/env bash
# Alle Browser-Tests nacheinander ausführen.
# Voraussetzung: im Projektordner "npm run build" und "npx vite preview --port 4199 --strictPort"
# laufen lassen; in diesem Ordner einmal "npm install" (puppeteer-core, kein Browser-Download nötig).
cd "$(dirname "$0")"
for t in sprachen export quiz0 score pakete gelernt statistik fortschritt gruppen bilanz slots neu karte bremse standard wiederholung kreis vollbild import_kodierung einfuegen ipad_export info akzente akzent_mischen session_arten langdruck tabwechsel spaltenansicht; do
  arg=""; [ "$t" = "pakete" ] && arg="preset"
  echo "== $t: $(node $t.mjs $arg 2>&1 | tail -1)"
done
