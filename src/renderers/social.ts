import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { addTextToImage } from '../utils/text.js';
import type { Config } from '../types.js';

interface SocialImageConfig {
  width: number;
  height: number;
  filename: string;
}

const SOCIAL_IMAGES: SocialImageConfig[] = [
  { width: 1200, height: 630, filename: 'og-image.png' },
  { width: 1200, height: 600, filename: 'twitter-card.png' },
  { width: 1200, height: 675, filename: 'twitter-card-large.png' },
];

export interface SocialResult {
  files: string[];
}

export async function generateSocialImages(
  svgContent: string,
  config: Config,
  wideSvgContent?: string | null
): Promise<SocialResult> {
  const files: string[] = [];
  const { output, background, theme, social, padding } = config;

  for (const imageConfig of SOCIAL_IMAGES) {
    const { width, height, filename } = imageConfig;

    // Use wide logo for social images if available, otherwise use square logo
    const logoSvg = wideSvgContent || svgContent;
    const isWideLogo = !!wideSvgContent;

    // Calculate logo size based on available space
    const hasText = social.title || social.tagline;
    const logoMaxHeight = hasText ? height * 0.4 : height * 0.6;
    const logoMaxWidth = width * (1 - padding.social * 2);

    // For wide logos, prioritize width; for square logos, use min dimension
    let logoWidth: number;
    let logoHeight: number;

    if (isWideLogo) {
      // Wide logo: fit to width, let height be proportional
      logoWidth = Math.min(logoMaxWidth, width * 0.7);
      logoHeight = logoMaxHeight;
    } else {
      // Square logo: use the minimum of max dimensions
      const logoSize = Math.min(logoMaxWidth, logoMaxHeight);
      logoWidth = logoSize;
      logoHeight = logoSize;
    }

    // Calculate vertical positions
    const logoY = hasText ? height * 0.15 : (height - logoHeight) / 2;
    const titleY = height * 0.6;
    const taglineY = height * 0.75;

    // Create base image with background
    const bgColor = parseColor(background);
    let baseImage = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: bgColor,
      },
    })
      .png()
      .toBuffer();

    // Add logo - use 'inside' to preserve aspect ratio without adding fill
    const svgBuffer = Buffer.from(logoSvg);
    const logoBuffer = await sharp(svgBuffer, { density: 300 })
      .resize(Math.round(logoWidth), Math.round(logoHeight), {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    // Get actual logo dimensions after resize
    const logoMeta = await sharp(logoBuffer).metadata();
    const actualLogoWidth = logoMeta.width || logoWidth;
    const actualLogoHeight = logoMeta.height || logoHeight;

    // Center the logo horizontally and position vertically
    const logoLeft = Math.round((width - actualLogoWidth) / 2);
    const logoTop = hasText
      ? Math.round(logoY + (logoMaxHeight - actualLogoHeight) / 2)
      : Math.round((height - actualLogoHeight) / 2);

    baseImage = await sharp(baseImage)
      .composite([
        {
          input: logoBuffer,
          top: logoTop,
          left: logoLeft,
        },
      ])
      .png()
      .toBuffer();

    // Add text overlays if configured
    if (hasText) {
      const texts = [];

      if (social.title) {
        texts.push({
          text: social.title,
          fontSize: social.titleSize || 64,
          color: social.titleColor || '#1a1a1a',
          font: social.font || 'sans-serif',
          y: titleY,
          align: 'center' as const,
        });
      }

      if (social.tagline) {
        texts.push({
          text: social.tagline,
          fontSize: social.taglineSize || 32,
          color: social.taglineColor || '#666666',
          font: social.font || 'sans-serif',
          y: taglineY,
          align: 'center' as const,
        });
      }

      baseImage = await addTextToImage(baseImage, texts, width);
    }

    // Add optional accent bar using theme color
    if (theme && theme !== background) {
      const accentHeight = 8;
      const accentBar = await sharp({
        create: {
          width,
          height: accentHeight,
          channels: 4,
          background: parseColor(theme),
        },
      })
        .png()
        .toBuffer();

      baseImage = await sharp(baseImage)
        .composite([
          {
            input: accentBar,
            top: height - accentHeight,
            left: 0,
          },
        ])
        .png()
        .toBuffer();
    }

    await writeFile(join(output, filename), baseImage);
    files.push(filename);
  }

  return { files };
}

function parseColor(hex: string): { r: number; g: number; b: number; alpha?: number } {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}
