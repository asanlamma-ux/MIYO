import type { ImageSourcePropType } from 'react-native';
import type { Theme } from '@/types/theme';

export type ThemeCategory = 'normal' | 'special';
export type ThemeEffectPackId = 'blossom' | 'coffee' | 'comfort' | 'matcha';
export type ThemeEffectVariant = 'splash' | 'loading' | 'auth' | 'card';

export interface ThemeEffectPack {
  id: ThemeEffectPackId;
  label: string;
  preview: ImageSourcePropType;
  hero: ImageSourcePropType;
  particles: readonly [ImageSourcePropType, ImageSourcePropType];
}

interface ThemeEffectProfile {
  normalLabel: string;
  specialLabel: string;
  splashCopy: string;
  loadingCopy: string;
  intenseCopy: string;
}

const PACKS: Record<ThemeEffectPackId, ThemeEffectPack> = {
  blossom: {
    id: 'blossom',
    label: 'Peach Blossom',
    preview: require('../assets/images/theme-effects/blossom-preview.png'),
    hero: require('../assets/images/theme-effects/blossom-hero.png'),
    particles: [
      require('../assets/images/theme-effects/blossom-particleA.png'),
      require('../assets/images/theme-effects/blossom-particleB.png'),
    ],
  },
  coffee: {
    id: 'coffee',
    label: 'Dark Coffee',
    preview: require('../assets/images/theme-effects/coffee-preview.png'),
    hero: require('../assets/images/theme-effects/coffee-hero.png'),
    particles: [
      require('../assets/images/theme-effects/coffee-particleA.png'),
      require('../assets/images/theme-effects/coffee-particleB.png'),
    ],
  },
  comfort: {
    id: 'comfort',
    label: 'Parchment Comfort',
    preview: require('../assets/images/theme-effects/comfort-preview.png'),
    hero: require('../assets/images/theme-effects/comfort-hero.png'),
    particles: [
      require('../assets/images/theme-effects/comfort-particleA.png'),
      require('../assets/images/theme-effects/comfort-particleB.png'),
    ],
  },
  matcha: {
    id: 'matcha',
    label: 'Matcha Paper',
    preview: require('../assets/images/theme-effects/matcha-preview.png'),
    hero: require('../assets/images/theme-effects/matcha-hero.png'),
    particles: [
      require('../assets/images/theme-effects/matcha-particleA.png'),
      require('../assets/images/theme-effects/matcha-particleB.png'),
    ],
  },
};

const PROFILES: Record<ThemeEffectPackId, ThemeEffectProfile> = {
  blossom: {
    normalLabel: 'Soft paper palette only',
    specialLabel: 'Petal ornaments and drifting blossom effects',
    splashCopy: 'Preparing a cherry blossom reading room',
    loadingCopy: 'Sweeping petals into place and restoring chapter ambience.',
    intenseCopy: 'VFX Boost adds denser falling petals and a fuller blossom veil.',
  },
  coffee: {
    normalLabel: 'Espresso palette only',
    specialLabel: 'Coffeehouse ornaments, steam drift, and darker loading art',
    splashCopy: 'Brewing a darker coffeehouse reading room',
    loadingCopy: 'Warming the espresso palette and preparing the next pour of chapters.',
    intenseCopy: 'VFX Boost deepens the cocoa glow and adds heavier steam motion.',
  },
  comfort: {
    normalLabel: 'Warm parchment palette only',
    specialLabel: 'Paper-grain ornaments and vellum dust effects',
    splashCopy: 'Setting a parchment comfort reading desk',
    loadingCopy: 'Settling vellum grain, highlights, and chapter markers.',
    intenseCopy: 'VFX Boost adds richer paper dust and warmer lamp-glow edges.',
  },
  matcha: {
    normalLabel: 'Matcha wash palette only',
    specialLabel: 'Tea-paper ornaments and soft botanical motion',
    splashCopy: 'Preparing a calm matcha paper reading room',
    loadingCopy: 'Laying out the tea-paper wash and restoring your place.',
    intenseCopy: 'VFX Boost adds denser tea flecks and a stronger paper bloom.',
  },
};

export function getThemeCategory(theme: Theme): ThemeCategory {
  return theme.category || (theme.effectPreset || theme.assetPackId ? 'special' : 'normal');
}

export function isSpecialTheme(theme: Theme): boolean {
  return getThemeCategory(theme) === 'special';
}

export function getThemeEffectPack(theme: Theme): ThemeEffectPack | null {
  const packId = (theme.assetPackId || theme.effectPreset) as ThemeEffectPackId | undefined;
  return packId ? PACKS[packId] || null : null;
}

export function getThemePerformanceHint(theme: Theme): string {
  return isSpecialTheme(theme)
    ? 'Decorative motion can be slightly heavier on older phones. Reduced Motion disables the ambient layer.'
    : 'Static palette only. No decorative motion.';
}

export function getBackdropParticleCount(
  variant: ThemeEffectVariant,
  options?: { intense?: boolean }
): number {
  let base = 0;
  switch (variant) {
    case 'splash':
      base = 8;
      break;
    case 'loading':
      base = 5;
      break;
    case 'auth':
      base = 4;
      break;
    case 'card':
      base = 0;
      break;
    default:
      base = 0;
  }
  if (!options?.intense) return base;
  return Math.min(base + (variant === 'splash' ? 5 : variant === 'loading' ? 3 : 2), 16);
}

export function getThemeUiSectionsCopy(theme: Theme): { normal: string; special: string } {
  const pack = getThemeEffectPack(theme);
  if (!pack) {
    return {
      normal: 'Normal UI themes keep the palette static for the lightest reading experience.',
      special: 'Special UI themes add artwork, themed loading surfaces, and optional ambient motion.',
    };
  }

  const profile = PROFILES[pack.id];
  return {
    normal: profile.normalLabel,
    special: profile.specialLabel,
  };
}

export function getThemeSceneCopy(
  theme: Theme,
  scene: 'splash' | 'loading',
  options?: { intense?: boolean }
): string {
  const pack = getThemeEffectPack(theme);
  if (!pack) {
    return scene === 'splash'
      ? 'Opening your reading library'
      : 'Preparing chapters, highlights, and reading position.';
  }
  const profile = PROFILES[pack.id];
  if (scene === 'splash') return profile.splashCopy;
  return options?.intense ? profile.intenseCopy : profile.loadingCopy;
}
