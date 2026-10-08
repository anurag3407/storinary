import math

# Variation C1: 3-Blade Vector Aperture / Delta
# Center at (128, 136).
# 3 blades rotating around center, creating an equilateral triangular negative space at center.
# Blade 1 is at the bottom: runs horizontally from left to right, then angles up-left.
# Blade 2 runs up the right side, then angles down-left.
# Blade 3 runs down the left side, then angles right.

# Let's test a clean geometric 3-blade aperture:
# 3 trapezoids / polygons in a pinwheel around an equilateral triangle:
# Center of triangle: (128, 136).
# Inradius r_in = 24.
# Circumradius r_out = 92.
# Angles: 90, 210, 330 (or 270, 30, 150).
# Clean angles: 30, 60, 90, 120, 150, 180!

def rotate(x, y, cx, cy, deg):
    rad = math.radians(deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    nx = cx + (x - cx) * cos_a - (y - cy) * sin_a
    ny = cy + (x - cx) * sin_a + (y - cy) * cos_a
    return round(nx, 2), round(ny, 2)

# Blade geometry relative to 0 deg:
# A polygon that overlaps and leaves a clean gap.
