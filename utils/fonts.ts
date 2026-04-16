/**
 * Centralized font configuration for Miyo.
 * Native UI uses stable internal family IDs so Android does not drop fonts that
 * contain spaces in their family names. The reader WebView resolves the same
 * bundled assets into local @font-face rules for offline rendering.
 */

import { Asset } from 'expo-asset';
import { Newsreader_400Regular, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { CrimsonPro_400Regular, CrimsonPro_600SemiBold } from '@expo-google-fonts/crimson-pro';
import { Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Merriweather_400Regular, Merriweather_700Bold } from '@expo-google-fonts/merriweather';
import { OpenSans_400Regular, OpenSans_600SemiBold } from '@expo-google-fonts/open-sans';

export interface FontOption {
  label: string;
  value: string;
  webStack: string;
  isSerif: boolean;
}

interface WebFontSource {
  moduleId: number;
  weight: number;
  style?: 'normal' | 'italic';
  familyOverride?: string;
}

interface InternalFontOption extends FontOption {
  nativeFamily: string | null;
  legacyAliases?: string[];
  webSources?: WebFontSource[];
}

const CODE_FONT_FAMILY = 'MiyoJetBrainsMono';
const SYSTEM_FONT_VALUE = 'system';

const internalFontOptions: InternalFontOption[] = [
  {
    label: 'System Default',
    value: SYSTEM_FONT_VALUE,
    nativeFamily: null,
    webStack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    isSerif: false,
    legacyAliases: ['System'],
  },
  {
    label: 'Newsreader',
    value: 'newsreader',
    nativeFamily: 'MiyoNewsreader',
    webStack: '"MiyoNewsreader", "Newsreader", "Times New Roman", Georgia, serif',
    isSerif: true,
    legacyAliases: ['Newsreader'],
    webSources: [
      { moduleId: Newsreader_400Regular, weight: 400 },
      { moduleId: Newsreader_600SemiBold, weight: 600 },
    ],
  },
  {
    label: 'Crimson Pro',
    value: 'crimson-pro',
    nativeFamily: 'MiyoCrimsonPro',
    webStack: '"MiyoCrimsonPro", "Crimson Pro", "Times New Roman", Georgia, serif',
    isSerif: true,
    legacyAliases: ['Crimson Pro'],
    webSources: [
      { moduleId: CrimsonPro_400Regular, weight: 400 },
      { moduleId: CrimsonPro_600SemiBold, weight: 600 },
    ],
  },
  {
    label: 'Lora',
    value: 'lora',
    nativeFamily: 'MiyoLora',
    webStack: '"MiyoLora", "Lora", "Times New Roman", Georgia, serif',
    isSerif: true,
    legacyAliases: ['Lora'],
    webSources: [
      { moduleId: Lora_400Regular, weight: 400 },
      { moduleId: Lora_700Bold, weight: 700 },
    ],
  },
  {
    label: 'IBM Plex Sans',
    value: 'ibm-plex-sans',
    nativeFamily: 'MiyoIBMPlexSans',
    webStack: '"MiyoIBMPlexSans", "IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
    isSerif: false,
    legacyAliases: ['IBM Plex Sans'],
    webSources: [
      { moduleId: IBMPlexSans_400Regular, weight: 400 },
      { moduleId: IBMPlexSans_600SemiBold, weight: 600 },
    ],
  },
  {
    label: 'JetBrains Mono',
    value: 'jetbrains-mono',
    nativeFamily: CODE_FONT_FAMILY,
    webStack: `"${CODE_FONT_FAMILY}", "JetBrains Mono", "Courier New", Courier, monospace`,
    isSerif: false,
    legacyAliases: ['JetBrains Mono'],
    webSources: [
      { moduleId: JetBrainsMono_400Regular, weight: 400, familyOverride: CODE_FONT_FAMILY },
      { moduleId: JetBrainsMono_500Medium, weight: 500, familyOverride: CODE_FONT_FAMILY },
    ],
  },
  {
    label: 'Merriweather',
    value: 'merriweather',
    nativeFamily: 'MiyoMerriweather',
    webStack: '"MiyoMerriweather", "Merriweather", Georgia, "Times New Roman", serif',
    isSerif: true,
    legacyAliases: ['Merriweather'],
    webSources: [
      { moduleId: Merriweather_400Regular, weight: 400 },
      { moduleId: Merriweather_700Bold, weight: 700 },
    ],
  },
  {
    label: 'Open Sans',
    value: 'open-sans',
    nativeFamily: 'MiyoOpenSans',
    webStack: '"MiyoOpenSans", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
    isSerif: false,
    legacyAliases: ['Open Sans'],
    webSources: [
      { moduleId: OpenSans_400Regular, weight: 400 },
      { moduleId: OpenSans_600SemiBold, weight: 600 },
    ],
  },
];

const fontAliasMap = new Map<string, string>();
for (const option of internalFontOptions) {
  fontAliasMap.set(option.value.toLowerCase(), option.value);
  option.legacyAliases?.forEach(alias => fontAliasMap.set(alias.toLowerCase(), option.value));
  if (option.nativeFamily) {
    fontAliasMap.set(option.nativeFamily.toLowerCase(), option.value);
  }
}

export const nativeFontLoadMap = {
  MiyoNewsreader: Newsreader_400Regular,
  MiyoCrimsonPro: CrimsonPro_400Regular,
  MiyoLora: Lora_400Regular,
  MiyoIBMPlexSans: IBMPlexSans_400Regular,
  [CODE_FONT_FAMILY]: JetBrainsMono_400Regular,
  MiyoMerriweather: Merriweather_400Regular,
  MiyoOpenSans: OpenSans_400Regular,
};

export const fontOptions: FontOption[] = internalFontOptions.map(({ label, value, webStack, isSerif }) => ({
  label,
  value,
  webStack,
  isSerif,
}));

function getFontOption(fontValue: string): InternalFontOption | undefined {
  return internalFontOptions.find(font => font.value === normalizeFontValue(fontValue));
}

export function normalizeFontValue(fontValue: string | null | undefined): string {
  if (!fontValue) return SYSTEM_FONT_VALUE;
  return fontAliasMap.get(fontValue.trim().toLowerCase()) || SYSTEM_FONT_VALUE;
}

export function isSystemFontValue(fontValue: string | null | undefined): boolean {
  return normalizeFontValue(fontValue) === SYSTEM_FONT_VALUE;
}

export function getNativeFontFamily(fontValue: string | null | undefined): string | undefined {
  return getFontOption(normalizeFontValue(fontValue))?.nativeFamily || undefined;
}

export function getFontStack(fontValue: string): string {
  return getFontOption(fontValue)?.webStack || internalFontOptions[0].webStack;
}

async function resolveAssetUri(moduleId: number): Promise<string | null> {
  try {
    const asset = Asset.fromModule(moduleId);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    return asset.localUri || asset.uri || null;
  } catch {
    return null;
  }
}

function buildFontFaceRule(fontFamily: string, uri: string, weight: number, style: 'normal' | 'italic' = 'normal') {
  return `@font-face { font-family: "${fontFamily}"; src: url("${uri}") format("truetype"); font-style: ${style}; font-weight: ${weight}; font-display: swap; }`;
}

export async function getLocalFontFaceCss(fontValue: string): Promise<string> {
  const selected = getFontOption(fontValue);
  const codeFontSources =
    internalFontOptions.find(font => font.value === 'jetbrains-mono')?.webSources?.filter(
      source => source.familyOverride === CODE_FONT_FAMILY && selected?.value !== 'jetbrains-mono'
    ) || [];
  const sources = [
    ...(selected?.webSources || []),
    ...codeFontSources,
  ];

  const rules = await Promise.all(
    sources.map(async source => {
      const uri = await resolveAssetUri(source.moduleId);
      if (!uri) return '';
      const family = source.familyOverride || selected?.nativeFamily || SYSTEM_FONT_VALUE;
      return buildFontFaceRule(family, uri, source.weight, source.style || 'normal');
    })
  );

  return rules.filter(Boolean).join('\n');
}
