import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import JSZip from 'jszip';
import type { DictionaryEntry, DictionaryManifest, DownloadedDictionary } from '@/types/dictionary';

const DICTIONARY_PACKAGE_MAGIC = 'MIYO_DICTIONARY_V1';

type DictionaryPackageFile =
  | DownloadedDictionary
  | {
      magic?: string;
      manifest?: Partial<DictionaryManifest>;
      entries?: unknown[];
    };

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function sanitizeEntry(input: any): DictionaryEntry | null {
  if (!input) return null;
  const term = String(input.term || '').trim().slice(0, 120);
  const definition = String(input.definition || '').trim().slice(0, 1200);
  if (!term || !definition) return null;

  const aliases = Array.isArray(input.aliases)
    ? input.aliases.map((alias: unknown) => String(alias).trim()).filter(Boolean).slice(0, 12)
    : undefined;

  return {
    term,
    definition,
    partOfSpeech: input.partOfSpeech ? String(input.partOfSpeech).trim().slice(0, 40) : undefined,
    example: input.example ? String(input.example).trim().slice(0, 280) : undefined,
    aliases,
    source: input.source ? String(input.source).trim().slice(0, 120) : undefined,
  };
}

function normalizeDictionaryPackage(
  raw: DictionaryPackageFile,
  source: { packageUrl?: string; packageSizeBytes?: number }
): DownloadedDictionary {
  const manifest = 'manifest' in raw && raw.manifest ? raw.manifest : raw;
  const rawEntries = Array.isArray((raw as any).entries) ? ((raw as any).entries as unknown[]) : [];
  const entries = rawEntries.map(sanitizeEntry).filter(Boolean) as DictionaryEntry[];

  const name = String((manifest as any).name || 'Imported Dictionary').trim().slice(0, 120);
  const id = String((manifest as any).id || slugify(name) || `dictionary-${Date.now()}`);
  const language = String((manifest as any).language || 'en').trim().slice(0, 16);
  const version = String((manifest as any).version || '1.0.0').trim().slice(0, 24);
  const tags = Array.isArray((manifest as any).tags)
    ? (manifest as any).tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 16)
    : [];

  if (!entries.length) {
    throw new Error('This dictionary package does not contain any valid entries.');
  }

  return {
    id,
    name,
    description: (manifest as any).description ? String((manifest as any).description).trim().slice(0, 400) : undefined,
    language,
    version,
    tags,
    entriesCount: entries.length,
    downloadCount: Number((manifest as any).downloadCount || (manifest as any).download_count || 0) || 0,
    attribution: (manifest as any).attribution ? String((manifest as any).attribution).trim().slice(0, 160) : undefined,
    sourceUrl: (manifest as any).sourceUrl ? String((manifest as any).sourceUrl).trim().slice(0, 400) : source.packageUrl,
    packageUrl: source.packageUrl,
    packageSizeBytes: source.packageSizeBytes,
    downloadedAt: new Date().toISOString(),
    entries,
  };
}

function parseDictionaryJson(text: string, source: { packageUrl?: string; packageSizeBytes?: number }) {
  let parsed: DictionaryPackageFile;
  try {
    parsed = JSON.parse(text) as DictionaryPackageFile;
  } catch {
    throw new Error('The dictionary package is not valid JSON.');
  }

  if ('magic' in parsed && parsed.magic && parsed.magic !== DICTIONARY_PACKAGE_MAGIC) {
    throw new Error('This file is not a supported Miyo dictionary package.');
  }

  return normalizeDictionaryPackage(parsed, source);
}

async function parseDictionaryZip(buffer: ArrayBuffer, source: { packageUrl?: string; packageSizeBytes?: number }) {
  const zip = await JSZip.loadAsync(buffer);
  const preferredEntry =
    zip.file('dictionary.json') ||
    zip.file('package.json') ||
    Object.values(zip.files).find(file => !file.dir && file.name.toLowerCase().endsWith('.json'));

  if (!preferredEntry) {
    throw new Error('The ZIP file does not include a dictionary JSON payload.');
  }

  const text = await preferredEntry.async('text');
  return parseDictionaryJson(text, source);
}

export async function importDictionaryPackageFromUrl(url: string): Promise<DownloadedDictionary> {
  const normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('Enter a full dictionary package URL starting with http:// or https://');
  }

  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error(`Dictionary download failed (${response.status}).`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const packageSizeBytes = Number(response.headers.get('content-length') || 0) || undefined;

  if (contentType.includes('zip') || normalized.toLowerCase().endsWith('.zip')) {
    const buffer = await response.arrayBuffer();
    return parseDictionaryZip(buffer, { packageUrl: normalized, packageSizeBytes });
  }

  const text = await response.text();
  return parseDictionaryJson(text, { packageUrl: normalized, packageSizeBytes });
}

export async function importDictionaryPackageFromFile(): Promise<DownloadedDictionary | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/zip', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const lowerName = (asset.name || asset.uri || '').toLowerCase();
  const packageSizeBytes = asset.size || undefined;

  if (lowerName.endsWith('.zip')) {
    const base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const preferredEntry =
      zip.file('dictionary.json') ||
      zip.file('package.json') ||
      Object.values(zip.files).find(file => !file.dir && file.name.toLowerCase().endsWith('.json'));

    if (!preferredEntry) {
      throw new Error('The selected ZIP file does not contain a supported dictionary package.');
    }

    const text = await preferredEntry.async('text');
    return parseDictionaryJson(text, { packageSizeBytes });
  }

  const text = await readAsStringAsync(asset.uri);
  return parseDictionaryJson(text, { packageSizeBytes });
}
