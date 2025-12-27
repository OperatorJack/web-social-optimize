import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { Config } from '../types.js';

export interface MetaTagsOptions {
  siteUrl?: string;
  siteName?: string;
  twitterHandle?: string;
}

export async function generateMetaTags(
  config: Config,
  options: MetaTagsOptions = {}
): Promise<string> {
  const { siteUrl = 'https://example.com', siteName = config.social.title || 'My Site', twitterHandle } = options;

  const title = config.social.title || 'My Site';
  const description = config.social.tagline || '';

  const html = `<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png">
<link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png">

<!-- Android / PWA -->
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="${config.theme}">

<!-- MS Tiles -->
<meta name="msapplication-TileColor" content="${config.theme}">
<meta name="msapplication-config" content="/browserconfig.xml">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="${siteUrl}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${siteUrl}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${escapeHtml(siteName)}">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="${siteUrl}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${siteUrl}/twitter-card-large.png">${
    twitterHandle
      ? `
<meta name="twitter:site" content="${twitterHandle}">
<meta name="twitter:creator" content="${twitterHandle}">`
      : ''
  }
`;

  await writeFile(join(config.output, 'meta-tags.html'), html);

  return 'meta-tags.html';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
