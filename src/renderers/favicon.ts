import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import toIco from 'to-ico';
import type { Config } from '../types.js';

const FAVICON_SIZES = [16, 32, 48];
const ICO_SIZES = [16, 32, 48];

export interface FaviconResult {
  files: string[];
}

async function createFaviconPng(
  svgContent: string,
  size: number,
  background: string,
  padding: number
): Promise<Buffer> {
  const svgBuffer = Buffer.from(svgContent);
  const bgColor = parseColor(background);

  // For small favicon sizes, use minimal or no padding to avoid issues
  const effectivePadding = size <= 32 ? Math.min(padding, 0.05) : padding;
  const logoSize = Math.max(Math.round(size * (1 - effectivePadding * 2)), size - 4);

  // Render SVG to PNG at high density for quality
  const logo = await sharp(svgBuffer, { density: 300 })
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();

  // Create background and composite logo
  const result = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      {
        input: logo,
        gravity: 'center',
      },
    ])
    .png()
    .toBuffer();

  return result;
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}

export async function generateFavicons(
  svgContent: string,
  config: Config
): Promise<FaviconResult> {
  const files: string[] = [];
  const { output, background, padding } = config;

  // Generate PNG favicons
  const pngBuffers: Map<number, Buffer> = new Map();

  for (const size of FAVICON_SIZES) {
    const png = await createFaviconPng(svgContent, size, background, padding.favicon);
    pngBuffers.set(size, png);

    const filename = `favicon-${size}x${size}.png`;
    await writeFile(join(output, filename), png);
    files.push(filename);
  }

  // Generate multi-size ICO file using the same buffers
  const icoBuffers = ICO_SIZES.map((size) => pngBuffers.get(size)!);
  const ico = await toIco(icoBuffers);
  await writeFile(join(output, 'favicon.ico'), ico);
  files.push('favicon.ico');

  return { files };
}
