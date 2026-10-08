# Mirror x to flip left/right:
# If nx = 256 - x:
# Let's see what happens if we mirror concept-a horizontally!

svg_s_mirrored = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-blocks">
  <title id="title-blocks">Storinary — Concept A: The Sovereign S</title>
  <!-- Two modular storage brackets interlocking to form a true S -->
  <path fill="#0C0A09" d="
    M 180 44
    H 76
    L 52 68
    V 118
    H 88
    V 80
    H 156
    L 180 104
    H 204
    L 204 68
    Z
    M 76 212
    H 180
    L 204 188
    V 138
    H 168
    V 176
    H 100
    L 76 152
    H 52
    L 52 188
    Z
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/concept-a.svg", "w") as f:
    f.write(svg_s_mirrored)

