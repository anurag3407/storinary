import math

# -----------------------------------------------------------------------------
# CONCEPT A: The Vault S (True Letterform S)
# Monumental, architectural S built from 40px-thick geometric storage slabs.
# -----------------------------------------------------------------------------
# Bounds: x in [48, 208] (width 160), y in [44, 212] (height 168).
# Top terminal at (68, 92) -> up to (48, 72) -> L 68 44 -> H 188 -> L 208 64
# -> V 112 -> L 188 132 -> H 108 -> L 88 152 -> V 192 -> L 108 212 -> H 188 ...
# Wait, let's trace a true S:
# Outer perimeter of S:
# 1. Top terminal: (56, 88)
# 2. Up to (56, 68) -> Chamfer (76, 44) -> Top edge H 184 -> Chamfer (204, 64)
# 3. Right wall of upper loop: V 116 -> Chamfer (184, 136)
# 4. Inward sweep to waist: H 116
# 5. Waist drop down-left: L 96 156
# 6. Left wall of lower loop: V 192 -> Chamfer (116, 212)
# 7. Bottom edge: H 184
# 8. Bottom-right terminal: Chamfer (204, 192) -> V 168
# 9. Inner corner of bottom terminal: H 164 -> V 180 -> Chamfer (152, 192)
# 10. Inside bottom edge: H 116 -> Chamfer (96, 172) -> V 156
# 11. Inside waist: H 144 -> Chamfer (164, 136) -> V 116 -> Chamfer (144, 96)
# 12. Inside top loop: H 96 -> Chamfer (76, 76) -> V 88 -> Z.

svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Vault S</title>
  <!-- Architectural, monumental S crafted from sovereign storage blocks -->
  <path fill="#0C0A09" d="
    M 52 88
    V 68
    L 76 44
    H 184
    L 204 64
    V 116
    L 184 136
    H 124
    L 104 156
    V 188
    L 128 212
    H 184
    L 204 192
    V 168
    H 172
    V 180
    L 164 188
    H 136
    L 128 180
    V 164
    L 144 148
    H 184
    L 204 128
    V 64
    L 184 44
    H 76
    L 52 68
    Z
  "/>
</svg>"""

# -----------------------------------------------------------------------------
# CONCEPT B: The Monolith Drive (Pictorial / Hardware Evolution)
# A rugged storage drive with carabiner aperture, cut by a clean 45-deg transform bolt.
# -----------------------------------------------------------------------------
svg_b = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">Storinary — Concept B: The Monolith Drive</title>
  <!-- Rugged storage container with carabiner loop aperture and clean 45-degree transform bolt -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 76 38
    H 148
    L 204 94
    V 194
    A 24 24 0 0 1 180 218
    H 76
    A 24 24 0 0 1 52 194
    V 62
    A 24 24 0 0 1 76 38
    Z
    M 164 64
    A 12 12 0 0 1 176 76
    V 84
    A 12 12 0 0 1 164 96
    A 12 12 0 0 1 152 84
    V 76
    A 12 12 0 0 1 164 64
    Z
    M 136 108
    L 88 156
    H 128
    L 120 204
    L 168 156
    H 128
    L 136 108
    Z
  "/>
</svg>"""

# -----------------------------------------------------------------------------
# CONCEPT C: The Storage Stack / Triple Bucket (Abstract / Modular CDN)
# Three stacked storage layers linked by an edge delivery chevron / S-curve.
# -----------------------------------------------------------------------------
svg_c = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">Storinary — Concept C: The Storage Stack</title>
  <!-- Three modular storage layers with negative space S-wave -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 68 44
    H 188
    A 20 20 0 0 1 208 64
    A 20 20 0 0 1 188 84
    H 68
    A 20 20 0 0 1 48 64
    A 20 20 0 0 1 68 44
    Z
    M 68 108
    H 188
    A 20 20 0 0 1 208 128
    A 20 20 0 0 1 188 148
    H 68
    A 20 20 0 0 1 48 128
    A 20 20 0 0 1 68 108
    Z
    M 68 172
    H 188
    A 20 20 0 0 1 208 192
    A 20 20 0 0 1 188 212
    H 68
    A 20 20 0 0 1 48 192
    A 20 20 0 0 1 68 172
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-a.svg", "w") as f:
    f.write(svg_a)

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-b.svg", "w") as f:
    f.write(svg_b)

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-c.svg", "w") as f:
    f.write(svg_c)

print("Updated concepts written")
