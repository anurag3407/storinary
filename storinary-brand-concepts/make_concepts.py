import math

# ==============================================================================
# CONCEPT A: The Vault S (Letterform)
# A monumental, architectural 'S' composed of two interlocking geometric storage blocks
# forming an unbroken, sovereign vault loop.
# Canvas 256x256. Center (128, 128).
# Bounds: x in [48, 208] (width 160), y in [44, 212] (height 168).
# Margins: L48 R48 T44 B44.
# ==============================================================================

# Let's construct a clean, bold S from continuous geometric arcs and straight bars:
# Upper loop:
# Outer arc: center (128, 86), R=42.
# Inner arc: center (128, 86), r=18.
# Lower loop:
# Outer arc: center (128, 170), R=42.
# Inner arc: center (128, 170), r=18.
# Connected by a dynamic 45-degree diagonal spine!
# Or pure rectilinear geometry with 45-degree chamfers:

# Let's test a chamfered architectural S:
svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Vault S</title>
  <!-- Architectural Vault S: two interlocking storage blocks forming an unmetered loop -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 84 44
    H 188
    L 208 64
    V 104
    L 188 124
    H 124
    L 104 144
    H 188
    L 208 164
    V 192
    L 188 212
    H 68
    L 48 192
    V 152
    L 68 132
    H 132
    L 152 112
    H 68
    L 48 92
    V 64
    L 68 44
    Z
    M 92 84
    H 164
    V 84.01
    H 92
    Z
  "/>
</svg>"""

