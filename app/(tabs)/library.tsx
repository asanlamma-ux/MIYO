import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import { getStorageDirectory, requestStorageDirectory, markPermissionGranted } from '@/utils/permissions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { FlashList } from '@shopify/flash-list';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { AppDialog, AppDialogAction, AppDialogTone } from '@/components/ui/AppDialog';
import { BookCard } from '@/components/library/BookCard';
import { EmptyLibrary } from '@/components/library/EmptyLibrary';
import { LibraryHeader } from '@/components/library/LibraryHeader';
import { BookActionModal } from '@/components/library/BookActionModal';
import { ImportSuccessModal } from '@/components/library/ImportSuccessModal';
import { OpdsCatalogModal } from '@/components/library/OpdsCatalogModal';
import { WtrLabBrowserModal } from '@/components/library/WtrLabBrowserModal';
import { Book } from '@/types/book';
import { Plus, BookOpen } from 'lucide-react-native';
import { logger, captureError } from '@/utils/logger';
import { importBookFromSource } from '@/utils/library-import';
import { OpdsEntry } from '@/types/opds';

export default function LibraryScreen() {
  const { currentTheme } = useTheme();
  const {
    sortedAndFilteredBooks,
    books,
    viewMode,
    addBook,
    removeBook,
    updateBook,
    isLoading,
    setFilterOption,
  } = useLibrary();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showOpdsModal, setShowOpdsModal] = useState(false);
  const [showWtrModal, setShowWtrModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageDirectoryUri, setStorageDirectoryUri] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{
    titles: string[];
    failed: number;
    skippedExact: number;
    skippedProbable: number;
  } | null>(null);
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    tone?: AppDialogTone;
    actions: AppDialogAction[];
  } | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    duplicateType: 'exact' | 'probable' | 'path';
    existingTitle: string;
    incomingName: string;
  } | null>(null);
  const duplicateResolverRef = useRef<((value: boolean) => void) | null>(null);

  const gridColumns = screenWidth < 360 ? 2 : screenWidth < 480 ? 3 : screenWidth < 600 ? 3 : 4;
  const horizontalPadding = 16;
  const itemSpacing = 10;
  const availableWidth = screenWidth - (horizontalPadding * 2);
  const cardWidth = Math.floor((availableWidth - (itemSpacing * (gridColumns - 1))) / gridColumns);
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  useEffect(() => {
    getStorageDirectory().then(setStorageDirectoryUri);
  }, []);

  const displayedBooks = useMemo(() => {
    if (!searchQuery.trim()) return sortedAndFilteredBooks;
    const q = searchQuery.toLowerCase();
    return sortedAndFilteredBooks.filter(
      b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [sortedAndFilteredBooks, searchQuery]);

  const showMessageDialog = useCallback(
    (title: string, message: string, tone: AppDialogTone = 'default') => {
      setDialogState({
        visible: true,
        title,
        message,
        tone,
        actions: [{ label: 'OK', onPress: () => setDialogState(null) }],
      });
    },
    []
  );

  const promptDuplicateImport = useCallback(
    (params: {
      duplicateType: 'exact' | 'probable' | 'path';
      existingTitle: string;
      incomingName: string;
    }) =>
      new Promise<boolean>(resolve => {
        duplicateResolverRef.current = resolve;
        setDuplicatePrompt(params);
      }),
    []
  );

  const resolveDuplicatePrompt = useCallback((shouldImport: boolean) => {
    duplicateResolverRef.current?.(shouldImport);
    duplicateResolverRef.current = null;
    setDuplicatePrompt(null);
  }, []);

  const handlePickStorageFolder = useCallback(async () => {
    try {
      const uri = await requestStorageDirectory();
      if (uri) {
        await markPermissionGranted(true);
        setStorageDirectoryUri(uri);
        showMessageDialog(
          'Books Folder Ready',
          'New imports will use this folder when possible on Android.',
          'success'
        );
      }
    } catch (e) {
      captureError('Pick storage folder', e);
    }
  }, [showMessageDialog]);

  const handleImportBooks = useCallback(async () => {
    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/epub'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        setImporting(false);
        return;
      }

      const storageDirUri = await getStorageDirectory();

      let successCount = 0;
      let failCount = 0;
      let skippedExactCount = 0;
      let skippedProbableCount = 0;
      const importedTitles: string[] = [];
      const usedNames = new Set<string>();
      const currentBatchNames = new Set<string>();
      let knownBooks = [...books];

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        try {
          await new Promise<void>(resolve => {
            InteractionManager.runAfterInteractions(() => resolve());
          });
          const outcome = await importBookFromSource({
            sourceUri: asset.uri,
            sourceFileName: asset.name || `book_${Date.now()}_${i}.epub`,
            existingBooks: knownBooks,
            storageDirUri,
            addBook,
            usedNames: new Set([...usedNames, ...currentBatchNames]),
          });

          if (outcome.status === 'duplicate') {
            const shouldImportAnyway = await promptDuplicateImport({
              duplicateType: outcome.duplicateType,
              existingTitle: outcome.existingBook.title,
              incomingName: asset.name || `book_${i + 1}.epub`,
            });

            if (!shouldImportAnyway) {
              if (outcome.duplicateType === 'probable') {
                skippedProbableCount++;
              } else {
                skippedExactCount++;
              }
              continue;
            }

            const forcedOutcome = await importBookFromSource({
              sourceUri: asset.uri,
              sourceFileName: asset.name || `book_${Date.now()}_${i}.epub`,
              existingBooks: knownBooks,
              storageDirUri,
              addBook,
              prepared: outcome.prepared,
              usedNames: new Set([...usedNames, ...currentBatchNames]),
              skipDuplicateCheck: true,
            });

            if (forcedOutcome.status !== 'imported') {
              throw forcedOutcome.status === 'failed'
                ? forcedOutcome.error
                : new Error('Could not import duplicate book.');
            }

            knownBooks = [...knownBooks, forcedOutcome.book];
            if (forcedOutcome.book.fileName) {
              usedNames.add(forcedOutcome.book.fileName.toLowerCase());
              currentBatchNames.add(forcedOutcome.book.fileName.toLowerCase());
            }
            importedTitles.push(forcedOutcome.book.title);
            successCount++;
            continue;
          }

          if (outcome.status === 'failed') {
            throw outcome.error;
          }

          knownBooks = [...knownBooks, outcome.book];
          if (outcome.book.fileName) {
            usedNames.add(outcome.book.fileName.toLowerCase());
            currentBatchNames.add(outcome.book.fileName.toLowerCase());
          }
          importedTitles.push(outcome.book.title);
          successCount++;
        } catch (err) {
          captureError('Import single book', err);
          failCount++;
        }
      }

      if (successCount > 0) {
        setFilterOption('all');
        setImportSuccess({
          titles: importedTitles,
          failed: failCount,
          skippedExact: skippedExactCount,
          skippedProbable: skippedProbableCount,
        });
        logger.info(`Imported ${successCount} books`);
      } else if (skippedExactCount > 0 || skippedProbableCount > 0) {
        showMessageDialog(
          'Import Cancelled',
          `${skippedExactCount} exact duplicate(s) and ${skippedProbableCount} probable duplicate(s) were left untouched.`,
          'warning'
        );
      } else if (failCount > 0) {
        showMessageDialog(
          'Import Failed',
          'Could not import the selected files. Make sure they are valid EPUB files.',
          'danger'
        );
      }
    } catch (error) {
      captureError('Import Books', error);
      showMessageDialog(
        'Import Failed',
        'Could not access the file picker. Please check permissions in Settings.',
        'danger'
      );
    } finally {
      setImporting(false);
    }
  }, [addBook, books, promptDuplicateImport, setFilterOption, showMessageDialog]);

  const handleBookPress = useCallback((book: Book) => {
    router.push(`/reader/${book.id}`);
  }, [router]);

  const importGeneratedSource = useCallback(async (params: {
    sourceUri: string;
    sourceFileName: string;
    duplicateTitle: string;
  }) => {
    const storageDirUri = await getStorageDirectory();
    const outcome = await importBookFromSource({
      sourceUri: params.sourceUri,
      sourceFileName: params.sourceFileName,
      existingBooks: books,
      storageDirUri,
      addBook,
    });

    if (outcome.status === 'imported') {
      setFilterOption('all');
      setImportSuccess({
        titles: [outcome.book.title],
        failed: 0,
        skippedExact: 0,
        skippedProbable: 0,
      });
      return true;
    }

    if (outcome.status === 'duplicate') {
      const shouldImportAnyway = await promptDuplicateImport({
        duplicateType: outcome.duplicateType,
        existingTitle: outcome.existingBook.title,
        incomingName: params.duplicateTitle,
      });

      if (!shouldImportAnyway) {
        showMessageDialog(
          'Import Left Unchanged',
          'That book already exists in your library, so the generated EPUB was not imported.',
          'warning'
        );
        return false;
      }

      const forcedOutcome = await importBookFromSource({
        sourceUri: params.sourceUri,
        sourceFileName: params.sourceFileName,
        existingBooks: books,
        storageDirUri,
        addBook,
        prepared: outcome.prepared,
        skipDuplicateCheck: true,
      });

      if (forcedOutcome.status === 'imported') {
        setFilterOption('all');
        setImportSuccess({
          titles: [forcedOutcome.book.title],
          failed: 0,
          skippedExact: 0,
          skippedProbable: 0,
        });
        return true;
      }

      showMessageDialog(
        'Import Failed',
        forcedOutcome.status === 'failed'
          ? forcedOutcome.error.message
          : 'Could not import this book.',
        'danger'
      );
      return false;
    }

    showMessageDialog('Import Failed', outcome.error.message, 'danger');
    return false;
  }, [addBook, books, promptDuplicateImport, setFilterOption, showMessageDialog]);

  const handleImportFromCatalog = useCallback(async (entry: OpdsEntry) => {
    const acquisitionLink = entry.acquisitionLinks.find(link => link.type === 'application/epub+zip') || entry.acquisitionLinks[0];
    if (!acquisitionLink) {
      showMessageDialog('Catalog Entry', 'This OPDS entry does not expose an EPUB download link.', 'warning');
      return;
    }

    const downloadsDir = `${cacheDirectory || ''}opds/`;

    try {
      setImporting(true);
      const dirInfo = await getInfoAsync(downloadsDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(downloadsDir, { intermediates: true });
      }

      const safeName = `${entry.title || 'catalog-book'}`.replace(/[<>:"/\\|?*]/g, '_');
      const tempPath = `${downloadsDir}${safeName}_${Date.now()}.epub`;
      const download = await downloadAsync(acquisitionLink.href, tempPath);
      const imported = await importGeneratedSource({
        sourceUri: download.uri,
        sourceFileName: `${safeName}.epub`,
        duplicateTitle: entry.title || safeName,
      });
      if (imported) {
        setShowOpdsModal(false);
      }
    } catch (error) {
      captureError('Import OPDS Book', error);
      showMessageDialog('Import Failed', 'Could not download this book from the catalog.', 'danger');
    } finally {
      setImporting(false);
    }
  }, [importGeneratedSource, showMessageDialog]);

  const handleBookLongPress = useCallback((book: Book) => {
    setSelectedBook(book);
    setShowActionModal(true);
  }, []);

  const handleDeleteBook = useCallback(() => {
    if (!selectedBook) return;
    setDialogState({
      visible: true,
      title: 'Remove Book',
      message: `Remove "${selectedBook.title}" from your library? The file will also be deleted.`,
      tone: 'danger',
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setDialogState(null) },
        {
          label: 'Remove',
          variant: 'danger',
          onPress: async () => {
            try {
              await deleteAsync(selectedBook.filePath, { idempotent: true });
            } catch (error) {
              captureError('Delete Book File', error);
            }
            await removeBook(selectedBook.id);
            setShowActionModal(false);
            setSelectedBook(null);
            setDialogState(null);
          },
        },
      ],
    });
  }, [selectedBook, removeBook]);

  const handleToggleStatus = useCallback(async (status: 'unread' | 'reading' | 'finished') => {
    if (!selectedBook) return;
    await updateBook(selectedBook.id, { readingStatus: status });
    setSelectedBook(prev => prev ? { ...prev, readingStatus: status } : null);
  }, [selectedBook, updateBook]);

  const handleUpdateBookTags = useCallback(
    async (tags: string[]) => {
      if (!selectedBook) return;
      await updateBook(selectedBook.id, { tags });
      setSelectedBook(prev => (prev ? { ...prev, tags } : null));
    },
    [selectedBook, updateBook]
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: Book; index: number }) => {
      const isLastInRow = (index + 1) % gridColumns === 0;
      return (
        <View
          style={[
            styles.gridItemWrapper,
            { width: cardWidth },
            !isLastInRow && { marginRight: itemSpacing },
          ]}
        >
          <BookCard
            book={item}
            isGridView={true}
            cardWidth={cardWidth}
            onPress={() => handleBookPress(item)}
            onLongPress={() => handleBookLongPress(item)}
          />
        </View>
      );
    },
    [gridColumns, cardWidth, itemSpacing, handleBookPress, handleBookLongPress]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Book; index: number }) => (
      <View style={styles.listItemWrap}>
        <BookCard
          book={item}
          isGridView={false}
          onPress={() => handleBookPress(item)}
          onLongPress={() => handleBookLongPress(item)}
        />
      </View>
    ),
    [handleBookPress, handleBookLongPress]
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.accent} />
        <ThemedText variant="secondary" size="body" style={{ marginTop: 12 }}>
          Loading library...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}> 
        <LibraryHeader
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          onPickStorageFolder={handlePickStorageFolder}
          storageDirectoryUri={storageDirectoryUri}
          onOpenCatalogs={() => setShowOpdsModal(true)}
          onOpenOnlineBrowser={() => setShowWtrModal(true)}
        />

        {displayedBooks.length === 0 && sortedAndFilteredBooks.length === 0 ? (
          <EmptyLibrary onImport={handleImportBooks} />
        ) : displayedBooks.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <View style={[styles.noResultsIcon, { backgroundColor: currentTheme.accent + '15' }]}>
              <BookOpen size={36} color={currentTheme.accent} />
            </View>
            <ThemedText variant="primary" size="header" weight="semibold">No books found</ThemedText>
            <ThemedText variant="secondary" size="body" style={{ textAlign: 'center', marginTop: 6 }}>
              Try a different search term or clear your filters.
            </ThemedText>
          </View>
        ) : (
          <View style={{ flex: 1, minHeight: 200, width: '100%' }}>
            <FlashList
              data={displayedBooks}
              renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
              keyExtractor={(item: Book) => item.id}
              numColumns={viewMode === 'grid' ? gridColumns : 1}
              key={viewMode === 'grid' ? `grid-${gridColumns}-${screenWidth}` : 'list'}
              {...({
                estimatedItemSize: viewMode === 'grid' ? 250 : 120,
                getItemType: () => viewMode,
              } as any)}
              contentContainerStyle={[
                viewMode === 'grid' ? styles.gridContent : styles.listContent,
                { paddingBottom: tabBarHeight + 90 },
              ]}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {sortedAndFilteredBooks.length > 0 && (
          <Animated.View
            style={[
              styles.fabContainer,
              { bottom: tabBarHeight + 16 },
            ]}
          >
            <PressableScale
              onPress={handleImportBooks}
              disabled={importing}
              style={[styles.fab, { backgroundColor: currentTheme.accent }]}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Plus size={22} color="#FFFFFF" />
                  <ThemedText style={styles.fabLabel}>Import</ThemedText>
                </>
              )}
            </PressableScale>
          </Animated.View>
        )}
      </View>

      <ImportSuccessModal
        visible={!!importSuccess}
        titles={importSuccess?.titles ?? []}
        failedCount={importSuccess?.failed ?? 0}
        skippedExactCount={importSuccess?.skippedExact ?? 0}
        skippedProbableCount={importSuccess?.skippedProbable ?? 0}
        onClose={() => setImportSuccess(null)}
      />

      <OpdsCatalogModal
        visible={showOpdsModal}
        onClose={() => setShowOpdsModal(false)}
        onImportBook={handleImportFromCatalog}
      />

      <WtrLabBrowserModal
        visible={showWtrModal}
        onClose={() => setShowWtrModal(false)}
        onImportGeneratedEpub={async ({ uri, fileName, title }) => {
          setImporting(true);
          try {
            return await importGeneratedSource({
              sourceUri: uri,
              sourceFileName: fileName,
              duplicateTitle: title,
            });
          } finally {
            setImporting(false);
          }
        }}
      />

      <BookActionModal
        visible={showActionModal}
        book={selectedBook}
        onClose={() => {
          setShowActionModal(false);
          setSelectedBook(null);
        }}
        onDelete={handleDeleteBook}
        onToggleStatus={handleToggleStatus}
        onUpdateTags={handleUpdateBookTags}
      />

      <AppDialog
        visible={!!dialogState?.visible}
        title={dialogState?.title || ''}
        message={dialogState?.message || ''}
        tone={dialogState?.tone}
        actions={dialogState?.actions || [{ label: 'OK', onPress: () => setDialogState(null) }]}
        onClose={() => setDialogState(null)}
      />

      <AppDialog
        visible={!!duplicatePrompt}
        title="Duplicate Book Detected"
        message={duplicatePrompt
          ? `${duplicatePrompt.duplicateType === 'probable' ? 'A probable duplicate of' : 'This matches'} \"${duplicatePrompt.existingTitle}\". Cancel import, or import anyway and Miyo will rename the new copy with a suffix like (1).`
          : ''}
        tone="warning"
        actions={[
          { label: 'Cancel Import', variant: 'secondary', onPress: () => resolveDuplicatePrompt(false) },
          { label: 'Import Anyway', variant: 'primary', onPress: () => resolveDuplicatePrompt(true) },
        ]}
        onClose={() => resolveDuplicatePrompt(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  listContent: {
    paddingTop: 10,
  },
  listItemWrap: {
    marginBottom: 8,
  },
  gridItemWrapper: {
    marginBottom: 10,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  noResultsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
