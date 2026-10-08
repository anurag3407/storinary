# Monogram LD:
# A geometric combination of L and D.
# Canvas 256x256.
# Stem: x=56 to 104 (width 48).
# D bowl: extends to x=200.
# Top of D: y=48. Bottom of D: y=160.
# Base of L: extends from x=56 to 208 at y=160 to 208 (height 48).
# That separates the D bowl (upper half) and the L base (lower shelf)!
# So the D sits atop the shelf of the L, sharing the vertical stem!

svg_ld = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-ld">
  <title id="title-ld">Logo Design Skill — Concept C: The LD Monogram</title>
  <!-- Unified LD monogram: D bowl atop the extended base shelf of the L -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 56 48
    H 136
    A 56 56 0 0 1 192 104
    A 56 56 0 0 1 136 160
    H 192
    L 208 176
    V 192
    L 192 208
    H 72
    L 56 192
    Z
    M 104 96
    H 136
    A 16 16 0 0 1 152 112
    A 16 16 0 0 1 136 128
    H 104
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/logo-concepts/test_ld.svg", "w") as f:
    f.write(svg_ld)

print("LD written")
