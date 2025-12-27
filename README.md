# Web Social Optimize

Generate all social media and SEO images from a single SVG logo. Optionally include a "wide" version for wide social media images.

## Quick Start

```bash
npm install && npm run build && npmx web-social-optimize --config config.example.json
```

## Usage

### Basic (logo only)

```bash
node dist/index.js --input logo.svg --output ./assets
```

### With text overlays

```bash
node dist/index.js -i logo.svg -o ./assets \
  --title "My Brand" --tagline "Building the future"
```

### With config file

```bash
cp config.example.json config.json
# Edit config.json
node dist/index.js --config config.json
```

### Generate specific types only

```bash
node dist/index.js -i logo.svg -o ./assets --only favicons,social
```

### With wide logo for social images

If your brand has both a square/compact logo and a wide/horizontal logo, you can use the wide version for social media images while the compact version is used for favicons and touch icons:

```bash
node dist/index.js -i logo-square.svg -w logo-wide.svg -o ./assets
```

## CLI Options

| Option                     | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `-i, --input <path>`       | Path to SVG logo file (square/compact)                  |
| `-w, --input-wide <path>`  | Path to wide SVG logo for social images (optional)      |
| `-o, --output <path>`      | Output directory                                        |
| `-c, --config <path>`      | Path to config file                                     |
| `-b, --background <color>` | Background color (hex)                                  |
| `-t, --theme <color>`      | Theme/accent color (hex)                                |
| `--title <text>`           | Title for social images                                 |
| `--tagline <text>`         | Tagline for social images                               |
| `--only <types>`           | Generate only: `favicons`, `apple`, `android`, `social` |
| `--site-url <url>`         | Site URL for meta tags                                  |
| `--twitter <handle>`       | Twitter handle for meta tags                            |

## Configuration File

```json
{
  "input": "./logo.svg",
  "inputWide": "./logo-wide.svg",
  "output": "./assets",
  "background": "#ffffff",
  "theme": "#1a73e8",
  "social": {
    "title": "Your Brand Name",
    "tagline": "Your tagline goes here",
    "font": "sans-serif",
    "titleSize": 64,
    "taglineSize": 32,
    "titleColor": "#1a1a1a",
    "taglineColor": "#666666"
  },
  "padding": {
    "favicon": 0.1,
    "social": 0.15,
    "apple": 0.1,
    "android": 0.1
  }
}
```

## Generated Files

### Favicons

- `favicon.ico` (16x16, 32x32, 48x48 multi-size)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-48x48.png`

### Apple Touch Icons

- `apple-touch-icon.png` (180x180)
- `apple-touch-icon-152x152.png`
- `apple-touch-icon-120x120.png`

### Android / PWA

- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `maskable-icon-512x512.png`

### Social Media

- `og-image.png` (1200x630) - Open Graph / Facebook / LinkedIn
- `twitter-card.png` (1200x600) - Twitter summary card
- `twitter-card-large.png` (1200x675) - Twitter large image

### Configuration Files

- `manifest.json` - PWA manifest
- `browserconfig.xml` - Windows tiles
- `meta-tags.html` - Copy-paste HTML meta tags

## Development

```bash
npm install
npm run dev -- --input example-logo.svg --output ./test-assets
```

## License

MIT
