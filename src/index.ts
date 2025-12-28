#!/usr/bin/env node

import { program } from 'commander';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import chalk from 'chalk';
import { generate } from './generator.js';
import { defaultConfig, type Config, type RenderType } from './types.js';

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

program.parse();
