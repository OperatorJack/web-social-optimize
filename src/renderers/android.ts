import { writeFile } from 'fs/promises';
import { join } from 'path';
import { createIconWithBackground } from '../utils/svg.js';
import type { Config } from '../types.js';

const ANDROID_SIZES = [192, 512];
const MASKABLE_PADDING = 0.2; // Extra padding for maskable icons

export interface AndroidResult {
  files: string[];
}

export async function generateAndroidIcons(
  svgContent: string,
  config: Config
): Promise<AndroidResult> {
  const files: string[] = [];
  const { output, background, padding } = config;

  // Generate standard Android icons
  for (const size of ANDROID_SIZES) {
    const png = await createIconWithBackground(svgContent, size, {
      background,
      padding: padding.android,
    });

    const filename = `android-chrome-${size}x${size}.png`;
    await writeFile(join(output, filename), png);
    files.push(filename);
  }

  // Generate maskable icon (with extra padding for safe zone)
  const maskableSize = 512;
  const maskablePng = await createIconWithBackground(svgContent, maskableSize, {
    background,
    padding: MASKABLE_PADDING,
  });

  await writeFile(join(output, 'maskable-icon-512x512.png'), maskablePng);
  files.push('maskable-icon-512x512.png');

  return { files };
}
