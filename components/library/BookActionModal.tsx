import React from 'react';
import { View, StyleSheet, Modal, Pressable, Image, ScrollView } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Book } from '@/types/book';
import {
  X,
  Trash2,
  BookOpen,
  CheckCircle,
  Circle,
  BookMarked,
  Info,
} from 'lucide-react-native';
import { BookDetailsModal } from './BookDetailsModal';

const QUICK_COLLECTION_TAGS = ['Fiction', 'Non-fiction', 'Study', 'Manga', 'Classics', 'Reference'] as const;

interface BookActionModalProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  onDelete: () => void;
  onToggleStatus: (status: 'unread' | 'reading' | 'finished') => void;
  onUpdateTags?: (tags: string[]) => void;
}

export function BookActionModal({
  visible,
  book,
  onClose,
  onDelete,
  onToggleStatus,
  onUpdateTags,
}: BookActionModalProps) {
  const { currentTheme } = useTheme();
  const [showDetails, setShowDetails] = React.useState(false);

  if (!book) return null;
  const activeTags = Array.isArray(book.tags) ? book.tags : [];

  return (
    <>
      <Modal
        visible={visible && !showDetails}
        animationType="fade"
        transparent
        onRequestClose={onClose}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[
              styles.content,
              { backgroundColor: currentTheme.cardBackground },
            ]}
            onPress={e => e.stopPropagation()}
          >
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentScrollInner}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.header}>
                <View style={styles.bookInfo}>
                  {book.coverUri ? (
                    <Image
                      source={{ uri: book.coverUri }}
                      style={styles.cover}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.placeholderCover,
                        { backgroundColor: currentTheme.accent + '20' },
                      ]}
                    >
                      <BookOpen size={24} color={currentTheme.accent} />
                    </View>
                  )}
                  <View style={styles.titleContainer}>
                    <ThemedText
                      variant="primary"
                      size="body"
                      weight="semibold"
                      numberOfLines={2}
                    >
                      {book.title}
                    </ThemedText>
                    <ThemedText
                      variant="secondary"
                      size="caption"
                      numberOfLines={1}
                    >
                      {book.author}
                    </ThemedText>
                  </View>
                </View>
                <PressableScale onPress={onClose} style={styles.closeButton}>
                  <X size={20} color={currentTheme.secondaryText} />
                </PressableScale>
              </View>

              <PressableScale
                onPress={() => setShowDetails(true)}
                style={[styles.detailsButton, { backgroundColor: currentTheme.accent + '15' }]}
              >
                <Info size={18} color={currentTheme.accent} />
                <ThemedText style={{ color: currentTheme.accent }} size="body" weight="medium">
                  View Book Details
                </ThemedText>
              </PressableScale>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: currentTheme.secondaryText + '20' },
                ]}
              />

              <View style={styles.statusSection}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.sectionTitle}
                >
                  READING STATUS
                </ThemedText>
                <View style={styles.statusOptions}>
                  <PressableScale
                    onPress={() => onToggleStatus('unread')}
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor:
                          book.readingStatus === 'unread'
                            ? currentTheme.accent + '15'
                            : 'transparent',
                        borderColor:
                          book.readingStatus === 'unread'
                            ? currentTheme.accent
                            : currentTheme.secondaryText + '30',
                      },
                    ]}
                  >
                    <Circle
                      size={18}
                      color={
                        book.readingStatus === 'unread'
                          ? currentTheme.accent
                          : currentTheme.secondaryText
                      }
                    />
                    <ThemedText
                      variant={book.readingStatus === 'unread' ? 'accent' : 'secondary'}
                      size="caption"
                      weight={book.readingStatus === 'unread' ? 'semibold' : 'regular'}
                    >
                      Unread
                    </ThemedText>
                  </PressableScale>

                  <PressableScale
                    onPress={() => onToggleStatus('reading')}
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor:
                          book.readingStatus === 'reading'
                            ? currentTheme.accent + '15'
                            : 'transparent',
                        borderColor:
                          book.readingStatus === 'reading'
                            ? currentTheme.accent
                            : currentTheme.secondaryText + '30',
                      },
                    ]}
                  >
                    <BookMarked
                      size={18}
                      color={
                        book.readingStatus === 'reading'
                          ? currentTheme.accent
                          : currentTheme.secondaryText
                      }
                    />
                    <ThemedText
                      variant={book.readingStatus === 'reading' ? 'accent' : 'secondary'}
                      size="caption"
                      weight={book.readingStatus === 'reading' ? 'semibold' : 'regular'}
                    >
                      Reading
                    </ThemedText>
                  </PressableScale>

                  <PressableScale
                    onPress={() => onToggleStatus('finished')}
                    style={[
                      styles.statusOption,
                      {
                        backgroundColor:
                          book.readingStatus === 'finished'
                            ? '#22C55E15'
                            : 'transparent',
                        borderColor:
                          book.readingStatus === 'finished'
                            ? '#22C55E'
                            : currentTheme.secondaryText + '30',
                      },
                    ]}
                  >
                    <CheckCircle
                      size={18}
                      color={
                        book.readingStatus === 'finished'
                          ? '#22C55E'
                          : currentTheme.secondaryText
                      }
                    />
                    <ThemedText
                      variant={book.readingStatus === 'finished' ? 'primary' : 'secondary'}
                      size="caption"
                      weight={book.readingStatus === 'finished' ? 'semibold' : 'regular'}
                      style={
                        book.readingStatus === 'finished' ? { color: '#22C55E' } : undefined
                      }
                    >
                      Finished
                    </ThemedText>
                  </PressableScale>
                </View>
              </View>

              {onUpdateTags && (
                <>
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: currentTheme.secondaryText + '20' },
                    ]}
                  />
                  <View style={styles.tagsSection}>
                    <ThemedText
                      variant="secondary"
                      size="caption"
                      weight="medium"
                      style={styles.sectionTitle}
                    >
                      COLLECTION TAGS
                    </ThemedText>
                    <View style={styles.tagsRow}>
                      {QUICK_COLLECTION_TAGS.map(tag => {
                        const active = activeTags.includes(tag);
                        return (
                          <PressableScale
                            key={tag}
                            onPress={() => {
                              const next = active
                                ? activeTags.filter(t => t !== tag)
                                : [...activeTags, tag]
                                  .filter((t, i, a) => a.indexOf(t) === i)
                                  .slice(0, 12);
                              onUpdateTags(next);
                            }}
                            style={[
                              styles.tagChip,
                              {
                                backgroundColor: active ? currentTheme.accent + '20' : currentTheme.background,
                                borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                              },
                            ]}
                          >
                            <ThemedText
                              variant={active ? 'accent' : 'secondary'}
                              size="caption"
                              weight={active ? 'semibold' : 'regular'}
                            >
                              {tag}
                            </ThemedText>
                          </PressableScale>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              <View
                style={[
                  styles.divider,
                  { backgroundColor: currentTheme.secondaryText + '20' },
                ]}
              />

              <PressableScale
                onPress={onDelete}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color="#EF4444" />
                <ThemedText
                  style={{ color: '#EF4444' }}
                  size="body"
                  weight="medium"
                >
                  Remove from Library
                </ThemedText>
              </PressableScale>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {book && (
        <BookDetailsModal
          visible={showDetails}
          book={book}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    minHeight: '35%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  contentScroll: {
    maxHeight: '100%',
  },
  contentScrollInner: {
    padding: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bookInfo: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  cover: {
    width: 48,
    height: 70,
    borderRadius: 6,
  },
  placeholderCover: {
    width: 48,
    height: 70,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  closeButton: {
    padding: 4,
    marginTop: -4,
    marginRight: -4,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  statusSection: {
    paddingVertical: 4,
  },
  sectionTitle: {
    marginBottom: 10,
    letterSpacing: 1,
    fontSize: 11,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusOption: {
    minWidth: '31%',
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EF444410',
  },
  tagsSection: { paddingVertical: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 16,
  },
});
