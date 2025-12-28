export interface Config {
  input: string;
  inputWide?: string;
  output: string;
  background: string;
  theme: string;
  social: SocialConfig;
  padding: PaddingConfig;
}

export interface SocialConfig {
  title?: string;
  tagline?: string;
  font?: string;
  titleSize?: number;
  taglineSize?: number;
  titleColor?: string;
  taglineColor?: string;
}

export interface PaddingConfig {
  favicon: number;
  social: number;
  apple: number;
  android: number;
}

export const defaultConfig: Config = {
  input: './logo.svg',
  output: './assets',
  background: '#ffffff',
  theme: '#1a73e8',
  social: {
    title: '',
    tagline: '',
    font: 'sans-serif',
    titleSize: 64,
    taglineSize: 32,
    titleColor: '#1a1a1a',
    taglineColor: '#666666',
  },
  padding: {
    favicon: 0.1,
    social: 0.15,
    apple: 0.1,
    android: 0.1,
  },
};

export type RenderType = 'favicons' | 'apple' | 'android' | 'social' | 'all';

export interface ImageToSvgConfig {
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
  /** Turd policy for potrace tracing (how to resolve ambiguities) */
  turdPolicy?: 'black' | 'white' | 'left' | 'right' | 'minority' | 'majority';
  /** Curve optimization tolerance. Lower = more accurate curves. Default: 0.1 */
  optTolerance?: number;
  /** Suppress speckles of up to this many pixels. Lower = more detail. Default: 2 */
  turdSize?: number;
  /** Corner threshold (0 to 1.33). Lower = sharper corners. Default: 0.75 */
  alphaMax?: number;
  /** Upscale factor before tracing for smoother curves. Default: 2 */
  upscale?: number;
}

export const defaultImageToSvgConfig: ImageToSvgConfig = {
  colorTolerance: 30,
  invert: false,
  threshold: 128,
  colorCount: 2,
  turdPolicy: 'minority',
  optTolerance: 0.1,
  turdSize: 2,
  alphaMax: 0.75,
  upscale: 2,
};
