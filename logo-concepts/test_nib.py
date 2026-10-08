import math
import subprocess

# 2. CONCEPT B: The Code Nib
# 45-degree clean angles everywhere!
# Tip: (128, 40)
# Shoulders: dx = 80, dy = 80 -> (48, 120) and (208, 120).
# Inset: dx = 24, dy = 24 -> (72, 144) and (184, 144).
# Base vertical: dy = 64 -> (72, 208) and (184, 208).
# Inverted chevron base: (72, 208) -> (128, 152) -> (184, 208). Angle: dx=56, dy=56 (45 degrees!)
# Slit: x from 124 to 132 (width 8) from y=40 down to y=116.
# Anchor circle at (128, 132) r=16.

svg_b = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">Logo Design Skill — Concept B: The Code Nib</title>
  <!-- Symmetrical pen nib + code chevron compound path with slit and anchor eye -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 124 40
    L 48 116
    L 72 140
    L 72 208
    L 128 152
    L 184 208
    L 184 140
    L 208 116
    L 132 40
    L 132 116.86
    A 16 16 0 1 1 124 116.86
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/logo-concepts/concept-b.svg", "w") as f:
    f.write(svg_b)

print("B written")
