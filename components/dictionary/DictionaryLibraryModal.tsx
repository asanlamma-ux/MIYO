import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownToLine, BookDown, Download, FileUp, Globe2, Link2, Search, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useDictionary } from '@/context/DictionaryContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { DictionaryManifest } from '@/types/dictionary';

interface DictionaryLibraryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DictionaryLibraryModal({ visible, onClose }: DictionaryLibraryModalProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const {
    downloadedDictionaries,
    fetchAvailableDictionaries,
    downloadDictionary,
    importDictionaryFromFile,
    importDictionaryFromUrl,
    removeDictionary,
  } = useDictionary();
  const [available, setAvailable] = useState<DictionaryManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoading(true);
      setAvailable(await fetchAvailableDictionaries());
      setLoading(false);
    })();
  }, [visible, fetchAvailableDictionaries]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return available;
    return available.filter(dictionary =>
      dictionary.name.toLowerCase().includes(normalized) ||
      dictionary.description?.toLowerCase().includes(normalized) ||
      dictionary.tags.some(tag => tag.toLowerCase().includes(normalized))
    );
  }, [available, query]);

  const englishPack = available.find(dictionary => dictionary.id === 'local-english-essentials');
  const showFeaturedEnglish = !!englishPack && !downloadedDictionaries.some(item => item.id === englishPack.id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.52)' }]}> 
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.cardBackground,
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="primary" size="header" weight="bold">
                Dictionary Library
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Build an offline lookup shelf. When no local match exists, Miyo falls back to online search.
              </ThemedText>
            </View>
            <PressableScale onPress={onClose} style={styles.iconBtn}>
              <X size={20} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>

          {showFeaturedEnglish ? (
            <View
              style={[
                styles.featuredCard,
                {
                  backgroundColor: currentTheme.background,
                  borderColor: currentTheme.accent + '28',
                },
              ]}
            >
              <View style={[styles.featuredSeal, { backgroundColor: currentTheme.accent + '14' }]}>
                <BookDown size={20} color={currentTheme.accent} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText variant="accent" size="caption" weight="semibold" style={styles.featuredLabel}>
                  QUICK START
                </ThemedText>
                <ThemedText variant="primary" size="body" weight="semibold">
                  Download English Essentials
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={{ lineHeight: 18 }}>
                  One tap installs a built-in starter English dictionary for common words and reading vocabulary.
                </ThemedText>
              </View>
              <PressableScale
                onPress={async () => {
                  setBusyId(englishPack.id);
                  setImportError(null);
                  setImportSuccess(null);
                  try {
                    const ok = await downloadDictionary(englishPack.id);
                    if (ok) {
                      setImportSuccess('English Essentials installed.');
                    } else {
                      setImportError('Could not install the English dictionary package.');
                    }
                  } finally {
                    setBusyId(null);
                  }
                }}
                disabled={busyId === englishPack.id}
                style={[styles.featuredDownloadBtn, { backgroundColor: currentTheme.accent }]}
              >
                {busyId === englishPack.id ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <ArrowDownToLine size={15} color="#FFF" />
                    <ThemedText style={styles.downloadText}>Install</ThemedText>
                  </>
                )}
              </PressableScale>
            </View>
          ) : null}

          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.secondaryText + '20',
              },
            ]}
          >
            <Search size={16} color={currentTheme.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.text }]}
              placeholder="Search dictionaries..."
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View style={[styles.importPanel, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
            <View style={styles.importPanelHeader}>
              <View style={[styles.importIcon, { backgroundColor: currentTheme.accent + '14' }]}>
                <Globe2 size={16} color={currentTheme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText variant="primary" size="body" weight="semibold">
                  Add your own package
                </ThemedText>
                <ThemedText variant="secondary" size="caption">
                  Paste a package URL or import a local JSON/ZIP dictionary file.
                </ThemedText>
              </View>
            </View>

            <View
              style={[
                styles.urlRow,
                {
                  backgroundColor: currentTheme.cardBackground,
                  borderColor: currentTheme.secondaryText + '20',
                },
              ]}
            >
              <Link2 size={15} color={currentTheme.secondaryText} />
              <TextInput
                style={[styles.urlInput, { color: currentTheme.text }]}
                placeholder="https://example.com/dictionary.json"
                placeholderTextColor={currentTheme.secondaryText + '70'}
                value={importUrl}
                onChangeText={setImportUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <PressableScale
                onPress={async () => {
                  setImportError(null);
                  setImportSuccess(null);
                  const trimmed = importUrl.trim();
                  if (!trimmed) {
                    setImportError('Enter a dictionary package URL first.');
                    return;
                  }
                  setBusyId('url-import');
                  try {
                    const result = await importDictionaryFromUrl(trimmed);
                    if (result.success) {
                      setImportSuccess('Dictionary imported from URL.');
                      setImportUrl('');
                    } else if (result.error) {
                      setImportError(result.error);
                    }
                  } finally {
                    setBusyId(null);
                  }
                }}
                disabled={busyId === 'url-import'}
                style={[styles.urlImportBtn, { backgroundColor: currentTheme.accent }]}
              >
                {busyId === 'url-import' ? <ActivityIndicator size="small" color="#FFF" /> : <Download size={15} color="#FFF" />}
              </PressableScale>
            </View>

            <View style={styles.importActions}>
              <PressableScale
                onPress={async () => {
                  setImportError(null);
                  setImportSuccess(null);
                  setBusyId('file-import');
                  try {
                    const result = await importDictionaryFromFile();
                    if (result.success) {
                      setImportSuccess('Dictionary imported from file.');
                    } else if (result.error) {
                      setImportError(result.error);
                    }
                  } finally {
                    setBusyId(null);
                  }
                }}
                disabled={busyId === 'file-import'}
                style={[styles.fileImportBtn, { borderColor: currentTheme.secondaryText + '22' }]}
              >
                {busyId === 'file-import' ? (
                  <ActivityIndicator size="small" color={currentTheme.accent} />
                ) : (
                  <>
                    <FileUp size={15} color={currentTheme.accent} />
                    <ThemedText variant="accent" size="caption" weight="semibold">
                      Import from file
                    </ThemedText>
                  </>
                )}
              </PressableScale>
            </View>

            {importError ? (
              <View style={[styles.noticeCard, { backgroundColor: '#EF444414', borderColor: '#EF44442B' }]}>
                <ThemedText style={{ color: '#EF4444', fontSize: 12, lineHeight: 18 }}>
                  {importError}
                </ThemedText>
              </View>
            ) : null}
            {importSuccess ? (
              <View style={[styles.noticeCard, { backgroundColor: '#22C55E14', borderColor: '#22C55E2B' }]}>
                <ThemedText style={{ color: '#16A34A', fontSize: 12, lineHeight: 18 }}>
                  {importSuccess}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            <View style={[styles.sectionCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
              <ThemedText variant="primary" size="body" weight="semibold">
                Downloaded Packages
              </ThemedText>
              {downloadedDictionaries.length === 0 ? (
                <ThemedText variant="secondary" size="caption" style={{ marginTop: 8 }}>
                  No offline dictionary packages downloaded yet.
                </ThemedText>
              ) : (
                downloadedDictionaries.map(dictionary => (
                  <View key={dictionary.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <ThemedText variant="primary" size="body" weight="medium">{dictionary.name}</ThemedText>
                        <ThemedText variant="secondary" size="caption">
                          {dictionary.entriesCount} entries · downloaded {new Date(dictionary.downloadedAt).toLocaleDateString()}
                          {dictionary.attribution ? ` · ${dictionary.attribution}` : ''}
                        </ThemedText>
                      </View>
                    <PressableScale
                      onPress={() => void removeDictionary(dictionary.id)}
                      style={[styles.actionBtn, { borderColor: '#EF444480' }]}
                    >
                      <Trash2 size={15} color="#EF4444" />
                    </PressableScale>
                  </View>
                ))
              )}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
              <ThemedText variant="primary" size="body" weight="semibold">
                Available Online
              </ThemedText>
              {loading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={currentTheme.accent} />
                </View>
              ) : filtered.length === 0 ? (
                <ThemedText variant="secondary" size="caption" style={{ marginTop: 8 }}>
                  No dictionary packages found.
                </ThemedText>
              ) : (
                filtered.map(dictionary => {
                  const isDownloaded = downloadedDictionaries.some(item => item.id === dictionary.id);
                  const isBusy = busyId === dictionary.id;
                  return (
                    <View key={dictionary.id} style={styles.rowCard}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <ThemedText variant="primary" size="body" weight="medium">{dictionary.name}</ThemedText>
                        <ThemedText variant="secondary" size="caption" numberOfLines={2}>
                          {dictionary.description || 'Offline package'}
                        </ThemedText>
                        <ThemedText variant="secondary" size="caption">
                          {dictionary.entriesCount} entries · {dictionary.downloadCount} downloads
                        </ThemedText>
                        {!!dictionary.attribution && (
                          <ThemedText variant="secondary" size="caption">
                            {dictionary.attribution}
                          </ThemedText>
                        )}
                      </View>
                      <PressableScale
                        onPress={async () => {
                          setBusyId(dictionary.id);
                          try {
                            await downloadDictionary(dictionary.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={isDownloaded || isBusy}
                        style={[styles.downloadBtn, { backgroundColor: isDownloaded ? '#22C55E20' : currentTheme.accent }]}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : isDownloaded ? (
                          <BookDown size={16} color="#22C55E" />
                        ) : (
                          <>
                            <Download size={15} color="#FFF" />
                            <ThemedText style={styles.downloadText}>Download</ThemedText>
                          </>
                        )}
                      </PressableScale>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    maxHeight: '92%',
    minHeight: '76%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 15,
  },
  featuredCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featuredSeal: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredLabel: {
    letterSpacing: 1.2,
  },
  featuredDownloadBtn: {
    minWidth: 94,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  importPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  importPanelHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  importIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 8,
  },
  urlInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
  },
  urlImportBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importActions: {
    flexDirection: 'row',
    gap: 10,
  },
  fileImportBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: { flex: 1 },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    minWidth: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
  },
  downloadText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  loadingState: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
