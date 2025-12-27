import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { Config } from '../types.js';

export interface ManifestOptions {
  name?: string;
  shortName?: string;
  description?: string;
  startUrl?: string;
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
}

export async function generateManifest(
  config: Config,
  options: ManifestOptions = {}
): Promise<string> {
  const {
    name = config.social.title || 'My App',
    shortName = config.social.title || 'App',
    description = config.social.tagline || '',
    startUrl = '/',
    display = 'standalone',
  } = options;

  const manifest = {
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    display,
    background_color: config.background,
    theme_color: config.theme,
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  const content = JSON.stringify(manifest, null, 2);
  await writeFile(join(config.output, 'manifest.json'), content);

  return 'manifest.json';
}
