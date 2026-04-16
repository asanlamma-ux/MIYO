import React, { memo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Book } from '@/types/book';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { BookOpen, Clock } from 'lucide-react-native';

interface BookCardProps {
  book: Book;
  isGridView: boolean;
  cardWidth?: number;
  onPress: () => void;
  onLongPress: () => void;
}

export const BookCard = memo(({ book, isGridView, cardWidth: propCardWidth, onPress, onLongPress }: BookCardProps) => {
  const { currentTheme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = propCardWidth || Math.floor((screenWidth - 42) / 2);
  const coverHeight = Math.floor(cardWidth * 1.45);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getStatusColor = () => {
    switch (book.readingStatus) {
      case 'reading': return currentTheme.accent;
      case 'finished': return '#22C55E';
      default: return currentTheme.secondaryText + '60';
    }
  };

  const getStatusLabel = () => {
    switch (book.readingStatus) {
      case 'reading': return 'Reading';
      case 'finished': return 'Finished';
      default: return 'Unread';
    }
  };

  // Generate a consistent color for books without covers based on title
  const getPlaceholderColor = () => {
    const colors = [
      '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
      '#EF4444', '#06B6D4', '#84CC16', '#F97316',
    ];
    let hash = 0;
    for (let i = 0; i < book.title.length; i++) {
      hash = book.title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const placeholderColor = getPlaceholderColor();

  if (isGridView) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        style={[
          styles.gridCard,
          {
            width: '100%',
            backgroundColor: currentTheme.cardBackground,
            shadowColor: currentTheme.isDark ? '#000' : '#999',
          },
        ]}
      >
        {/* Cover */}
        <View style={[styles.coverContainer, { height: coverHeight }]}>
          {book.coverUri ? (
            <Image
              source={book.coverUri}
              style={styles.cover}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.placeholderCover, { backgroundColor: placeholderColor + '22' }]}>
              <View style={[styles.placeholderSpine, { backgroundColor: placeholderColor }]} />
              <View style={styles.placeholderContent}>
                <View style={[styles.placeholderLines]}>
                  {[80, 65, 50].map((w, i) => (
                    <View
                      key={i}
                      style={[
                        styles.placeholderLine,
                        { width: `${w}%`, backgroundColor: placeholderColor + '80', height: i === 0 ? 3 : 2 }
                      ]}
                    />
                  ))}
                </View>
                <BookOpen size={Math.min(22, cardWidth * 0.22)} color={placeholderColor} style={{ marginBottom: 6 }} />
                <ThemedText
                  numberOfLines={3}
                  style={[styles.placeholderTitle, { color: placeholderColor }]}
                >
                  {book.title}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Progress bar */}
          {book.progress > 0 && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${book.progress}%`, backgroundColor: currentTheme.accent }]} />
            </View>
          )}

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]} />
        </View>

        {/* Info */}
        <View style={styles.gridInfo}>
          <ThemedText
            variant="primary"
            size="caption"
            weight="semibold"
            numberOfLines={2}
            style={styles.gridTitle}
          >
            {book.title}
          </ThemedText>
          <ThemedText
            variant="secondary"
            size="caption"
            numberOfLines={1}
            style={styles.gridAuthor}
          >
            {book.author}
          </ThemedText>
          {book.progress > 0 && (
            <ThemedText style={[styles.progressLabel, { color: currentTheme.accent }]}>
              {book.progress}%
            </ThemedText>
          )}
        </View>
      </PressableScale>
    );
  }

  // List view
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.listCard,
        {
          backgroundColor: currentTheme.cardBackground,
          shadowColor: currentTheme.isDark ? '#000' : '#999',
        },
      ]}
    >
      {/* Cover Thumbnail */}
      <View style={styles.listCoverContainer}>
        {book.coverUri ? (
          <Image
            source={book.coverUri}
            style={styles.listCover}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.listPlaceholderCover, { backgroundColor: placeholderColor + '25' }]}>
            <View style={[styles.listPlaceholderSpine, { backgroundColor: placeholderColor }]} />
            <BookOpen size={22} color={placeholderColor} />
          </View>
        )}

        {/* Status indicator on cover */}
        <View style={[styles.listStatusDot, { backgroundColor: getStatusColor() }]} />
      </View>

      {/* Content */}
      <View style={styles.listContent}>
        <ThemedText
          variant="primary"
          size="body"
          weight="semibold"
          numberOfLines={2}
          style={styles.listTitle}
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

        {/* Progress & Date */}
        <View style={styles.listMeta}>
          <View style={styles.listProgressRow}>
            <View style={[styles.listProgressTrack, { backgroundColor: currentTheme.secondaryText + '25' }]}>
              <View
                style={[
                  styles.listProgressFill,
                  {
                    width: `${book.progress}%`,
                    backgroundColor: book.progress === 100 ? '#22C55E' : currentTheme.accent,
                  },
                ]}
              />
            </View>
            <ThemedText
              variant="secondary"
              size="caption"
              weight="semibold"
              style={{ minWidth: 30, textAlign: 'right' }}
            >
              {book.progress}%
            </ThemedText>
          </View>

          {book.lastReadAt && (
            <View style={styles.lastReadRow}>
              <Clock size={11} color={currentTheme.secondaryText} />
              <ThemedText variant="secondary" size="caption">
                {formatDate(book.lastReadAt)}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Tags */}
        {book.tags && book.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {book.tags.slice(0, 2).map((tag, i) => (
              <View key={i} style={[styles.tagChip, { backgroundColor: currentTheme.accent + '15' }]}>
                <ThemedText style={[styles.tagText, { color: currentTheme.accent }]}>
                  {tag}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Chapter count */}
      <View style={styles.listRight}>
        <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center' }}>
          {book.totalChapters}
        </ThemedText>
        <ThemedText variant="secondary" style={{ fontSize: 9 }}>
          ch.
        </ThemedText>
      </View>
    </PressableScale>
  );
}, (prevProps, nextProps) => {
  // Custom comparator to avoid re-rendering unless these specific fields change
  return (
    prevProps.isGridView === nextProps.isGridView &&
    prevProps.cardWidth === nextProps.cardWidth &&
    prevProps.book.id === nextProps.book.id &&
    prevProps.book.progress === nextProps.book.progress &&
    prevProps.book.readingStatus === nextProps.book.readingStatus &&
    prevProps.book.lastReadAt === nextProps.book.lastReadAt &&
    prevProps.book.title === nextProps.book.title &&
    prevProps.book.coverUri === nextProps.book.coverUri // cover might load later
  );
});

const styles = StyleSheet.create({
  // Grid Card
  gridCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  coverContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  placeholderCover: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    position: 'relative',
  },
  placeholderSpine: {
    width: 5,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 8,
    paddingLeft: 12,
  },
  placeholderLines: {
    width: '100%',
    gap: 4,
    marginBottom: 12,
    position: 'absolute',
    top: 12,
    paddingLeft: 6,
  },
  placeholderLine: {
    borderRadius: 1,
  },
  placeholderTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  progressBarFill: { height: '100%' },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  gridInfo: { padding: 9, paddingTop: 8 },
  gridTitle: { marginBottom: 2, lineHeight: 16 },
  gridAuthor: { lineHeight: 15 },
  progressLabel: { fontSize: 10, fontWeight: '700', marginTop: 3 },

  // List Card
  listCard: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: 16,
    marginVertical: 5,
    minHeight: 100,
  },
  listCoverContainer: {
    width: 68,
    minHeight: 100,
    position: 'relative',
    overflow: 'hidden',
  },
  listCover: { width: '100%', height: '100%' },
  listPlaceholderCover: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    flexDirection: 'row',
    position: 'relative',
  },
  listPlaceholderSpine: {
    width: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  listStatusDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  listContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  listTitle: { marginBottom: 2, lineHeight: 22 },
  listMeta: { marginTop: 8, gap: 4 },
  listProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  listProgressFill: { height: '100%', borderRadius: 2 },
  lastReadRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagsRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  tagChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '600' },
  listRight: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 12,
  },
});
