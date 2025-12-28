#!/usr/bin/env node

import { program } from 'commander';
import { readFile } from 'fs/promises';
import { resolve, basename, dirname, join } from 'path';
import chalk from 'chalk';
import { generate } from './generator.js';
import { defaultConfig, defaultImageToSvgConfig, type Config, type RenderType, type ImageToSvgConfig } from './types.js';
import { processImageToSvg } from './utils/image-to-svg.js';

async function loadConfig(configPath: string): Promise<Partial<Config>> {
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    ...base,
    ...override,
    social: {
      ...base.social,
      ...override.social,
    },
    padding: {
      ...base.padding,
      ...override.padding,
    },
  };
}

program
  .name('web-social-optimize')
  .description('Generate all social media and SEO images from a single SVG logo')
  .version('1.0.0')
  .option('-i, --input <path>', 'Path to SVG logo file (square/compact logo)')
  .option('-w, --input-wide <path>', 'Path to wide SVG logo for social images (optional)')
  .option('-o, --output <path>', 'Output directory for generated assets')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-b, --background <color>', 'Background color (hex)')
  .option('-t, --theme <color>', 'Theme/accent color (hex)')
  .option('--title <text>', 'Title for social images')
  .option('--tagline <text>', 'Tagline for social images')
  .option('--only <types>', 'Generate only specific types (comma-separated: favicons,apple,android,social)')
  .option('--site-url <url>', 'Site URL for meta tags')
  .option('--twitter <handle>', 'Twitter handle for meta tags')
  .action(async (options) => {
    console.log(chalk.bold('\n🎨 Web Social Optimize\n'));

    try {
      // Load config file if provided
      let fileConfig: Partial<Config> = {};
      if (options.config) {
        fileConfig = await loadConfig(resolve(options.config));
        console.log(chalk.dim(`Loaded config from ${options.config}`));
      }

      // Build config from CLI options
      const cliConfig: Partial<Config> = {};

      if (options.input) cliConfig.input = resolve(options.input);
      if (options.inputWide) cliConfig.inputWide = resolve(options.inputWide);
      if (options.output) cliConfig.output = resolve(options.output);
      if (options.background) cliConfig.background = options.background;
      if (options.theme) cliConfig.theme = options.theme;

      if (options.title || options.tagline) {
        cliConfig.social = {
          title: options.title,
          tagline: options.tagline,
        };
      }

      // Merge configs: defaults < file < CLI
      let config = mergeConfig(defaultConfig, fileConfig);
      config = mergeConfig(config, cliConfig);

      // Resolve paths
      config.input = resolve(config.input);
      if (config.inputWide) config.inputWide = resolve(config.inputWide);
      config.output = resolve(config.output);

      // Parse --only option
      const only: RenderType[] = options.only
        ? options.only.split(',').map((t: string) => t.trim() as RenderType)
        : ['all'];

      console.log(chalk.dim(`Input:      ${config.input}`));
      if (config.inputWide) {
        console.log(chalk.dim(`Input wide: ${config.inputWide}`));
      }
      console.log(chalk.dim(`Output:     ${config.output}\n`));

      // Generate assets
      const startTime = Date.now();
      const result = await generate(config, {
        only,
        metaTags: {
          siteUrl: options.siteUrl,
          twitterHandle: options.twitter,
        },
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Print results
      console.log(chalk.green('✓ Generated files:\n'));

      const categories: Record<string, string[]> = {
        'Favicons': result.files.filter((f) => f.includes('favicon')),
        'Apple Touch Icons': result.files.filter((f) => f.includes('apple')),
        'Android/PWA Icons': result.files.filter((f) => f.includes('android') || f.includes('maskable')),
        'Social Media': result.files.filter((f) => f.includes('og-') || f.includes('twitter')),
        'Configuration': result.files.filter((f) => f.endsWith('.json') || f.endsWith('.xml') || f.endsWith('.html')),
      };

      for (const [category, files] of Object.entries(categories)) {
        if (files.length > 0) {
          console.log(chalk.bold(`  ${category}:`));
          for (const file of files) {
            console.log(chalk.dim(`    • ${file}`));
          }
          console.log();
        }
      }

      console.log(chalk.dim(`Generated ${result.files.length} files in ${duration}s`));
      console.log(chalk.dim(`Output directory: ${result.outputDir}\n`));
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`\n✖ Error: ${error.message}\n`));
        if (error.message.includes('ENOENT')) {
          console.error(chalk.dim('Make sure the input SVG file exists.\n'));
        }
      } else {
        console.error(chalk.red('\n✖ An unexpected error occurred\n'));
      }
      process.exit(1);
    }
  });

// Image to SVG conversion command
program
  .command('convert')
  .description('Convert a PNG/JPEG image to SVG (vectorize)')
  .argument('<input>', 'Path to input image (PNG or JPEG)')
  .option('-O, --output <path>', 'Output SVG file path (defaults to input name with .svg extension)')
  .option('-b, --background <color>', 'Background color to remove (hex, e.g., #ffffff). Auto-detects if not specified.')
  .option('--tolerance <number>', 'Color tolerance for background removal (0-255)', '30')
  .option('--threshold <number>', 'Threshold for black/white conversion (0-255)', '128')
  .option('--colors <number>', 'Number of colors for posterization (2-256, use for multi-color logos)', '2')
  .option('--invert', 'Invert colors (useful for dark logos on light backgrounds)')
  .option('--turd-policy <policy>', 'Turd policy for tracing - how to resolve ambiguities (black, white, left, right, minority, majority)', 'minority')
  .option('--opt-tolerance <number>', 'Curve optimization tolerance (lower = sharper)', '0.1')
  .option('--turd-size <number>', 'Suppress speckles up to this size in pixels (lower = more detail)', '2')
  .option('--alpha-max <number>', 'Corner sharpness (0-1.33, lower = sharper corners)', '0.75')
  .option('--upscale <number>', 'Upscale factor before tracing for smoother curves (1-4)', '2')
  .action(async (input, options) => {
    console.log(chalk.bold('\n🎨 Image to SVG Conversion\n'));

    try {
      const inputPath = resolve(input);

      // Determine output path
      let outputPath: string;
      if (options.output) {
        outputPath = resolve(options.output);
      } else {
        const inputDir = dirname(inputPath);
        const inputName = basename(inputPath, /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.exec(inputPath)?.[0] || '');
        outputPath = join(inputDir, `${inputName}.svg`);
      }

      console.log(chalk.dim(`Input:  ${inputPath}`));
      console.log(chalk.dim(`Output: ${outputPath}\n`));

      // Build conversion options
      const convertOptions: ImageToSvgConfig = {
        ...defaultImageToSvgConfig,
        backgroundColor: options.background,
        colorTolerance: parseInt(options.tolerance, 10),
        threshold: parseInt(options.threshold, 10),
        colorCount: parseInt(options.colors, 10),
        invert: options.invert || false,
        turdPolicy: options.turdPolicy as ImageToSvgConfig['turdPolicy'],
        optTolerance: parseFloat(options.optTolerance),
        turdSize: parseInt(options.turdSize, 10),
        alphaMax: parseFloat(options.alphaMax),
        upscale: parseFloat(options.upscale),
      };

      console.log(chalk.dim('Processing...'));
      console.log(chalk.dim('  - Removing background'));
      console.log(chalk.dim('  - Trimming transparent space'));
      console.log(chalk.dim('  - Vectorizing image\n'));

      const startTime = Date.now();
      await processImageToSvg(inputPath, outputPath, convertOptions);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(chalk.green(`✓ SVG created successfully!`));
      console.log(chalk.dim(`  Output: ${outputPath}`));
      console.log(chalk.dim(`  Time: ${duration}s\n`));
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`\n✖ Error: ${error.message}\n`));
        if (error.message.includes('ENOENT')) {
          console.error(chalk.dim('Make sure the input image file exists.\n'));
        }
        if (error.message.includes('Input file is missing')) {
          console.error(chalk.dim('Supported formats: PNG, JPEG, GIF, WebP, BMP, TIFF\n'));
        }
      } else {
        console.error(chalk.red('\n✖ An unexpected error occurred\n'));
      }
      process.exit(1);
    }
  });

program.parse();
