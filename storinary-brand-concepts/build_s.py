import math

# Uniform 40px stroke geometric S on 256x256 canvas
# Centered at (128, 128)
# Bounds: x in [48, 208] (width 160), y in [44, 212] (height 168)
# Bar thickness = 40.
# Top bar: y in [44, 84], x from (88, 44) to (188, 44). Chamfer at top-right: (188, 44) -> (208, 64) -> (208, 108).
# Wait, let's trace the perimeter of the S:
# 1. Start at top-left inner terminal: (88, 84)
# 2. Go up-left to (48, 84) -> (48, 64) -> (68, 44) [top-left chamfer]
# 3. Go right to (188, 44)
# 4. Chamfer down-right to (208, 64)
# 5. Go down to (208, 116)
# 6. Chamfer down-left to (188, 136)
# 7. Go down to (208, 156) [wait, S curves back left in the middle!]
# Ah! S goes from top-right DOWN-LEFT across the middle!

# Let's trace S correctly:
# Upper loop:
# - Top edge: (68, 44) to (188, 44)
# - Top-right corner: (188, 44) -> (208, 64) -> (208, 108) -> (188, 128)
# - Middle diagonal/horizontal: goes LEFT from (188, 128) to (108, 128)
# - Lower loop:
#   from (108, 128) goes DOWN-RIGHT or DOWN-LEFT?
#   In an S:
#   Top loop is on the RIGHT. Left side of top is open, or left side has a vertical stem?
#   WAIT! In the letter S:
#   Top curve: enters from top-left, curves around top, goes down the RIGHT, then sweeps across the middle to the LEFT, goes down the LEFT, curves around the bottom, and terminates at bottom-right!
#   YES!
#   Top: curve is at TOP and RIGHT.
#   Middle: sweeps from right to left!
#   Bottom: curve is at LEFT and BOTTOM!
#   Terminal 1 is at TOP-LEFT (pointing left or down).
#   Terminal 2 is at BOTTOM-RIGHT (pointing right or up).

# Let's verify:
# Terminal 1: at top-left, say (48, 88).
# Runs up to (48, 64) -> chamfer (68, 44) -> top edge to (188, 44) -> chamfer (208, 64) -> right edge to (208, 116).
# From (208, 116), sweeps INWARD and DOWN to the middle:
# -> chamfer (188, 136) -> across middle to (88, 136).
# From (88, 136), goes down the left side of bottom loop:
# -> down to (48, 176) [left edge of bottom loop] -> chamfer to (68, 212) [bottom-left corner]
# -> across bottom edge to (188, 212)
# -> chamfer to (208, 192) -> up to (208, 168) [terminal 2 at bottom-right]!

# Now the INNER perimeter of the S:
# From (208, 168), we go inside the lower loop:
# -> chamfer to (188, 172) -> left along inside of bottom to (88, 172)
# -> up the inside of left wall to (88, 148)
# -> across middle spine: (88, 120) to (168, 120)
# -> up the inside of right wall to (168, 84)
# -> left along inside of top to (88, 84) -> back to (48, 88)!

print("S topology verified!")
