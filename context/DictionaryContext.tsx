import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { DictionaryEntry, DictionaryLookupResult, DictionaryManifest, DownloadedDictionary } from '@/types/dictionary';
import { captureError, logger } from '@/utils/logger';
import { DEFAULT_DICTIONARY_PACKS } from '@/data/default-dictionaries';
import { importDictionaryPackageFromFile, importDictionaryPackageFromUrl } from '@/utils/dictionary-package';

const DICTIONARY_STORAGE_KEY = '@miyo/downloaded-dictionaries';

interface DictionaryContextType {
  downloadedDictionaries: DownloadedDictionary[];
  isLoading: boolean;
  fetchAvailableDictionaries: () => Promise<DictionaryManifest[]>;
  downloadDictionary: (dictionaryId: string) => Promise<boolean>;
  importDictionaryFromUrl: (url: string) => Promise<{ success: boolean; error: string | null }>;
  importDictionaryFromFile: () => Promise<{ success: boolean; error: string | null }>;
  removeDictionary: (dictionaryId: string) => Promise<void>;
  lookupWord: (word: string) => Promise<DictionaryLookupResult | null>;
}

const DictionaryContext = createContext<DictionaryContextType | undefined>(undefined);

function normalizeWord(value: string): string {
  return value.trim().toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function mapManifestRow(row: any): DictionaryManifest {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    language: row.language || 'en',
    version: row.version || '1.0.0',
    tags: row.tags || [],
    entriesCount: row.entries_count || (row.entries?.length ?? 0),
    downloadCount: row.download_count || 0,
    attribution: row.attribution || undefined,
    sourceUrl: row.source_url || row.sourceUrl || undefined,
    packageUrl: row.package_url || row.packageUrl || undefined,
    packageSizeBytes: row.package_size_bytes || row.packageSizeBytes || undefined,
  };
}

function mapLocalManifest(dictionary: DownloadedDictionary): DictionaryManifest {
  return {
    id: dictionary.id,
    name: dictionary.name,
    description: dictionary.description,
    language: dictionary.language,
    version: dictionary.version,
    tags: dictionary.tags,
    entriesCount: dictionary.entriesCount,
    downloadCount: dictionary.downloadCount,
    attribution: dictionary.attribution,
    sourceUrl: dictionary.sourceUrl,
    packageUrl: dictionary.packageUrl,
    packageSizeBytes: dictionary.packageSizeBytes,
  };
}

function findOfflineEntries(word: string, dictionaries: DownloadedDictionary[]): DictionaryLookupResult | null {
  const normalized = normalizeWord(word);
  if (!normalized) return null;

  const matches: DictionaryEntry[] = [];
  const sourceNames = new Set<string>();

  for (const dictionary of dictionaries) {
    const entries = dictionary.entries.filter(entry => {
      const candidates = [entry.term, ...(entry.aliases || [])].map(normalizeWord);
      return candidates.includes(normalized);
    });

    if (entries.length > 0) {
      entries.forEach(entry => matches.push(entry));
      sourceNames.add(dictionary.name);
    }
  }

  if (!matches.length) return null;

  return {
    source: 'offline',
    word,
    dictionaryName: Array.from(sourceNames).join(', '),
    entries: matches,
  };
}

async function fetchOnlineDefinition(word: string): Promise<DictionaryLookupResult | null> {
  const normalized = normalizeWord(word);
  if (!normalized) return null;

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as any[];
    const entries: DictionaryEntry[] = [];
    for (const item of payload || []) {
      for (const meaning of item.meanings || []) {
        for (const definition of meaning.definitions || []) {
          if (!definition.definition) continue;
          entries.push({
            term: item.word || normalized,
            definition: definition.definition,
            partOfSpeech: meaning.partOfSpeech,
            example: definition.example,
            source: 'dictionaryapi.dev',
          });
        }
      }
    }

    if (!entries.length) return null;

    return {
      source: 'online',
      word: normalized,
      dictionaryName: 'Online Dictionary',
      entries,
      sourceUrl: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`,
    };
  } catch {
    return null;
  }
}

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const [downloadedDictionaries, setDownloadedDictionaries] = useState<DownloadedDictionary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DICTIONARY_STORAGE_KEY);
        if (raw) {
          setDownloadedDictionaries(JSON.parse(raw));
        }
      } catch (error) {
        captureError('Load Dictionaries', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: DownloadedDictionary[]) => {
    setDownloadedDictionaries(next);
    await AsyncStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const upsertDictionary = useCallback(async (dictionary: DownloadedDictionary) => {
    const next = [
      ...downloadedDictionaries.filter(item => item.id !== dictionary.id),
      dictionary,
    ];
    await persist(next);
  }, [downloadedDictionaries, persist]);

  const fetchAvailableDictionaries = useCallback(async (): Promise<DictionaryManifest[]> => {
    const { data, error } = await supabase
      .from('community_dictionaries')
      .select('id, name, description, language, version, tags, entries_count, download_count, attribution, source_url, package_url, package_size_bytes')
      .order('download_count', { ascending: false });

    if (error) {
      logger.warn('Failed to fetch available dictionaries', error);
      return DEFAULT_DICTIONARY_PACKS.map(mapLocalManifest);
    }

    const remote = (data || []).map(mapManifestRow);
    const merged = [...DEFAULT_DICTIONARY_PACKS.map(mapLocalManifest)];
    remote.forEach(dictionary => {
      if (!merged.some(item => item.id === dictionary.id)) {
        merged.push(dictionary);
      }
    });
    return merged;
  }, []);

  const downloadDictionary = useCallback(async (dictionaryId: string): Promise<boolean> => {
    try {
      const local = DEFAULT_DICTIONARY_PACKS.find(dictionary => dictionary.id === dictionaryId);
      if (local) {
        await upsertDictionary({ ...local, downloadedAt: new Date().toISOString() });
        return true;
      }

      const { data, error } = await supabase
        .from('community_dictionaries')
        .select('*')
        .eq('id', dictionaryId)
        .single();

      if (error || !data) {
        logger.warn('Failed to download dictionary package', error);
        return false;
      }

      const manifest = mapManifestRow(data);
      const downloaded: DownloadedDictionary = {
        ...manifest,
        downloadedAt: new Date().toISOString(),
        entries: data.entries || [],
      };

      await upsertDictionary(downloaded);

      await supabase
        .from('community_dictionaries')
        .update({ download_count: (data.download_count || 0) + 1 })
        .eq('id', dictionaryId);

      return true;
    } catch (error) {
      captureError('Download Dictionary', error);
      return false;
    }
  }, [upsertDictionary]);

  const importDictionaryFromUrl = useCallback(async (url: string) => {
    try {
      const imported = await importDictionaryPackageFromUrl(url);
      await upsertDictionary(imported);
      return { success: true, error: null };
    } catch (error) {
      captureError('Import Dictionary From URL', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to import this dictionary package.' };
    }
  }, [upsertDictionary]);

  const importDictionaryFromFile = useCallback(async () => {
    try {
      const imported = await importDictionaryPackageFromFile();
      if (!imported) {
        return { success: false, error: null };
      }
      await upsertDictionary(imported);
      return { success: true, error: null };
    } catch (error) {
      captureError('Import Dictionary From File', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to import this dictionary file.' };
    }
  }, [upsertDictionary]);

  const removeDictionary = useCallback(async (dictionaryId: string) => {
    await persist(downloadedDictionaries.filter(dictionary => dictionary.id !== dictionaryId));
  }, [downloadedDictionaries, persist]);

  const lookupWord = useCallback(async (word: string): Promise<DictionaryLookupResult | null> => {
    const offline = findOfflineEntries(word, downloadedDictionaries);
    if (offline) {
      return offline;
    }

    return fetchOnlineDefinition(word);
  }, [downloadedDictionaries]);

  const value = useMemo(() => ({
    downloadedDictionaries,
    isLoading,
    fetchAvailableDictionaries,
    downloadDictionary,
    importDictionaryFromUrl,
    importDictionaryFromFile,
    removeDictionary,
    lookupWord,
  }), [downloadDictionary, downloadedDictionaries, fetchAvailableDictionaries, importDictionaryFromFile, importDictionaryFromUrl, isLoading, lookupWord, removeDictionary]);

  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function useDictionary() {
  const context = useContext(DictionaryContext);
  if (!context) {
    throw new Error('useDictionary must be used within a DictionaryProvider');
  }
  return context;
}
