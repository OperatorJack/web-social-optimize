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
  /** Curve optimization tolerance. Lower = more accurate curves. Default: 0.1 */
  optTolerance?: number;
  /** Preserve original colors from the image. Default: true */
  preserveColors?: boolean;
  /** Suppress speckles of up to this many pixels. Lower = more detail. Default: 2 */
  turdSize?: number;
  /** Corner threshold (0 to 1.33). Lower = sharper corners. Default: 0.75 */
  alphaMax?: number;
  /** Upscale factor before tracing for smoother curves. Default: 2 */
  upscale?: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface RGBA extends RGB {
  a: number;
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
 * Sample average color from a region of an image, including alpha
 */
async function sampleRegionColor(
  imageBuffer: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<RGBA> {
  const regionBuffer = await sharp(imageBuffer)
    .ensureAlpha()
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = regionBuffer;
  const channels = info.channels; // Should be 4 (RGBA) after ensureAlpha
  let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
  const pixelCount = data.length / channels;

  for (let i = 0; i < data.length; i += channels) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    aSum += channels >= 4 ? data[i + 3] : 255;
  }

  return {
    r: Math.round(rSum / pixelCount),
    g: Math.round(gSum / pixelCount),
    b: Math.round(bSum / pixelCount),
    a: Math.round(aSum / pixelCount),
  };
}

/**
 * Detect the dominant corner color which is likely the background.
 * Returns null if:
 * - Corners are already transparent (background is already removed)
 * - Corners don't match each other (no consistent background)
 * - Center matches corners (logo fills the image, no distinct background)
 */
async function detectBackgroundColor(imageBuffer: Buffer): Promise<RGB | null> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  const width = metadata.width;
  const height = metadata.height;

  // Sample size for regions
  const sampleSize = Math.min(10, Math.floor(Math.min(width, height) / 10));
  if (sampleSize < 2) {
    return null; // Image too small for reliable detection
  }

  // Sample the four corners
  const corners = [
    { left: 0, top: 0 },
    { left: width - sampleSize, top: 0 },
    { left: 0, top: height - sampleSize },
    { left: width - sampleSize, top: height - sampleSize },
  ];

  const cornerColors: RGBA[] = [];
  for (const corner of corners) {
    const color = await sampleRegionColor(
      imageBuffer,
      Math.max(0, corner.left),
      Math.max(0, corner.top),
      Math.min(sampleSize, width),
      Math.min(sampleSize, height)
    );
    cornerColors.push(color);
  }

  // Check if corners are mostly transparent - if so, background is already removed
  const avgAlpha = cornerColors.reduce((sum, c) => sum + c.a, 0) / cornerColors.length;
  if (avgAlpha < 128) {
    // Corners are mostly transparent, no background removal needed
    return null;
  }

  // Check if all corners have similar colors
  const tolerance = 30;
  const baseColor = cornerColors[0];
  const allCornersMatch = cornerColors.every(c => colorsMatch(c, baseColor, tolerance));

  if (!allCornersMatch) {
    // Corners don't match - no consistent background detected
    return null;
  }

  // Average corner color
  const avgCornerColor: RGB = {
    r: Math.round(cornerColors.reduce((sum, c) => sum + c.r, 0) / cornerColors.length),
    g: Math.round(cornerColors.reduce((sum, c) => sum + c.g, 0) / cornerColors.length),
    b: Math.round(cornerColors.reduce((sum, c) => sum + c.b, 0) / cornerColors.length),
  };

  // Sample the center of the image
  const centerSize = Math.min(sampleSize * 2, Math.floor(Math.min(width, height) / 4));
  const centerLeft = Math.floor((width - centerSize) / 2);
  const centerTop = Math.floor((height - centerSize) / 2);

  const centerColor = await sampleRegionColor(
    imageBuffer,
    centerLeft,
    centerTop,
    centerSize,
    centerSize
  );

  // If the center matches the corners, the logo likely fills the entire image
  // In this case, we should NOT remove the "background" as it's actually the logo
  if (colorsMatch(centerColor, avgCornerColor, tolerance)) {
    return null;
  }

  return avgCornerColor;
}

/**
 * Remove background color from an image, making it transparent.
 * Includes safeguards to prevent removing too much of the image.
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

  // Note: detectBackgroundColor already checks that center differs from corners,
  // so if we get here with an auto-detected color, it's a real background to remove.
  // No additional percentage-based safeguard is needed.

  // Remove the background
  const outputData = Buffer.alloc(data.length);

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
 * Convert RGB to hex color string
 */
function rgbToHex(color: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Extract unique colors from an image (ignoring transparent pixels)
 * Groups similar colors together based on tolerance
 */
async function extractUniqueColors(
  imageBuffer: Buffer,
  tolerance: number = 20
): Promise<RGB[]> {
  const { data } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4;
  const colorCounts = new Map<string, { color: RGB; count: number }>();

  // Count all opaque pixel colors
  for (let i = 0; i < data.length; i += channels) {
    const alpha = data[i + 3];
    if (alpha < 128) continue; // Skip transparent pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r},${g},${b}`;

    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  // Sort by frequency (most common first)
  const sortedColors = [...colorCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map(c => c.color);

  // Group similar colors together
  const uniqueColors: RGB[] = [];
  for (const color of sortedColors) {
    const isSimilarToExisting = uniqueColors.some(
      existing => colorsMatch(color, existing, tolerance)
    );
    if (!isSimilarToExisting) {
      uniqueColors.push(color);
    }
  }

  return uniqueColors;
}

/**
 * Create a binary mask for a specific color
 * Pixels matching the color become black, others become white
 */
async function createColorMask(
  imageBuffer: Buffer,
  targetColor: RGB,
  tolerance: number = 20
): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = 4;

  // Create grayscale output (1 channel)
  const maskData = Buffer.alloc(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels;
      const dstIdx = y * width + x;

      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const alpha = data[srcIdx + 3];

      const pixelColor: RGB = { r, g, b };

      // Black (0) where color matches, white (255) elsewhere
      if (alpha >= 128 && colorsMatch(pixelColor, targetColor, tolerance)) {
        maskData[dstIdx] = 0; // Black - will be traced
      } else {
        maskData[dstIdx] = 255; // White - background
      }
    }
  }

  return sharp(maskData, {
    raw: { width, height, channels: 1 }
  }).png().toBuffer();
}

/**
 * Extract path data from an SVG string
 */
function extractPathFromSvg(svg: string): string | null {
  const pathMatch = svg.match(/<path[^>]*\sd="([^"]+)"/);
  return pathMatch ? pathMatch[1] : null;
}

/**
 * Extract viewBox dimensions from an SVG string
 */
function extractViewBox(svg: string): { width: number; height: number } | null {
  const viewBoxMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (viewBoxMatch) {
    return { width: parseInt(viewBoxMatch[1]), height: parseInt(viewBoxMatch[2]) };
  }
  const dimMatch = svg.match(/width="(\d+)"[^>]*height="(\d+)"/);
  if (dimMatch) {
    return { width: parseInt(dimMatch[1]), height: parseInt(dimMatch[2]) };
  }
  return null;
}

/**
 * Upscale an image for better tracing quality.
 * Upscaling before tracing produces smoother curves.
 */
async function upscaleForTracing(
  imageBuffer: Buffer,
  scaleFactor: number = 2
): Promise<{ buffer: Buffer; scale: number; originalWidth: number; originalHeight: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  if (originalWidth === 0 || originalHeight === 0) {
    return { buffer: imageBuffer, scale: 1, originalWidth, originalHeight };
  }

  // Limit maximum dimensions to prevent memory issues
  const maxDimension = 4000;
  const currentMax = Math.max(originalWidth, originalHeight);

  // Adjust scale factor if resulting image would be too large
  let effectiveScale = scaleFactor;
  if (currentMax * scaleFactor > maxDimension) {
    effectiveScale = maxDimension / currentMax;
  }

  if (effectiveScale <= 1) {
    return { buffer: imageBuffer, scale: 1, originalWidth, originalHeight };
  }

  const upscaled = await sharp(imageBuffer)
    .resize({
      width: Math.round(originalWidth * effectiveScale),
      height: Math.round(originalHeight * effectiveScale),
      kernel: 'lanczos3',  // High-quality upscaling
    })
    .png()
    .toBuffer();

  return { buffer: upscaled, scale: effectiveScale, originalWidth, originalHeight };
}

/**
 * Convert a raster image to SVG with color preservation
 */
async function vectorizeWithColors(
  imageBuffer: Buffer,
  options: {
    turdPolicy?: potrace.PotraceOptions['turdPolicy'];
    optTolerance?: number;
    colorTolerance?: number;
    turdSize?: number;
    alphaMax?: number;
    upscale?: number;
  } = {}
): Promise<string> {
  const {
    turdPolicy = 'minority',
    optTolerance = 0.1,  // Lower = more accurate curves
    colorTolerance = 20,
    turdSize = 2,        // Suppress tiny speckles only
    alphaMax = 0.75,     // Sharper corners (0 = very sharp, 1.33 = very round)
    upscale = 2,         // Upscale factor for smoother tracing
  } = options;

  // Upscale image for better tracing quality
  const { buffer: processBuffer, originalWidth, originalHeight } = await upscaleForTracing(imageBuffer, upscale);

  // Extract unique colors from the upscaled image
  const colors = await extractUniqueColors(processBuffer, colorTolerance);

  if (colors.length === 0) {
    // No colors found, return empty SVG with original dimensions
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${originalWidth}" height="${originalHeight}" viewBox="0 0 ${originalWidth} ${originalHeight}"></svg>`;
  }

  const paths: { color: string; d: string }[] = [];
  let tracedViewBox: { width: number; height: number } | null = null;

  // Trace each color separately using the upscaled buffer
  for (const color of colors) {
    const mask = await createColorMask(processBuffer, color, colorTolerance);

    const potraceOptions: potrace.PotraceOptions = {
      threshold: 128,
      turdPolicy,
      turdSize,
      alphaMax,
      optTolerance,
      optCurve: true,
      background: 'transparent',
      color: 'black',
    };

    const svg = await traceAsync(mask, potraceOptions);
    const pathData = extractPathFromSvg(svg);

    if (pathData && pathData.trim()) {
      paths.push({ color: rgbToHex(color), d: pathData });
      if (!tracedViewBox) {
        tracedViewBox = extractViewBox(svg);
      }
    }
  }

  if (paths.length === 0 || !tracedViewBox) {
    // Fallback: return empty SVG with original dimensions
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${originalWidth}" height="${originalHeight}" viewBox="0 0 ${originalWidth} ${originalHeight}"></svg>`;
  }

  // Combine all paths into a single SVG
  const pathElements = paths
    .map(p => `\t<path d="${p.d}" fill="${p.color}" fill-rule="evenodd"/>`)
    .join('\n');

  // Use original dimensions for display size, traced dimensions for viewBox
  // This lets SVG's built-in scaling handle the coordinate transformation
  // The paths are traced at higher resolution, giving smoother curves
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${originalWidth}" height="${originalHeight}" viewBox="0 0 ${tracedViewBox.width} ${tracedViewBox.height}" version="1.1">
${pathElements}
</svg>`;
}

/**
 * Convert a raster image to SVG using potrace vectorization
 */
export async function vectorizeImage(
  imageBuffer: Buffer,
  options: Omit<ImageToSvgOptions, 'backgroundColor'> = {}
): Promise<string> {
  const {
    invert = false,
    threshold = 128,
    colorCount = 2,
    turdPolicy = 'minority',
    optTolerance = 0.1,
    preserveColors = true,
    colorTolerance = 20,
    turdSize = 2,
    alphaMax = 0.75,
    upscale = 2,
  } = options;

  // Use color-preserving vectorization by default
  if (preserveColors) {
    return vectorizeWithColors(imageBuffer, {
      turdPolicy,
      optTolerance,
      colorTolerance,
      turdSize,
      alphaMax,
      upscale,
    });
  }

  // Fallback to grayscale tracing
  const processedBuffer = await sharp(imageBuffer)
    .grayscale()
    .png()
    .toBuffer();

  // Potrace options
  const potraceOptions: potrace.PotraceOptions = {
    threshold,
    turdPolicy,
    turdSize,
    alphaMax,
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
    preserveColors: options.preserveColors ?? true,
    colorTolerance: options.colorTolerance,
    turdSize: options.turdSize,
    alphaMax: options.alphaMax,
    upscale: options.upscale,
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
