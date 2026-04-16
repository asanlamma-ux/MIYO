import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheDirectory,
  deleteAsync,
  getInfoAsync,
  readDirectoryAsync,
  StorageAccessFramework,
} from 'expo-file-system/legacy';
import { Book, SortOption, FilterOption, ViewMode, ReadingPosition, Bookmark, Highlight } from '@/types/book';
import { logger, captureError } from '@/utils/logger';
import { StorageQueue } from '@/utils/storage-queue';
import { clearAllCache, invalidateCache } from '@/utils/chapter-cache';
import { getStorageDirectory } from '@/utils/permissions';
import {
  createImportedBook,
  enrichStoredBook,
  fileBasename,
  findDuplicateBook,
  normalizePath,
  prepareBookImport,
} from '@/utils/book-identity';
import { saveProgressToJson } from '@/utils/progress-json';

export interface LibraryRescanResult {
  removed: number;
  valid: number;
  imported: number;
  skippedDuplicates: number;
  watchedFolderFiles: number;
}

interface LibraryContextType {
  books: Book[];
  addBook: (book: Book) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updateBook: (bookId: string, updates: Partial<Book>) => Promise<void>;
  getBook: (bookId: string) => Book | undefined;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  filterOption: FilterOption;
  setFilterOption: (option: FilterOption) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortedAndFilteredBooks: Book[];
  isLoading: boolean;
  // Reading position
  saveReadingPosition: (position: ReadingPosition) => Promise<void>;
  getReadingPosition: (bookId: string) => Promise<ReadingPosition | null>;
  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  getBookmarksByBook: (bookId: string) => Bookmark[];
  // Highlights
  highlights: Highlight[];
  addHighlight: (highlight: Highlight) => Promise<void>;
  removeHighlight: (highlightId: string) => Promise<void>;
  getHighlightsByBook: (bookId: string) => Highlight[];
  // Data management
  clearCache: () => Promise<void>;
  rescanLibrary: () => Promise<LibraryRescanResult>;
  /** Sum of on-disk EPUB file sizes (bytes); best-effort */
  estimateLibraryStorageBytes: () => Promise<number>;
  /** Remove a book from reading history without affecting its progress */
  clearHistoryEntry: (bookId: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

const LIBRARY_STORAGE_KEY = '@miyo/library';
const SORT_STORAGE_KEY = '@miyo/sort';
const FILTER_STORAGE_KEY = '@miyo/filter';
const VIEW_MODE_STORAGE_KEY = '@miyo/view-mode';
const READING_POSITIONS_KEY = '@miyo/reading-positions';
const BOOKMARKS_KEY = '@miyo/bookmarks';
const HIGHLIGHTS_KEY = '@miyo/highlights';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [sortOption, setSortOptionState] = useState<SortOption>('recent');
  const [filterOption, setFilterOptionState] = useState<FilterOption>('all');
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');
  const [readingPositions, setReadingPositions] = useState<Record<string, ReadingPosition>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [
        libraryJson,
        sortJson,
        filterJson,
        viewModeJson,
        positionsJson,
        bookmarksJson,
        highlightsJson,
      ] = await Promise.all([
        AsyncStorage.getItem(LIBRARY_STORAGE_KEY),
        AsyncStorage.getItem(SORT_STORAGE_KEY),
        AsyncStorage.getItem(FILTER_STORAGE_KEY),
        AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY),
        AsyncStorage.getItem(READING_POSITIONS_KEY),
        AsyncStorage.getItem(BOOKMARKS_KEY),
        AsyncStorage.getItem(HIGHLIGHTS_KEY),
      ]);

      if (libraryJson) {
        const parsedBooks = JSON.parse(libraryJson) as Book[];
        const normalizedBooks = parsedBooks.map(enrichStoredBook);
        setBooks(normalizedBooks);
        if (JSON.stringify(parsedBooks) !== JSON.stringify(normalizedBooks)) {
          StorageQueue.enqueueJSON(LIBRARY_STORAGE_KEY, normalizedBooks);
        }
      }
      if (sortJson) setSortOptionState(sortJson as SortOption);
      if (filterJson) setFilterOptionState(filterJson as FilterOption);
      if (viewModeJson) setViewModeState(viewModeJson as ViewMode);
      if (positionsJson) setReadingPositions(JSON.parse(positionsJson));
      if (bookmarksJson) setBookmarks(JSON.parse(bookmarksJson));
      if (highlightsJson) setHighlights(JSON.parse(highlightsJson));
      
      logger.info('Library data loaded successfully', { bookCount: libraryJson ? JSON.parse(libraryJson).length : 0 });
    } catch (error) {
      captureError('Load Library Data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBooks = useCallback((newBooks: Book[]) => {
    // Batched write — won't block UI thread
    StorageQueue.enqueueJSON(LIBRARY_STORAGE_KEY, newBooks);
    logger.debug('Library queued for save', { bookCount: newBooks.length });
  }, []);

  const addBook = async (book: Book) => {
    const newBooks = [...books, enrichStoredBook(book)];
    setBooks(newBooks);
    await saveBooks(newBooks);
  };

  const removeBook = async (bookId: string) => {
    const newBooks = books.filter((b: Book) => b.id !== bookId);
    setBooks(newBooks);
    saveBooks(newBooks);
    // Invalidate chapter cache for removed book
    invalidateCache(bookId).catch(() => {});
  };

  const updateBook = async (bookId: string, updates: Partial<Book>) => {
    const shouldRebuildIdentity =
      'title' in updates ||
      'author' in updates ||
      'totalChapters' in updates ||
      'filePath' in updates ||
      'language' in updates ||
      'epubIdentifier' in updates;

    const newBooks = books.map((b: Book) => {
      if (b.id !== bookId) return b;
      return enrichStoredBook({
        ...b,
        ...updates,
        identityKey: shouldRebuildIdentity ? undefined : updates.identityKey ?? b.identityKey,
      } as Book);
    });
    setBooks(newBooks);
    await saveBooks(newBooks);
  };

  const getBook = (bookId: string) => books.find((b: Book) => b.id === bookId);

  const setSortOption = useCallback((option: SortOption) => {
    setSortOptionState(option);
    StorageQueue.enqueue(SORT_STORAGE_KEY, option);
  }, []);

  const setFilterOption = useCallback((option: FilterOption) => {
    setFilterOptionState(option);
    StorageQueue.enqueue(FILTER_STORAGE_KEY, option);
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    StorageQueue.enqueue(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  const sortedAndFilteredBooks = React.useMemo(() => {
    let filtered = books;

    // Apply filter
    if (filterOption !== 'all') {
      filtered = books.filter((b: Book) => b.readingStatus === filterOption);
    }

    // Apply sort
    const sorted = [...filtered];
    switch (sortOption) {
      case 'recent':
        sorted.sort((a, b) => {
          const dateA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
          const dateB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'author':
        sorted.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'progress':
        sorted.sort((a, b) => b.progress - a.progress);
        break;
      case 'dateAdded':
        sorted.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
        break;
    }

    return sorted;
  }, [books, sortOption, filterOption]);

  // Reading positions (batched — high-frequency writes during reading)
  const saveReadingPosition = useCallback(async (position: ReadingPosition) => {
    setReadingPositions(prev => {
      const newPositions = { ...prev, [position.bookId]: position };
      StorageQueue.enqueueJSON(READING_POSITIONS_KEY, newPositions);
      return newPositions;
    });
    // Also persist to progress.json as a secondary backup
    const book = books.find(b => b.id === position.bookId);
    if (book) {
      saveProgressToJson({
        bookId: book.id,
        title: book.title,
        author: book.author,
        lastChapter: position.chapterIndex,
        percentage: book.progress,
        lastReadAt: book.lastReadAt,
        savedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }, [books]);

  const getReadingPosition = async (bookId: string) => {
    return readingPositions[bookId] || null;
  };

  // Bookmarks (batched writes)
  const addBookmark = useCallback(async (bookmark: Bookmark) => {
    setBookmarks(prev => {
      const newBookmarks = [...prev, bookmark];
      StorageQueue.enqueueJSON(BOOKMARKS_KEY, newBookmarks);
      return newBookmarks;
    });
  }, []);

  const removeBookmark = useCallback(async (bookmarkId: string) => {
    setBookmarks(prev => {
      const newBookmarks = prev.filter((b: Bookmark) => b.id !== bookmarkId);
      StorageQueue.enqueueJSON(BOOKMARKS_KEY, newBookmarks);
      return newBookmarks;
    });
  }, []);

  const getBookmarksByBook = (bookId: string) => bookmarks.filter((b: Bookmark) => b.bookId === bookId);

  // Highlights (batched writes)
  const addHighlight = useCallback(async (highlight: Highlight) => {
    setHighlights(prev => {
      const newHighlights = [...prev, highlight];
      StorageQueue.enqueueJSON(HIGHLIGHTS_KEY, newHighlights);
      return newHighlights;
    });
  }, []);

  const removeHighlight = useCallback(async (highlightId: string) => {
    setHighlights(prev => {
      const newHighlights = prev.filter((h: Highlight) => h.id !== highlightId);
      StorageQueue.enqueueJSON(HIGHLIGHTS_KEY, newHighlights);
      return newHighlights;
    });
  }, []);

  const getHighlightsByBook = (bookId: string) => highlights.filter((h: Highlight) => h.bookId === bookId);

  // Data management
  const clearCache = async () => {
    await clearAllCache();
    const opdsTempDir = `${cacheDirectory || ''}opds/`;
    const generatedEpubDir = `${cacheDirectory || ''}generated-epub/`;
    await deleteAsync(opdsTempDir, { idempotent: true });
    await deleteAsync(generatedEpubDir, { idempotent: true });
    logger.info('Temporary cache cleared successfully');
  };

  const estimateLibraryStorageBytes = async (): Promise<number> => {
    let total = 0;
    for (const book of books) {
      try {
        const info = await getInfoAsync(book.filePath);
        if (info.exists && 'size' in info) {
          total += (info as { size: number }).size;
        }
      } catch {
        /* skip */
      }
    }
    return total;
  };

  const clearHistoryEntry = useCallback(async (bookId: string) => {
    const newBooks = books.map((b: Book) =>
      b.id === bookId ? { ...b, lastReadAt: null } : b
    );
    setBooks(newBooks);
    saveBooks(newBooks);
  }, [books, saveBooks]);

  const rescanLibrary = async (): Promise<LibraryRescanResult> => {
    try {
      let removed = 0;
      let imported = 0;
      let skippedDuplicates = 0;
      let watchedFolderFiles = 0;
      const booksToRemove: string[] = [];
      let workingBooks = books.map(enrichStoredBook);

      // Check existing books in library
      for (const book of workingBooks) {
        try {
          const info = await getInfoAsync(book.filePath);
          if (!info.exists) {
            booksToRemove.push(book.id);
            removed++;
          }
        } catch {
          // Some storage providers are flaky with stat calls. Keep the entry and let open/read fail later.
        }
      }

      if (booksToRemove.length > 0) {
        workingBooks = workingBooks.filter((b: Book) => !booksToRemove.includes(b.id));
      }

      // Scan user's selected storage directory for new books and import them in-place
      try {
        const storageDirUri = await getStorageDirectory();
        if (storageDirUri) {
          try {
            const files =
              storageDirUri.startsWith('content://')
                ? await StorageAccessFramework.readDirectoryAsync(storageDirUri)
                : await readDirectoryAsync(storageDirUri);
            watchedFolderFiles = files.length;

            for (const fileUri of files) {
              const fileName = fileBasename(fileUri);
              if (!fileName.toLowerCase().endsWith('.epub')) continue;
              if (workingBooks.some(book => normalizePath(book.filePath) === normalizePath(fileUri))) {
                continue;
              }

              try {
                const prepared = await prepareBookImport(fileUri, fileName);
                const duplicate = findDuplicateBook(
                  {
                    filePath: fileUri,
                    contentHash: prepared.contentHash,
                    identityKey: prepared.identityKey,
                  },
                  workingBooks
                );

                if (duplicate) {
                  skippedDuplicates++;
                  continue;
                }

                const importedBook = createImportedBook({
                  id: `book_rescan_${Date.now()}_${imported}_${Math.random().toString(36).slice(2, 8)}`,
                  filePath: fileUri,
                  fileName,
                  prepared,
                  storageFolderUri: storageDirUri,
                });

                workingBooks = [...workingBooks, importedBook];
                imported++;
                logger.info('Imported EPUB from watched storage folder', {
                  title: importedBook.title,
                  fileName,
                });
              } catch (importError) {
                logger.warn('Failed to import watched-folder EPUB during rescan', {
                  fileUri,
                  error: importError instanceof Error ? importError.message : String(importError),
                });
              }
            }
          } catch (e) {
            logger.warn('Could not scan storage directory', e);
          }
        }
      } catch (e) {
        logger.warn('Storage directory scan skipped', e);
      }

      if (
        booksToRemove.length > 0 ||
        imported > 0 ||
        JSON.stringify(books) !== JSON.stringify(workingBooks)
      ) {
        setBooks(workingBooks);
        await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(workingBooks));
      }

      const valid = workingBooks.length;
      logger.info('Library rescan complete', { removed, valid, imported, skippedDuplicates, watchedFolderFiles });
      return { removed, valid, imported, skippedDuplicates, watchedFolderFiles };
    } catch (error) {
      captureError('Rescan Library', error);
      return { removed: 0, valid: books.length, imported: 0, skippedDuplicates: 0, watchedFolderFiles: 0 };
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        books,
        addBook,
        removeBook,
        updateBook,
        getBook,
        sortOption,
        setSortOption,
        filterOption,
        setFilterOption,
        viewMode,
        setViewMode,
        sortedAndFilteredBooks,
        isLoading,
        saveReadingPosition,
        getReadingPosition,
        bookmarks,
        addBookmark,
        removeBookmark,
        getBookmarksByBook,
        highlights,
        addHighlight,
        removeHighlight,
        getHighlightsByBook,
        clearCache,
        rescanLibrary,
        estimateLibraryStorageBytes,
        clearHistoryEntry,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
