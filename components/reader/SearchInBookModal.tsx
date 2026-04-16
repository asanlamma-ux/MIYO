import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Text,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { EpubChapter } from '@/utils/epub-parser';

interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  excerpt: string;
  matchIndex: number;
  matchStart: number;
  matchEnd: number;
}

interface SearchInBookModalProps {
  visible: boolean;
  onClose: () => void;
  chapters: EpubChapter[];
  currentChapterIndex: number;
  onGoToChapter: (index: number, searchTerm: string) => void;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchInChapters(
  chapters: EpubChapter[],
  query: string,
  options?: { onlyChapterIndex?: number }
): SearchResult[] {
  if (!query.trim() || query.length < 2) return [];
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();
  const CONTEXT_CHARS = 80;

  const startCi =
    typeof options?.onlyChapterIndex === 'number' ? options.onlyChapterIndex : 0;
  const endCi =
    typeof options?.onlyChapterIndex === 'number'
      ? options.onlyChapterIndex + 1
      : chapters.length;

  for (let ci = startCi; ci < endCi; ci++) {
    const chapter = chapters[ci];
    const text = stripHtml(chapter.content);
    const lowerText = text.toLowerCase();

    let searchIdx = 0;
    let matchCount = 0;
    while (matchCount < 5) {
      const idx = lowerText.indexOf(lowerQuery, searchIdx);
      if (idx === -1) break;

      const start = Math.max(0, idx - CONTEXT_CHARS);
      const end = Math.min(text.length, idx + query.length + CONTEXT_CHARS);
      const excerpt =
        (start > 0 ? '…' : '') +
        text.slice(start, end) +
        (end < text.length ? '…' : '');

      results.push({
        chapterIndex: ci,
        chapterTitle: chapter.title || `Chapter ${ci + 1}`,
        excerpt,
        matchIndex: matchCount,
        matchStart: idx - start + (start > 0 ? 1 : 0),
        matchEnd: idx - start + (start > 0 ? 1 : 0) + query.length,
      });

      searchIdx = idx + 1;
      matchCount++;
    }

    if (results.length >= 50) break;
  }

  return results;
}

export function SearchInBookModal({
  visible,
  onClose,
  chapters,
  currentChapterIndex,
  onGoToChapter,
}: SearchInBookModalProps) {
  const insets = useSafeAreaInsets();
  const win = Dimensions.get('window');
  const sheetMaxH = Math.min(win.height * 0.88, 720);
  const { currentTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  /** Default: current chapter only (per product spec); user can expand to whole book */
  const [fullBookSearch, setFullBookSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!text.trim() || text.length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      searchTimeout.current = setTimeout(() => {
        const found = searchInChapters(chapters, text, {
          onlyChapterIndex: fullBookSearch ? undefined : currentChapterIndex,
        });
        setResults(found);
        setIsSearching(false);
      }, 300);
    },
    [chapters, currentChapterIndex, fullBookSearch]
  );

  const handleSelectResult = (result: SearchResult) => {
    onGoToChapter(result.chapterIndex, query);
    onClose();
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  useEffect(() => {
    if (!visible) {
      setFullBookSearch(false);
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
    handleSearch(query);
    // Only re-run when search scope changes; handleSearch already tracks query via onChangeText
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullBookSearch]);

  const isDark = currentTheme.isDark;

  const renderResult = ({ item }: { item: SearchResult; index: number }) => {
    const start = Math.min(item.matchStart, item.excerpt.length);
    const end = Math.min(item.matchEnd, item.excerpt.length);
    const excerptBefore = item.excerpt.slice(0, start);
    const excerptMatch = item.excerpt.slice(start, end);
    const excerptAfter = item.excerpt.slice(end);
    const isCurrentChapter = item.chapterIndex === currentChapterIndex;

    return (
      <PressableScale
        onPress={() => handleSelectResult(item)}
        style={[
          styles.resultItem,
          {
            backgroundColor: isCurrentChapter
              ? currentTheme.accent + '10'
              : currentTheme.background,
            borderColor: isCurrentChapter
              ? currentTheme.accent + '30'
              : currentTheme.secondaryText + '15',
          },
        ]}
      >
        <View style={styles.resultHeader}>
          <ThemedText
            style={[styles.resultChapter, { color: currentTheme.accent }]}
            numberOfLines={1}
          >
            {item.chapterTitle}
          </ThemedText>
          {isCurrentChapter && (
            <View style={[styles.currentBadge, { backgroundColor: currentTheme.accent + '20' }]}>
              <ThemedText style={[styles.currentBadgeText, { color: currentTheme.accent }]}>
                Current
              </ThemedText>
            </View>
          )}
        </View>
        <Text style={[styles.resultExcerpt, { color: currentTheme.text }]} numberOfLines={4}>
          {excerptBefore}
          <Text style={[styles.resultMatch, { backgroundColor: currentTheme.accent + '35', color: currentTheme.text }]}>
            {excerptMatch}
          </Text>
          {excerptAfter}
        </Text>
      </PressableScale>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close search" />
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.cardBackground,
                borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                maxHeight: sheetMaxH,
                height: sheetMaxH,
                paddingBottom: Math.max(insets.bottom, 12) + 8,
              },
            ]}
          >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />

          {/* Header */}
          <View style={styles.header}>
            <ThemedText variant="primary" size="header" weight="bold">
              Search in Book
            </ThemedText>
            <PressableScale onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>

          <View style={styles.scopeRow}>
            <PressableScale
              onPress={() => setFullBookSearch(false)}
              style={[
                styles.scopeChip,
                {
                  backgroundColor: !fullBookSearch ? currentTheme.accent + '22' : currentTheme.background,
                  borderColor: !fullBookSearch ? currentTheme.accent : currentTheme.secondaryText + '30',
                },
              ]}
            >
              <ThemedText
                variant={!fullBookSearch ? 'accent' : 'primary'}
                size="caption"
                weight={!fullBookSearch ? 'semibold' : 'regular'}
              >
                This chapter
              </ThemedText>
            </PressableScale>
            <PressableScale
              onPress={() => setFullBookSearch(true)}
              style={[
                styles.scopeChip,
                {
                  backgroundColor: fullBookSearch ? currentTheme.accent + '22' : currentTheme.background,
                  borderColor: fullBookSearch ? currentTheme.accent : currentTheme.secondaryText + '30',
                },
              ]}
            >
              <ThemedText
                variant={fullBookSearch ? 'accent' : 'primary'}
                size="caption"
                weight={fullBookSearch ? 'semibold' : 'regular'}
              >
                Entire book
              </ThemedText>
            </PressableScale>
          </View>

          {/* Search input */}
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
            <Search size={18} color={currentTheme.secondaryText} strokeWidth={2} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.text }]}
              placeholder="Search for words, phrases…"
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={clearSearch} style={styles.clearBtn}>
                <X size={16} color={currentTheme.secondaryText} />
              </Pressable>
            )}
          </View>

          {/* Results count */}
          {query.length >= 2 && (
            <View style={styles.resultsMeta}>
              {isSearching ? (
                <ThemedText variant="secondary" size="caption">Searching…</ThemedText>
              ) : (
                <ThemedText variant="secondary" size="caption">
                  {results.length === 0
                    ? 'No results found'
                    : `${results.length}${results.length >= 50 ? '+' : ''} result${results.length !== 1 ? 's' : ''}`}
                </ThemedText>
              )}
            </View>
          )}

          {/* Results list — fixed height parent so FlatList lays out on Android */}
          <FlatList
            data={results}
            renderItem={renderResult}
            keyExtractor={(_, idx) => `r-${idx}`}
            style={styles.resultsList}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              query.length >= 2 && !isSearching ? (
                <View style={styles.emptyState}>
                  <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                    No matches for "{query}"
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginTop: 4 }}>
                    Try different keywords
                  </ThemedText>
                </View>
              ) : null
            }
          />
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 0,
  },
  kav: {
    zIndex: 1,
    maxHeight: '100%',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeBtn: {
    padding: 4,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scopeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  resultsMeta: {
    marginBottom: 10,
  },
  resultsList: {
    flex: 1,
    minHeight: 120,
  },
  resultsContent: {
    gap: 8,
    paddingBottom: 16,
  },
  resultItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultChapter: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.3,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  resultExcerpt: {
    fontSize: 14,
    lineHeight: 20,
  },
  resultMatch: {
    fontWeight: '700',
    borderRadius: 3,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
  },
});
