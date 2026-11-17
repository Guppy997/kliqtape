#!/usr/bin/env bash
# Holt Archivo und Caveat (SIL OFL) aus google/fonts und erzeugt daraus
#  - frontend/public/fonts: Variable Fonts (woff2) fuer die App,
#  - backend/assets/fonts: feste Schnitte (ttf) fuer die PDFs, weil pdfkit
#    keine Variable Fonts kann.
# Rollen und Quelle stehen im Markenskill brand-kliqtape; dasselbe Skript
# liegt in der Website unter tools/fonts/build.sh.
#
# Warum selbst gehostet: Die App laedt nichts von fremden Servern. Geholt
# wird nur hier, beim Erzeugen der Dateien.
#
# Braucht fontTools mit brotli:  python3 -m pip install 'fonttools[woff]'
# Aufruf aus dem Repo-Wurzelordner:  scripts/fonts.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
web="$root/frontend/public/fonts"
pdf="$root/backend/assets/fonts"
cache="$here/.fonts-cache"
base="https://raw.githubusercontent.com/google/fonts/main/ofl"
PY="${PYTHON:-python3}"

mkdir -p "$cache" "$web" "$pdf"
curl -fsSL -o "$cache/Archivo.ttf" "$base/archivo/Archivo%5Bwdth,wght%5D.ttf"
curl -fsSL -o "$cache/Caveat.ttf" "$base/caveat/Caveat%5Bwght%5D.ttf"
curl -fsSL -o "$cache/OFL-Archivo.txt" "$base/archivo/OFL.txt"
curl -fsSL -o "$cache/OFL-Caveat.txt" "$base/caveat/OFL.txt"
for d in "$web" "$pdf"; do cp "$cache"/OFL-*.txt "$d/"; done

# Latin-1 plus die Satzzeichen, die im Deutschen vorkommen („“ ‚‘ – — … € •).
# Achsen und alle OpenType-Features bleiben (vor allem tnum fuer tabular-nums).
unicodes="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+2212"
for f in Archivo Caveat; do
  "$PY" -m fontTools.subset "$cache/$f.ttf" --unicodes="$unicodes" --layout-features='*' \
    --flavor=woff2 --output-file="$web/$f-Variable.woff2"
done

# Feste Schnitte fuer die PDFs: Rolle -> Achsenwerte
inst() { # name quelle achsen...
  local name="$1" src="$2"; shift 2
  "$PY" -m fontTools.varLib.instancer "$cache/$src.ttf" "$@" --update-name-table -o "$cache/$name.ttf" -q
  "$PY" -m fontTools.subset "$cache/$name.ttf" --unicodes="$unicodes" --layout-features='*' \
    --output-file="$pdf/$name.ttf"
}
inst Archivo-Regular Archivo wght=400 wdth=100
inst Archivo-Medium Archivo wght=500 wdth=100
inst Archivo-Titel Archivo wght=700 wdth=87.5
inst Archivo-Wortmarke Archivo wght=700 wdth=75
inst Caveat-Regular Caveat wght=400
ls -l "$web" "$pdf"
