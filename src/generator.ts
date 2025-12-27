import { mkdir } from 'fs/promises';
import { loadSvg } from './utils/svg.js';
import { generateFavicons } from './renderers/favicon.js';
import { generateAppleIcons } from './renderers/apple.js';
import { generateAndroidIcons } from './renderers/android.js';
import { generateSocialImages } from './renderers/social.js';
import { generateManifest } from './templates/manifest.js';
import { generateBrowserconfig } from './templates/browserconfig.js';
import { generateMetaTags, type MetaTagsOptions } from './templates/meta-tags.js';
import type { Config, RenderType } from './types.js';

export interface GeneratorOptions {
  only?: RenderType[];
  metaTags?: MetaTagsOptions;
}

export interface GeneratorResult {
  files: string[];
  outputDir: string;
}

export async function generate(
  config: Config,
  options: GeneratorOptions = {}
): Promise<GeneratorResult> {
  const { only = ['all'] } = options;
  const shouldGenerate = (type: RenderType) => only.includes('all') || only.includes(type);

  // Ensure output directory exists
  await mkdir(config.output, { recursive: true });

  // Load SVG content (compact/square logo is the primary input)
  const svgContent = await loadSvg(config.input);

  // Load wide logo if provided (used for non-square social images)
  const wideSvgContent = config.inputWide ? await loadSvg(config.inputWide) : null;

  const files: string[] = [];

  // Generate favicons
  if (shouldGenerate('favicons')) {
    const result = await generateFavicons(svgContent, config);
    files.push(...result.files);
  }

  // Generate Apple touch icons
  if (shouldGenerate('apple')) {
    const result = await generateAppleIcons(svgContent, config);
    files.push(...result.files);
  }

  // Generate Android/PWA icons
  if (shouldGenerate('android')) {
    const result = await generateAndroidIcons(svgContent, config);
    files.push(...result.files);
  }

  // Generate social media images (use wide logo if available)
  if (shouldGenerate('social')) {
    const result = await generateSocialImages(svgContent, config, wideSvgContent);
    files.push(...result.files);
  }

  // Generate templates (always generate if any icons are generated)
  if (shouldGenerate('android')) {
    const manifestFile = await generateManifest(config);
    files.push(manifestFile);

    const browserconfigFile = await generateBrowserconfig(config);
    files.push(browserconfigFile);
  }

  // Generate meta tags HTML
  const metaTagsFile = await generateMetaTags(config, options.metaTags);
  files.push(metaTagsFile);

  return {
    files,
    outputDir: config.output,
  };
}
