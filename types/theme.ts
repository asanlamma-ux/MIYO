export interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  secondaryText: string;
  cardBackground: string;
  isDark: boolean;
  isCustom?: boolean;
  category?: 'normal' | 'special';
  effectPreset?: 'blossom' | 'coffee' | 'comfort' | 'matcha';
  assetPackId?: 'blossom' | 'coffee' | 'comfort' | 'matcha';
  performanceHint?: 'standard' | 'decorative';
}

export type ThemeMode = 'light' | 'dark';

export type BodyFontWeight = 400 | 500 | 600 | 700;

export interface TypographySettings {
  fontFamily: string;
  fontSize: number; // 12-28
  lineHeight: number; // 1.2-2.0
  letterSpacing: number; // -0.05 to 0.2
  paragraphSpacing: number;
  textAlign: 'left' | 'justify';
  /** Body text weight (Koodo-style typography control) */
  fontWeight: BodyFontWeight;
}

export type MarginPreset = 'narrow' | 'medium' | 'wide';

/** Max content column width in CSS px (null = full width, like Koodo “spread”) */
export type ContentColumnWidth = null | 560 | 640 | 720 | 840;

/** CSS columns for spread-style reading (narrow viewports fall back to one column in reader CSS). */
export type ReaderColumnLayout = 'single' | 'two';

/** Left/right taps and horizontal swipes: scroll the page vs change chapter */
export type TapZoneNavMode = 'scroll' | 'chapter';

export interface ReadingSettings {
  pageAnimation: 'slide' | 'fade' | 'curl';
  tapZonesEnabled: boolean;
  /** Portion of viewport to scroll per tap/swipe when mode is scroll */
  tapScrollPageRatio: number;
  tapZoneNavMode: TapZoneNavMode;
  volumeButtonPageTurn: boolean;
  autoScrollSpeed: number;
  immersiveMode: boolean;
  brightnessOverride: number | null;
  blueLightFilter: boolean;
  reducedMotion: boolean;
  /** Horizontal padding feel */
  marginPreset: MarginPreset;
  /** Reading column width */
  contentColumnWidth: ContentColumnWidth;
  /** Multi-column body text (magazine-style on wide screens) */
  columnLayout: ReaderColumnLayout;
  /** Bionic / “fast reading” — emphasize word beginnings */
  bionicReading: boolean;
  /** Keep display awake while reader is open */
  keepScreenOn: boolean;
  /** Auto-translation mode (requires login) */
  autoTranslationMode: 'off' | 'normal' | 'advanced';
  /** 0 = off; otherwise minutes until sleep reminder (optional exit) */
  sleepTimerMinutes: number;
  /** When true, reaching the end of a chapter scroll loads the next chapter */
  autoAdvanceChapter: boolean;
  /** Keep special theme ornaments and decorative UI enabled */
  specialThemeUiEnabled: boolean;
  /** Heavier decorative VFX mode for special themes */
  specialThemeVfxBoost: boolean;
}

export const defaultThemes: Theme[] = [
  {
    id: 'sepia-classic',
    name: 'Sepia Classic',
    background: '#F4EFE8',
    text: '#3A3228',
    accent: '#8B6F47',
    secondaryText: '#6B5D4D',
    cardBackground: '#FFFBF5',
    isDark: false,
  },
  {
    id: 'night-mode',
    name: 'Night Mode',
    background: '#1A1A1A',
    text: '#E8E6E3',
    accent: '#A78BFA',
    secondaryText: '#9CA3AF',
    cardBackground: '#242424',
    isDark: true,
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    background: '#E8F0E8',
    text: '#2D3E2D',
    accent: '#4A7C59',
    secondaryText: '#4D6B4D',
    cardBackground: '#F0F5F0',
    isDark: false,
  },
  {
    id: 'lavender-dream',
    name: 'Lavender Dream',
    background: '#F0EBF4',
    text: '#3E3548',
    accent: '#9B7EBD',
    secondaryText: '#6B5E78',
    cardBackground: '#F8F4FB',
    isDark: false,
  },
  {
    id: 'midnight-oled',
    name: 'Midnight OLED',
    background: '#000000',
    text: '#CCCCCC',
    accent: '#00D9FF',
    secondaryText: '#888888',
    cardBackground: '#0A0A0A',
    isDark: true,
  },
  {
    id: 'parchment',
    name: 'Parchment Comfort',
    background: '#FFFBF5',
    text: '#2C2416',
    accent: '#9D7651',
    secondaryText: '#5C4D3A',
    cardBackground: '#FFF8F0',
    isDark: false,
    category: 'special',
    effectPreset: 'comfort',
    assetPackId: 'comfort',
    performanceHint: 'decorative',
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    background: '#F5F5F5',
    text: '#1A1A1A',
    accent: '#666666',
    secondaryText: '#4A4A4A',
    cardBackground: '#FFFFFF',
    isDark: false,
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    background: '#E8F1F5',
    text: '#1E3A4C',
    accent: '#2D7D9A',
    secondaryText: '#4A6B7C',
    cardBackground: '#F0F7FA',
    isDark: false,
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    background: '#FFF5ED',
    text: '#4A2C1A',
    accent: '#D97706',
    secondaryText: '#7A5C4A',
    cardBackground: '#FFFAF5',
    isDark: false,
  },
  {
    id: 'nordic-night',
    name: 'Nordic Night',
    background: '#1E2430',
    text: '#D8DEE9',
    accent: '#88C0D0',
    secondaryText: '#8FBCBB',
    cardBackground: '#2E3440',
    isDark: true,
  },
  {
    id: 'rose-garden',
    name: 'Peach Blossom',
    background: '#FDF2F4',
    text: '#4A2832',
    accent: '#D4687A',
    secondaryText: '#7A4A58',
    cardBackground: '#FFF8F9',
    isDark: false,
    category: 'special',
    effectPreset: 'blossom',
    assetPackId: 'blossom',
    performanceHint: 'decorative',
  },
  {
    id: 'dark-coffee',
    name: 'Dark Coffee',
    background: '#1C1816',
    text: '#E5DDD5',
    accent: '#C4A77D',
    secondaryText: '#A89888',
    cardBackground: '#2A2420',
    isDark: true,
    category: 'special',
    effectPreset: 'coffee',
    assetPackId: 'coffee',
    performanceHint: 'decorative',
  },
  {
    id: 'matcha-paper',
    name: 'Matcha Paper',
    background: '#EEF5E8',
    text: '#263628',
    accent: '#5E8B4A',
    secondaryText: '#58705A',
    cardBackground: '#F8FCF5',
    isDark: false,
    category: 'special',
    effectPreset: 'matcha',
    assetPackId: 'matcha',
    performanceHint: 'decorative',
  },
  {
    id: 'ink-stone',
    name: 'Ink Stone',
    background: '#171A1F',
    text: '#E7E3DA',
    accent: '#C28C4C',
    secondaryText: '#9A958B',
    cardBackground: '#20242A',
    isDark: true,
  },
  {
    id: 'blueprint-day',
    name: 'Blueprint Day',
    background: '#EEF4FA',
    text: '#203246',
    accent: '#3A78B8',
    secondaryText: '#5D7387',
    cardBackground: '#F8FBFE',
    isDark: false,
  },
  {
    id: 'ember-night',
    name: 'Ember Night',
    background: '#151313',
    text: '#F0E5DC',
    accent: '#E07A3F',
    secondaryText: '#B1A197',
    cardBackground: '#201B1A',
    isDark: true,
  },
];

export const defaultTypography: TypographySettings = {
  fontFamily: 'system',
  fontSize: 18,
  lineHeight: 1.6,
  letterSpacing: 0,
  paragraphSpacing: 16,
  textAlign: 'left',
  fontWeight: 400,
};

export const defaultReadingSettings: ReadingSettings = {
  pageAnimation: 'slide',
  tapZonesEnabled: true,
  tapScrollPageRatio: 0.82,
  tapZoneNavMode: 'scroll',
  volumeButtonPageTurn: false,
  autoScrollSpeed: 0,
  immersiveMode: true,
  brightnessOverride: null,
  blueLightFilter: false,
  reducedMotion: false,
  marginPreset: 'medium',
  contentColumnWidth: 720,
  columnLayout: 'single',
  bionicReading: false,
  keepScreenOn: true,
  autoTranslationMode: 'off',
  sleepTimerMinutes: 0,
  autoAdvanceChapter: true,
  specialThemeUiEnabled: true,
  specialThemeVfxBoost: false,
};

export { fontOptions } from '@/utils/fonts';
