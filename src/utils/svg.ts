import sharp from 'sharp';
import { optimize } from 'svgo';
import { readFile } from 'fs/promises';

export async function loadSvg(path: string): Promise<string> {
  const content = await readFile(path, 'utf-8');
  return content;
}

export function optimizeSvg(svgContent: string): string {
  const result = optimize(svgContent, {
    multipass: true,
    plugins: [
      'preset-default',
      'removeDimensions',
      {
        name: 'removeAttrs',
        params: {
          attrs: '(stroke|fill)',
        },
      },
    ],
  });
  return result.data;
}

export async function svgToPng(
  svgContent: string,
  width: number,
  height: number,
  options: {
    background?: string;
    padding?: number;
    fit?: 'contain' | 'cover' | 'fill';
  } = {}
): Promise<Buffer> {
  const { background, padding = 0, fit = 'contain' } = options;

  const paddedWidth = Math.round(width * (1 - padding * 2));
  const paddedHeight = Math.round(height * (1 - padding * 2));

  const svgBuffer = Buffer.from(svgContent);

  let pipeline = sharp(svgBuffer, { density: 300 }).resize(paddedWidth, paddedHeight, {
    fit,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  if (background) {
    const bgColor = parseColor(background);
    pipeline = pipeline.flatten({ background: bgColor });
  }

  if (padding > 0) {
    const padX = Math.round((width - paddedWidth) / 2);
    const padY = Math.round((height - paddedHeight) / 2);

    pipeline = pipeline.extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background: background ? parseColor(background) : { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  return pipeline.png().toBuffer();
}

export async function createIconWithBackground(
  svgContent: string,
  size: number,
  options: {
    background: string;
    padding?: number;
  }
): Promise<Buffer> {
  const { background, padding = 0.1 } = options;

  const logoSize = Math.round(size * (1 - padding * 2));
  const svgBuffer = Buffer.from(svgContent);

  const logo = await sharp(svgBuffer, { density: 300 })
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();

  const bgColor = parseColor(background);

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

function parseColor(hex: string): { r: number; g: number; b: number; alpha?: number } {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}
