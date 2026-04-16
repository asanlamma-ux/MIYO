export interface DictionaryEntry {
  term: string;
  definition: string;
  partOfSpeech?: string;
  example?: string;
  aliases?: string[];
  source?: string;
}

export interface DictionaryManifest {
  id: string;
  name: string;
  description?: string;
  language: string;
  version: string;
  tags: string[];
  entriesCount: number;
  downloadCount: number;
  attribution?: string;
  sourceUrl?: string;
  packageUrl?: string;
  packageSizeBytes?: number;
}

export interface DownloadedDictionary extends DictionaryManifest {
  downloadedAt: string;
  entries: DictionaryEntry[];
}

export interface DictionaryLookupResult {
  source: 'offline' | 'online';
  word: string;
  dictionaryName: string;
  entries: DictionaryEntry[];
  sourceUrl?: string;
}
