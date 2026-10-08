import math

# Two interlocking storage brackets forming S:
# Canvas 256x256. Center (128, 128).
# Gap = 20px (between y=118 and y=138).
# Upper bracket:
# Bounds: x in [60, 196] (width 136), y in [44, 118] (height 74).
# Thickness = 36px.
# Chamfer corners at 45 degrees:
# Top-left corner: (60, 80) -> (96, 44) or outer chamfer.

svg_blocks = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-blocks">
  <title id="title-blocks">Storinary — Concept A: The Sovereign S</title>
  <!-- Two modular storage units interlocking to form a monumental S -->
  <path fill="#0C0A09" d="
    M 76 44
    H 180
    L 204 68
    V 118
    H 168
    V 80
    H 100
    L 76 104
    H 52
    L 52 68
    Z
    M 180 212
    H 76
    L 52 188
    V 138
    H 88
    V 176
    H 156
    L 180 152
    H 204
    L 204 188
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-a.svg", "w") as f:
    f.write(svg_blocks)

print("Concept A written")
