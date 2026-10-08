import os
import subprocess

# Generate 3 refined concepts and lockups

# CONCEPT A: The Vector L
svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Logo Design Skill — Concept A: The Vector L</title>
  <!-- Architectural L with 45-degree chamfers and coordinate anchor eye -->
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

# CONCEPT B: The Code Nib
# Centered with clean margins
svg_b = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">Logo Design Skill — Concept B: The Code Nib</title>
  <!-- Symmetrical pen nib + code chevron compound path with slit and anchor eye -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 124 44
    L 48 120
    L 72 144
    L 72 212
    L 128 156
    L 184 212
    L 184 144
    L 208 120
    L 132 44
    L 132 120.86
    A 16 16 0 1 1 124 120.86
    Z
  "/>
</svg>"""

# CONCEPT C: The LD Monogram
# Perfectly centered: x shifted so L52 R52
svg_c = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">Logo Design Skill — Concept C: The LD Monogram</title>
  <!-- Unified LD monogram: D bowl atop the extended base shelf of the L -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 52 48
    H 132
    A 56 56 0 0 1 188 104
    A 56 56 0 0 1 132 160
    H 188
    L 204 176
    V 192
    L 188 208
    H 68
    L 52 192
    Z
    M 100 96
    H 132
    A 16 16 0 0 1 148 112
    A 16 16 0 0 1 132 128
    H 100
    Z
  "/>
</svg>"""

dest_dir = "/Users/jarvis/storinary-supabase/logo-concepts"
for name, content in [("concept-a.svg", svg_a), ("concept-b.svg", svg_b), ("concept-c.svg", svg_c)]:
    path = os.path.join(dest_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

print("Symbols written")
