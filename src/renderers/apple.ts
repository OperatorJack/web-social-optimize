import { writeFile } from 'fs/promises';
import { join } from 'path';
import { createIconWithBackground } from '../utils/svg.js';
import type { Config } from '../types.js';

const APPLE_SIZES = [180, 152, 120];

export interface AppleResult {
  files: string[];
}

export async function generateAppleIcons(
  svgContent: string,
  config: Config
): Promise<AppleResult> {
  const files: string[] = [];
  const { output, background, padding } = config;

  for (const size of APPLE_SIZES) {
    const png = await createIconWithBackground(svgContent, size, {
      background,
      padding: padding.apple,
    });

    const filename = size === 180 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}x${size}.png`;
    await writeFile(join(output, filename), png);
    files.push(filename);
  }

  return { files };
}
