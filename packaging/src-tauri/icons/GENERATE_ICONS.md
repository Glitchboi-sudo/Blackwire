# Blackwire Icons

## Required Icons

Tauri requires the following icon files:

```
icons/
├── 32x32.png          # 32x32 PNG
├── 128x128.png        # 128x128 PNG
├── 128x128@2x.png     # 256x256 PNG (retina)
├── icon.icns          # macOS icon bundle
├── icon.ico           # Windows icon
└── icon.png           # Linux tray icon (PNG, any size)
```

## Generate Icons Automatically

### Option 1: Using Tauri Icon Generator

```bash
# Install the icon generator
cargo install tauri-cli

# Create a single source PNG (1024x1024 or larger)
# Save it as: icon-source.png

# Generate all required formats
cargo tauri icon icon-source.png
```

This will automatically generate all required icon sizes.

### Option 2: Using ImageMagick

```bash
# From a source PNG (e.g., logo.png):

# Generate PNGs
convert logo.png -resize 32x32 32x32.png
convert logo.png -resize 128x128 128x128.png
convert logo.png -resize 256x256 128x128@2x.png
convert logo.png -resize 512x512 icon.png

# Generate ICO (Windows)
convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Generate ICNS (macOS) - requires iconutil on macOS
mkdir MyIcon.iconset
sips -z 16 16     logo.png --out MyIcon.iconset/icon_16x16.png
sips -z 32 32     logo.png --out MyIcon.iconset/icon_16x16@2x.png
sips -z 32 32     logo.png --out MyIcon.iconset/icon_32x32.png
sips -z 64 64     logo.png --out MyIcon.iconset/icon_32x32@2x.png
sips -z 128 128   logo.png --out MyIcon.iconset/icon_128x128.png
sips -z 256 256   logo.png --out MyIcon.iconset/icon_128x128@2x.png
sips -z 256 256   logo.png --out MyIcon.iconset/icon_256x256.png
sips -z 512 512   logo.png --out MyIcon.iconset/icon_256x256@2x.png
sips -z 512 512   logo.png --out MyIcon.iconset/icon_512x512.png
sips -z 1024 1024 logo.png --out MyIcon.iconset/icon_512x512@2x.png
iconutil -c icns MyIcon.iconset
mv MyIcon.icns icon.icns
rm -rf MyIcon.iconset
```

## Design Guidelines

- **Source image**: Use a square PNG (1024x1024 or larger)
- **Transparency**: Include alpha channel for proper rendering
- **Style**: Simple, recognizable icon that works at small sizes
- **Colors**: High contrast for visibility in system tray

## Placeholder Icons

Until custom icons are created, you can use placeholder icons for testing:

```bash
# Create simple placeholder icons (requires ImageMagick)
for size in 32 128 256 512; do
    convert -size ${size}x${size} xc:black -fill white \
            -gravity center -pointsize $((size/2)) -annotate +0+0 "B" \
            icon_${size}.png
done

mv icon_32.png 32x32.png
mv icon_128.png 128x128.png
mv icon_256.png 128x128@2x.png
mv icon_512.png icon.png
```
