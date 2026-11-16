#!/usr/bin/env bash
#
# Generates the demo images: simple original SVG illustrations, rendered to PNG.
#
# Run inside the DDEV web container (it has ImageMagick):
#   ddev exec bash scripts/demo-content/build-images.sh
#
# The PNG files are committed, so this script is only needed to change them.
# PNG (not WebP) is used on purpose: Drupal image styles convert to WebP later,
# which is the usual setup on real sites where editors upload JPG/PNG.
#
# ImageMagick's built-in SVG renderer handles `transform` and thick strokes
# poorly, so the shapes use only absolute coordinates and fills.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/images"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# leaf X Y DX DY COLOUR: a leaf from (X,Y) to (X+DX,Y+DY), as a plain path.
# The control points sit on both sides of the leaf's axis, 35% of its length away.
leaf() {
  local x=$1 y=$2 dx=$3 dy=$4 fill=$5
  local nx=$(( -dy * 35 / 100 )) ny=$(( dx * 35 / 100 ))
  local ax=$(( x + dx / 4 )) ay=$(( y + dy / 4 )) bx=$(( x + dx * 3 / 4 )) by=$(( y + dy * 3 / 4 ))
  echo "<path d=\"M$x $y C$((ax + nx)) $((ay + ny)) $((bx + nx)) $((by + ny)) $((x + dx)) $((y + dy)) C$((bx - nx)) $((by - ny)) $((ax - nx)) $((ay - ny)) $x $y Z\" fill=\"$fill\"/>"
}

# Each shape prints an SVG fragment that uses $MAIN and $SECOND colours.
shape_bottle() {
  cat <<EOF
<rect x="545" y="140" width="110" height="80" rx="14" fill="$SECOND"/>
<path d="M525 220 h150 q60 60 60 160 v310 q0 50 -50 50 h-170 q-50 0 -50 -50 v-310 q0 -100 60 -160z" fill="$MAIN"/>
<rect x="540" y="270" width="18" height="160" rx="9" fill="#ffffff" opacity="0.35"/>
<rect x="465" y="450" width="270" height="170" rx="14" fill="#fffdf7"/>
<path d="M600 482 c40 20 50 72 0 112 c-50 -40 -40 -92 0 -112z" fill="$MAIN"/>
EOF
}

shape_bowl() {
  cat <<EOF
<circle cx="470" cy="455" r="70" fill="$SECOND"/>
<circle cx="585" cy="425" r="80" fill="#f2c14e"/>
<circle cx="705" cy="440" r="75" fill="#2f6b3a"/>
<circle cx="795" cy="470" r="55" fill="$SECOND" opacity="0.8"/>
<circle cx="640" cy="485" r="45" fill="#fffdf7"/>
<path d="M310 470 h580 a290 250 0 0 1 -580 0z" fill="$MAIN"/>
<rect x="330" y="494" width="540" height="12" fill="#ffffff" opacity="0.25"/>
EOF
}

shape_bar() {
  cat <<EOF
<rect x="400" y="560" width="480" height="150" rx="32" fill="$MAIN" opacity="0.75"/>
<rect x="320" y="370" width="540" height="190" rx="36" fill="$MAIN"/>
<rect x="520" y="370" width="150" height="190" fill="$SECOND"/>
<circle cx="390" cy="430" r="16" fill="#fffdf7" opacity="0.5"/>
<circle cx="450" cy="500" r="12" fill="#fffdf7" opacity="0.5"/>
<circle cx="750" cy="420" r="14" fill="#fffdf7" opacity="0.5"/>
<circle cx="800" cy="500" r="18" fill="#fffdf7" opacity="0.5"/>
EOF
}

shape_jar() {
  cat <<EOF
<rect x="470" y="170" width="260" height="70" rx="16" fill="#1f3d2b"/>
<rect x="440" y="230" width="320" height="510" rx="60" fill="#fffdf7"/>
<clipPath id="jar"><rect x="460" y="250" width="280" height="470" rx="48"/></clipPath>
<g clip-path="url(#jar)">
  <rect x="460" y="330" width="280" height="140" fill="$SECOND"/>
  <rect x="460" y="470" width="280" height="120" fill="#f5e6c8"/>
  <rect x="460" y="590" width="280" height="140" fill="$MAIN"/>
  <circle cx="530" cy="340" r="28" fill="#e76f51"/>
  <circle cx="660" cy="330" r="22" fill="#f2c14e"/>
</g>
EOF
}

shape_plate() {
  cat <<EOF
<rect x="250" y="190" width="22" height="520" rx="11" fill="#1f3d2b" opacity="0.6"/>
<rect x="928" y="190" width="22" height="520" rx="11" fill="#1f3d2b" opacity="0.6"/>
<circle cx="600" cy="450" r="290" fill="#fffdf7"/>
<circle cx="600" cy="450" r="229" fill="#1f3d2b" opacity="0.08"/>
<circle cx="600" cy="450" r="221" fill="#fffdf7"/>
<circle cx="535" cy="400" r="95" fill="$MAIN"/>
<circle cx="685" cy="415" r="72" fill="$SECOND"/>
<circle cx="610" cy="535" r="78" fill="#f2c14e"/>
EOF
}

shape_sprout() {
  echo '<rect x="592" y="330" width="16" height="190" rx="8" fill="#2f6b3a"/>'
  leaf 600 360 131 -92 '#4c9a5b'
  leaf 600 430 -131 -92 '#2f6b3a'
  cat <<EOF
<path d="M480 540 h240 l-30 200 h-180z" fill="$MAIN"/>
<rect x="455" y="505" width="290" height="55" rx="12" fill="$SECOND"/>
EOF
}

# slug | shape | background | accent | main | second
ITEMS='
green-glow-smoothie|bottle|#e8f3e4|#cfe6c6|#6fae5a|#1f3d2b
ginger-lemon-shot|bottle|#fdf3dc|#f8e2a8|#f2c14e|#2f6b3a
oat-barista-drink|bottle|#f6efe4|#eadcc4|#d9c3a0|#6b4f3a
berry-kombucha|bottle|#f6e6ea|#ecc7d1|#b5446e|#1f3d2b
quinoa-power-bowl|bowl|#eef4e6|#d7e8c4|#2f6b3a|#e76f51
mediterranean-lentil-bowl|bowl|#fbeee4|#f3d3bd|#c8553d|#6fae5a
teriyaki-tofu-bowl|bowl|#edf1f5|#d3dde8|#3d5a80|#f2c14e
almond-date-bar|bar|#f7efe6|#ead6c0|#8a5a3c|#fffdf7
sea-salt-chickpea-crisps|bar|#fdf6e3|#f3e3b5|#e0a458|#2f6b3a
cocoa-hazelnut-bites|bar|#f2ece8|#dfd0c6|#5c3d2e|#f2c14e
spelt-banana-loaf|bar|#fbf3e2|#f1dfb6|#c98b4b|#fffdf7
mango-overnight-oats|jar|#fff4e0|#fde2b0|#f4a259|#6fae5a
buckwheat-granola|jar|#f5efe6|#e6d9c3|#a0703f|#e76f51
chia-coconut-pudding|jar|#eef3f2|#d5e4e1|#8fb9a8|#b5446e
green-shakshuka|plate|#eaf2e5|#d4e7c9|#4c9a5b|#f2c14e
red-lentil-soup|plate|#fbeee4|#f3d3bd|#c8553d|#6fae5a
three-breakfast-smoothies|plate|#f6e6ea|#ecc7d1|#b5446e|#6fae5a
recyclable-bottles|sprout|#e8f3e4|#cfe6c6|#c98b4b|#8a5a3c
autumn-menu|sprout|#fff4e0|#fde2b0|#e76f51|#c8553d
'

while IFS='|' read -r SLUG SHAPE BG ACCENT MAIN SECOND; do
  [ -z "$SLUG" ] && continue
  {
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">'
    echo "<rect width=\"1200\" height=\"900\" fill=\"$BG\"/>"
    echo "<circle cx=\"960\" cy=\"180\" r=\"280\" fill=\"$ACCENT\"/>"
    echo "<circle cx=\"170\" cy=\"760\" r=\"160\" fill=\"$ACCENT\" opacity=\"0.6\"/>"
    echo '<ellipse cx="600" cy="770" rx="320" ry="34" fill="#1f3d2b" opacity="0.14"/>'
    leaf 170 250 139 -80 '#2f6b3a'
    leaf 900 620 150 55 '#4c9a5b'
    "shape_$SHAPE"
    echo '</svg>'
  } > "$TMP/$SLUG.svg"
  magick "$TMP/$SLUG.svg" -strip -colors 64 "PNG8:$OUT/$SLUG.png"
  echo "  $SLUG.png"
done <<< "$ITEMS"
