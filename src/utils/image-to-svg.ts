import sharp from 'sharp';
import potrace from 'potrace';

// Promisify potrace.trace
function traceAsync(buffer: Buffer, options: potrace.PotraceOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, options, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

// Promisify potrace.posterize
function posterizeAsync(buffer: Buffer, options: potrace.PosterizerOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    potrace.posterize(buffer, options, (err, svg) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

export interface ImageToSvgOptions {
  /** Color to remove from background (e.g., '#ffffff' for white). If not specified, auto-detects. */
  backgroundColor?: string;
  /** Tolerance for background color matching (0-255). Default: 30 */
  colorTolerance?: number;
  /** Whether to invert colors (useful for dark logos). Default: false */
  invert?: boolean;
  /** Threshold for black/white conversion (0-255). Default: 128 */
  threshold?: number;
  /** Number of colors for posterization (2-256). Use for multi-color logos. Default: 2 */
  colorCount?: number;
  /** Turd policy for potrace (how to resolve ambiguities). Default: 'minority' */
  turdPolicy?: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';
  /** Curve optimization tolerance. Higher = smoother curves. Default: 0.2 */
  optTolerance?: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse a hex color string to RGB values
 */
function parseHexColor(hex: string): RGB {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
}

/**
 * Check if two colors are similar within a given tolerance
 */
function colorsMatch(c1: RGB, c2: RGB, tolerance: number): boolean {
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance
  );
}

/**
 * Detect the dominant corner color which is likely the background
 * Samples the four corners of the image
 */
async function detectBackgroundColor(imageBuffer: Buffer): Promise<RGB | null> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  const width = metadata.width;
  const height = metadata.height;

  // Sample size for corners (5x5 pixels)
  const sampleSize = 5;

  // Extract corners and analyze their colors
  const corners = [
    { left: 0, top: 0 }, // Top-left
    { left: width - sampleSize, top: 0 }, // Top-right
    { left: 0, top: height - sampleSize }, // Bottom-left
    { left: width - sampleSize, top: height - sampleSize }, // Bottom-right
  ];

  const cornerColors: RGB[] = [];

  for (const corner of corners) {
    const cornerBuffer = await sharp(imageBuffer)
      .extract({
        left: Math.max(0, corner.left),
        top: Math.max(0, corner.top),
        width: Math.min(sampleSize, width),
        height: Math.min(sampleSize, height)
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Get average color of the corner sample
    const { data, info } = cornerBuffer;
    const channels = info.channels;
    let rSum = 0, gSum = 0, bSum = 0;
    const pixelCount = data.length / channels;

    for (let i = 0; i < data.length; i += channels) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }

    cornerColors.push({
      r: Math.round(rSum / pixelCount),
      g: Math.round(gSum / pixelCount),
      b: Math.round(bSum / pixelCount),
    });
  }

  // Check if all corners have similar colors (likely background)
  const tolerance = 30;
  const baseColor = cornerColors[0];
  const allMatch = cornerColors.every(c => colorsMatch(c, baseColor, tolerance));

  if (allMatch) {
    // Return average of all corner colors
    return {
      r: Math.round(cornerColors.reduce((sum, c) => sum + c.r, 0) / cornerColors.length),
      g: Math.round(cornerColors.reduce((sum, c) => sum + c.g, 0) / cornerColors.length),
      b: Math.round(cornerColors.reduce((sum, c) => sum + c.b, 0) / cornerColors.length),
    };
  }

  return null;
}

/**
 * Remove background color from an image, making it transparent
 */
export async function removeBackground(
  imageBuffer: Buffer,
  options: { backgroundColor?: string; colorTolerance?: number } = {}
): Promise<Buffer> {
  const { colorTolerance = 30 } = options;

  // Determine background color
  let bgColor: RGB;
  if (options.backgroundColor) {
    bgColor = parseHexColor(options.backgroundColor);
  } else {
    const detected = await detectBackgroundColor(imageBuffer);
    if (!detected) {
      // No consistent background detected, return original with alpha channel
      return sharp(imageBuffer).ensureAlpha().png().toBuffer();
    }
    bgColor = detected;
  }

  // Get image data as raw RGBA
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const outputData = Buffer.alloc(data.length);

  // Process each pixel
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels === 4 ? data[i + 3] : 255;

    const pixelColor: RGB = { r, g, b };

    if (colorsMatch(pixelColor, bgColor, colorTolerance)) {
      // Make this pixel transparent
      outputData[i] = 0;
      outputData[i + 1] = 0;
      outputData[i + 2] = 0;
      outputData[i + 3] = 0;
    } else {
      // Keep original pixel
      outputData[i] = r;
      outputData[i + 1] = g;
      outputData[i + 2] = b;
      outputData[i + 3] = a;
    }
  }

  // Reconstruct image
  return sharp(outputData, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Trim transparent/alpha space around the image content
 */
export async function trimAlpha(imageBuffer: Buffer): Promise<Buffer> {
  // Sharp's trim() function removes borders based on the top-left pixel
  // For images with alpha, we need to trim based on the alpha channel

  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = 4; // RGBA

  // Find bounding box of non-transparent pixels
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = data[idx + 3];

      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // If no non-transparent pixels found, return original
  if (minX >= maxX || minY >= maxY) {
    return imageBuffer;
  }

  // Add a small margin (2 pixels) to avoid edge clipping
  const margin = 2;
  const extractLeft = Math.max(0, minX - margin);
  const extractTop = Math.max(0, minY - margin);
  const extractWidth = Math.min(width - extractLeft, maxX - minX + 1 + margin * 2);
  const extractHeight = Math.min(height - extractTop, maxY - minY + 1 + margin * 2);

  // Extract the trimmed region
  return sharp(imageBuffer)
    .extract({
      left: extractLeft,
      top: extractTop,
      width: extractWidth,
      height: extractHeight,
    })
    .png()
    .toBuffer();
}

/**
 * Convert a raster image to SVG using potrace vectorization
 */
export async function vectorizeImage(
  imageBuffer: Buffer,
  options: Omit<ImageToSvgOptions, 'backgroundColor' | 'colorTolerance'> = {}
): Promise<string> {
  const {
    invert = false,
    threshold = 128,
    colorCount = 2,
    turdPolicy = 'minority',
    optTolerance = 0.2,
  } = options;

  // Convert to grayscale for better tracing
  const processedBuffer = await sharp(imageBuffer)
    .grayscale()
    .png()
    .toBuffer();

  // Potrace options
  const potraceOptions: potrace.PotraceOptions = {
    threshold,
    turdPolicy,
    optTolerance,
    optCurve: true,
    background: 'transparent',
  };

  if (invert) {
    potraceOptions.color = 'white';
    potraceOptions.background = 'black';
  }

  let svg: string;

  if (colorCount > 2) {
    // Use posterization for multi-color images
    const posterizeOptions: potrace.PosterizerOptions = {
      ...potraceOptions,
      steps: colorCount,
      fillStrategy: 'dominant',
    };
    svg = await posterizeAsync(processedBuffer, posterizeOptions);
  } else {
    // Simple black and white tracing
    svg = await traceAsync(processedBuffer, potraceOptions);
  }

  return svg;
}

/**
 * Main conversion pipeline: Image to SVG
 * 1. Remove solid color background
 * 2. Trim transparent space
 * 3. Vectorize to SVG
 */
export async function convertImageToSvg(
  input: Buffer | string,
  options: ImageToSvgOptions = {}
): Promise<string> {
  // Load image
  let imageBuffer: Buffer;
  if (typeof input === 'string') {
    imageBuffer = await sharp(input).png().toBuffer();
  } else {
    imageBuffer = input;
  }

  // Step 1: Remove background
  const noBackground = await removeBackground(imageBuffer, {
    backgroundColor: options.backgroundColor,
    colorTolerance: options.colorTolerance,
  });

  // Step 2: Trim alpha space
  const trimmed = await trimAlpha(noBackground);

  // Step 3: Vectorize to SVG
  const svg = await vectorizeImage(trimmed, {
    invert: options.invert,
    threshold: options.threshold,
    colorCount: options.colorCount,
    turdPolicy: options.turdPolicy,
    optTolerance: options.optTolerance,
  });

  return svg;
}

/**
 * Process image and save as SVG file
 */
export async function processImageToSvg(
  inputPath: string,
  outputPath: string,
  options: ImageToSvgOptions = {}
): Promise<void> {
  const { writeFile } = await import('fs/promises');

  const svg = await convertImageToSvg(inputPath, options);
  await writeFile(outputPath, svg, 'utf-8');
}
