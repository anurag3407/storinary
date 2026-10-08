import sys
import os

# Script to generate candidates and verify with svg_audit

# CONCEPT A: The Vector L
# A disciplined, architectural letterform L merged with a precision drafting square and anchor point.
# 256x256 canvas.
svg_a = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Logo Design Skill — Concept A: The Vector L</title>
  <!-- Compound path with real circular hole at anchor vertex -->
  <path fill="#000000" fill-rule="evenodd" d="
    M 56 44
    L 104 44
    L 104 152
    L 204 152
    L 204 204
    L 76 204
    L 56 184
    Z
    M 132 124
    A 18 18 0 1 0 132 124.01
    Z
  "/>
</svg>"""

