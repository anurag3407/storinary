# Brand color version of Concept C:
# Chevrons: #0C0A09
# Center lens: #0047FF
svg_brand = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-brand">
  <title id="title-brand">Storinary Logo</title>
  <path fill="#0C0A09" d="
    M 52 108
    L 128 32
    L 204 108
    H 156
    L 128 80
    L 100 108
    Z
    M 204 148
    L 128 224
    L 52 148
    H 100
    L 128 176
    L 156 148
    Z
  "/>
  <circle cx="128" cy="128" r="24" fill="#0047FF"/>
</svg>"""

with open("/Users/jarvis/storinary-supabase/storinary-brand-concepts/storinary-color.svg", "w") as f:
    f.write(svg_brand)

print("Brand SVG written")
