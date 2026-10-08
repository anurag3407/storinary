import math

# Trefoil / Triquetra in pure SVG arcs:
# 3 overlapping circular arcs:
# Radii R = 72.
# Centers at equilateral triangle:
# C1: (128, 96)
# C2: (128 - 28, 128 + 16) -> (100, 144)
# C3: (128 + 28, 128 + 16) -> (156, 144)

# Or: 4-lobed vector knot (The Command Vertex / Vector Knot):
# Center at (128, 128).
# 4 corner circles of radius 36 with holes of radius 16, connected by cross bars!
# Like the iconic ⌘ symbol, but with thick, bold vector weights and precision anchor vertices!

svg_knot = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">Logo Design Skill — Concept C: The Vector Knot</title>
  <path fill="#000000" fill-rule="evenodd" d="
    M 96 64
    A 32 32 0 1 0 64 96
    H 88
    V 160
    H 64
    A 32 32 0 1 0 96 192
    V 168
    H 160
    V 192
    A 32 32 0 1 0 192 160
    H 168
    V 96
    H 192
    A 32 32 0 1 0 160 64
    V 88
    H 96
    Z
    M 96 80
    A 16 16 0 1 1 80 96
    H 96
    Z
    M 96 160
    H 80
    A 16 16 0 1 1 96 176
    Z
    M 160 176
    A 16 16 0 1 1 176 160
    H 160
    Z
    M 176 96
    A 16 16 0 1 1 160 80
    V 96
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/logo-concepts/concept-c.svg", "w") as f:
    f.write(svg_knot)

print("Knot written")
