import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BookDown, ChevronLeft, ChevronRight, Globe2, Link2, Plus, Search, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { OpdsCatalog, OpdsEntry, OpdsFeed } from '@/types/opds';
import { addOpdsCatalog, fetchOpdsFeed, getSavedOpdsCatalogs, removeOpdsCatalog } from '@/utils/opds';

interface OpdsCatalogModalProps {
  visible: boolean;
  onClose: () => void;
  onImportBook: (entry: OpdsEntry) => Promise<void>;
}

export function OpdsCatalogModal({ visible, onClose, onImportBook }: OpdsCatalogModalProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const [catalogs, setCatalogs] = useState<OpdsCatalog[]>([]);
  const [feed, setFeed] = useState<OpdsFeed | null>(null);
  const [feedStack, setFeedStack] = useState<string[]>([]);
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null);
  const [catalogUrl, setCatalogUrl] = useState('');
  const [entryQuery, setEntryQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingEntryId, setImportingEntryId] = useState<string | null>(null);

  const loadCatalogs = useCallback(async () => {
    setCatalogs(await getSavedOpdsCatalogs());
  }, []);

  useEffect(() => {
    if (visible) {
      void loadCatalogs();
    } else {
      setFeed(null);
      setFeedStack([]);
      setCatalogUrl('');
      setEntryQuery('');
      setError(null);
      setActiveCatalogId(null);
    }
  }, [visible, loadCatalogs]);

  const loadFeed = useCallback(async (url: string, pushHistory = true, nextCatalogId?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      const nextFeed = await fetchOpdsFeed(url);
      setFeed(current => {
        if (current && pushHistory && current.url !== url) {
          setFeedStack(prev => [...prev, current.url]);
        }
        return nextFeed;
      });
      if (nextCatalogId !== undefined) {
        setActiveCatalogId(nextCatalogId);
      }
      if (!pushHistory) {
        setFeedStack([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || feed || catalogs.length === 0) return;
    setActiveCatalogId(catalogs[0].id);
    void loadFeed(catalogs[0].url, false, catalogs[0].id);
  }, [visible, feed, catalogs, loadFeed]);

  const handleSaveCatalog = useCallback(async () => {
    if (!catalogUrl.trim()) return;
    try {
      setSavingCatalog(true);
      setError(null);
      const result = await addOpdsCatalog(catalogUrl.trim());
      setCatalogs(result.catalogs);
      setActiveCatalogId(result.addedCatalog.id);
      await loadFeed(result.addedCatalog.url, false, result.addedCatalog.id);
      setCatalogUrl('');
      if (result.alreadySaved) {
        setError('That catalog was already saved. Opened the existing entry instead.');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this catalog.');
    } finally {
      setSavingCatalog(false);
    }
  }, [catalogUrl, loadFeed]);

  const handleDeleteCatalog = useCallback(async (catalogId: string) => {
    const nextCatalogs = await removeOpdsCatalog(catalogId);
    setCatalogs(nextCatalogs);
    if (activeCatalogId === catalogId) {
      const fallbackCatalog = nextCatalogs[0];
      if (fallbackCatalog) {
        setActiveCatalogId(fallbackCatalog.id);
        void loadFeed(fallbackCatalog.url, false, fallbackCatalog.id);
      } else {
        setFeed(null);
        setActiveCatalogId(null);
      }
    }
  }, [activeCatalogId, loadFeed]);

  const feedEntries = useMemo(() => {
    const entries = feed?.entries || [];
    if (!entryQuery.trim()) return entries;
    const query = entryQuery.trim().toLowerCase();
    return entries.filter(entry =>
      entry.title.toLowerCase().includes(query) ||
      entry.author.toLowerCase().includes(query) ||
      (entry.summary || '').toLowerCase().includes(query)
    );
  }, [entryQuery, feed]);

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
                OPDS Catalogs
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Browse online catalogs and import EPUBs directly into your library
              </ThemedText>
            </View>
            <PressableScale onPress={onClose} style={styles.headerBtn}>
              <X size={20} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>

          <View
            style={[
              styles.addRow,
              {
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.secondaryText + '20',
              },
            ]}
          >
            <Link2 size={16} color={currentTheme.secondaryText} />
            <TextInput
              style={[styles.urlInput, { color: currentTheme.text }]}
              placeholder="Add OPDS feed URL..."
              placeholderTextColor={currentTheme.secondaryText + '80'}
              autoCapitalize="none"
              autoCorrect={false}
              value={catalogUrl}
              onChangeText={setCatalogUrl}
            />
            <PressableScale
              onPress={handleSaveCatalog}
              disabled={!catalogUrl.trim() || savingCatalog}
              style={[styles.addBtn, { backgroundColor: currentTheme.accent }]}
            >
              {savingCatalog ? <ActivityIndicator size="small" color="#FFF" /> : <Plus size={16} color="#FFF" />}
            </PressableScale>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catalogRow}
            style={{ maxHeight: 56 }}
          >
            {catalogs.map(catalog => (
              <PressableScale
                key={catalog.id}
                onPress={() => loadFeed(catalog.url, false, catalog.id)}
                style={[
                  styles.catalogChip,
                  {
                    backgroundColor: activeCatalogId === catalog.id ? currentTheme.accent + '14' : currentTheme.background,
                    borderColor: activeCatalogId === catalog.id ? currentTheme.accent + '55' : currentTheme.secondaryText + '20',
                  },
                ]}
              >
                <Globe2 size={14} color={currentTheme.accent} />
                <ThemedText variant="primary" size="caption" weight="medium" numberOfLines={1} style={{ maxWidth: 140 }}>
                  {catalog.title}
                </ThemedText>
                {!catalog.isDefault ? (
                  <Pressable onPress={() => handleDeleteCatalog(catalog.id)} hitSlop={8}>
                    <Trash2 size={13} color={currentTheme.secondaryText} />
                  </Pressable>
                ) : null}
              </PressableScale>
            ))}
          </ScrollView>

          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.secondaryText + '20',
              },
            ]}
          >
            <Search size={15} color={currentTheme.secondaryText} />
            <TextInput
              value={entryQuery}
              onChangeText={setEntryQuery}
              placeholder="Filter loaded entries..."
              placeholderTextColor={currentTheme.secondaryText + '80'}
              style={[styles.searchInput, { color: currentTheme.text }]}
            />
            {entryQuery ? (
              <PressableScale onPress={() => setEntryQuery('')}>
                <X size={15} color={currentTheme.secondaryText} />
              </PressableScale>
            ) : null}
          </View>

          {feedStack.length > 0 && (
            <PressableScale
              onPress={() => {
                const previous = feedStack[feedStack.length - 1];
                setFeedStack(prev => prev.slice(0, -1));
                void loadFeed(previous, false);
              }}
              style={[styles.backBtn, { borderColor: currentTheme.secondaryText + '20' }]}
            >
              <ThemedText variant="accent" size="caption" weight="medium">Back to previous feed</ThemedText>
            </PressableScale>
          )}

          <View style={styles.feedHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="primary" size="body" weight="semibold">
                {feed?.title || 'No catalog loaded'}
              </ThemedText>
              <ThemedText variant="secondary" size="caption" numberOfLines={1}>
                {feed?.url || 'Save or open an OPDS feed to browse books'}
              </ThemedText>
            </View>
            {(feed?.previousUrl || feed?.nextUrl) ? (
              <View style={styles.feedPager}>
                <PressableScale
                  onPress={() => feed?.previousUrl ? loadFeed(feed.previousUrl, false, activeCatalogId) : null}
                  disabled={!feed?.previousUrl || loading}
                  style={[
                    styles.feedPagerBtn,
                    {
                      opacity: feed?.previousUrl ? 1 : 0.45,
                      borderColor: currentTheme.secondaryText + '20',
                    },
                  ]}
                >
                  <ChevronLeft size={16} color={currentTheme.text} />
                </PressableScale>
                <PressableScale
                  onPress={() => feed?.nextUrl ? loadFeed(feed.nextUrl, false, activeCatalogId) : null}
                  disabled={!feed?.nextUrl || loading}
                  style={[
                    styles.feedPagerBtn,
                    {
                      opacity: feed?.nextUrl ? 1 : 0.45,
                      borderColor: currentTheme.secondaryText + '20',
                    },
                  ]}
                >
                  <ChevronRight size={16} color={currentTheme.text} />
                </PressableScale>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={currentTheme.accent} />
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>{error}</ThemedText>
              <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                Try a public OPDS feed like Project Gutenberg, or use a feed that allows anonymous app requests.
              </ThemedText>
            </View>
          ) : feedEntries.length === 0 ? (
            <View style={styles.centerState}>
              <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                {entryQuery ? 'No entries matched that filter.' : 'No feed entries yet.'}
              </ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              {feedEntries.map(entry => {
                const canImport = entry.acquisitionLinks.length > 0;
                return (
                  <View
                    key={entry.id}
                    style={[styles.entryCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}
                  >
                    <View style={styles.entryHeader}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <ThemedText variant="primary" size="body" weight="semibold">
                          {entry.title}
                        </ThemedText>
                        <ThemedText variant="secondary" size="caption">
                          {entry.author}
                        </ThemedText>
                      </View>
                      {canImport ? (
                        <PressableScale
                          onPress={async () => {
                            setImportingEntryId(entry.id);
                            try {
                              await onImportBook(entry);
                            } finally {
                              setImportingEntryId(null);
                            }
                          }}
                          disabled={importingEntryId === entry.id}
                          style={[styles.importBtn, { backgroundColor: currentTheme.accent }]}
                        >
                          {importingEntryId === entry.id ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <BookDown size={16} color="#FFF" />
                              <ThemedText style={styles.importBtnText}>Import</ThemedText>
                            </>
                          )}
                        </PressableScale>
                      ) : entry.navigationLinks[0] ? (
                        <PressableScale
                          onPress={() => void loadFeed(entry.navigationLinks[0].href)}
                          style={[styles.navBtn, { borderColor: currentTheme.accent + '50' }]}
                        >
                          <ThemedText variant="accent" size="caption" weight="semibold">Open</ThemedText>
                        </PressableScale>
                      ) : null}
                    </View>
                    {!!entry.summary && (
                      <ThemedText variant="secondary" size="caption" numberOfLines={3} style={{ lineHeight: 18 }}>
                        {entry.summary}
                      </ThemedText>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    maxHeight: '92%',
    minHeight: '78%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 8,
    marginBottom: 12,
    gap: 10,
  },
  urlInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 15,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogRow: {
    gap: 8,
    paddingBottom: 8,
  },
  catalogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feedHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedPager: {
    flexDirection: 'row',
    gap: 8,
  },
  feedPagerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  importBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  navBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
