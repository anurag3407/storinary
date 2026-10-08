import math

# Infinity S:
# Two interlocking circular loops forming an S and an infinity symbol
# Top loop center: (128, 90)
# Bottom loop center: (128, 166)
# Radii: Outer R = 44, Inner r = 16 (uniform stroke = 28px).
# Top loop spans from angle 0 (right) around top to angle 180 (left), then swoops down-right to waist (128, 128).
# Bottom loop spans from waist (128, 128) swoops down-left to angle 180 (left), around bottom to angle 0 (right).

# Let's test exact circular arc commands:
# Outer stroke of S:
# Start at top terminal: (84, 90)
# Arc around top: A 44 44 0 0 1 172 90
# Arc to waist: A 44 44 0 0 1 128 128
# Arc to bottom left: A 44 44 0 0 0 84 166
# Arc around bottom: A 44 44 0 0 0 172 166
# Terminals: clean rounded caps!

svg_inf = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-inf">
  <title id="title-inf">Storinary — Concept A: The Sovereign S-Loop</title>
  <!-- Fluid continuous S-loop: unmetered storage and transformation pipeline -->
  <path fill="none" stroke="#0C0A09" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="
    M 92 84
    A 36 36 0 1 1 164 84
    C 164 116 92 140 92 172
    A 36 36 0 1 0 164 172
  "/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/test_inf.svg", "w") as f:
    f.write(svg_inf)

print("Infinity S written")
