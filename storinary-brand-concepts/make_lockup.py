import math

# Generate pixel-perfect geometric sans letter paths for STORINARY
# Cap height H = 64, baseline y = 144, top y = 80.
# Stroke = 12.
# Clean integer grid.

# Let's test letter paths:
# S:
# T: horizontal bar y in [80, 92], vertical stem centered
# O: outer rounded rect / circle, inner cutout
# R: stem on left, top loop, angled leg
# I: single vertical stem
# N: left stem, diagonal, right stem
# A: left diagonal, right diagonal, horizontal crossbar
# R: ...
# Y: top left branch, top right branch, vertical stem down to baseline

print("Letter builder setup")
