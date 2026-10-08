import math

# Concept B: The Monolith Drive
# Canvas 256x256
# A sleek, geometric rugged storage container with the iconic carabiner notch in upper-right,
# cut by a dynamic negative-space transform ray / lightning bolt.
# Bounding box: x in [56, 200] (w=144), y in [36, 220] (h=184).
# Or square proportions: x in [48, 208], y in [44, 212].
# Let's test exact geometry:

svg_drive = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-drive">
  <title id="title-drive">Storinary — Concept B: The Monolith Drive</title>
  <!-- Rugged storage container with carabiner loop and center transform ray -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 76 36
    H 144
    L 204 96
    V 196
    A 24 24 0 0 1 180 220
    H 80
    A 24 24 0 0 1 56 196
    V 60
    A 24 24 0 0 1 76 36
    Z
    M 164 64
    A 12 12 0 0 1 176 76
    V 84
    A 12 12 0 0 1 164 96
    A 12 12 0 0 1 152 84
    V 76
    A 12 12 0 0 1 164 64
    Z
    M 136 112
    L 96 160
    H 124
    L 116 196
    L 156 148
    H 128
    L 136 112
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/test_drive.svg", "w") as f:
    f.write(svg_drive)

print("Drive concept written")
