import math
import subprocess

# Let's test a clean, iconic 3-blade aperture / triad
# All angles are exact multiples of 30 and 60 degrees.
# Center: cx = 128, cy = 132
# Inner triangle negative space:
# Top: (128, 92)
# Bottom Right: (162.64, 152) -> rounded (163, 152)
# Bottom Left: (93.36, 152) -> rounded (93, 152)

# Blade 1 (Bottom):
# Top edge: from (93, 152) to (163, 152)
# Right slant (60 deg): from (163, 152) to (195, 208)
# Bottom edge: from (195, 208) to (61, 208)
# Left slant (60 deg): from (61, 208) to (93, 152)
# Wait, this is a trapezoid. If we rotate this trapezoid by 120 and 240 degrees:
# They form a pinwheel aperture!
# But to make it pinwheel / dynamic: each blade extends past one vertex:
# Blade 1: from (61, 208) to (210, 208) -> cuts at 60 deg to (178, 152) -> along (93, 152) -> to (61, 208).
# Let's compute exact rotated points for 3 identical blades:

def rot(x, y, deg):
    rad = math.radians(deg)
    # rotate around (128, 132)
    dx = x - 128
    dy = y - 132
    nx = 128 + dx * math.cos(rad) - dy * math.sin(rad)
    ny = 132 + dx * math.sin(rad) + dy * math.cos(rad)
    return round(nx, 1), round(ny, 1)

# Base blade:
# Polygon points:
p0 = (56, 208)
p1 = (196, 208)
p2 = (168, 160)
p3 = (100, 160)
p4 = (72, 208)

# Let's check rotation:
b1 = [p0, p1, p2, p3]
b2 = [rot(x, y, 120) for x, y in b1]
b3 = [rot(x, y, 240) for x, y in b1]

print("b1:", b1)
print("b2:", b2)
print("b3:", b3)
