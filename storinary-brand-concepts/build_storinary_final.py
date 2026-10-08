import math
import os

# ==============================================================================
# CONCEPT A: The Sovereign Vault S (Letterform)
# A bold, architectural, geometric S built from interlocking modular storage blocks.
# ==============================================================================
# Canvas 256x256. Center (128, 128).
# Bounds: x in [48, 208] (w=160), y in [44, 212] (h=168).
# Uniform 36px bar thickness with 45-degree bevels.
svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Sovereign Vault S</title>
  <!-- Architectural Vault S constructed with 45-degree chamfers and modular storage blocks -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 84 44
    H 188
    L 208 64
    V 108
    L 188 128
    H 124
    L 100 152
    H 168
    L 188 172
    V 192
    L 168 212
    H 68
    L 48 192
    V 148
    L 68 128
    H 132
    L 156 104
    H 88
    L 68 84
    V 60
    Z
    M 92 84
    H 164
    V 84.01
    H 92
    Z
  "/>
</svg>"""

# Wait, let's make sure Concept A is visually a true S!
# Let's construct Concept A using two interlocking C-brackets (storage buckets)
# that face each other and form an unmistakable, world-class S:
svg_a_clean = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Vault S</title>
  <!-- Two interlocking storage buckets forming an undeniable, balanced S -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 88 44
    H 184
    L 208 68
    V 112
    L 188 132
    H 116
    L 96 152
    H 176
    V 176
    H 84
    L 48 212
    H 184
    L 208 188
    V 164
    L 188 144
    H 128
    L 148 124
    H 88
    V 100
    H 172
    V 76
    H 76
    Z
  "/>
</svg>"""

# Let's do Concept A with pure clean circular arcs & rectangles for an iconic, timeless S:
# Top lobe: Outer arc R=56 from (72, 44) to (184, 44), down to (208, 100).
# Inner arc r=24.
# Let's test a clean, balanced geometric S path:
svg_a_true = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Sovereign S</title>
  <!-- Monumental S letterform: twin storage vaults in an unmetered continuous flow -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 64 96
    H 100
    A 28 28 0 0 1 128 68
    H 156
    A 28 28 0 0 1 184 96
    A 28 28 0 0 1 156 124
    H 100
    A 28 28 0 0 0 72 152
    A 28 28 0 0 0 100 180
    H 156
    A 28 28 0 0 0 184 152
    H 220
    A 64 64 0 0 1 156 216
    H 100
    A 64 64 0 0 1 36 152
    A 64 64 0 0 1 100 88
    H 156
    A 8 8 0 0 0 164 80
    A 8 8 0 0 0 156 72
    H 100
    A 64 64 0 0 0 36 136
    Z
  "/>
</svg>"""

