import math
import subprocess

# ==============================================================================
# CONCEPT A: The Sovereign Vault 'S' (Letterform)
# Pure modular geometry: two interlocking storage brackets forming a monumental S.
# Every corner and angle is strictly 0, 45, or 90 degrees.
# Canvas 256x256. Center (128, 128).
# Bounds: x in [48, 208] (w=160), y in [44, 212] (h=168).
# Margins: L48 R48 T44 B44.
# ==============================================================================

# Top storage bracket:
# Starts at (68, 44), goes to (188, 44) -> 45-deg chamfer to (208, 64) -> V 116 ->
# chamfer to (188, 136) -> H 112 -> 45-deg cut to (92, 116) -> V 84 -> H 168 ->
# V 64 -> H 88 -> chamfer to (68, 84) -> V 104 -> ...
# Let's make an unbroken single compound path for the Vault S:

svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Storinary — Concept A: The Sovereign Vault S</title>
  <!-- Architectural Vault S constructed with 45-degree chamfered geometry -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 88 44
    H 188
    L 208 64
    V 112
    L 188 132
    H 116
    L 96 152
    H 168
    L 188 172
    V 192
    L 168 212
    H 68
    L 48 192
    V 144
    L 68 124
    H 140
    L 160 104
    H 88
    L 68 84
    V 64
    Z
    M 108 84
    H 168
    V 84.01
    H 108
    Z
  "/>
</svg>"""

# ==============================================================================
# CONCEPT B: The Monolith Drive (Pictorial / Hardware Evolution)
# Refines the project's original rugged SSD into a timeless vector mark.
# Canvas 256x256. Center (128, 128).
# Margins L52 R52 T38 B38.
# Strict 0, 45, 90 degree angles on the transform bolt!
# ==============================================================================

svg_b = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">Storinary — Concept B: The Monolith Drive</title>
  <!-- Rugged storage container with carabiner loop aperture and 45-degree transform bolt -->
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
    M 136 112
    L 96 152
    H 128
    L 120 192
    L 160 152
    H 128
    L 136 112
    Z
  "/>
</svg>"""

# ==============================================================================
# CONCEPT C: The Transform Prism (Abstract / CDN Edge Velocity)
# An isometric media storage block split by a high-velocity edge delivery ray.
# Canvas 256x256. Center (128, 128).
# Constructed from pure 45-degree and 90-degree chevrons and a central diamond.
# ==============================================================================

svg_c = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">Storinary — Concept C: The Transform Prism</title>
  <!-- Storage cube intersected by a 45-degree transform conduit framing an aperture -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 128 44
    L 208 124
    L 168 164
    L 128 124
    L 88 164
    L 48 124
    Z
    M 128 212
    L 48 132
    L 88 92
    L 128 132
    L 168 92
    L 208 132
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-a.svg", "w") as f:
    f.write(svg_a)

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-b.svg", "w") as f:
    f.write(svg_b)

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-c.svg", "w") as f:
    f.write(svg_c)

print("All 3 SVGs written")
