import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { Config } from '../types.js';

export async function generateBrowserconfig(config: Config): Promise<string> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/android-chrome-192x192.png"/>
      <TileColor>${config.theme}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;

  await writeFile(join(config.output, 'browserconfig.xml'), xml);

  return 'browserconfig.xml';
}
