import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
  StatusBar,
  Share,
  Linking,
  ScrollView,
  InteractionManager,
  Image,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import ReaderWebView from '@/components/reader/ReaderWebView';
import { getInfoAsync as getFileInfoAsync } from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Brightness from 'expo-brightness';
import * as NavigationBar from 'expo-navigation-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { VolumeManager } from 'react-native-volume-manager';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { useTerms } from '@/context/TermsContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { AppDialog } from '@/components/ui/AppDialog';
import { parseEpub, ParsedEpub, type EpubChapter } from '@/utils/epub-parser';
import { isCacheFresh, getCachedBook, cacheBook } from '@/utils/chapter-cache';
import { logger, captureError } from '@/utils/logger';
import {
  startReadingSession,
  endReadingSession,
  recordWordsRead,
  getReadingStats,
} from '@/utils/reading-stats';
import { annotationsToMarkdown, annotationsToPlainText } from '@/utils/export-annotations';
import { Book } from '@/types/book';
import { fontOptions, Theme } from '@/types/theme';
import { getFontStack, getLocalFontFaceCss } from '@/utils/fonts';
import { isSafeEmbeddedUrl, isSafeExternalUrl } from '@/utils/url-safety';
import { getThemeCategory, getThemeUiSectionsCopy } from '@/utils/theme-effects';
import {
  buildBionicToggleJS,
  buildBlueLightFilterJS,
  buildColumnWidthInjectionJS,
  buildFontFamilyInjectionJS,
  buildMarginInjectionJS,
  buildThemeInjectionJS,
  buildTypographyInjectionJS,
} from '@/utils/webview-injector';
import { BookLoadingAnimation } from '@/components/reader/BookLoadingAnimation';
import { SelectionToolbar, SelectionData, HighlightData } from '@/components/reader/SelectionToolbar';
import { SearchInBookModal } from '@/components/reader/SearchInBookModal';
import { AnnotationsDrawer } from '@/components/reader/AnnotationsDrawer';
import { ReaderLayoutPanel } from '@/components/reader/ReaderLayoutPanel';
import { ReadingStatsModal } from '@/components/reader/ReadingStatsModal';
import { TranslationSheet } from '@/components/reader/TranslationSheet';
import { InlineLookupModal } from '@/components/reader/InlineLookupModal';
import { DictionaryLookupModal } from '@/components/reader/DictionaryLookupModal';
import { DictionaryLibraryModal } from '@/components/dictionary/DictionaryLibraryModal';
import { AddTermModal } from '@/components/terms/AddTermModal';
import type { Term } from '@/types/terms';
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Type,
  List,
  Sun,
  Moon,
  Minus,
  Plus,
  AlignLeft,
  AlignJustify,
  Palette,
  X,
  Search,
  Layers,
  BarChart2,
  Columns,
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ScrollRestoreMode = 'saved' | 'chapterStart' | 'preserve';

function countChapterWords(ch: Pick<EpubChapter, 'content' | 'wordCount'>): number {
  if (ch.wordCount != null) return ch.wordCount;
  return ch.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function uniqueSortedChapterIndices(indices: number[]): number[] {
  return Array.from(new Set(indices))
    .filter(index => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b);
}

function escapeHtmlContent(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlContent(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isLatinTerm(text: string): boolean {
  // Returns true if the term consists primarily of Latin/ASCII characters
  // (i.e., not pure CJK) — only Latin terms need word-boundary enforcement
  return /[a-zA-Z]/.test(text) && !/[\u4e00-\u9fff\u3040-\u30ff]/.test(text);
}

function isWordBoundary(text: string, index: number): boolean {
  // Check if position is at a word boundary (start/end of string or non-alphanumeric char)
  if (index < 0 || index > text.length) return true;
  if (index === 0 || index === text.length) return true;
  const charCode = text.charCodeAt(index);
  // Word chars: a-z, A-Z, 0-9
  return !(
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122) ||
    (charCode >= 48 && charCode <= 57)
  );
}

function replaceTermsInTextSegment(
  text: string,
  terms: Term[],
  chapterIndex: number,
  counterRef: { value: number }
): string {
  if (!text || !terms.length) {
    return text;
  }

  const loweredText = text.toLowerCase();
  const matches: Array<{ start: number; end: number; term: Term }> = [];

  for (const term of terms) {
    const original = term.originalText.trim();
    const corrected = term.correctedText.trim();
    if (!original || !corrected) {
      continue;
    }

    const loweredOriginal = original.toLowerCase();
    const needsBoundary = isLatinTerm(original);
    let cursor = 0;
    while (cursor < loweredText.length) {
      const start = loweredText.indexOf(loweredOriginal, cursor);
      if (start === -1) {
        break;
      }
      const end = start + original.length;

      // For Latin terms, enforce word boundaries to avoid partial matches
      // e.g., prevent "xinnai" matching inside "jiu xinnai" at a non-boundary
      if (!needsBoundary || (isWordBoundary(loweredText, start) && isWordBoundary(loweredText, end))) {
        matches.push({ start, end, term });
      }
      cursor = start + Math.max(1, loweredOriginal.length);
    }
  }

  if (!matches.length) {
    return text;
  }

  matches.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return (b.end - b.start) - (a.end - a.start);
  });

  const accepted: Array<{ start: number; end: number; term: Term }> = [];
  let consumedUntil = -1;
  for (const match of matches) {
    if (match.start < consumedUntil) {
      continue;
    }
    accepted.push(match);
    consumedUntil = match.end;
  }

  if (!accepted.length) {
    return text;
  }

  let cursor = 0;
  let output = '';
  for (const match of accepted) {
    output += text.slice(cursor, match.start);
    counterRef.value += 1;
    const termKey = `${match.term.id}_${chapterIndex}_${counterRef.value}`;
    output += `<span class="miyo-term-replaced" tabindex="0" role="button" data-term-id="${escapeHtmlAttribute(match.term.id)}" data-term-key="${escapeHtmlAttribute(termKey)}" data-term-original="${escapeHtmlAttribute(match.term.originalText)}" data-term-translation="${escapeHtmlAttribute(match.term.translationText || '')}" data-term-corrected="${escapeHtmlAttribute(match.term.correctedText)}" data-current-text="${escapeHtmlAttribute(match.term.correctedText)}" title="${escapeHtmlAttribute(match.term.correctedText)}">${escapeHtmlContent(match.term.correctedText)}</span>`;
    cursor = match.end;
  }

  output += text.slice(cursor);
  return output;
}

function replaceTermsInHtmlContent(content: string, terms: Term[], chapterIndex: number): string {
  if (!content || !terms.length) {
    return content;
  }

  const counterRef = { value: 0 };
  return String(content)
    .split(/(<[^>]+>)/g)
    .map(part => {
      if (!part || part.startsWith('<')) {
        return part;
      }
      return replaceTermsInTextSegment(part, terms, chapterIndex, counterRef);
    })
    .join('');
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentTheme,
    typography,
    readingSettings,
    themes,
    setTheme,
    toggleThemeMode,
    setTypography,
    setReadingSettings,
  } = useTheme();
  const {
    getBook,
    updateBook,
    saveReadingPosition,
    getReadingPosition,
    addBookmark,
    getBookmarksByBook,
    removeBookmark,
    addHighlight,
    getHighlightsByBook,
    removeHighlight,
    highlights,
    bookmarks,
  } = useLibrary();
  const { getTermsForBook } = useTerms();

  const [book, setBook] = useState<Book | null>(null);
  const [parsedEpub, setParsedEpub] = useState<ParsedEpub | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showChapterDrawer, setShowChapterDrawer] = useState(false);
  const [showTypographyPanel, setShowTypographyPanel] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showThemeInfoDialog, setShowThemeInfoDialog] = useState(false);
  const [chapterScrollPercent, setChapterScrollPercent] = useState(0);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [visibleChapterIndex, setVisibleChapterIndex] = useState(0);
  const [loadedChapterIndices, setLoadedChapterIndices] = useState<number[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [chapterHighlights, setChapterHighlights] = useState<any[]>([]);
  const [searchHighlightTerm, setSearchHighlightTerm] = useState('');
  const [estimatedWordsRead, setEstimatedWordsRead] = useState(0);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [restoredScrollPosition, setRestoredScrollPosition] = useState(0);
  const [showAddTermModal, setShowAddTermModal] = useState(false);
  const [addTermInitialText, setAddTermInitialText] = useState('');
  const [termPopover, setTermPopover] = useState<{
    term: Term;
    termKey: string;
    x: number;
    y: number;
  } | null>(null);
  const [paceWpm, setPaceWpm] = useState(200);
  const [translationSheet, setTranslationSheet] = useState<{ open: boolean; text: string }>({
    open: false,
    text: '',
  });
  const [sleepDeadlineMs, setSleepDeadlineMs] = useState<number | null>(null);
  const [sleepUiTick, setSleepUiTick] = useState(0);
  const [lookupModal, setLookupModal] = useState<{ visible: boolean; title: string; uri: string }>({
    visible: false,
    title: '',
    uri: '',
  });
  const [dictionaryLookupWord, setDictionaryLookupWord] = useState('');
  const [showDictionaryLookup, setShowDictionaryLookup] = useState(false);
  const [showDictionaryLibrary, setShowDictionaryLibrary] = useState(false);
  const [webFontFaceCss, setWebFontFaceCss] = useState('');
  const [sleepTimerDialogVisible, setSleepTimerDialogVisible] = useState(false);
  const [scrollRestoreMode, setScrollRestoreMode] = useState<ScrollRestoreMode>('saved');

  const webViewRef = useRef<React.ComponentRef<typeof ReaderWebView>>(null);
  const pendingChapterAnchorRef = useRef<string | null>(null);
  const chapterScrollPercentRef = useRef(0);
  const lastScrollPositionRef = useRef(0);
  const chapterIndexRef = useRef(0);
  const persistScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordsRecordedRef = useRef(0);
  const bottomChapterNavLockRef = useRef(false);
  const volumeLevelRef = useRef<number | null>(null);
  const restoringVolumeRef = useRef(false);
  const lastVolumeNavAtRef = useRef(0);
  // Track last term-tap timestamp to suppress tap-to-scroll/toolbar when a term was just tapped
  const lastTermTapAtRef = useRef(0);
  const toolbarOpacity = useSharedValue(0);
  const progressOpacity = useSharedValue(1);
  const toolbarTranslateY = useSharedValue(-20);
  const continuousReadingEnabled = readingSettings.autoAdvanceChapter;
  const activeChapterIndex = continuousReadingEnabled ? visibleChapterIndex : currentChapterIndex;
  const normalReaderThemes = useMemo(
    () => themes.filter(theme => getThemeCategory(theme) === 'normal'),
    [themes]
  );
  const specialReaderThemes = useMemo(
    () => themes.filter(theme => getThemeCategory(theme) === 'special'),
    [themes]
  );
  const themeSectionCopy = useMemo(() => getThemeUiSectionsCopy(currentTheme), [currentTheme]);
  const webMessageTargetOrigin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? JSON.stringify(window.location.origin)
      : "'*'";

  // Load book and parse EPUB
  useEffect(() => {
    const loadBook = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        setLoadError(null);

        const foundBook = getBook(id);
        if (!foundBook) {
          setLoadError('Book not found in library');
          setIsLoading(false);
          return;
        }

        setBook(foundBook);

        const fileInfo = await getFileInfoAsync(foundBook.filePath);
        if (!fileInfo.exists) {
          setLoadError('EPUB file not found. It may have been moved or deleted.');
          setIsLoading(false);
          return;
        }

        logger.info('Checking cache for read', { title: foundBook.title });
        const isFresh = await isCacheFresh(id, foundBook.filePath);
        let parsed: ParsedEpub;

        if (isFresh) {
          logger.info('Cache hit, loading from filesystem');
          const cached = await getCachedBook(id);
          if (cached) {
            parsed = {
              metadata: cached.metadata,
              chapters: cached.chapters,
              totalChapters: cached.chapters.length,
              extractedCss: cached.extractedCss,
            };
          } else {
            throw new Error('Cache read failed despite being fresh');
          }
        } else {
          logger.info('Cache miss, parsing EPUB from scratch');
          await new Promise<void>(resolve => {
            InteractionManager.runAfterInteractions(() => resolve());
          });
          parsed = await parseEpub(foundBook.filePath);
          
          // Background caching
          setTimeout(() => {
            cacheBook(id, foundBook.filePath, {
              metadata: parsed.metadata,
              chapters: parsed.chapters,
              extractedCss: parsed.extractedCss,
            }).catch(e => logger.error('Cache write failed', e));
          }, 1000);
        }

        setParsedEpub(parsed);

        const savedPosition = await getReadingPosition(id);
        if (savedPosition && savedPosition.chapterIndex < parsed.chapters.length) {
          setCurrentChapterIndex(savedPosition.chapterIndex);
          setVisibleChapterIndex(savedPosition.chapterIndex);
          setLoadedChapterIndices([savedPosition.chapterIndex]);
          const savedScrollPosition = savedPosition.scrollPosition || 0;
          setLastScrollPosition(savedScrollPosition);
          setRestoredScrollPosition(savedScrollPosition);
          setScrollRestoreMode('saved');
        } else {
          setCurrentChapterIndex(0);
          setVisibleChapterIndex(0);
          setLoadedChapterIndices([0]);
          setLastScrollPosition(0);
          setRestoredScrollPosition(0);
          setScrollRestoreMode('chapterStart');
        }

        await updateBook(id, {
          title: parsed.metadata.title !== 'Unknown Title' ? parsed.metadata.title : foundBook.title,
          author: parsed.metadata.author !== 'Unknown Author' ? parsed.metadata.author : foundBook.author,
          totalChapters: parsed.totalChapters,
          lastReadAt: new Date().toISOString(),
          readingStatus: 'reading',
        });

        logger.info('EPUB loaded successfully', {
          chapters: parsed.chapters.length,
          title: parsed.metadata.title,
        });
      } catch (error) {
        captureError('Load EPUB', error);
        setLoadError('Failed to load this EPUB file. The file may be corrupted or unsupported.');
      } finally {
        setIsLoading(false);
      }
    };

    loadBook();
  }, [id]);

  useEffect(() => {
    if (!book?.id) return;
    startReadingSession(book.id);
    wordsRecordedRef.current = 0;
    return () => {
      void endReadingSession();
    };
  }, [book?.id]);

  useEffect(() => {
    getReadingStats().then(s => {
      const w = s.averageWordsPerMinute;
      setPaceWpm(w >= 40 && w <= 500 ? w : 200);
    });
  }, []);

  useEffect(() => {
    if (!book?.id || !parsedEpub) return;
    const tag = 'miyo-reader';
    if (readingSettings.keepScreenOn) {
      void activateKeepAwakeAsync(tag);
    } else {
      void deactivateKeepAwake(tag);
    }
    return () => {
      void deactivateKeepAwake(tag);
    };
  }, [book?.id, parsedEpub, readingSettings.keepScreenOn]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'android') {
        void Brightness.restoreSystemBrightnessAsync();
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (Platform.OS === 'android') {
          try {
            NavigationBar.setVisibilityAsync('visible');
            NavigationBar.setBehaviorAsync('inset-swipe');
          } catch {
            /* ignore */
          }
        }
      };
    }, [])
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setVisibilityAsync(showToolbar ? 'visible' : 'hidden');
      } catch {
        /* ignore */
      }
    })();
  }, [showToolbar]);

  useEffect(() => {
    chapterScrollPercentRef.current = chapterScrollPercent;
  }, [chapterScrollPercent]);
  useEffect(() => {
    lastScrollPositionRef.current = lastScrollPosition;
  }, [lastScrollPosition]);
  useEffect(() => {
    chapterIndexRef.current = activeChapterIndex;
  }, [activeChapterIndex]);

  useEffect(() => {
    bottomChapterNavLockRef.current = false;
  }, [currentChapterIndex]);

  // Sync toolbar visibility with smooth animation
  useEffect(() => {
    toolbarOpacity.value = withTiming(showToolbar ? 1 : 0, { duration: 220 });
    toolbarTranslateY.value = withTiming(showToolbar ? 0 : -16, { duration: 220 });
    progressOpacity.value = withTiming(showToolbar ? 0 : 1, { duration: 220 });
  }, [showToolbar]);

  // Check bookmark status for current chapter
  useEffect(() => {
    if (!id) return;
    const allBookmarks = getBookmarksByBook(id);
    const isCurrentBookmarked = allBookmarks.some(b => b.chapterIndex === activeChapterIndex);
    setIsBookmarked(isCurrentBookmarked);

    const visibleChapterSet = new Set(
      continuousReadingEnabled
        ? loadedChapterIndices
        : [activeChapterIndex]
    );
    const bookChapterHighlights = getHighlightsByBook(id).filter(
      h => visibleChapterSet.has(h.chapterIndex)
    );
    setChapterHighlights(bookChapterHighlights);
  }, [id, activeChapterIndex, highlights, bookmarks, continuousReadingEnabled, loadedChapterIndices]);

  useEffect(() => {
    if (!parsedEpub?.chapters.length) return;

    if (!continuousReadingEnabled) {
      setLoadedChapterIndices([currentChapterIndex]);
      return;
    }

    setLoadedChapterIndices(prev => {
      if (prev.length === 0) return [currentChapterIndex];
      if (prev.includes(currentChapterIndex)) return prev;
      return uniqueSortedChapterIndices([...prev, currentChapterIndex]);
    });
  }, [continuousReadingEnabled, currentChapterIndex, parsedEpub?.chapters.length]);

  // Estimate words read (completed chapters + scroll position in current)
  useEffect(() => {
    if (!parsedEpub) return;
    let wordCount = 0;
    for (let i = 0; i < activeChapterIndex && i < parsedEpub.chapters.length; i++) {
      const w = parsedEpub.chapters[i].wordCount;
      if (w != null) wordCount += w;
      else {
        const text = parsedEpub.chapters[i].content.replace(/<[^>]+>/g, ' ').trim();
        wordCount += text.split(/\s+/).filter(Boolean).length;
      }
    }
    const cur = parsedEpub.chapters[activeChapterIndex];
    if (cur) {
      const cw =
        cur.wordCount ??
        cur.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      wordCount += (chapterScrollPercent / 100) * cw;
    }
    const rounded = Math.round(wordCount);
    setEstimatedWordsRead(rounded);
    if (!book?.id) return;
    const delta = rounded - wordsRecordedRef.current;
    if (delta >= 40) {
      recordWordsRead(delta);
      wordsRecordedRef.current = rounded;
    }
  }, [activeChapterIndex, parsedEpub, chapterScrollPercent, book?.id]);

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
    transform: [{ translateY: toolbarTranslateY.value }],
  }));

  const bottomToolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
    transform: [{ translateY: withTiming(showToolbar ? 0 : 20, { duration: 220 }) }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const appliedTerms = useMemo(() => {
    if (!book?.id) return [] as Term[];
    return getTermsForBook(book.id)
      .filter(term => term.originalText?.trim() && term.correctedText?.trim())
      .sort((a, b) => b.originalText.length - a.originalText.length);
  }, [book?.id, getTermsForBook]);

  const appliedTermsById = useMemo(
    () => new Map(appliedTerms.map(term => [term.id, term])),
    [appliedTerms]
  );

  const appliedTermsSignature = useMemo(
    () =>
      JSON.stringify(
        appliedTerms.map(term => ({
          id: term.id,
          originalText: term.originalText,
          translationText: term.translationText || '',
          correctedText: term.correctedText,
          context: term.context || '',
          imageUri: term.imageUri || '',
          updatedAt: term.updatedAt || '',
        }))
      ),
    [appliedTerms]
  );

  const previousAppliedTermsSignatureRef = useRef('');

  useEffect(() => {
    if (!parsedEpub || !book?.id) {
      previousAppliedTermsSignatureRef.current = appliedTermsSignature;
      return;
    }
    if (
      previousAppliedTermsSignatureRef.current &&
      previousAppliedTermsSignatureRef.current !== appliedTermsSignature
    ) {
      setRestoredScrollPosition(lastScrollPositionRef.current);
      setScrollRestoreMode('preserve');
    }
    previousAppliedTermsSignatureRef.current = appliedTermsSignature;
  }, [appliedTermsSignature, book?.id, parsedEpub]);

  const leftZoneWidth = screenWidth * 0.25;
  const rightZoneStart = screenWidth * 0.75;

  const injectScrollByPage = useCallback(
    (direction: 'up' | 'down') => {
      const ratio = Math.min(0.95, Math.max(0.35, readingSettings.tapScrollPageRatio));
      const sign = direction === 'down' ? 1 : -1;
      webViewRef.current?.injectJavaScript(`
        (function(){
          var targetY = window.scrollY + (${sign} * window.innerHeight * ${ratio});
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        })();
        true;
      `);
    },
    [readingSettings.tapScrollPageRatio]
  );

  const openChapterAt = useCallback((
    index: number,
    options?: {
      searchTerm?: string;
      keepLoaded?: boolean;
      preserveScroll?: boolean;
      restoreMode?: ScrollRestoreMode;
    }
  ) => {
    if (!parsedEpub?.chapters.length) return;
    const target = Math.max(0, Math.min(index, parsedEpub.chapters.length - 1));

    setCurrentChapterIndex(target);
    setVisibleChapterIndex(target);
    setShowChapterDrawer(false);
    setShowToolbar(false);
    setSelection(null);
    setSearchHighlightTerm(options?.searchTerm || '');
    bottomChapterNavLockRef.current = false;

    if (continuousReadingEnabled && options?.keepLoaded) {
      setLoadedChapterIndices(prev => uniqueSortedChapterIndices([...prev, target]));
    } else {
      setLoadedChapterIndices([target]);
    }

    if (options?.preserveScroll) {
      setRestoredScrollPosition(lastScrollPositionRef.current);
      setScrollRestoreMode('preserve');
    } else {
      setLastScrollPosition(0);
      setRestoredScrollPosition(0);
      setScrollRestoreMode(options?.restoreMode || 'chapterStart');
    }

    setChapterScrollPercent(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [continuousReadingEnabled, parsedEpub?.chapters.length]);

  const navigateChapter = useCallback((direction: 'prev' | 'next') => {
    if (!parsedEpub) return;
    const totalChapters = parsedEpub.chapters.length;
    if (direction === 'prev' && activeChapterIndex > 0) {
      openChapterAt(activeChapterIndex - 1, {
        keepLoaded: continuousReadingEnabled,
        restoreMode: 'chapterStart',
      });
    } else if (direction === 'next' && activeChapterIndex < totalChapters - 1) {
      openChapterAt(activeChapterIndex + 1, {
        keepLoaded: continuousReadingEnabled,
        restoreMode: 'chapterStart',
      });
    }
  }, [parsedEpub, activeChapterIndex, openChapterAt, continuousReadingEnabled]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;
    VolumeManager.showNativeVolumeUI({ enabled: !readingSettings.volumeButtonPageTurn }).catch(() => null);

    if (!readingSettings.volumeButtonPageTurn) {
      return () => {
        VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => null);
      };
    }

    VolumeManager.getVolume()
      .then(({ volume }) => {
        if (mounted) volumeLevelRef.current = volume;
      })
      .catch(() => null);

    const sub = VolumeManager.addVolumeListener(async ({ volume, type }) => {
      if (type && type !== 'music') return;

      const previousVolume = volumeLevelRef.current;
      volumeLevelRef.current = volume;

      if (restoringVolumeRef.current) {
        restoringVolumeRef.current = false;
        return;
      }

      if (previousVolume == null) return;

      const delta = volume - previousVolume;
      if (Math.abs(delta) < 0.02) return;

      const now = Date.now();
      if (now - lastVolumeNavAtRef.current < 180) return;
      lastVolumeNavAtRef.current = now;

      if (delta > 0) {
        if (readingSettings.tapZoneNavMode === 'chapter') {
          navigateChapter('prev');
        } else {
          injectScrollByPage('up');
        }
      } else if (readingSettings.tapZoneNavMode === 'chapter') {
        navigateChapter('next');
      } else {
        injectScrollByPage('down');
      }

      restoringVolumeRef.current = true;
      volumeLevelRef.current = previousVolume;

      try {
        await VolumeManager.setVolume(previousVolume, {
          showUI: false,
          playSound: false,
          type: 'music',
        });
      } catch {
        restoringVolumeRef.current = false;
      }
    });

    return () => {
      mounted = false;
      sub.remove();
      VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => null);
    };
  }, [
    readingSettings.volumeButtonPageTurn,
    readingSettings.tapZoneNavMode,
    injectScrollByPage,
    navigateChapter,
  ]);

  const handleTap = useCallback(
    async (x: number) => {
      // Suppress tap actions if a term was just tapped (within 350ms)
      if (Date.now() - lastTermTapAtRef.current < 350) return;

      if (selection) {
        setSelection(null);
        return;
      }
      if (!readingSettings.tapZonesEnabled) {
        setShowToolbar(prev => !prev);
        return;
      }
      if (x < leftZoneWidth) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (readingSettings.tapZoneNavMode === 'chapter') {
          navigateChapter('prev');
        } else {
          injectScrollByPage('up');
        }
      } else if (x > rightZoneStart) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (readingSettings.tapZoneNavMode === 'chapter') {
          navigateChapter('next');
        } else {
          injectScrollByPage('down');
        }
      } else {
        setShowToolbar(prev => !prev);
      }
    },
    [
      readingSettings.tapZonesEnabled,
      readingSettings.tapZoneNavMode,
      selection,
      navigateChapter,
      injectScrollByPage,
    ]
  );

  const goToChapter = useCallback((index: number, searchTerm?: string) => {
    openChapterAt(index, {
      searchTerm,
      keepLoaded: false,
      restoreMode: 'chapterStart',
    });
  }, [openChapterAt]);

  const handleBack = useCallback(async () => {
    if (book && parsedEpub?.chapters.length) {
      const n = parsedEpub.chapters.length;
      const seg = 100 / n;
      const progress = Math.min(
        100,
        Math.round(activeChapterIndex * seg + (seg * chapterScrollPercent) / 100)
      );
      const updates: Partial<Book> = { progress, currentChapter: activeChapterIndex };
      if (progress >= 100) {
        updates.readingStatus = 'finished';
      } else if (progress > 0 && book.readingStatus === 'unread') {
        updates.readingStatus = 'reading';
      }
      await updateBook(book.id, updates);
      await saveReadingPosition({
        bookId: book.id,
        chapterIndex: activeChapterIndex,
        scrollPosition: lastScrollPosition,
        chapterScrollPercent,
        timestamp: new Date().toISOString(),
      });
    }
    router.back();
  }, [
    book,
    parsedEpub,
    activeChapterIndex,
    chapterScrollPercent,
    lastScrollPosition,
    updateBook,
    saveReadingPosition,
    router,
  ]);

  const handleBackRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    handleBackRef.current = handleBack;
  }, [handleBack]);

  const scheduleScrollPersist = useCallback(() => {
    if (!book?.id || !parsedEpub?.chapters.length) return;
    if (persistScrollTimerRef.current) clearTimeout(persistScrollTimerRef.current);
    persistScrollTimerRef.current = setTimeout(() => {
      persistScrollTimerRef.current = null;
      const n = parsedEpub.chapters.length;
      const ci = chapterIndexRef.current;
      const csp = chapterScrollPercentRef.current;
      const lsp = lastScrollPositionRef.current;
      const seg = 100 / n;
      const pct = Math.min(100, Math.round(ci * seg + (seg * csp) / 100));
      const updates: Partial<Book> = { progress: pct, currentChapter: ci };
      if (pct >= 100) {
        updates.readingStatus = 'finished';
      } else if (pct > 0 && book.readingStatus === 'unread') {
        updates.readingStatus = 'reading';
      }
      void updateBook(book.id, updates);
      void saveReadingPosition({
        bookId: book.id,
        chapterIndex: ci,
        scrollPosition: lsp,
        chapterScrollPercent: csp,
        timestamp: new Date().toISOString(),
      });
    }, 1500);
  }, [book?.id, parsedEpub, saveReadingPosition, updateBook]);

  useEffect(() => {
    const m = readingSettings.sleepTimerMinutes;
    if (!m || m <= 0 || !book?.id) {
      setSleepDeadlineMs(null);
      return;
    }
    setSleepDeadlineMs(Date.now() + m * 60_000);
  }, [readingSettings.sleepTimerMinutes, book?.id]);

  useEffect(() => {
    if (!sleepDeadlineMs) return;
    const id = setInterval(() => {
      setSleepUiTick(x => x + 1);
      if (Date.now() >= sleepDeadlineMs) {
        setSleepDeadlineMs(null);
        setReadingSettings({ sleepTimerMinutes: 0, autoScrollSpeed: 0 });
        setSleepTimerDialogVisible(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepDeadlineMs, setReadingSettings]);

  useEffect(() => {
    const frag = pendingChapterAnchorRef.current;
    if (!frag) return;
    pendingChapterAnchorRef.current = null;
    const t = setTimeout(() => {
      const safe = JSON.stringify(frag);
      webViewRef.current?.injectJavaScript(`
        (function(){
          var id = ${safe};
          try {
            var el = document.getElementById(id) || document.querySelector('[name="' + String(id).replace(/"/g, '\\\\"') + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (e) {}
        })();
        true;
      `);
    }, 550);
    return () => clearTimeout(t);
  }, [currentChapterIndex]);

  const handleToggleBookmark = useCallback(async () => {
    if (!book) return;
    const allBookmarks = getBookmarksByBook(book.id);
    const existing = allBookmarks.find(b => b.chapterIndex === activeChapterIndex);

    if (existing) {
      await removeBookmark(existing.id);
      setIsBookmarked(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await addBookmark({
        id: `bm_${Date.now()}`,
        bookId: book.id,
        chapterIndex: activeChapterIndex,
        position: lastScrollPosition,
        text: parsedEpub?.chapters[activeChapterIndex]?.title || `Chapter ${activeChapterIndex + 1}`,
        createdAt: new Date().toISOString(),
      });
      setIsBookmarked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [book, activeChapterIndex, parsedEpub, getBookmarksByBook, removeBookmark, addBookmark, lastScrollPosition]);

  const handleHighlight = useCallback(async (data: HighlightData) => {
    if (!book) return;
    await addHighlight({
      id: `hl_${Date.now()}`,
      bookId: book.id,
      chapterIndex: activeChapterIndex,
      startOffset: 0,
      endOffset: data.text.length,
      text: data.text,
      color: data.color,
      note: data.note,
      createdAt: new Date().toISOString(),
    });
    const escapedText = data.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    webViewRef.current?.injectJavaScript(`
      (function() {
        window.__addHighlight && window.__addHighlight("${escapedText}", "${data.color}", "${data.textColor || ''}");
      })();
      true;
    `);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [book, activeChapterIndex]);

  const handleNote = useCallback(async (data: HighlightData) => {
    if (!book) return;
    await addHighlight({
      id: `hl_${Date.now()}`,
      bookId: book.id,
      chapterIndex: activeChapterIndex,
      startOffset: 0,
      endOffset: data.text.length,
      text: data.text,
      color: data.color,
      note: data.note,
      createdAt: new Date().toISOString(),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [book, activeChapterIndex]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await ExpoClipboard.setStringAsync(text);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
  }, []);

  const handleShare = useCallback(async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch { }
  }, []);

  const handleDictionary = useCallback((text: string) => {
    const word = (text.trim().split(/\s+/)[0] || '').slice(0, 80);
    if (!word) return;
    setDictionaryLookupWord(word);
    setShowDictionaryLookup(true);
  }, []);

  const handleTranslate = useCallback((text: string) => {
    setTranslationSheet({ open: true, text });
  }, []);

  const handleWikipedia = useCallback((text: string) => {
    const q = text.trim().slice(0, 240);
    if (!q) return;
    setLookupModal({
      visible: true,
      title: 'Wikipedia',
      uri: `https://en.m.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
    });
  }, []);

  const handleBookmarkSelection = useCallback(async (text: string) => {
    if (!book) return;
    await addBookmark({
      id: `bm_${Date.now()}`,
      bookId: book.id,
      chapterIndex: activeChapterIndex,
      position: lastScrollPosition,
      text: text.slice(0, 120),
      createdAt: new Date().toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [book, activeChapterIndex, lastScrollPosition]);

  const handleUnderline = useCallback(async (data: HighlightData) => {
    if (!book) return;
    await addHighlight({
      id: `hl_${Date.now()}`,
      bookId: book.id,
      chapterIndex: activeChapterIndex,
      startOffset: 0,
      endOffset: data.text.length,
      text: data.text,
      color: data.color,
      note: 'underline',
      createdAt: new Date().toISOString(),
    });
    const escapedText = data.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    webViewRef.current?.injectJavaScript(`
      (function() {
        window.__addHighlight && window.__addHighlight("${escapedText}", "transparent", "", "");
        var spans = document.querySelectorAll('.miyo-highlight');
        var last = spans[spans.length - 1];
        if (last) {
          last.style.backgroundColor = 'transparent';
          last.style.textDecoration = 'underline';
          last.style.textDecorationColor = '${data.color}';
          last.style.textUnderlineOffset = '3px';
        }
      })();
      true;
    `);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [book, activeChapterIndex]);

  const handleAddTerm = useCallback((text: string) => {
    setTermPopover(null);
    setSelection(null);
    setAddTermInitialText(text);
    setShowAddTermModal(true);
  }, []);

  const handleApplyTermVariant = useCallback((value: string) => {
    if (!termPopover) return;
    const safeTermKey = JSON.stringify(termPopover.termKey);
    const safeValue = JSON.stringify(value);
    webViewRef.current?.injectJavaScript(`
      (function() {
        if (window.__setTermVariant) {
          window.__setTermVariant(${safeTermKey}, ${safeValue});
        }
        if (window.__clearActiveTerm) {
          window.__clearActiveTerm();
        }
      })();
      true;
    `);
    setTermPopover(null);
  }, [termPopover]);

  const handleDeleteBookmark = useCallback(async (bmId: string) => {
    await removeBookmark(bmId);
  }, [removeBookmark]);

  const handleDeleteHighlight = useCallback(async (hlId: string) => {
    await removeHighlight(hlId);
    webViewRef.current?.injectJavaScript(`
      (function() {
        var spans = document.querySelectorAll('.miyo-highlight[data-id="${hlId}"]');
        spans.forEach(function(span) {
          var parent = span.parentNode;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
        });
      })();
      true;
    `);
  }, [removeHighlight]);

  const getMargins = () => {
    const base =
      screenWidth < 400
        ? screenWidth * 0.04
        : screenWidth < 600
          ? screenWidth * 0.06
          : Math.min(screenWidth * 0.1, Math.max(0, (screenWidth - 600) / 2));
    const mult =
      readingSettings.marginPreset === 'narrow' ? 0.55 : readingSettings.marginPreset === 'wide' ? 1.38 : 1;
    return Math.max(8, base * mult);
  };

  const margins = getMargins();
  const columnMaxPx = readingSettings.contentColumnWidth;
  const wrapInlineStyle = columnMaxPx
    ? `max-width:${columnMaxPx}px;margin-left:auto;margin-right:auto;width:100%;`
    : 'max-width:none;width:100%;';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextFontCss = await getLocalFontFaceCss(typography.fontFamily);
      if (!cancelled) {
        setWebFontFaceCss(nextFontCss);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typography.fontFamily]);

  const injectReaderDisplaySettings = useCallback(() => {
    if (!webViewRef.current) return;
    const fontStack = getFontStack(typography.fontFamily);
    const js = [
      buildThemeInjectionJS(currentTheme),
      buildTypographyInjectionJS(typography),
      buildFontFamilyInjectionJS(fontStack, webFontFaceCss),
      buildMarginInjectionJS(margins),
      buildColumnWidthInjectionJS(readingSettings.contentColumnWidth),
      buildBlueLightFilterJS(readingSettings.blueLightFilter),
      buildBionicToggleJS(readingSettings.bionicReading),
    ].join('\n');

    webViewRef.current.injectJavaScript(js);
  }, [
    currentTheme,
    typography,
    webFontFaceCss,
    margins,
    readingSettings.contentColumnWidth,
    readingSettings.blueLightFilter,
    readingSettings.bionicReading,
  ]);

  useEffect(() => {
    injectReaderDisplaySettings();
  }, [injectReaderDisplaySettings]);

  const buildRenderedChapterSection = useCallback((index: number) => {
    if (!parsedEpub) {
      return '';
    }

    const chapterItem = parsedEpub.chapters[index];
    if (!chapterItem) {
      return '';
    }

    const content = replaceTermsInHtmlContent(chapterItem.content, appliedTerms, index);

    const chapterHeading = (chapterItem.title || `Chapter ${index + 1}`)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `
      <section class="miyo-chapter-section" data-chapter-index="${index}" id="miyo-chapter-${index}">
        <div class="miyo-chapter-divider"></div>
        <header class="miyo-chapter-header">
          <div class="miyo-chapter-kicker">Chapter ${index + 1}</div>
          <h1 class="miyo-chapter-title">${chapterHeading}</h1>
        </header>
        <div class="miyo-chapter-content">${content}</div>
      </section>
    `;
  }, [parsedEpub, appliedTerms]);

  const appendChapterToReader = useCallback((index: number) => {
    const sectionHtml = buildRenderedChapterSection(index);
    if (!sectionHtml) {
      return false;
    }

    const chapterSpecificHighlights = chapterHighlights
      .filter(highlight => highlight.chapterIndex === index)
      .map(highlight => ({
        text: highlight.text,
        color: highlight.color,
        textColor: highlight.textColor || null,
        id: highlight.id,
        chapterIndex: highlight.chapterIndex,
      }));

    webViewRef.current?.injectJavaScript(`
      (function() {
        if (!window.__appendChapterSection) return;
        window.__appendChapterSection(
          ${JSON.stringify(sectionHtml)},
          ${index},
          ${JSON.stringify(chapterSpecificHighlights)},
          ${JSON.stringify(searchHighlightTerm)}
        );
      })();
      true;
    `);
    return true;
  }, [buildRenderedChapterSection, chapterHighlights, searchHighlightTerm]);

  const generateReaderHTML = () => {
    if (!parsedEpub) {
      return `<!DOCTYPE html><html><body style="background:${currentTheme.background};color:${currentTheme.text};font-family:sans-serif;padding:40px;text-align:center;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>Loading book...</p></body></html>`;
    }

    const fontStack = getFontStack(typography.fontFamily);
    const renderedChapterIndices = continuousReadingEnabled
      ? (loadedChapterIndices.length ? loadedChapterIndices : [currentChapterIndex])
      : [currentChapterIndex];

    const chapter = parsedEpub.chapters[currentChapterIndex];
    if (!chapter) {
      return `<!DOCTYPE html><html><body style="background:${currentTheme.background};color:${currentTheme.text};font-family:sans-serif;padding:40px;"><p>Chapter not found</p></body></html>`;
    }

    const highlightsJSON = JSON.stringify(
      chapterHighlights.map(h => ({
        text: h.text,
        color: h.color,
        textColor: h.textColor || null,
        id: h.id,
        chapterIndex: h.chapterIndex,
      }))
    );

    const renderedContent = renderedChapterIndices.map(index => buildRenderedChapterSection(index)).join('\n');

    const escapedSearchTerm = searchHighlightTerm
      ? searchHighlightTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\<')
      : '';

    const bionicInit = readingSettings.bionicReading
      ? `
      setTimeout(function miyoBionic() {
        try {
          var root = document.querySelector('.miyo-wrap') || document.body;
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          var nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          var budget = 14000;
          for (var i = 0; i < nodes.length && budget > 0; i++) {
            var node = nodes[i];
            var p = node.parentElement;
            if (!p) continue;
            var tag = p.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') continue;
            if (p.closest('code,pre,script,style,.miyo-highlight,.miyo-search-match')) continue;
            var t = node.nodeValue;
            if (!t || t.replace(/\\s/g, '').length < 12) continue;
            var parts = t.split(/(\\s+)/);
            var frag = document.createDocumentFragment();
            for (var j = 0; j < parts.length; j++) {
              var w = parts[j];
              if (!w || /^\\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); continue; }
              if (w.length < 4) { frag.appendChild(document.createTextNode(w)); continue; }
              var c = Math.max(1, Math.ceil(w.length * 0.42));
              var s = document.createElement('strong');
              s.className = 'miyo-bionic';
              s.style.fontWeight = '650';
              s.textContent = w.slice(0, c);
              frag.appendChild(s);
              frag.appendChild(document.createTextNode(w.slice(c)));
              budget -= w.length;
            }
            node.parentNode.replaceChild(frag, node);
          }
        } catch (e) {}
      }, 520);
`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <style id="miyo-initial-fonts">${webFontFaceCss}</style>
  <style>
    *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    :root {
      --bg: ${currentTheme.background};
      --fg: ${currentTheme.text};
      --fg2: ${currentTheme.secondaryText};
      --accent: ${currentTheme.accent};
      --card: ${currentTheme.cardBackground};
    }
    html {
      font-size: ${typography.fontSize}px;
      -webkit-text-size-adjust: 100%;
    }
    ${readingSettings.blueLightFilter ? `
    html::after {
      content: '';
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background-color: rgba(255, 120, 40, 0.32);
      pointer-events: none;
      z-index: 2147483647;
    }
    ` : ''}
    body {
      font-family: ${fontStack};
      font-size: 1rem;
      font-weight: ${typography.fontWeight};
      line-height: ${typography.lineHeight};
      letter-spacing: ${typography.letterSpacing}em;
      color: var(--fg);
      background-color: var(--bg);
      padding: 20px ${margins}px 80px;
      text-align: ${typography.textAlign};
      word-wrap: break-word;
      overflow-wrap: break-word;
      margin: 0;
      -webkit-font-smoothing: antialiased;
    }
    .miyo-wrap,
    .miyo-wrap p,
    .miyo-wrap div,
    .miyo-wrap span,
    .miyo-wrap li,
    .miyo-wrap a,
    .miyo-wrap blockquote,
    .miyo-wrap td,
    .miyo-wrap th,
    .miyo-wrap strong,
    .miyo-wrap em {
      font-family: ${fontStack} !important;
    }
    .miyo-wrap code,
    .miyo-wrap pre {
      font-family: "JetBrains Mono", "Courier New", monospace !important;
    }
    .miyo-wrap { box-sizing: border-box; }
    .miyo-chapter-section {
      position: relative;
      padding-bottom: 1.4rem;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .miyo-chapter-section + .miyo-chapter-section {
      margin-top: 2.2rem;
    }
    .miyo-chapter-divider {
      height: 1px;
      margin: 0 0 1.25rem;
      background: color-mix(in srgb, var(--fg2) 18%, transparent);
    }
    .miyo-chapter-header {
      margin-bottom: 1.25rem;
      padding-bottom: 0.4rem;
    }
    .miyo-chapter-kicker {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.72rem;
      font-weight: 700;
      margin-bottom: 0.3rem;
    }
    .miyo-chapter-title {
      margin: 0;
      font-size: 1.35em;
      line-height: 1.28;
    }
    .miyo-chapter-content > :first-child {
      margin-top: 0;
    }
    .miyo-wrap.miyo-two-col {
      column-count: 2;
      column-gap: 1.35em;
      column-fill: balance;
    }
    @media (max-width: 520px) {
      .miyo-wrap.miyo-two-col { column-count: 1; }
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${fontStack};
      margin-top: 1.5em; margin-bottom: 0.75em;
      line-height: 1.3; color: var(--fg); font-weight: 700;
    }
    h1 { font-size: 1.5em; } h2 { font-size: 1.3em; } h3 { font-size: 1.15em; }
    p { margin-top: 0; margin-bottom: ${typography.paragraphSpacing}px; hyphens: auto; -webkit-hyphens: auto; }
    p:first-of-type { text-indent: 0; }
    img { max-width: 100%; height: auto; display: block; margin: 1.2em auto; border-radius: 6px; }
    figure { margin: 1em 0; text-align: center; }
    figcaption { font-size: 0.85em; color: var(--fg2); margin-top: 0.5em; font-style: italic; }
    a { color: var(--accent); text-decoration: none; }
    a:active { opacity: 0.7; }
    blockquote {
      border-left: 3px solid var(--accent); margin: 1.2em 0;
      padding: 0.6em 1.2em; color: var(--fg2); font-style: italic;
      border-radius: 0 8px 8px 0; background: color-mix(in srgb, var(--accent) 5%, transparent);
    }
    pre { background: var(--card); padding: 1em; border-radius: 8px; overflow-x: auto; font-size: 0.85em; }
    code { font-family: 'Courier New', monospace; font-size: 0.85em; background: var(--card); padding: 2px 6px; border-radius: 4px; }
    pre code { background: transparent; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
    th, td { padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--fg2) 30%, transparent); text-align: left; }
    th { background: var(--card); font-weight: 600; }
    hr { border: none; border-top: 1px solid color-mix(in srgb, var(--fg2) 25%, transparent); margin: 2em 0; }
    ::selection { background-color: color-mix(in srgb, var(--accent) 40%, transparent); }
    ::-moz-selection { background-color: color-mix(in srgb, var(--accent) 40%, transparent); }
    .miyo-highlight { border-radius: 3px; transition: opacity 0.2s; }
    .miyo-term-replaced {
      display: inline;
      border-bottom: 1.5px dotted var(--accent);
      color: var(--accent);
      cursor: pointer;
      font-weight: 600;
      border-radius: 3px;
      padding: 0 0.04em;
    }
    .miyo-term-replaced[data-term-active="true"] {
      background-color: color-mix(in srgb, var(--accent) 14%, transparent);
      outline: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    }
    .miyo-search-match { background-color: color-mix(in srgb, var(--accent) 50%, transparent); border-radius: 3px; outline: 2px solid color-mix(in srgb, var(--accent) 80%, transparent); }
    ${parsedEpub?.extractedCss || ''}
  </style>
</head>
<body>
  <div class="miyo-wrap${readingSettings.columnLayout === 'two' ? ' miyo-two-col' : ''}" style="${wrapInlineStyle}">
  ${renderedContent}
  </div>
  <script>
    (function() {
      function notify(data) {
        try {
          var msg = JSON.stringify(data);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(msg);
          } else if (window.parent && window.parent !== window) {
            var targetOrigin = ${webMessageTargetOrigin};
            window.parent.postMessage(msg, targetOrigin);
          }
        } catch(e) {}
      }

      // Text selection tracking
      var selTimeout;
      document.addEventListener('selectionchange', function() {
        clearTimeout(selTimeout);
        selTimeout = setTimeout(function() {
          var sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) {
            var text = sel.toString().trim();
            var range = sel.getRangeAt(0);
            var rect = range.getBoundingClientRect();
            notify({ type: 'selection', text: text, x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
          } else if (!sel || sel.isCollapsed) {
            notify({ type: 'clearSelection' });
          }
        }, 80);
      });

      // Scroll tracking
      function computeChapterMetrics() {
        var sections = Array.prototype.slice.call(document.querySelectorAll('.miyo-chapter-section'));
        if (!sections.length) {
          return { chapterIndex: ${currentChapterIndex}, chapterScrollPercent: 0 };
        }
        var probeY = window.scrollY + Math.max(32, window.innerHeight * 0.22);
        var active = sections[0];
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].offsetTop <= probeY) active = sections[i];
          else break;
        }
        var next = active.nextElementSibling && active.nextElementSibling.classList && active.nextElementSibling.classList.contains('miyo-chapter-section')
          ? active.nextElementSibling
          : null;
        var start = active.offsetTop || 0;
        var end = next ? next.offsetTop : document.documentElement.scrollHeight;
        var span = Math.max(1, end - start - window.innerHeight * 0.35);
        var percent = Math.max(0, Math.min(100, ((window.scrollY - start) / span) * 100));
        return {
          chapterIndex: Number(active.getAttribute('data-chapter-index') || ${currentChapterIndex}),
          chapterScrollPercent: percent,
        };
      }

      var scrollTimer;
      window.addEventListener('scroll', function() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function() {
          var scrollH = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          var pct = scrollH > 0 ? (window.scrollY / scrollH) * 100 : 100;
          var atBottom = scrollH > 40 && window.scrollY >= scrollH - 32;
          var chapterMetrics = computeChapterMetrics();
          notify({
            type: 'scroll',
            scrollY: window.scrollY,
            scrollPercent: pct,
            atBottom: atBottom,
            chapterIndex: chapterMetrics.chapterIndex,
            chapterScrollPercent: chapterMetrics.chapterScrollPercent
          });
        }, 200);
      }, { passive: true });

      // Tap and Swipe zone tracking
      var touchStartX = 0, touchStartY = 0, touchStartTime = 0, touchMoved = false;
      document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
        touchMoved = false;
      }, { passive: true });
      document.addEventListener('touchmove', function() { touchMoved = true; }, { passive: true });
      document.addEventListener('touchend', function(e) {
        var touchEndX = e.changedTouches[0].screenX;
        var touchEndY = e.changedTouches[0].screenY;
        var dx = touchEndX - touchStartX;
        var dy = touchEndY - touchStartY;
        var absDx = Math.abs(dx);
        var absDy = Math.abs(dy);
        var duration = Date.now() - touchStartTime;

        // Skip if user was selecting text
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;

        // Swipe detection (significant horizontal movement, minimal vertical, fast enough)
        if (absDx > 60 && absDy < 100 && duration < 500) {
          notify({ type: 'swipe', direction: dx > 0 ? 'right' : 'left' });
          return;
        }

        // Tap detection (minimal movement)
        if (!touchMoved || (absDx < 10 && absDy < 10)) {
          notify({ type: 'tap', x: e.changedTouches[0].clientX });
        }
      }, { passive: true });

      // Internal EPUB link interception — in-chapter #anchors scroll; others go to native
      document.addEventListener('click', function(e) {
        var termTarget = e.target.closest ? e.target.closest('.miyo-term-replaced') : null;
        if (termTarget) {
          e.preventDefault();
          e.stopPropagation();
          document.querySelectorAll('.miyo-term-replaced[data-term-active="true"]').forEach(function(node) {
            node.removeAttribute('data-term-active');
          });
          termTarget.setAttribute('data-term-active', 'true');
          var termRect = termTarget.getBoundingClientRect();
          notify({
            type: 'termTap',
            termId: termTarget.getAttribute('data-term-id'),
            termKey: termTarget.getAttribute('data-term-key'),
            x: termRect.left + termRect.width / 2,
            y: termRect.top,
          });
          return;
        }
        var a = e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        var rawHref = a.getAttribute('href') || '';
        if (!rawHref) return;
        if (rawHref.charAt(0) === '#') {
          e.preventDefault();
          var aid = decodeURIComponent(rawHref.slice(1));
          try {
            var el = document.getElementById(aid) || document.querySelector('[name="' + aid.replace(/"/g, '\\\\"') + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (err) {}
          return;
        }
        e.preventDefault();
        notify({ type: 'link', href: rawHref });
      });

      // Highlight helpers
      window.__addHighlight = function(text, bgColor, textColor, hlId, chapterIndex) {
        try {
          if (!text) return;
          var root = typeof chapterIndex === 'number'
            ? document.querySelector('.miyo-chapter-section[data-chapter-index="' + chapterIndex + '"]') || document.body
            : document.body;
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          var found = false;
          while (walker.nextNode() && !found) {
            var node = walker.currentNode;
            var idx = node.textContent.indexOf(text);
            if (idx !== -1) {
              found = true;
              var range = document.createRange();
              range.setStart(node, idx); range.setEnd(node, idx + text.length);
              var span = document.createElement('span');
              span.style.backgroundColor = bgColor + '55';
              if (textColor) span.style.color = textColor;
              span.className = 'miyo-highlight';
              if (hlId) span.setAttribute('data-id', hlId);
              try { range.surroundContents(span); } catch(e) {}
            }
          }
        } catch(e) {}
      };

      // Apply saved highlights
      var savedHighlights = ${highlightsJSON};
      if (savedHighlights && savedHighlights.length > 0) {
        setTimeout(function() {
          savedHighlights.forEach(function(h) { window.__addHighlight(h.text, h.color, h.textColor, h.id, h.chapterIndex); });
        }, 300);
      }

      // Search highlight
      window.__highlightSearch = function(term) {
        document.querySelectorAll('.miyo-search-match').forEach(function(el) {
          var parent = el.parentNode;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        });
        if (!term || term.length < 2) return;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var lowerTerm = term.toLowerCase();
        var firstMatch = null;
        while (walker.nextNode()) {
          var node = walker.currentNode;
          if (node.parentElement && node.parentElement.classList.contains('miyo-search-match')) continue;
          var idx2 = node.textContent.toLowerCase().indexOf(lowerTerm);
          if (idx2 !== -1) {
            var range2 = document.createRange();
            range2.setStart(node, idx2); range2.setEnd(node, idx2 + term.length);
            var mark = document.createElement('mark');
            mark.className = 'miyo-search-match';
            try { range2.surroundContents(mark); if (!firstMatch) firstMatch = mark; } catch(e) {}
            walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            if (firstMatch) break;
          }
        }
        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      window.__appendChapterSection = function(sectionHtml, chapterIndex, chapterHighlights, searchTerm) {
        try {
          if (document.querySelector('.miyo-chapter-section[data-chapter-index="' + chapterIndex + '"]')) return;
          var wrap = document.querySelector('.miyo-wrap') || document.body;
          var temp = document.createElement('div');
          temp.innerHTML = String(sectionHtml || '').trim();
          var nextSection = temp.firstElementChild;
          if (!nextSection) return;
          wrap.appendChild(nextSection);
          if (chapterHighlights && chapterHighlights.length && window.__addHighlight) {
            setTimeout(function() {
              chapterHighlights.forEach(function(h) {
                window.__addHighlight(h.text, h.color, h.textColor, h.id, h.chapterIndex);
              });
            }, 24);
          }
          if (searchTerm && window.__highlightSearch) {
            setTimeout(function() { window.__highlightSearch(searchTerm); }, 32);
          }
          setTimeout(function() {
            var scrollH = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            var pct = scrollH > 0 ? (window.scrollY / scrollH) * 100 : 100;
            var atBottom = scrollH > 40 && window.scrollY >= scrollH - 32;
            var chapterMetrics = computeChapterMetrics();
            notify({
              type: 'scroll',
              scrollY: window.scrollY,
              scrollPercent: pct,
              atBottom: atBottom,
              chapterIndex: chapterMetrics.chapterIndex,
              chapterScrollPercent: chapterMetrics.chapterScrollPercent
            });
          }, 48);
        } catch (e) {}
      };

      window.__setTermVariant = function(termKey, value) {
        try {
          if (!termKey) return;
          var el = document.querySelector('.miyo-term-replaced[data-term-key="' + String(termKey).replace(/"/g, '\\"') + '"]');
          if (!el) return;
          el.textContent = String(value || '');
          el.setAttribute('data-current-text', String(value || ''));
        } catch (e) {}
      };

      window.__clearActiveTerm = function() {
        try {
          document.querySelectorAll('.miyo-term-replaced[data-term-active="true"]').forEach(function(node) {
            node.removeAttribute('data-term-active');
          });
        } catch (e) {}
      };

      ${escapedSearchTerm ? `setTimeout(function() { window.__highlightSearch("${escapedSearchTerm}"); }, 500);` : ''}
      setTimeout(function() {
        if (${JSON.stringify(scrollRestoreMode)} === 'chapterStart') {
          var targetSection = document.querySelector('.miyo-chapter-section[data-chapter-index="${currentChapterIndex}"]');
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'auto', block: 'start' });
            return;
          }
        }
        window.scrollTo(0, ${restoredScrollPosition});
      }, 50);
      ${bionicInit}
    })();
  </script>
</body>
</html>`;
  };

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'selection') {
        setSelection({ text: data.text, x: data.x, y: data.y });
        setTermPopover(null);
        setShowToolbar(false);
      } else if (data.type === 'clearSelection') {
        setSelection(null);
      } else if (data.type === 'tap') {
        if (termPopover) {
          setTermPopover(null);
          webViewRef.current?.injectJavaScript(`window.__clearActiveTerm && window.__clearActiveTerm(); true;`);
          return;
        }
        if (!selection) handleTap(data.x);
      } else if (data.type === 'termTap') {
        // Record the time of this term tap so handleTap suppresses the following tap event
        lastTermTapAtRef.current = Date.now();
        const term = typeof data.termId === 'string' ? appliedTermsById.get(data.termId) : null;
        if (term && typeof data.termKey === 'string') {
          setSelection(null);
          setShowToolbar(false);
          setTermPopover({
            term,
            termKey: data.termKey,
            x: typeof data.x === 'number' ? data.x : screenWidth / 2,
            y: typeof data.y === 'number' ? data.y : screenHeight / 3,
          });
        }
      } else if (data.type === 'scroll') {
        if (termPopover) {
          setTermPopover(null);
          webViewRef.current?.injectJavaScript(`window.__clearActiveTerm && window.__clearActiveTerm(); true;`);
        }
        if (data.scrollY !== undefined) {
          setLastScrollPosition(data.scrollY);
        }
        if (typeof data.chapterIndex === 'number' && !Number.isNaN(data.chapterIndex)) {
          const maxChapterIndex = parsedEpub?.chapters.length ? parsedEpub.chapters.length - 1 : data.chapterIndex;
          const nextVisibleChapter = Math.max(0, Math.min(maxChapterIndex, data.chapterIndex));
          setVisibleChapterIndex(prev => (prev === nextVisibleChapter ? prev : nextVisibleChapter));
          if (!continuousReadingEnabled) {
            setCurrentChapterIndex(prev => (prev === nextVisibleChapter ? prev : nextVisibleChapter));
          }
        }
        if (typeof data.chapterScrollPercent === 'number' && !Number.isNaN(data.chapterScrollPercent)) {
          setChapterScrollPercent(Math.min(100, Math.max(0, data.chapterScrollPercent)));
        } else if (typeof data.scrollPercent === 'number' && !Number.isNaN(data.scrollPercent)) {
          setChapterScrollPercent(Math.min(100, Math.max(0, data.scrollPercent)));
        }
        if (data.atBottom === false) {
          bottomChapterNavLockRef.current = false;
        }
        if (
          data.atBottom === true &&
          continuousReadingEnabled &&
          parsedEpub &&
          loadedChapterIndices.length > 0 &&
          loadedChapterIndices[loadedChapterIndices.length - 1] < parsedEpub.chapters.length - 1
        ) {
          if (!bottomChapterNavLockRef.current) {
            bottomChapterNavLockRef.current = true;
            const highestLoaded = loadedChapterIndices.length
              ? loadedChapterIndices[loadedChapterIndices.length - 1]
              : currentChapterIndex;
            const nextIndex = Math.min(parsedEpub.chapters.length - 1, highestLoaded + 1);
            const appendedInPlace = appendChapterToReader(nextIndex);
            setLoadedChapterIndices(prev => {
              if (prev.includes(nextIndex)) return prev;
              return uniqueSortedChapterIndices([...prev, nextIndex]);
            });
            if (!appendedInPlace) {
              setRestoredScrollPosition(lastScrollPositionRef.current);
              setScrollRestoreMode('preserve');
            }
          }
        }
        scheduleScrollPersist();
      } else if (data.type === 'swipe') {
        if (readingSettings.tapZoneNavMode === 'chapter') {
          const total = parsedEpub?.chapters.length || 1;
          if (data.direction === 'left') {
            if (activeChapterIndex < total - 1) {
              openChapterAt(activeChapterIndex + 1, {
                keepLoaded: continuousReadingEnabled,
                restoreMode: 'chapterStart',
              });
            }
          } else if (data.direction === 'right') {
            if (activeChapterIndex > 0) {
              openChapterAt(activeChapterIndex - 1, {
                keepLoaded: continuousReadingEnabled,
                restoreMode: 'chapterStart',
              });
            }
          }
        } else {
          if (data.direction === 'left') injectScrollByPage('down');
          else injectScrollByPage('up');
        }
      } else if (data.type === 'link') {
        if (parsedEpub && data.href) {
          const rawHref: string = data.href;
          const hashI = rawHref.indexOf('#');
          const frag = hashI >= 0 ? decodeURIComponent(rawHref.slice(hashI + 1)) : '';
          const pathPart = hashI >= 0 ? rawHref.slice(0, hashI) : rawHref;

          if (!pathPart && frag) {
            const safe = JSON.stringify(frag);
            webViewRef.current?.injectJavaScript(`
              (function(){
                var id = ${safe};
                try {
                  var el = document.getElementById(id) || document.querySelector('[name="' + String(id).replace(/"/g, '\\\\"') + '"]');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (e) {}
              })();
              true;
            `);
            return;
          }

          const targetPath = pathPart;
          if (!targetPath) return;

          const visibleChapter = parsedEpub.chapters[activeChapterIndex];
          const currentHref = visibleChapter?.href || '';
          const currentDir = currentHref.includes('/')
            ? currentHref.substring(0, currentHref.lastIndexOf('/') + 1)
            : '';
          const pathParts = (currentDir + targetPath).split('/');
          const stack: string[] = [];
          for (const p of pathParts) {
            if (p === '..') stack.pop();
            else if (p !== '.' && p !== '') stack.push(p);
          }
          const resolvedPath = stack.join('/');
          const targetIdx = parsedEpub.chapters.findIndex(c =>
            c.href === resolvedPath ||
            c.href === targetPath ||
            c.href.endsWith('/' + resolvedPath) ||
            c.href.endsWith('/' + targetPath) ||
            c.href.split('/').pop() === targetPath.split('/').pop()
          );
          if (targetIdx !== -1) {
            if (frag) pendingChapterAnchorRef.current = frag;
            openChapterAt(targetIdx, {
              keepLoaded: false,
              restoreMode: 'chapterStart',
            });
          }
        }
      }
    } catch { }
  }, [
    handleTap,
    selection,
    termPopover,
    parsedEpub,
    currentChapterIndex,
    activeChapterIndex,
    loadedChapterIndices,
    readingSettings.tapZoneNavMode,
    continuousReadingEnabled,
    appliedTermsById,
    injectScrollByPage,
    openChapterAt,
    appendChapterToReader,
    scheduleScrollPersist,
  ]);

  const currentChapter = parsedEpub?.chapters[activeChapterIndex];
  const totalChapters = parsedEpub?.chapters.length || 1;
  const bookProgressPct = useMemo(() => {
    if (!parsedEpub?.chapters.length) return 0;
    const n = parsedEpub.chapters.length;
    const seg = 100 / n;
    return Math.min(100, activeChapterIndex * seg + (seg * chapterScrollPercent) / 100);
  }, [parsedEpub, activeChapterIndex, chapterScrollPercent]);
  const progress = bookProgressPct;

  const chapterReadingMinutes = useMemo(() => {
    if (!currentChapter) return 0;
    return Math.max(1, Math.ceil(countChapterWords(currentChapter) / 200));
  }, [currentChapter]);

  const sleepMinutesLeft = useMemo(() => {
    if (sleepDeadlineMs == null) return null;
    return Math.max(0, Math.ceil((sleepDeadlineMs - Date.now()) / 60000));
  }, [sleepDeadlineMs, sleepUiTick]);

  const bookTotalWords = useMemo(() => {
    if (!parsedEpub) return 0;
    return parsedEpub.chapters.reduce((sum, ch) => sum + countChapterWords(ch), 0);
  }, [parsedEpub]);

  const wordsRemaining = useMemo(
    () => Math.max(0, bookTotalWords - estimatedWordsRead),
    [bookTotalWords, estimatedWordsRead]
  );

  const bookFinishEtaMinutes = useMemo(
    () => (wordsRemaining > 0 ? Math.max(1, Math.ceil(wordsRemaining / paceWpm)) : 0),
    [wordsRemaining, paceWpm]
  );

  const getChapterReadPercent = useCallback(
    (index: number) => {
      if (index < activeChapterIndex) return 100;
      if (index > activeChapterIndex) return 0;
      return Math.min(100, Math.max(0, Math.round(chapterScrollPercent)));
    },
    [activeChapterIndex, chapterScrollPercent]
  );

  const injectAutoScroll = useCallback(() => {
    const s = readingSettings.autoScrollSpeed;
    const js = `
(function(){
  if (window.__miyoScrollTimer) { clearInterval(window.__miyoScrollTimer); window.__miyoScrollTimer = null; }
  var speed = ${s};
  if (!speed) return;
  var step = 0.14 + speed * 0.11;
  window.__miyoScrollTimer = setInterval(function(){
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (window.scrollY >= maxScroll - 0.5) return;
    window.scrollBy(0, step);
  }, 45);
})();
true;
`;
    webViewRef.current?.injectJavaScript(js);
  }, [readingSettings.autoScrollSpeed]);

  useEffect(() => {
    injectAutoScroll();
  }, [injectAutoScroll]);

  const bookHighlights = book ? getHighlightsByBook(book.id) : [];
  const allBookmarks = book ? getBookmarksByBook(book.id) : [];
  const chapterTitles = parsedEpub?.chapters.map(c => c.title) || [];
  const readerContentVersion = continuousReadingEnabled
    ? `${currentChapterIndex}|${scrollRestoreMode === 'chapterStart' ? currentChapterIndex : 'steady'}|${scrollRestoreMode}`
    : `${currentChapterIndex}|${scrollRestoreMode}`;

  const handleExportAnnotationsTxt = useCallback(async () => {
    if (!book) return;
    const txt = annotationsToPlainText(book.title, allBookmarks, bookHighlights, chapterTitles);
    try {
      await Share.share({ message: txt, title: `${book.title} — annotations` });
    } catch {
      /* ignore */
    }
  }, [book, allBookmarks, bookHighlights, chapterTitles]);

  const handleExportAnnotationsMd = useCallback(async () => {
    if (!book) return;
    const md = annotationsToMarkdown(book.title, allBookmarks, bookHighlights, chapterTitles);
    try {
      await Share.share({ message: md, title: `${book.title} — annotations` });
    } catch {
      /* ignore */
    }
  }, [book, allBookmarks, bookHighlights, chapterTitles]);

  const renderThemeOption = useCallback(
    (theme: Theme) => {
      const isActive = currentTheme.id === theme.id;

      return (
        <PressableScale
          key={theme.id}
          onPress={() => {
            setTheme(theme);
            setShowThemePanel(false);
          }}
          style={[
            styles.themeOption,
            {
              backgroundColor: theme.background,
              borderWidth: isActive ? 2.5 : 1,
              borderColor: isActive ? theme.accent : theme.text + '15',
            },
          ]}
        >
          <View style={[styles.themePreviewLine, { backgroundColor: theme.text + '55', top: 16 }]} />
          <View style={[styles.themePreviewLine, { backgroundColor: theme.text + '35', width: '55%', top: 26 }]} />
          <View style={[styles.themePreviewLine, { backgroundColor: theme.text + '45', width: '70%', top: 36 }]} />
          <View style={[styles.themeAccentDot, { backgroundColor: theme.accent }]} />
          {isActive && (
            <View style={[styles.themeActiveCheck, { backgroundColor: theme.accent }]}>
              <ThemedText style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>✓</ThemedText>
            </View>
          )}
          <ThemedText style={[styles.themeLabel, { color: theme.text }]} numberOfLines={2}>
            {theme.name}
          </ThemedText>
        </PressableScale>
      );
    },
    [currentTheme.id, setTheme]
  );

  const readerHTML = useMemo(() => generateReaderHTML(), [
    parsedEpub,
    readerContentVersion,
    searchHighlightTerm,
    continuousReadingEnabled,
    currentTheme,
    typography,
    margins,
    wrapInlineStyle,
    webFontFaceCss,
    scrollRestoreMode,
    restoredScrollPosition,
    readingSettings.columnLayout,
    readingSettings.blueLightFilter,
    readingSettings.bionicReading,
    book?.id,
    appliedTermsSignature,
  ]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar hidden={false} />
        <BookLoadingAnimation title={book?.title} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar hidden={false} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 60 }]}>
          <View style={[styles.errorIconBg, { backgroundColor: currentTheme.accent + '15' }]}>
            <ThemedText style={{ fontSize: 40 }}>📚</ThemedText>
          </View>
          <ThemedText variant="primary" size="header" weight="bold" style={styles.errorTitle}>
            Unable to Load Book
          </ThemedText>
          <ThemedText variant="secondary" size="body" style={styles.errorMessage}>
            {loadError}
          </ThemedText>
          <PressableScale
            onPress={() => router.back()}
            style={[styles.errorBackButton, { backgroundColor: currentTheme.accent }]}
          >
            <ChevronLeft size={18} color="#FFFFFF" />
            <ThemedText size="body" weight="semibold" style={{ color: '#FFFFFF' }}>
              Go Back
            </ThemedText>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (!book || !parsedEpub) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <View style={styles.loadingContainer}>
          <ThemedText variant="secondary">Book not found</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar hidden={readingSettings.immersiveMode && !showToolbar} translucent backgroundColor="transparent" />

      {/* WebView Reader */}
      <View style={styles.contentContainer}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ flex: 1, backgroundColor: currentTheme.background, zIndex: 0 }}
        >
          <ReaderWebView
            ref={webViewRef}
            source={{ html: readerHTML }}
            style={[styles.webView, { backgroundColor: currentTheme.background }]}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            originWhitelist={['about:blank', 'https://*', 'http://*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            onMessage={handleWebViewMessage}
            onLoadEnd={injectAutoScroll}
            onError={(syntheticEvent) => {
              logger.error('WebView error', syntheticEvent.nativeEvent);
            }}
            onShouldStartLoadWithRequest={(request) => {
              if (isSafeEmbeddedUrl(request.url)) {
                return true;
              }
              if (isSafeExternalUrl(request.url)) {
                void Linking.openURL(request.url);
                return false;
              }
              return false;
            }}
            allowsLinkPreview={false}
            setSupportMultipleWindows={false}
            {...(Platform.OS === 'android' ? { overScrollMode: 'never' as const } : {})}
          />
        </Animated.View>
      </View>

      {termPopover && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setTermPopover(null);
              webViewRef.current?.injectJavaScript(`window.__clearActiveTerm && window.__clearActiveTerm(); true;`);
            }}
          />
          <View
            style={[
              styles.termPopover,
              {
                left: Math.min(Math.max(termPopover.x - 150, 12), Math.max(12, screenWidth - 312)),
                top: Math.min(Math.max(termPopover.y + insets.top - 8, insets.top + 12), screenHeight - 280),
                backgroundColor: currentTheme.cardBackground,
                borderColor: currentTheme.secondaryText + '20',
              },
            ]}
          >
            <View style={[styles.termPopoverArrow, { borderBottomColor: currentTheme.cardBackground, left: 28 }]} />
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.termPopoverLabel}>
              TERM OPTIONS
            </ThemedText>
            <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={2}>
              {termPopover.term.correctedText}
            </ThemedText>
            {termPopover.term.imageUri ? (
              <Image source={{ uri: termPopover.term.imageUri }} style={styles.termPopoverImage} resizeMode="cover" />
            ) : null}
            {termPopover.term.context ? (
              <ThemedText variant="secondary" size="caption" style={styles.termPopoverCopy} numberOfLines={3}>
                {termPopover.term.context}
              </ThemedText>
            ) : null}
            <View style={styles.termPopoverActions}>
              <PressableScale
                onPress={() => handleApplyTermVariant(termPopover.term.originalText)}
                style={[styles.termVariantBtn, { borderColor: currentTheme.secondaryText + '20', backgroundColor: currentTheme.background }]}
              >
                <ThemedText variant="secondary" size="caption" weight="semibold" numberOfLines={2}>
                  Original
                </ThemedText>
                <ThemedText variant="primary" size="caption" numberOfLines={2}>
                  {termPopover.term.originalText}
                </ThemedText>
              </PressableScale>
              {termPopover.term.translationText ? (
                <PressableScale
                  onPress={() => handleApplyTermVariant(termPopover.term.translationText!)}
                  style={[styles.termVariantBtn, { borderColor: currentTheme.secondaryText + '20', backgroundColor: currentTheme.background }]}
                >
                  <ThemedText variant="secondary" size="caption" weight="semibold" numberOfLines={2}>
                    Translation
                  </ThemedText>
                  <ThemedText variant="primary" size="caption" numberOfLines={2}>
                    {termPopover.term.translationText}
                  </ThemedText>
                </PressableScale>
              ) : null}
              <PressableScale
                onPress={() => handleApplyTermVariant(termPopover.term.correctedText)}
                style={[styles.termVariantBtn, { borderColor: currentTheme.accent + '40', backgroundColor: currentTheme.accent + '10' }]}
              >
                <ThemedText variant="accent" size="caption" weight="semibold" numberOfLines={2}>
                  Added Term
                </ThemedText>
                <ThemedText variant="primary" size="caption" numberOfLines={2}>
                  {termPopover.term.correctedText}
                </ThemedText>
              </PressableScale>
            </View>
          </View>
        </>
      )}

      {/* Selection Toolbar */}
      {selection && (
        <SelectionToolbar
          selection={selection}
          onClose={() => setSelection(null)}
          onHighlight={handleHighlight}
          onNote={handleNote}
          onCopy={handleCopy}
          onShare={handleShare}
          onDictionary={handleDictionary}
          onWikipedia={handleWikipedia}
          onTranslate={handleTranslate}
          onBookmarkSelection={handleBookmarkSelection}
          onUnderline={handleUnderline}
          onAddTerm={handleAddTerm}
        />
      )}

      {/* Reading Progress Bar (when toolbar hidden) */}
      {!selection && (
        <Animated.View
          style={[
            styles.progressContainer,
            progressAnimatedStyle,
            { bottom: insets.bottom + 14, pointerEvents: 'none' },
          ]}
        >
          <View style={[styles.progressTrack, { backgroundColor: currentTheme.secondaryText + '22' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: currentTheme.accent },
              ]}
            />
          </View>
          <ThemedText variant="secondary" size="caption" style={styles.progressText}>
            {Math.round(bookProgressPct)}% · {activeChapterIndex + 1}/{totalChapters} · ~{chapterReadingMinutes}m
            {sleepMinutesLeft != null && sleepMinutesLeft > 0 ? ` · ${sleepMinutesLeft}m sleep` : ''}
          </ThemedText>
        </Animated.View>
      )}

      {/* Top Toolbar */}
      <Animated.View
        style={[styles.topToolbar, toolbarAnimatedStyle, { paddingTop: insets.top, pointerEvents: showToolbar ? 'auto' : 'none' }]}
      >
        <View style={[styles.toolbarBackground, { backgroundColor: currentTheme.background + 'F2' }]}>
          <View style={styles.toolbarContent}>
            <PressableScale onPress={handleBack} style={styles.toolbarButton}>
              <ChevronLeft size={24} color={currentTheme.text} strokeWidth={2} />
            </PressableScale>

            <View style={styles.toolbarTitleSection}>
              <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={1}>
                {currentChapter?.title || book.title}
              </ThemedText>
              <ThemedText variant="secondary" size="caption" numberOfLines={2}>
                {book.author}
                {bookFinishEtaMinutes > 0 && wordsRemaining > 500
                  ? ` · ~${bookFinishEtaMinutes} min left in book`
                  : ''}
              </ThemedText>
            </View>

            <PressableScale
              onPress={toggleThemeMode}
              style={styles.toolbarButton}
            >
              {currentTheme.isDark ? (
                <Sun size={20} color={currentTheme.text} strokeWidth={2} />
              ) : (
                <Moon size={20} color={currentTheme.text} strokeWidth={2} />
              )}
            </PressableScale>

            <PressableScale
              onPress={() => setShowStatsModal(true)}
              style={styles.toolbarButton}
            >
              <BarChart2 size={20} color={currentTheme.text} strokeWidth={2} />
            </PressableScale>

            <PressableScale onPress={handleToggleBookmark} style={styles.toolbarButton}>
              {isBookmarked ? (
                <BookmarkCheck size={22} color={currentTheme.accent} />
              ) : (
                <Bookmark size={22} color={currentTheme.text} />
              )}
            </PressableScale>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Toolbar */}
      <Animated.View
        style={[styles.bottomToolbar, bottomToolbarAnimatedStyle, { paddingBottom: insets.bottom + 8, pointerEvents: showToolbar ? 'auto' : 'none' }]}
      >
        <View style={[styles.toolbarBackground, { backgroundColor: currentTheme.background + 'F2' }]}>
          <View style={styles.bottomToolbarInner}>
            {/* Chapter Progress Slider */}
            <View style={styles.sliderRow}>
              <ThemedText variant="secondary" size="caption" weight="semibold">
                {activeChapterIndex + 1}
              </ThemedText>
              <View style={[styles.sliderTrack, { backgroundColor: currentTheme.secondaryText + '22' }]}>
                <View
                  style={[
                    styles.sliderFill,
                    { width: `${progress}%`, backgroundColor: currentTheme.accent },
                  ]}
                />
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${Math.min(Math.max(progress, 3), 97)}%`,
                      backgroundColor: currentTheme.accent,
                      borderColor: currentTheme.background,
                    },
                  ]}
                />
              </View>
              <ThemedText variant="secondary" size="caption" weight="semibold">
                {totalChapters}
              </ThemedText>
            </View>

            {/* Action Row (scrolls on narrow screens — Koodo-style dense tools) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionsRow}
            >
              <PressableScale
                onPress={() => { setShowChapterDrawer(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <List size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Chapters</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowSearchModal(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Search size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Search</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => navigateChapter('prev')}
                disabled={activeChapterIndex === 0}
                style={[styles.actionBtn, ...(activeChapterIndex === 0 ? [styles.disabledBtn] : [])]}
              >
                <ChevronLeft size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Prev</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => navigateChapter('next')}
                disabled={activeChapterIndex >= totalChapters - 1}
                style={[styles.actionBtn, ...(activeChapterIndex >= totalChapters - 1 ? [styles.disabledBtn] : [])]}
              >
                <ChevronRight size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Next</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowAnnotationsDrawer(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Layers size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Notes</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowLayoutPanel(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Columns size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Layout</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowTypographyPanel(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Type size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Font</ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => { setShowThemePanel(true); setShowToolbar(false); }}
                style={styles.actionBtn}
              >
                <Palette size={20} color={currentTheme.text} strokeWidth={2} />
                <ThemedText variant="secondary" size="caption" style={styles.actionLabel}>Theme</ThemedText>
              </PressableScale>
            </ScrollView>
          </View>
        </View>
      </Animated.View>

      {/* Chapter Drawer */}
      {showChapterDrawer && (
        <>
          <Pressable style={styles.drawerOverlay} onPress={() => setShowChapterDrawer(false)} />
          <Animated.View
            entering={SlideInUp.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.chapterDrawer,
              {
                backgroundColor: currentTheme.cardBackground,
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            <View style={[styles.drawerHandle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
            <View style={styles.drawerHeaderRow}>
              <View>
                <ThemedText variant="primary" size="header" weight="bold">Chapters</ThemedText>
                <ThemedText variant="secondary" size="caption">
                  {totalChapters} chapters · Chapter {activeChapterIndex + 1}
                </ThemedText>
              </View>
              <PressableScale onPress={() => setShowChapterDrawer(false)} style={styles.drawerCloseBtn}>
                <X size={20} color={currentTheme.secondaryText} />
              </PressableScale>
            </View>
            <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
              {parsedEpub.chapters.map((chapter, index) => {
                const isActive = activeChapterIndex === index;
                const readPct = getChapterReadPercent(index);
                const w = countChapterWords(chapter);
                return (
                  <PressableScale
                    key={chapter.id}
                    onPress={() => goToChapter(index)}
                    style={[
                      styles.chapterItem,
                      ...(isActive
                        ? [styles.chapterItemActive, { backgroundColor: currentTheme.accent + '14' }]
                        : []),
                    ]}
                  >
                    <View style={[
                      styles.chapterItemNumber,
                      { backgroundColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '18' }
                    ]}>
                      <ThemedText
                        style={[
                          styles.chapterNumber,
                          { color: isActive ? '#FFFFFF' : currentTheme.secondaryText }
                        ]}
                      >
                        {index + 1}
                      </ThemedText>
                    </View>
                    <View style={styles.chapterItemBody}>
                      <ThemedText
                        variant={isActive ? 'accent' : 'primary'}
                        size="body"
                        weight={isActive ? 'semibold' : 'regular'}
                        numberOfLines={2}
                        style={styles.chapterTitle}
                      >
                        {chapter.title}
                      </ThemedText>
                      <ThemedText variant="secondary" size="caption" style={styles.chapterMeta}>
                        {w.toLocaleString()} words · {readPct}% read
                      </ThemedText>
                      <View style={[styles.chapterReadTrack, { backgroundColor: currentTheme.secondaryText + '22' }]}>
                        <View
                          style={[
                            styles.chapterReadFill,
                            { width: `${readPct}%`, backgroundColor: currentTheme.accent },
                          ]}
                        />
                      </View>
                    </View>
                    {isActive && (
                      <View style={[styles.activeChapterDot, { backgroundColor: currentTheme.accent }]} />
                    )}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* Typography Panel */}
      {showTypographyPanel && (
        <>
          <Pressable style={styles.drawerOverlay} onPress={() => setShowTypographyPanel(false)} />
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={[
              styles.bottomPanel,
              { backgroundColor: currentTheme.cardBackground, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <ScrollView
              style={styles.bottomPanelScroll}
              contentContainerStyle={styles.bottomPanelContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.drawerHandle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
              <View style={styles.drawerHeaderRow}>
                <ThemedText variant="primary" size="header" weight="bold">Typography</ThemedText>
                <PressableScale onPress={() => setShowTypographyPanel(false)}>
                  <X size={20} color={currentTheme.secondaryText} />
                </PressableScale>
              </View>

              <View style={styles.typographySection}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                  FONT SIZE · {typography.fontSize}px
                </ThemedText>
                <View style={styles.typographyControls}>
                  <PressableScale
                    onPress={() => setTypography({ fontSize: Math.max(12, typography.fontSize - 1) })}
                    style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                  >
                    <ThemedText variant="primary" size="body" weight="bold">A-</ThemedText>
                  </PressableScale>
                  <View style={[styles.typographySlider, { backgroundColor: currentTheme.secondaryText + '18' }]}>
                    <View style={[styles.typographySliderFill, { width: `${((typography.fontSize - 12) / 16) * 100}%`, backgroundColor: currentTheme.accent }]} />
                  </View>
                  <PressableScale
                    onPress={() => setTypography({ fontSize: Math.min(28, typography.fontSize + 1) })}
                    style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                  >
                    <ThemedText variant="primary" size="title" weight="bold">A+</ThemedText>
                  </PressableScale>
                </View>
              </View>

              <View style={styles.typographySection}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                  LINE HEIGHT · {typography.lineHeight.toFixed(1)}
                </ThemedText>
                <View style={styles.typographyControls}>
                  <PressableScale
                    onPress={() => setTypography({ lineHeight: Math.max(1.2, parseFloat((typography.lineHeight - 0.1).toFixed(1))) })}
                    style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                  >
                    <Minus size={18} color={currentTheme.text} />
                  </PressableScale>
                  <View style={[styles.typographySlider, { backgroundColor: currentTheme.secondaryText + '18' }]}>
                    <View style={[styles.typographySliderFill, { width: `${((typography.lineHeight - 1.2) / 0.8) * 100}%`, backgroundColor: currentTheme.accent }]} />
                  </View>
                  <PressableScale
                    onPress={() => setTypography({ lineHeight: Math.min(2.0, parseFloat((typography.lineHeight + 0.1).toFixed(1))) })}
                    style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                  >
                    <Plus size={18} color={currentTheme.text} />
                  </PressableScale>
                </View>
              </View>

              <View style={styles.typographySection}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                  PARAGRAPH SPACING · {typography.paragraphSpacing}px
                </ThemedText>
                <View style={styles.typographyControls}>
                  <PressableScale
                    onPress={() => setTypography({ paragraphSpacing: Math.max(8, typography.paragraphSpacing - 2) })}
                    style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                  >
                    <Minus size={18} color={currentTheme.text} />
                  </PressableScale>
                  <View style={[styles.typographySlider, { backgroundColor: currentTheme.secondaryText + '18' }]}>
                    <View style={[styles.typographySliderFill, { width: `${((typography.paragraphSpacing - 8) / 32) * 100}%`, backgroundColor: currentTheme.accent }]} />
                  </View>
                  <PressableScale
                    onPress={() => setTypography({ paragraphSpacing: Math.min(40, typography.paragraphSpacing + 2) })}
                    style={[styles.typographyBtn, { backgroundColor: currentTheme.background }]}
                  >
                    <Plus size={18} color={currentTheme.text} />
                  </PressableScale>
                </View>
              </View>

              <View style={styles.typographySection}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                  FONT FAMILY
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                  {fontOptions.map(font => {
                    const isActive = typography.fontFamily === font.value;
                    return (
                      <PressableScale
                        key={font.value}
                        onPress={() => setTypography({ fontFamily: font.value })}
                        style={[
                          styles.fontChip,
                          {
                            backgroundColor: isActive ? currentTheme.accent + '20' : currentTheme.background,
                            borderColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '30',
                          },
                        ]}
                      >
                        <ThemedText
                          variant={isActive ? 'accent' : 'secondary'}
                          size="caption"
                          weight={isActive ? 'semibold' : 'regular'}
                        >
                          {font.label}
                        </ThemedText>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.typographySection}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                  FONT WEIGHT · {typography.fontWeight}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                  {([400, 500, 600, 700] as const).map(w => {
                    const isActive = typography.fontWeight === w;
                    return (
                      <PressableScale
                        key={w}
                        onPress={() => setTypography({ fontWeight: w })}
                        style={[
                          styles.fontChip,
                          {
                            backgroundColor: isActive ? currentTheme.accent + '20' : currentTheme.background,
                            borderColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '30',
                          },
                        ]}
                      >
                        <ThemedText
                          variant={isActive ? 'accent' : 'secondary'}
                          size="caption"
                          weight={isActive ? 'semibold' : 'regular'}
                        >
                          {w === 400 ? 'Regular' : w === 500 ? 'Medium' : w === 600 ? 'Semibold' : 'Bold'}
                        </ThemedText>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.typographySection}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.typographyLabel}>
                  TEXT ALIGNMENT
                </ThemedText>
                <View style={styles.alignmentRow}>
                  {[
                    { align: 'left', Icon: AlignLeft, label: 'Left' },
                    { align: 'justify', Icon: AlignJustify, label: 'Justify' },
                  ].map(({ align, Icon, label }) => (
                    <PressableScale
                      key={align}
                      onPress={() => setTypography({ textAlign: align as any })}
                      style={[
                        styles.alignmentBtn,
                        {
                          backgroundColor: typography.textAlign === align ? currentTheme.accent + '18' : currentTheme.background,
                          borderColor: typography.textAlign === align ? currentTheme.accent : 'transparent',
                        },
                      ]}
                    >
                      <Icon size={20} color={typography.textAlign === align ? currentTheme.accent : currentTheme.secondaryText} />
                      <ThemedText
                        variant={typography.textAlign === align ? 'accent' : 'secondary'}
                        size="caption"
                        weight="medium"
                      >
                        {label}
                      </ThemedText>
                    </PressableScale>
                  ))}
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* Theme Panel */}
      {showThemePanel && (
        <>
          <Pressable style={styles.drawerOverlay} onPress={() => setShowThemePanel(false)} />
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={[
              styles.bottomPanel,
              { backgroundColor: currentTheme.cardBackground, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <ScrollView
              style={styles.bottomPanelScroll}
              contentContainerStyle={styles.bottomPanelContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.drawerHandle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
              <View style={styles.drawerHeaderRow}>
                <ThemedText variant="primary" size="header" weight="bold">Reading Theme</ThemedText>
                <View style={styles.themeHeaderActions}>
                  <PressableScale
                    onPress={() => setShowThemeInfoDialog(true)}
                    style={[
                      styles.themeHelpButton,
                      { backgroundColor: currentTheme.accent + '12', borderColor: currentTheme.accent + '28' },
                    ]}
                  >
                    <ThemedText style={{ color: currentTheme.accent, fontSize: 16, fontWeight: '800' }}>
                      ?
                    </ThemedText>
                  </PressableScale>
                  <PressableScale onPress={() => setShowThemePanel(false)}>
                    <X size={20} color={currentTheme.secondaryText} />
                  </PressableScale>
                </View>
              </View>
              <View
                style={[
                  styles.readerThemeFxCard,
                  { backgroundColor: currentTheme.background, borderColor: currentTheme.accent + '18' },
                ]}
              >
                <ThemedText variant="accent" size="caption" weight="semibold" style={styles.readerThemeSectionLabel}>
                  SPECIAL UI CONTROLS
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={styles.readerThemeSectionCopy}>
                  Toggle the decorative layer without changing the theme palette.
                </ThemedText>
                <View style={styles.readerThemeFxActions}>
                  <PressableScale
                    onPress={() => setReadingSettings({ specialThemeUiEnabled: !readingSettings.specialThemeUiEnabled })}
                    style={[
                      styles.readerThemeFxButton,
                      {
                        backgroundColor: readingSettings.specialThemeUiEnabled ? currentTheme.accent : currentTheme.cardBackground,
                        borderColor: readingSettings.specialThemeUiEnabled ? currentTheme.accent : currentTheme.secondaryText + '20',
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: readingSettings.specialThemeUiEnabled ? '#FFFFFF' : currentTheme.text,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {readingSettings.specialThemeUiEnabled ? 'Special UI On' : 'Special UI Off'}
                    </ThemedText>
                  </PressableScale>
                </View>
              </View>

              <View style={styles.readerThemeSection}>
                <ThemedText variant="accent" size="caption" weight="semibold" style={styles.readerThemeSectionLabel}>
                  NORMAL UI
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={styles.readerThemeSectionCopy}>
                  {themeSectionCopy.normal}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScroll}>
                  {normalReaderThemes.map(renderThemeOption)}
                </ScrollView>
              </View>

              <View style={styles.readerThemeSection}>
                <ThemedText variant="accent" size="caption" weight="semibold" style={styles.readerThemeSectionLabel}>
                  SPECIAL UI
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={styles.readerThemeSectionCopy}>
                  {themeSectionCopy.special}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScroll}>
                  {specialReaderThemes.map(renderThemeOption)}
                </ScrollView>
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* Search Modal */}
      <SearchInBookModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        chapters={parsedEpub.chapters}
        currentChapterIndex={activeChapterIndex}
        onGoToChapter={(index, term) => {
          goToChapter(index, term);
          setShowSearchModal(false);
        }}
      />

      {/* Annotations Drawer */}
      <AnnotationsDrawer
        visible={showAnnotationsDrawer}
        onClose={() => setShowAnnotationsDrawer(false)}
        bookTitle={book.title}
        bookmarks={allBookmarks}
        highlights={bookHighlights}
        currentChapterIndex={activeChapterIndex}
        onGoToChapter={(index) => { goToChapter(index); setShowAnnotationsDrawer(false); }}
        onDeleteBookmark={handleDeleteBookmark}
        onDeleteHighlight={handleDeleteHighlight}
        chapterTitles={chapterTitles}
        onExportTxt={handleExportAnnotationsTxt}
        onExportMarkdown={handleExportAnnotationsMd}
      />

      <ReaderLayoutPanel visible={showLayoutPanel} onClose={() => setShowLayoutPanel(false)} />

      {/* Reading Stats Modal */}
      <ReadingStatsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        book={book}
        currentChapterIndex={activeChapterIndex}
        totalChapters={totalChapters}
        totalHighlights={bookHighlights.length}
        totalBookmarks={allBookmarks.length}
        estimatedWordsRead={estimatedWordsRead}
        bookTotalWords={bookTotalWords}
        wordsRemaining={wordsRemaining}
        bookFinishEtaMinutes={bookFinishEtaMinutes}
        bookProgressPercent={bookProgressPct}
      />

      {/* Add Term Modal (from reader selection) */}
      <TranslationSheet
        visible={translationSheet.open}
        sourceText={translationSheet.text}
        onClose={() => setTranslationSheet({ open: false, text: '' })}
        advanced={readingSettings.autoTranslationMode === 'advanced'}
      />

      <AddTermModal
        visible={showAddTermModal}
        initialText={addTermInitialText}
        bookId={book.id}
        onClose={() => setShowAddTermModal(false)}
      />

      <InlineLookupModal
        visible={lookupModal.visible}
        title={lookupModal.title}
        uri={lookupModal.uri}
        onClose={() => setLookupModal(prev => ({ ...prev, visible: false }))}
      />

      <DictionaryLookupModal
        visible={showDictionaryLookup}
        word={dictionaryLookupWord}
        onClose={() => setShowDictionaryLookup(false)}
        onManageDictionaries={() => {
          setShowDictionaryLookup(false);
          setShowDictionaryLibrary(true);
        }}
      />

      <DictionaryLibraryModal
        visible={showDictionaryLibrary}
        onClose={() => setShowDictionaryLibrary(false)}
      />

      <AppDialog
        visible={sleepTimerDialogVisible}
        title="Sleep Timer"
        message="Your timer finished."
        tone="warning"
        actions={[
          {
            label: 'Keep Reading',
            variant: 'secondary',
            onPress: () => setSleepTimerDialogVisible(false),
          },
          {
            label: 'Exit Book',
            variant: 'primary',
            onPress: () => {
              setSleepTimerDialogVisible(false);
              void handleBackRef.current();
            },
          },
        ]}
        onClose={() => setSleepTimerDialogVisible(false)}
      />
      <AppDialog
        visible={showThemeInfoDialog}
        title="Normal UI vs Special UI"
        message="Normal UI keeps the reading surface static. Special UI adds themed art and loading surfaces without a separate VFX boost mode."
        actions={[{ label: 'Close', onPress: () => setShowThemeInfoDialog(false) }]}
        onClose={() => setShowThemeInfoDialog(false)}
      >
        <View style={styles.readerThemeInfoStack}>
          <View style={[styles.readerThemeInfoCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '18' }]}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.readerThemeSectionLabel}>
              NORMAL UI
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.readerThemeSectionCopy}>
              Static palette only. Lowest overhead and the least distracting during long sessions.
            </ThemedText>
          </View>
          <View style={[styles.readerThemeInfoCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '18' }]}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.readerThemeSectionLabel}>
              SPECIAL UI
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.readerThemeSectionCopy}>
              Adds blossom, coffee, parchment, or matcha artwork while keeping the decorative motion layer restrained.
            </ThemedText>
          </View>
        </View>
      </AppDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorIconBg: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  errorTitle: { textAlign: 'center', marginBottom: 10 },
  errorMessage: { textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  errorBackButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  contentContainer: { flex: 1, position: 'relative' },
  webView: { flex: 1 },

  progressContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: { flex: 1, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1.5 },
  progressText: { minWidth: 40, textAlign: 'right', fontSize: 11 },
  termPopover: {
    position: 'absolute',
    width: 300,
    maxWidth: screenWidth - 24,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 16,
    zIndex: 20,
  },
  termPopoverArrow: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  termPopoverLabel: { letterSpacing: 0.8 },
  termPopoverImage: {
    width: '100%',
    height: 132,
    borderRadius: 12,
  },
  termPopoverCopy: { lineHeight: 18 },
  termPopoverActions: { gap: 8 },
  termVariantBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },

  // Top Toolbar
  topToolbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  toolbarBackground: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 6,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  toolbarButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toolbarTitleSection: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },

  // Bottom Toolbar
  bottomToolbar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
  bottomToolbarInner: { paddingHorizontal: 14, paddingTop: 12 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sliderTrack: { flex: 1, height: 4, borderRadius: 2, position: 'relative', overflow: 'visible' },
  sliderFill: { height: '100%', borderRadius: 2 },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4, paddingHorizontal: 4, gap: 4 },
  actionBtn: { alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, minWidth: 56 },
  actionLabel: { fontSize: 10, letterSpacing: 0.1 },
  disabledBtn: { opacity: 0.28 },

  // Chapter Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)', zIndex: 200 },
  chapterDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: screenHeight * 0.72,
    zIndex: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  drawerHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  themeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeHelpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCloseBtn: { padding: 4, marginTop: 2 },
  drawerScroll: { maxHeight: screenHeight * 0.48 },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 2,
    gap: 10,
  },
  chapterItemActive: {},
  chapterItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chapterNumber: { fontSize: 12, fontWeight: '700' },
  chapterItemBody: { flex: 1, minWidth: 0, gap: 4 },
  chapterTitle: { fontSize: 14, lineHeight: 20 },
  chapterMeta: { fontSize: 11, opacity: 0.9 },
  chapterReadTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  chapterReadFill: { height: '100%', borderRadius: 2 },
  activeChapterDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },

  // Bottom Panel (Typography + Theme)
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    zIndex: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    maxHeight: screenHeight * 0.82,
  },
  bottomPanelScroll: { flexGrow: 0 },
  bottomPanelContent: { paddingBottom: 8 },

  // Typography Panel
  typographySection: { marginBottom: 18 },
  typographyLabel: { letterSpacing: 0.8, marginBottom: 10, fontSize: 11 },
  typographyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typographyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  typographySlider: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  typographySliderFill: { height: '100%', borderRadius: 2 },
  alignmentRow: { flexDirection: 'row', gap: 10 },
  alignmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  fontChipsRow: { gap: 8, paddingBottom: 4 },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },

  // Theme Panel
  readerThemeFxCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    gap: 8,
  },
  readerThemeSection: {
    marginBottom: 18,
    gap: 8,
  },
  readerThemeSectionLabel: {
    letterSpacing: 1,
    fontSize: 11,
  },
  readerThemeSectionCopy: {
    lineHeight: 18,
  },
  readerThemeFxActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  readerThemeFxButton: {
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeScroll: { gap: 12, paddingVertical: 8 },
  themeOption: {
    width: 90,
    height: 125,
    borderRadius: 16,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  themePreviewLine: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 1.5,
    left: 12,
    right: 12,
  },
  themeAccentDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 12, right: 12 },
  themeSpecialBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  themeLabel: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  themeActiveCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerThemeInfoStack: {
    gap: 12,
  },
  readerThemeInfoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
});
