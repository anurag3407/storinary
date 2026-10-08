import math

# A 4-blade or 3-blade precision aperture.
# Let's test a 4-blade aperture in a square:
# Canvas 256x256. Center (128, 128).
# In a square, a 4-blade pinwheel aperture creates a tilted square/diamond negative space at center!
# And 4 blades rotate around it with 90-degree rotational symmetry!
# Because rotation is 90 degrees, all angles remain strictly 0, 45, or 90 degrees!
# No fractional or weird angles! 100% clean angles!

# Let's design one blade of the 4-blade aperture:
# Canvas: 256x256.
# Margin: 36px on all sides -> content in [36, 220], size = 184x184.
# Center: 128, 128.
# Central diamond / square negative space:
# Say from (108, 108) to (148, 148), or diamond with corners at (128, 104), (152, 128), (128, 152), (104, 128).
# Blade 1 (Top):
# From (36, 36) to (220, 36)...
# Let's construct 4 L-shaped or trapezoidal blades:
# Blade 1:
# Starts at (36, 36) -> H 180 -> V 92 -> H 100 -> V 100 -> H 36 -> Z.
# Let's test rotating this by 90, 180, 270 degrees.

def rot90(x, y):
    # around (128, 128)
    dx = x - 128
    dy = y - 128
    return 128 - dy, 128 + dx

print("Rot test ok")
