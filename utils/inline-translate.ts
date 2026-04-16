/**
 * Client-side translation without leaving the app (MyMemory free tier).
 * Rate-limited; suitable for short selections. Falls back gracefully on error.
 */

import { logger } from '@/utils/logger';

const MAX_CHARS = 450;

export interface InlineTranslateResult {
  translatedText: string;
  detectedLang?: string;
}

function sanitizeForRequest(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

/**
 * Translate text to a target language (ISO code, e.g. "en", "es").
 * Uses MyMemory public API — no API key; do not send sensitive content.
 */
export async function translateTextFree(
  text: string,
  targetLang: string = 'en'
): Promise<InlineTranslateResult> {
  const q = sanitizeForRequest(text);
  if (!q) {
    return { translatedText: '' };
  }

  const pair = `Autodetect|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(pair)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    const out = json.responseData?.translatedText?.trim();
    if (!out) {
      throw new Error('Empty translation');
    }
    return { translatedText: out };
  } catch (e) {
    logger.warn('Inline translate failed', { e });
    throw e;
  } finally {
    clearTimeout(t);
  }
}
