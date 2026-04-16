import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Book } from '@/types/book';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { getCachedBook } from '@/utils/chapter-cache';
import { parseEpub } from '@/utils/epub-parser';
import { AppDialog } from '@/components/ui/AppDialog';
import {
  X,
  BookOpen,
  Image as ImageIcon,
  Share as ShareIcon,
  HardDrive,
  FileText,
  List as ListIcon,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';

interface BookDetailsModalProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
}

export function BookDetailsModal({ visible, book, onClose }: BookDetailsModalProps) {
  const { currentTheme } = useTheme();
  const { updateBook } = useLibrary();

  const [loading, setLoading] = useState(true);
  const [fileSize, setFileSize] = useState<string>('Unknown');
  const [description, setDescription] = useState<string>('');
  const [chapters, setChapters] = useState<any[]>([]);
  const [displayCoverUri, setDisplayCoverUri] = useState<string | null>(book?.coverUri || null);
  const [coverDialog, setCoverDialog] = useState<{ title: string; message: string; tone: 'success' | 'danger' } | null>(null);
  const [tocExpanded, setTocExpanded] = useState(false);

  useEffect(() => {
    setDisplayCoverUri(book?.coverUri || null);
  }, [book?.coverUri, book?.id]);

  useEffect(() => {
    if (!visible || !book) return;
    let mounted = true;

    const loadDetails = async () => {
      setLoading(true);
      try {
        // 1. Get file size
        const fileInfo = await getInfoAsync(book.filePath);
        if (fileInfo.exists && mounted) {
          const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);
          setFileSize(`${sizeMB} MB`);
        }

        // 2. Get rich metadata (description, chapters)
        let cached = await getCachedBook(book.id);
        if (!cached) {
          // Fallback if not cached yet
          const parsed = await parseEpub(book.filePath);
          cached = {
            metadata: parsed.metadata,
            chapters: parsed.chapters,
            extractedCss: parsed.extractedCss || '',
          };
        }

        if (mounted) {
          setDescription(cached.metadata.description || 'No description available for this book.');
          setChapters(cached.chapters || []);
        }
      } catch (err) {
        console.warn('Failed to load book detailed info:', err);
        if (mounted) setDescription('Failed to load metadata.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      mounted = false;
    };
  }, [visible, book]);

  if (!book) return null;

  const handleImportCover = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const base64 = await readAsStringAsync(asset.uri, { encoding: 'base64' });
      const coverUri = `data:${asset.mimeType || 'image/jpeg'};base64,${base64}`;

      await updateBook(book.id, { coverUri });
      setDisplayCoverUri(coverUri);
      setCoverDialog({
        title: 'Cover Updated',
        message: 'The imported cover was applied to this book.',
        tone: 'success',
      });
    } catch (err) {
      console.warn('Cover import failed:', err);
      setCoverDialog({
        title: 'Cover Import Failed',
        message: 'Miyo could not import that image as a cover.',
        tone: 'danger',
      });
    }
  };

  const handleExportCover = async () => {
    const coverUri = displayCoverUri || book.coverUri;
    if (!coverUri) return;
    try {
      await Share.share({
        url: coverUri,
        title: `${book.title} Cover Art`,
      });
    } catch (err) {
      console.warn('Cover export failed:', err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="primary" size="header" weight="semibold">
            Book Details
          </ThemedText>
          <PressableScale onPress={onClose} style={styles.closeButton}>
            <X size={24} color={currentTheme.secondaryText} />
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Section: Cover + Basic Info */}
          <View style={styles.topSection}>
            <View style={styles.coverFrame}>
              {(displayCoverUri || book.coverUri) ? (
                <Image source={{ uri: displayCoverUri || book.coverUri || undefined }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.placeholderCover, { backgroundColor: currentTheme.accent + '20' }]}>
                  <BookOpen size={40} color={currentTheme.accent} />
                </View>
              )}
            </View>

            <View style={styles.titleInfo}>
              <ThemedText variant="primary" size="header" weight="bold" style={styles.title}>
                {book.title}
              </ThemedText>
              <ThemedText variant="secondary" size="body" style={styles.author}>
                {book.author}
              </ThemedText>

              {/* Cover Action Buttons */}
              <View style={styles.coverActions}>
                <PressableScale
                  style={[styles.actionBtn, { backgroundColor: currentTheme.cardBackground }]}
                  onPress={handleImportCover}
                >
                  <ImageIcon size={16} color={currentTheme.text} />
                  <ThemedText size="caption" weight="medium">
                    Import Cover
                  </ThemedText>
                </PressableScale>
                <PressableScale
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: currentTheme.cardBackground,
                      opacity: (displayCoverUri || book.coverUri) ? 1 : 0.5,
                    },
                  ]}
                  onPress={handleExportCover}
                  disabled={!(displayCoverUri || book.coverUri)}
                >
                  <ShareIcon size={16} color={currentTheme.text} />
                  <ThemedText size="caption" weight="medium">
                    Export
                  </ThemedText>
                </PressableScale>
              </View>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={[styles.statsBar, { backgroundColor: currentTheme.cardBackground }]}>
            <View style={styles.statItem}>
              <HardDrive size={20} color={currentTheme.accent} />
              <View>
                <ThemedText size="caption" variant="secondary">Size</ThemedText>
                <ThemedText size="body" weight="semibold">
                  {loading ? '...' : fileSize}
                </ThemedText>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <FileText size={20} color={currentTheme.accent} />
              <View>
                <ThemedText size="caption" variant="secondary">Format</ThemedText>
                <ThemedText size="body" weight="semibold">EPUB</ThemedText>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ListIcon size={20} color={currentTheme.accent} />
              <View>
                <ThemedText size="caption" variant="secondary">Chapters</ThemedText>
                <ThemedText size="body" weight="semibold">
                  {book.totalChapters}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <ThemedText variant="secondary" size="caption" weight="bold" style={styles.sectionHeader}>
              DESCRIPTION
            </ThemedText>
            {loading ? (
              <ActivityIndicator size="small" color={currentTheme.accent} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
            ) : (
              <ThemedText size="body" style={styles.descriptionText}>
                {description.replace(/<[^>]*>?/gm, '') /* strip html */}
              </ThemedText>
            )}
          </View>

          {/* Chapter Outline — Expandable */}
          <View style={styles.section}>
            <Pressable
              onPress={() => setTocExpanded(p => !p)}
              style={[styles.tocHeader, { borderBottomColor: currentTheme.secondaryText + '15' }]}
            >
              <View style={styles.tocHeaderLeft}>
                <ListIcon size={15} color={currentTheme.secondaryText} />
                <ThemedText variant="secondary" size="caption" weight="bold" style={{ marginLeft: 6 }}>
                  TABLE OF CONTENTS
                </ThemedText>
              </View>
              <View style={styles.tocHeaderRight}>
                <ThemedText variant="secondary" size="caption">
                  {chapters.length} ch
                </ThemedText>
                {tocExpanded
                  ? <ChevronUp size={16} color={currentTheme.secondaryText} style={{ marginLeft: 4 }} />
                  : <ChevronDown size={16} color={currentTheme.secondaryText} style={{ marginLeft: 4 }} />}
              </View>
            </Pressable>
            {loading ? (
              <ActivityIndicator size="small" color={currentTheme.accent} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
            ) : (
              <View style={[styles.chapterList, { backgroundColor: currentTheme.cardBackground }]}>
                {(tocExpanded ? chapters : chapters.slice(0, 5)).map((ch, i) => (
                  <Pressable
                    key={i}
                    onPress={() => { onClose(); }}
                    style={[styles.chapterRow, i > 0 && { borderTopWidth: 1, borderTopColor: currentTheme.secondaryText + '20' }]}
                  >
                    <ThemedText variant="secondary" size="caption" style={{ minWidth: 28 }}>{i + 1}.</ThemedText>
                    <ThemedText numberOfLines={1} style={{ flex: 1 }}>{ch.title || `Chapter ${i + 1}`}</ThemedText>
                    <ChevronRight size={14} color={currentTheme.secondaryText + '60'} />
                  </Pressable>
                ))}
                {!tocExpanded && chapters.length > 5 && (
                  <Pressable
                    onPress={() => setTocExpanded(true)}
                    style={[styles.chapterRow, { borderTopWidth: 1, borderTopColor: currentTheme.secondaryText + '20', justifyContent: 'center' }]}
                  >
                    <ChevronDown size={14} color={currentTheme.accent} style={{ marginRight: 4 }} />
                    <ThemedText variant="secondary" size="caption" style={{ color: currentTheme.accent }}>
                      Show all {chapters.length} chapters
                    </ThemedText>
                  </Pressable>
                )}
                {tocExpanded && chapters.length > 5 && (
                  <Pressable
                    onPress={() => setTocExpanded(false)}
                    style={[styles.chapterRow, { borderTopWidth: 1, borderTopColor: currentTheme.secondaryText + '20', justifyContent: 'center' }]}
                  >
                    <ChevronUp size={14} color={currentTheme.accent} style={{ marginRight: 4 }} />
                    <ThemedText variant="secondary" size="caption" style={{ color: currentTheme.accent }}>
                      Collapse
                    </ThemedText>
                  </Pressable>
                )}
                {chapters.length === 0 && (
                  <View style={styles.chapterRow}>
                    <ThemedText variant="secondary" size="caption">No index found.</ThemedText>
                  </View>
                )}
              </View>
            )}
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <AppDialog
        visible={!!coverDialog}
        title={coverDialog?.title || ''}
        message={coverDialog?.message || ''}
        tone={coverDialog?.tone || 'success'}
        actions={[{ label: 'OK', onPress: () => setCoverDialog(null) }]}
        onClose={() => setCoverDialog(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  topSection: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  coverFrame: {
    width: 110,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 6,
    lineHeight: 28,
  },
  author: {
    marginBottom: 16,
  },
  coverActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statsBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    marginHorizontal: 16,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    marginBottom: 10,
    letterSpacing: 1,
  },
  tocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 0,
    borderBottomWidth: 1,
  },
  tocHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tocHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  descriptionText: {
    lineHeight: 24,
    opacity: 0.9,
  },
  chapterList: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
