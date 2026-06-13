# Run: python gen_icons.py
import base64, json

SVG_192 = '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" rx="32" fill="#d68d45"/><text x="96" y="124" text-anchor="middle" font-size="96" font-family="serif" fill="white">\u8bb0</text></svg>'
SVG_512 = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="#d68d45"/><text x="256" y="330" text-anchor="middle" font-size="256" font-family="serif" fill="white">\u8bb0</text></svg>'

for name, svg in [("icon-192.svg", SVG_192), ("icon-512.svg", SVG_512)]:
    with open(name, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Created {name}")

# Also generate placeholder HTML icons data URI for the manifest
# Since we can't easily convert SVG to PNG here, we'll use the SVG as favicon
print("Icons done - use SVG files as favicon for now")
