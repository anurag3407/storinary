import os
import shutil

# Master production SVGs for Storinary (Concept C: The Transform Aperture)

# 1. Master Symbol (Color)
svg_symbol_color = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">Storinary Logo</title>
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

# 2. Master Symbol (White for Dark Mode)
svg_symbol_white = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-white">
  <title id="title-white">Storinary Logo (White)</title>
  <path fill="#FFFFFF" d="
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

# 3. Master Symbol (Monochrome Black)
svg_symbol_black = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-black">
  <title id="title-black">Storinary Logo (Mono Black)</title>
  <path fill="#0C0A09" fill-rule="evenodd" d="
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
    M 128 104
    A 24 24 0 1 0 128 152
    A 24 24 0 1 0 128 104
    Z
  "/>
</svg>"""

# 4. App Icon / Favicon SVG (src/app/icon.svg)
# Modern rounded container with the brand mark
svg_app_icon = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-labelledby="title-icon">
  <title id="title-icon">Storinary Icon</title>
  <rect width="64" height="64" rx="14" fill="#0C0A09"/>
  <g transform="translate(6, 6) scale(0.203125)">
    <path fill="#FFFFFF" d="
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
  </g>
</svg>"""

# Write files to public/ and src/app/
public_dir = "/Users/jarvis/storinary-supabase/public"
src_app_dir = "/Users/jarvis/storinary-supabase/src/app"

with open(os.path.join(public_dir, "logo.svg"), "w") as f:
    f.write(svg_symbol_color)

with open(os.path.join(public_dir, "logo-white.svg"), "w") as f:
    f.write(svg_symbol_white)

with open(os.path.join(public_dir, "logo-black.svg"), "w") as f:
    f.write(svg_symbol_black)

with open(os.path.join(src_app_dir, "icon.svg"), "w") as f:
    f.write(svg_app_icon)

# Also copy dist icons to public/
dist_dir = "/Users/jarvis/storinary-supabase/storinary-brand-concepts/dist"
for fname in ["favicon.ico", "favicon-16.png", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest"]:
    src = os.path.join(dist_dir, fname)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(public_dir, fname))

print("SVG assets and web-icons staged successfully")
