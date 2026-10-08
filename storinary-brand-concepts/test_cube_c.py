import math

# Isometric storage cube with negative-space S-channel:
# Canvas 256x256. Center (128, 128).
# An isometric cube:
# Top vertex: (128, 44)
# Top-right: (204, 88)
# Bottom-right: (204, 168)
# Bottom vertex: (128, 212)
# Bottom-left: (52, 168)
# Top-left: (52, 88)
# Center: (128, 128)
# If we slice an S-conduit through this cube:
# An upper storage block and a lower storage block with a clean 30-degree slit!

# Or: What about "The Storage Aperture" - an aperture iris formed by 3 curved blades?
# Let's test the isometric cube with an S-cut:
svg_cube = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-cube">
  <title id="title-cube">Storinary — Concept C: The Sovereign Cube</title>
  <!-- Isometric storage monolith split by an S-velocity delivery channel -->
  <path fill="#0C0A09" fill-rule="evenodd" d="
    M 128 44
    L 204 88
    V 124
    L 128 80
    L 68 114
    V 96
    Z
    M 204 140
    V 168
    L 128 212
    L 52 168
    V 132
    L 128 176
    L 188 142
    Z
    M 128 92
    L 192 128
    L 128 164
    L 64 128
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/test_cube.svg", "w") as f:
    f.write(svg_cube)

