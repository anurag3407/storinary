import math

# Let's draft Concept A: The Vault S
# An architectural, faceted S built from two interlocking storage blocks with clean 45-degree chamfers.
# Can also be an S formed by two C-shaped interlocking vault brackets.
# Let's test exact coordinates:
# Canvas 256x256.
# S bounding box: x in [48, 208] (w=160), y in [44, 212] (h=168).
# Perfectly centered: L48 R48 T44 B44.

svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Vault S</title>
  <!-- Architectural Vault S constructed with 45-degree chamfered geometry -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 84 44
    H 188
    L 208 64
    V 108
    L 188 128
    H 128
    V 148
    H 188
    L 208 168
    V 192
    L 188 212
    H 68
    L 48 192
    V 148
    L 68 128
    H 128
    V 108
    H 68
    L 48 88
    V 64
    L 68 44
    Z
    M 88 84
    H 168
    V 88
    H 88
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/draft_a.svg", "w") as f:
    f.write(svg_a)

print("Draft A written")
