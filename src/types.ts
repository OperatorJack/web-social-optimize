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
