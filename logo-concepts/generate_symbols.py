import math
import os

# 1. CONCEPT A: The Vector L (Letterform)
# Canvas 256x256
# A monumental L combining an architectural square, 45-degree chamfers, and an anchor-point negative space.
svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Logo Design Skill — Concept A: The Vector L</title>
  <path fill="#000000" fill-rule="evenodd" d="
    M 48 64
    L 64 48
    L 108 48
    L 108 148
    L 208 148
    L 208 192
    L 192 208
    L 64 208
    L 48 192
    Z
    M 148 108
    A 16 16 0 1 0 148 107.99
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/logo-concepts/concept-a.svg", "w") as f:
    f.write(svg_a)

print("A written")
