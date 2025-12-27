import sharp from 'sharp';

export interface TextOverlayOptions {
  text: string;
  fontSize: number;
  color: string;
  font?: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

export function createTextSvg(options: TextOverlayOptions): Buffer {
  const { text, fontSize, color, font = 'sans-serif', width, align = 'center' } = options;

  const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const x = align === 'left' ? 0 : align === 'right' ? width : width / 2;

  const svg = `
    <svg width="${width}" height="${fontSize * 1.5}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${x}"
        y="${fontSize}"
        font-family="${font}"
        font-size="${fontSize}px"
        font-weight="bold"
        fill="${color}"
        text-anchor="${textAnchor}"
      >${escapeXml(text)}</text>
    </svg>
  `;

  return Buffer.from(svg);
}

export async function addTextToImage(
  imageBuffer: Buffer,
  texts: Array<{
    text: string;
    fontSize: number;
    color: string;
    font?: string;
    y: number;
    align?: 'left' | 'center' | 'right';
  }>,
  imageWidth: number
): Promise<Buffer> {
  const composites = await Promise.all(
    texts
      .filter((t) => t.text && t.text.trim() !== '')
      .map(async (textConfig) => {
        const textSvg = createTextSvg({
          text: textConfig.text,
          fontSize: textConfig.fontSize,
          color: textConfig.color,
          font: textConfig.font,
          width: imageWidth - 100,
          align: textConfig.align || 'center',
        });

        return {
          input: textSvg,
          top: Math.round(textConfig.y),
          left: 50,
        };
      })
  );

  if (composites.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(composites).png().toBuffer();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
