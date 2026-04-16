import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  Download,
  Globe2,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react-native';
import ReaderWebView from '@/components/reader/ReaderWebView';
import { PressableScale } from '@/components/ui/PressableScale';
import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/context/ThemeContext';
import type {
  WtrLabBridgeRequest,
  WtrLabChapterContent,
  WtrLabNovelDetails,
  WtrLabNovelSummary,
  WtrLabSearchFilters,
  WtrLabSearchResult,
} from '@/types/wtr-lab';
import {
  buildWtrBridgeCommand,
  getProviderStartUrl,
  ONLINE_MTL_PROVIDERS,
  parseWtrBridgeMessage,
  WTR_LAB_BOOTSTRAP_SCRIPT,
} from '@/utils/wtr-lab-bridge';
import { createRemoteNovelEpub } from '@/utils/epub-builder';

interface WtrLabBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  onImportGeneratedEpub: (params: { uri: string; fileName: string; title: string }) => Promise<boolean>;
}

const DEFAULT_FILTERS: WtrLabSearchFilters = {
  providerId: 'wtr-lab',
  query: '',
  page: 1,
  cursor: null,
  latestOnly: false,
  orderBy: 'update',
  order: 'desc',
  status: 'all',
  minChapters: null,
  maxChapters: null,
  minRating: null,
  minReviewCount: null,
};

type PendingResolver = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function WtrLabBrowserModal({
  visible,
  onClose,
  onImportGeneratedEpub,
}: WtrLabBrowserModalProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const webViewRef = useRef<any>(null);
  const pendingResolvers = useRef<Record<string, PendingResolver>>({});
  const autoLoadedRef = useRef(false);
  const requestCounter = useRef(0);

  const [bridgeReady, setBridgeReady] = useState(false);
  const [filters, setFilters] = useState<WtrLabSearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<WtrLabNovelSummary[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<WtrLabNovelDetails | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting to source…');
  const [error, setError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaBody, setCaptchaBody] = useState('');
  const [chapterStart, setChapterStart] = useState('1');
  const [chapterEnd, setChapterEnd] = useState('50');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const currentProvider = useMemo(
    () => ONLINE_MTL_PROVIDERS.find(provider => provider.id === filters.providerId) || ONLINE_MTL_PROVIDERS[0],
    [filters.providerId]
  );
  const captchaViewportHeight = useMemo(
    () => Math.min(560, Math.max(340, Math.round(windowHeight * 0.58))),
    [windowHeight]
  );

  useEffect(() => {
    if (!visible) {
      setBridgeReady(false);
      setFilters(DEFAULT_FILTERS);
      setResults([]);
      setSelectedNovel(null);
      setSearching(false);
      setLoadingDetails(false);
      setDownloading(false);
      setHasMore(false);
      setError(null);
      setCaptchaRequired(false);
      setCaptchaBody('');
      setStatusMessage('Connecting to source…');
      setChapterStart('1');
      setChapterEnd('50');
      setDescriptionExpanded(false);
      autoLoadedRef.current = false;
      Object.values(pendingResolvers.current).forEach(entry => clearTimeout(entry.timer));
      pendingResolvers.current = {};
    }
  }, [visible]);

  const currentChapterRange = useMemo(() => {
    const totalChapters = selectedNovel?.chapterCount || selectedNovel?.chapters.length || 0;
    if (!selectedNovel || !totalChapters) return null;
    const start = Math.max(1, Number(chapterStart) || 1);
    const end = Math.min(totalChapters, Number(chapterEnd) || totalChapters);
    return { start, end };
  }, [chapterEnd, chapterStart, selectedNovel]);

  const runBridgeRequest = useCallback(
    <T,>(type: WtrLabBridgeRequest['type'], payload: Record<string, unknown>) =>
      new Promise<T>((resolve, reject) => {
        if (Platform.OS === 'web') {
          reject(new Error('Online source browsing is only available in the Android beta build.'));
          return;
        }
        const id = `wtr_${Date.now()}_${requestCounter.current++}`;
        const timer = setTimeout(() => {
          delete pendingResolvers.current[id];
          reject(new Error(`${currentProvider.label} did not respond in time.`));
        }, 90000);
        pendingResolvers.current[id] = { resolve, reject, timer };
        const script = buildWtrBridgeCommand({
          id,
          type,
          payload: {
            providerId: currentProvider.id,
            ...payload,
          },
        });
        webViewRef.current?.injectJavaScript(script);
      }),
    [currentProvider.id, currentProvider.label]
  );

  const handleBridgeMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const message = parseWtrBridgeMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === 'ready') {
      setBridgeReady(true);
      setCaptchaRequired(false);
      setCaptchaBody('');
      const providerLabel =
        ONLINE_MTL_PROVIDERS.find(provider => provider.id === message.providerId)?.label || currentProvider.label;
      setStatusMessage(`${providerLabel} is ready.`);
      return;
    }

    if (message.type === 'challenge') {
      Object.values(pendingResolvers.current).forEach(entry => {
        clearTimeout(entry.timer);
        entry.reject(new Error('Verification is required before the selected source can continue.'));
      });
      pendingResolvers.current = {};
      setBridgeReady(false);
      setCaptchaRequired(true);
      setCaptchaBody(message.body || '');
      const providerLabel =
        ONLINE_MTL_PROVIDERS.find(provider => provider.id === message.providerId)?.label || currentProvider.label;
      setStatusMessage(`${providerLabel} requires verification. Complete it below to continue.`);
      return;
    }

    if (!message.id) return;
    const pending = pendingResolvers.current[message.id];
    if (!pending) return;
    clearTimeout(pending.timer);
    delete pendingResolvers.current[message.id];

    if (message.type === 'error') {
      pending.reject(new Error(message.error || `${currentProvider.label} request failed.`));
      return;
    }

    pending.resolve(message.payload);
  }, [currentProvider.label]);

  const bootstrapBridge = useCallback(() => {
    setStatusMessage(`Preparing ${currentProvider.label}…`);
    webViewRef.current?.injectJavaScript(WTR_LAB_BOOTSTRAP_SCRIPT);
  }, [currentProvider.label]);

  const performSearch = useCallback(
    async (loadMore = false) => {
      try {
        setSearching(true);
        setError(null);
        setStatusMessage(loadMore ? `Loading more from ${currentProvider.label}…` : `Searching ${currentProvider.label}…`);
        const payload = {
          ...filters,
          page: loadMore ? filters.page + 1 : 1,
          cursor: loadMore ? filters.cursor || null : null,
        };
        const result = await runBridgeRequest<WtrLabSearchResult>('search', payload);
        setResults(prev => {
          if (!loadMore) {
            return result.items;
          }
          const merged = [...prev, ...result.items];
          const seen = new Set<string>();
          return merged.filter(item => {
            const key = `${item.rawId}:${item.slug}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        setFilters(prev => ({ ...prev, page: result.page, cursor: result.nextCursor || null }));
        setHasMore(result.hasMore);
        setStatusMessage(result.items.length ? 'Search complete.' : 'No novels matched those filters.');
      } catch (searchError) {
        const nextError = searchError instanceof Error ? searchError.message : `Could not search ${currentProvider.label}.`;
        if (/verification|required|captcha|403/i.test(nextError)) {
          setCaptchaRequired(true);
        }
        setError(nextError);
        setStatusMessage('Search failed.');
      } finally {
        setSearching(false);
      }
    },
    [filters, runBridgeRequest, currentProvider.label]
  );

  useEffect(() => {
    if (!visible || !bridgeReady || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    void performSearch(false);
  }, [bridgeReady, performSearch, visible]);

  const openNovel = useCallback(
    async (novel: WtrLabNovelSummary) => {
      try {
        setLoadingDetails(true);
        setError(null);
        setSelectedNovel(prev => ({
          providerId: novel.providerId,
          providerLabel: novel.providerLabel,
          rawId: novel.rawId,
          slug: novel.slug,
          path: novel.path,
          title: novel.title || prev?.title || 'Untitled',
          coverUrl: novel.coverUrl || prev?.coverUrl || null,
          author: novel.author || prev?.author || 'Unknown Author',
          summary: novel.summary || prev?.summary || '',
          status: novel.status || prev?.status || 'Unknown',
          chapterCount: novel.chapterCount || prev?.chapterCount || null,
          rating: novel.rating || prev?.rating || null,
          genres: prev?.rawId === novel.rawId ? prev.genres : [],
          tags: prev?.rawId === novel.rawId ? prev.tags : [],
          chapters: prev?.rawId === novel.rawId ? prev.chapters : [],
        }));
        setStatusMessage(`Loading ${novel.title} from ${novel.providerLabel}…`);
        const details = await runBridgeRequest<WtrLabNovelDetails>('details', {
          providerId: novel.providerId,
          rawId: novel.rawId,
          slug: novel.slug,
          path: novel.path,
          fallbackTitle: novel.title,
          fallbackCoverUrl: novel.coverUrl,
          fallbackAuthor: novel.author,
          fallbackSummary: novel.summary,
          fallbackStatus: novel.status,
          fallbackChapterCount: novel.chapterCount,
          includeChapters: true,
        });
        setSelectedNovel({
          ...novel,
          ...details,
          title: details.title || novel.title,
          coverUrl: details.coverUrl || novel.coverUrl,
          author: details.author || novel.author,
          summary: details.summary || novel.summary,
          status: details.status || novel.status,
          chapterCount: details.chapterCount || novel.chapterCount,
        });
        setChapterStart('1');
        setChapterEnd(String(details.chapterCount || details.chapters.length || 1));
        setDescriptionExpanded(false);
        setStatusMessage('Novel loaded.');
      } catch (detailError) {
        const nextError = detailError instanceof Error ? detailError.message : 'Could not load the novel.';
        if (/verification|required|captcha|403/i.test(nextError)) {
          setCaptchaRequired(true);
        }
        setError(nextError);
        setStatusMessage('Novel load failed.');
      } finally {
        setLoadingDetails(false);
      }
    },
    [runBridgeRequest]
  );

  const handleDownload = useCallback(async () => {
    if (!selectedNovel || !currentChapterRange) return;
    const { start, end } = currentChapterRange;
    if (end < start) {
      setError('The chapter range is invalid.');
      return;
    }

    try {
      setDownloading(true);
      setError(null);
      const selectedChapters = selectedNovel.chapters.filter(
        chapter => chapter.order >= start && chapter.order <= end
      );
      if (!selectedChapters.length) {
        throw new Error('No chapters were found in that range.');
      }

      const fetchRemoteChapter = async (chapter: typeof selectedChapters[number], attempt = 0): Promise<WtrLabChapterContent> => {
        try {
          return await runBridgeRequest<WtrLabChapterContent>('chapter', {
            providerId: selectedNovel.providerId,
            rawId: selectedNovel.rawId,
            slug: selectedNovel.slug,
            chapterNo: chapter.order,
            chapterTitle: chapter.title,
            path: chapter.path || selectedNovel.path,
          });
        } catch (error) {
          if (attempt >= 3) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1200 + attempt * 900));
          return fetchRemoteChapter(chapter, attempt + 1);
        }
      };

      const chapterPayloads: WtrLabChapterContent[] = new Array(selectedChapters.length);
      const firstChapter = selectedChapters[0];
      const sampleStartedAt = Date.now();
      setStatusMessage(`Fetching chapter 1 of ${selectedChapters.length}…`);
      chapterPayloads[0] = await fetchRemoteChapter(firstChapter);
      const sampleDurationMs = Date.now() - sampleStartedAt;
      const concurrency =
        selectedNovel.providerId === 'wtr-lab'
          ? 1
          : sampleDurationMs < 900
            ? 15
            : sampleDurationMs < 1800
              ? 12
              : 10;

      let nextIndex = 1;
      let completed = 1;
      const workerCount = Math.min(concurrency, Math.max(0, selectedChapters.length - 1));
      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          const claimedIndex = nextIndex;
          nextIndex += 1;
          if (claimedIndex >= selectedChapters.length) {
            return;
          }
          const chapter = selectedChapters[claimedIndex];
          const content = await fetchRemoteChapter(chapter);
          chapterPayloads[claimedIndex] = content;
          completed += 1;
          setStatusMessage(
            `Fetching chapter ${Math.min(completed, selectedChapters.length)} of ${selectedChapters.length}…`
          );
        }
      });
      await Promise.all(workers);

      setStatusMessage('Building EPUB…');
      const generated = await createRemoteNovelEpub({
        novel: selectedNovel,
        chapters: chapterPayloads,
      });
      setStatusMessage('Importing EPUB into your library…');
      const imported = await onImportGeneratedEpub({
        uri: generated.uri,
        fileName: generated.fileName,
        title: selectedNovel.title,
      });
      if (imported) {
        setStatusMessage(`${selectedNovel.providerLabel} novel imported.`);
        onClose();
      } else {
        setStatusMessage('Import cancelled. The generated EPUB stayed out of your library.');
      }
    } catch (downloadError) {
      const nextError = downloadError instanceof Error ? downloadError.message : 'Could not export this novel.';
      if (/verification|required|captcha|403/i.test(nextError)) {
        setCaptchaRequired(true);
      }
      setError(nextError);
      setStatusMessage('EPUB export failed.');
    } finally {
      setDownloading(false);
    }
  }, [currentChapterRange, onClose, onImportGeneratedEpub, runBridgeRequest, selectedNovel]);

  const renderFilterChip = (
    label: string,
    active: boolean,
    onPress: () => void
  ) => (
    <PressableScale
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? currentTheme.accent + '18' : currentTheme.background,
          borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '20',
        },
      ]}
    >
      <ThemedText
        size="caption"
        weight="semibold"
        style={{ color: active ? currentTheme.accent : currentTheme.secondaryText }}
      >
        {label}
      </ThemedText>
    </PressableScale>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.54)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.cardBackground,
              paddingTop: insets.top + 10,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="primary" size="header" weight="bold">
                Online MTL Browser
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Switch providers, run one combined search, inspect novels, and export EPUBs without leaving Miyo
              </ThemedText>
            </View>
            <PressableScale onPress={onClose} style={styles.headerBtn}>
              <X size={20} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.centerState}>
              <ThemedText variant="primary" size="body" weight="semibold" style={{ textAlign: 'center' }}>
                Online source browsing is only available in the Android beta build.
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                Protected provider sessions run inside an in-app browser context, so the web preview build cannot verify these sources.
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <ReaderWebView
                key={currentProvider.id}
                ref={webViewRef}
                source={{ uri: getProviderStartUrl(currentProvider.id) }}
                onLoadEnd={bootstrapBridge}
                onMessage={handleBridgeMessage}
                onError={event => {
                  setError(event.nativeEvent.description || `Could not initialize ${currentProvider.label}.`);
                }}
                nestedScrollEnabled
                style={
                  captchaRequired
                    ? [styles.captchaWebView, { height: captchaViewportHeight }]
                    : styles.hiddenWebView
                }
              />
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: currentTheme.background,
                    borderColor: currentTheme.secondaryText + '18',
                  },
                ]}
              >
                {searching || loadingDetails || downloading ? (
                  <LoaderCircle size={16} color={currentTheme.accent} />
                ) : (
                  <Globe2 size={16} color={bridgeReady ? currentTheme.accent : currentTheme.secondaryText} />
                )}
                <ThemedText variant="secondary" size="caption" style={{ flex: 1 }}>
                  {statusMessage}
                </ThemedText>
              </View>

              {error ? (
                <View
                  style={[
                    styles.errorCard,
                    { backgroundColor: '#EF444412', borderColor: '#EF444440' },
                  ]}
                >
                  <ThemedText style={{ color: '#EF4444', fontSize: 13, lineHeight: 18 }}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              {captchaRequired ? (
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.accent + '30',
                    },
                  ]}
                >
                  <ThemedText variant="primary" size="body" weight="semibold" style={{ marginBottom: 6 }}>
                    Verification Required
                  </ThemedText>
                  <ThemedText variant="secondary" size="caption" style={{ lineHeight: 18, marginBottom: 12 }}>
                    {currentProvider.label} is asking for a captcha or browser verification. Complete it below without leaving the app, then tap retry.
                  </ThemedText>
                  {captchaBody ? (
                    <ThemedText variant="secondary" size="caption" style={{ lineHeight: 18, marginBottom: 12 }}>
                      {captchaBody.slice(0, 220)}
                    </ThemedText>
                  ) : null}
                  <PressableScale
                    onPress={() => {
                      setError(null);
                      bootstrapBridge();
                    }}
                    style={[styles.secondaryBtn, { borderColor: currentTheme.secondaryText + '18', marginBottom: 12 }]}
                  >
                    <RefreshCw size={16} color={currentTheme.text} />
                    <ThemedText variant="primary" size="caption" weight="semibold">
                      Retry After Verification
                    </ThemedText>
                  </PressableScale>
                </View>
              ) : null}

              {selectedNovel ? (
                <View>
                  <View style={styles.detailTopRow}>
                    <PressableScale
                      onPress={() => setSelectedNovel(null)}
                      style={[styles.backBtn, { borderColor: currentTheme.secondaryText + '20' }]}
                    >
                      <ArrowLeft size={16} color={currentTheme.text} />
                      <ThemedText variant="primary" size="caption" weight="semibold">
                        Back
                      </ThemedText>
                    </PressableScale>
                    <PressableScale
                      onPress={() => void openNovel(selectedNovel)}
                      style={[styles.backBtn, { borderColor: currentTheme.secondaryText + '20' }]}
                    >
                      <RefreshCw size={15} color={currentTheme.text} />
                      <ThemedText variant="primary" size="caption" weight="semibold">
                        Refresh
                      </ThemedText>
                    </PressableScale>
                  </View>

                  <View style={styles.detailHero}>
                    <View
                      style={[
                        styles.coverWrap,
                        { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '18' },
                      ]}
                    >
                      {selectedNovel.coverUrl ? (
                        <Image source={{ uri: selectedNovel.coverUrl }} resizeMode="cover" style={styles.coverImage} />
                      ) : (
                        <View style={styles.coverFallback}>
                          <BookOpenText size={34} color={currentTheme.accent} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <ThemedText variant="primary" size="header" weight="bold">
                        {selectedNovel.title}
                      </ThemedText>
                      <ThemedText variant="secondary" size="caption">
                        {selectedNovel.author || 'Unknown Author'}
                      </ThemedText>
                      <View style={styles.metaRow}>
                        {renderFilterChip(selectedNovel.providerLabel, false, () => {})}
                        {renderFilterChip(selectedNovel.status || 'Unknown', true, () => {})}
                        {renderFilterChip(`${selectedNovel.chapterCount || selectedNovel.chapters.length} chapters`, false, () => {})}
                        {selectedNovel.rating ? renderFilterChip(`${selectedNovel.rating.toFixed(1)}★`, false, () => {}) : null}
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: currentTheme.background,
                        borderColor: currentTheme.secondaryText + '18',
                      },
                    ]}
                  >
                    <ThemedText variant="accent" size="caption" weight="semibold" style={styles.sectionLabel}>
                      DESCRIPTION
                    </ThemedText>
                    <ThemedText
                      variant="primary"
                      size="body"
                      style={{ lineHeight: 24 }}
                      numberOfLines={descriptionExpanded ? undefined : 5}
                    >
                      {selectedNovel.summary || `No description was returned by ${selectedNovel.providerLabel} for this series.`}
                    </ThemedText>
                    {selectedNovel.summary ? (
                      <PressableScale
                        onPress={() => setDescriptionExpanded(prev => !prev)}
                        style={[styles.backBtn, { alignSelf: 'flex-start', marginTop: 12, borderColor: currentTheme.secondaryText + '20' }]}
                      >
                        <ThemedText variant="primary" size="caption" weight="semibold">
                          {descriptionExpanded ? 'Show Less' : 'Show More'}
                        </ThemedText>
                        <ChevronDown
                          size={16}
                          color={currentTheme.text}
                          style={{ transform: [{ rotate: descriptionExpanded ? '180deg' : '0deg' }] }}
                        />
                      </PressableScale>
                    ) : null}
                  </View>

                  {selectedNovel.genres.length > 0 || selectedNovel.tags.length > 0 ? (
                    <View
                      style={[
                        styles.sectionCard,
                        {
                          backgroundColor: currentTheme.background,
                          borderColor: currentTheme.secondaryText + '18',
                        },
                      ]}
                    >
                      <ThemedText variant="accent" size="caption" weight="semibold" style={styles.sectionLabel}>
                        TAGS AND THEMES
                      </ThemedText>
                      {selectedNovel.genres.length > 0 ? (
                        <>
                          <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                            Themes
                          </ThemedText>
                          <View style={styles.filterRow}>
                            {selectedNovel.genres.map(genre => (
                              <View key={`genre:${genre}`} pointerEvents="none">
                                {renderFilterChip(genre, false, () => {})}
                              </View>
                            ))}
                          </View>
                        </>
                      ) : null}
                      {selectedNovel.tags.length > 0 ? (
                        <>
                          <ThemedText
                            variant="secondary"
                            size="caption"
                            weight="medium"
                            style={[styles.rangeLabel, selectedNovel.genres.length > 0 ? { marginTop: 10 } : null]}
                          >
                            Tags
                          </ThemedText>
                          <View style={styles.filterRow}>
                            {selectedNovel.tags.map(tag => (
                              <View key={`tag:${tag}`} pointerEvents="none">
                                {renderFilterChip(tag, false, () => {})}
                              </View>
                            ))}
                          </View>
                        </>
                      ) : null}
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: currentTheme.background,
                        borderColor: currentTheme.secondaryText + '18',
                      },
                    ]}
                  >
                    <ThemedText variant="accent" size="caption" weight="semibold" style={styles.sectionLabel}>
                      EPUB RANGE
                    </ThemedText>
                    <ThemedText variant="secondary" size="caption" style={{ lineHeight: 18, marginBottom: 12 }}>
                      Choose any chapter range. Miyo now exports large ranges through an adaptive concurrent chapter queue.
                    </ThemedText>
                    <View style={styles.rangeRow}>
                      <View style={styles.rangeField}>
                        <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                          Start
                        </ThemedText>
                        <TextInput
                          value={chapterStart}
                          onChangeText={setChapterStart}
                          keyboardType="number-pad"
                          style={[
                            styles.rangeInput,
                            {
                              color: currentTheme.text,
                              backgroundColor: currentTheme.cardBackground,
                              borderColor: currentTheme.secondaryText + '20',
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.rangeField}>
                        <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                          End
                        </ThemedText>
                        <TextInput
                          value={chapterEnd}
                          onChangeText={setChapterEnd}
                          keyboardType="number-pad"
                          style={[
                            styles.rangeInput,
                            {
                              color: currentTheme.text,
                              backgroundColor: currentTheme.cardBackground,
                              borderColor: currentTheme.secondaryText + '20',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <PressableScale
                      onPress={handleDownload}
                      disabled={downloading}
                      style={[styles.primaryBtn, { backgroundColor: currentTheme.accent, opacity: downloading ? 0.75 : 1 }]}
                    >
                      {downloading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Download size={18} color="#FFF" />
                      )}
                      <ThemedText style={styles.primaryBtnText}>
                        {downloading ? 'Exporting…' : `Download ${selectedNovel.providerLabel} as EPUB`}
                      </ThemedText>
                    </PressableScale>
                  </View>

                  <View
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: currentTheme.background,
                        borderColor: currentTheme.secondaryText + '18',
                      },
                    ]}
                  >
                    <ThemedText variant="accent" size="caption" weight="semibold" style={styles.sectionLabel}>
                      CHAPTER PREVIEW
                    </ThemedText>
                    {selectedNovel.chapters.slice(0, 14).map(chapter => (
                      <View key={chapter.path} style={styles.chapterRow}>
                        <ThemedText variant="primary" size="caption" weight="semibold" style={{ flex: 1 }}>
                          {chapter.order}. {chapter.title}
                        </ThemedText>
                        {chapter.updatedAt ? (
                          <ThemedText variant="secondary" size="caption">
                            {chapter.updatedAt.slice(0, 10)}
                          </ThemedText>
                        ) : null}
                      </View>
                    ))}
                    {selectedNovel.chapters.length > 14 ? (
                      <ThemedText variant="secondary" size="caption" style={{ marginTop: 8 }}>
                        Showing the first 14 chapters out of {selectedNovel.chapters.length}.
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View>
                  <View
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: currentTheme.background,
                        borderColor: currentTheme.secondaryText + '18',
                      },
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View>
                        <ThemedText variant="primary" size="body" weight="semibold">
                          Search All Providers
                        </ThemedText>
                        <ThemedText variant="secondary" size="caption">
                          One query now drives title and summary matching inside the selected provider.
                        </ThemedText>
                      </View>
                      <View style={[styles.iconBubble, { backgroundColor: currentTheme.accent + '16' }]}>
                        <Sparkles size={18} color={currentTheme.accent} />
                      </View>
                    </View>

                    <View style={styles.filterRow}>
                      {ONLINE_MTL_PROVIDERS.map(provider =>
                        renderFilterChip(provider.label, filters.providerId === provider.id, () => {
                          autoLoadedRef.current = false;
                          setBridgeReady(false);
                          setCaptchaRequired(false);
                          setCaptchaBody('');
                          setSelectedNovel(null);
                          setResults([]);
                          setHasMore(false);
                          setError(null);
                          setDescriptionExpanded(false);
                          setFilters(prev => ({
                            ...prev,
                            providerId: provider.id,
                            page: 1,
                            cursor: null,
                          }));
                          setStatusMessage(`Connecting to ${provider.label}…`);
                        })
                      )}
                    </View>

                    <View
                      style={[
                        styles.searchBar,
                        {
                          backgroundColor: currentTheme.cardBackground,
                          borderColor: currentTheme.secondaryText + '20',
                        },
                      ]}
                    >
                      <Search size={16} color={currentTheme.secondaryText} />
                      <TextInput
                        value={filters.query}
                        onChangeText={value => setFilters(prev => ({ ...prev, query: value }))}
                        placeholder={`Search ${currentProvider.label} by title, summary, tag, or keyword`}
                        placeholderTextColor={currentTheme.secondaryText + '80'}
                        style={[styles.searchInput, { color: currentTheme.text }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.rangeRow}>
                      <View style={styles.rangeField}>
                        <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                          Min Chapters
                        </ThemedText>
                        <TextInput
                          value={filters.minChapters == null ? '' : String(filters.minChapters)}
                          onChangeText={value =>
                            setFilters(prev => ({
                              ...prev,
                              minChapters: value.trim() ? Math.max(1, Number(value) || 1) : null,
                            }))
                          }
                          placeholder="Any"
                          placeholderTextColor={currentTheme.secondaryText + '70'}
                          keyboardType="number-pad"
                          style={[
                            styles.rangeInput,
                            {
                              color: currentTheme.text,
                              backgroundColor: currentTheme.cardBackground,
                              borderColor: currentTheme.secondaryText + '20',
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.rangeField}>
                        <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                          Max Chapters
                        </ThemedText>
                        <TextInput
                          value={filters.maxChapters == null ? '' : String(filters.maxChapters)}
                          onChangeText={value =>
                            setFilters(prev => ({
                              ...prev,
                              maxChapters: value.trim() ? Math.max(1, Number(value) || 1) : null,
                            }))
                          }
                          placeholder="No cap"
                          placeholderTextColor={currentTheme.secondaryText + '70'}
                          keyboardType="number-pad"
                          style={[
                            styles.rangeInput,
                            {
                              color: currentTheme.text,
                              backgroundColor: currentTheme.cardBackground,
                              borderColor: currentTheme.secondaryText + '20',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.rangeRow}>
                      <View style={styles.rangeField}>
                        <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                          Min Rating
                        </ThemedText>
                        <TextInput
                          value={filters.minRating == null ? '' : String(filters.minRating)}
                          onChangeText={value =>
                            setFilters(prev => ({
                              ...prev,
                              minRating: value.trim() ? Math.max(1, Number(value) || 1) : null,
                            }))
                          }
                          placeholder="Off"
                          placeholderTextColor={currentTheme.secondaryText + '70'}
                          keyboardType="decimal-pad"
                          style={[
                            styles.rangeInput,
                            {
                              color: currentTheme.text,
                              backgroundColor: currentTheme.cardBackground,
                              borderColor: currentTheme.secondaryText + '20',
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.rangeField}>
                        <ThemedText variant="secondary" size="caption" weight="medium" style={styles.rangeLabel}>
                          Min Reviews
                        </ThemedText>
                        <TextInput
                          value={filters.minReviewCount == null ? '' : String(filters.minReviewCount)}
                          onChangeText={value =>
                            setFilters(prev => ({
                              ...prev,
                              minReviewCount: value.trim() ? Math.max(1, Number(value) || 1) : null,
                            }))
                          }
                          placeholder="Off"
                          placeholderTextColor={currentTheme.secondaryText + '70'}
                          keyboardType="number-pad"
                          style={[
                            styles.rangeInput,
                            {
                              color: currentTheme.text,
                              backgroundColor: currentTheme.cardBackground,
                              borderColor: currentTheme.secondaryText + '20',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.filterRow}>
                      {renderFilterChip('Latest', filters.latestOnly, () => setFilters(prev => ({ ...prev, latestOnly: !prev.latestOnly, page: 1 })))}
                      {renderFilterChip('All', filters.status === 'all', () => setFilters(prev => ({ ...prev, status: 'all' })))}
                      {renderFilterChip('Ongoing', filters.status === 'ongoing', () => setFilters(prev => ({ ...prev, status: 'ongoing' })))}
                      {renderFilterChip('Completed', filters.status === 'completed', () => setFilters(prev => ({ ...prev, status: 'completed' })))}
                    </View>

                    <View style={styles.filterRow}>
                      {renderFilterChip('Updated', filters.orderBy === 'update', () => setFilters(prev => ({ ...prev, orderBy: 'update' })))}
                      {renderFilterChip('Rating', filters.orderBy === 'rating', () => setFilters(prev => ({ ...prev, orderBy: 'rating' })))}
                      {renderFilterChip('Chapters', filters.orderBy === 'chapter', () => setFilters(prev => ({ ...prev, orderBy: 'chapter' })))}
                      {renderFilterChip(filters.order === 'desc' ? 'Desc' : 'Asc', true, () => setFilters(prev => ({ ...prev, order: prev.order === 'desc' ? 'asc' : 'desc' })))}
                    </View>

                    <PressableScale
                      onPress={() => void performSearch(false)}
                      disabled={!bridgeReady || searching}
                      style={[styles.primaryBtn, { backgroundColor: currentTheme.accent, opacity: !bridgeReady || searching ? 0.7 : 1 }]}
                    >
                      {searching ? <ActivityIndicator size="small" color="#FFF" /> : <Search size={18} color="#FFF" />}
                      <ThemedText style={styles.primaryBtnText}>
                        {searching ? 'Searching…' : `Search ${currentProvider.label}`}
                      </ThemedText>
                    </PressableScale>
                  </View>

                  <View style={styles.resultsHeader}>
                    <ThemedText variant="primary" size="body" weight="semibold">
                      Results
                    </ThemedText>
                    <ThemedText variant="secondary" size="caption">
                      {results.length} novels loaded
                    </ThemedText>
                  </View>

                  {loadingDetails ? (
                    <View style={styles.centerState}>
                      <ActivityIndicator size="large" color={currentTheme.accent} />
                    </View>
                  ) : results.length === 0 ? (
                    <View style={styles.centerState}>
                      <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                        {searching ? 'Searching…' : `No novels loaded yet from ${currentProvider.label}.`}
                      </ThemedText>
                    </View>
                  ) : (
                    <>
                      {results.map(item => (
                        <PressableScale
                          key={`${item.rawId}:${item.slug}`}
                          onPress={() => void openNovel(item)}
                          style={[
                            styles.resultCard,
                            {
                              backgroundColor: currentTheme.background,
                              borderColor: currentTheme.secondaryText + '16',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.resultCoverWrap,
                              { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '15' },
                            ]}
                          >
                            {item.coverUrl ? (
                              <Image source={{ uri: item.coverUrl }} resizeMode="cover" style={styles.resultCover} />
                            ) : (
                              <View style={styles.coverFallback}>
                                <BookOpenText size={24} color={currentTheme.accent} />
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1, gap: 6 }}>
                            <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={2}>
                              {item.title}
                            </ThemedText>
                            <ThemedText variant="secondary" size="caption" numberOfLines={1}>
                              {item.author || 'Unknown Author'}
                            </ThemedText>
                            <ThemedText variant="secondary" size="caption" numberOfLines={3} style={{ lineHeight: 18 }}>
                              {item.summary || 'No description preview available.'}
                            </ThemedText>
                            <View style={styles.metaRow}>
                              {renderFilterChip(item.providerLabel, false, () => {})}
                              {item.chapterCount ? renderFilterChip(`${item.chapterCount} ch`, false, () => {}) : null}
                              {item.status ? renderFilterChip(item.status, false, () => {}) : null}
                            </View>
                          </View>
                        </PressableScale>
                      ))}

                      {hasMore ? (
                        <PressableScale
                          onPress={() => void performSearch(true)}
                          disabled={searching}
                          style={[styles.secondaryBtn, { borderColor: currentTheme.secondaryText + '18' }]}
                        >
                          <ChevronDown size={16} color={currentTheme.text} />
                          <ThemedText variant="primary" size="caption" weight="semibold">
                            Load More
                          </ThemedText>
                        </PressableScale>
                      ) : null}
                    </>
                  )}
                </View>
              )}
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
    minHeight: '78%',
    maxHeight: '94%',
  },
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
    right: 0,
    bottom: 0,
  },
  captchaWebView: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: 8,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 12,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    fontSize: 15,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rangeField: {
    flex: 1,
  },
  rangeLabel: {
    marginBottom: 8,
  },
  rangeInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  resultCoverWrap: {
    width: 84,
    height: 116,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultCover: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTopRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailHero: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  coverWrap: {
    width: 118,
    height: 170,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 10,
  },
  chapterRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
});
