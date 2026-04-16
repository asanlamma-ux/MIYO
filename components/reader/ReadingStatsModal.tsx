import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { X, BookOpen, Clock, TrendingUp, BarChart2, Layers } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Book } from '@/types/book';

interface ReadingStatsModalProps {
  visible: boolean;
  onClose: () => void;
  book: Book;
  currentChapterIndex: number;
  totalChapters: number;
  totalHighlights: number;
  totalBookmarks: number;
  estimatedWordsRead: number;
  /** Whole-book word count from EPUB (0 if unknown). */
  bookTotalWords: number;
  wordsRemaining: number;
  /** Minutes to finish at estimated WPM. */
  bookFinishEtaMinutes: number;
  /** Actual reading progress 0–100 (chapter + scroll), not chapter index ratio */
  bookProgressPercent: number;
}

export function ReadingStatsModal({
  visible,
  onClose,
  book,
  currentChapterIndex,
  totalChapters,
  totalHighlights,
  totalBookmarks,
  estimatedWordsRead,
  bookTotalWords,
  wordsRemaining,
  bookFinishEtaMinutes,
  bookProgressPercent,
}: ReadingStatsModalProps) {
  const { currentTheme } = useTheme();

  const isDark = currentTheme.isDark;
  const progress = Math.min(100, Math.max(0, bookProgressPercent));

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const estimatedMinutes = Math.round(estimatedWordsRead / 250);
  const hoursRead = Math.floor(estimatedMinutes / 60);
  const minutesRead = estimatedMinutes % 60;

  const showBookScope = bookTotalWords > 0;

  const stats = [
    {
      icon: TrendingUp,
      label: 'Reading Progress',
      value: `${Math.round(progress)}%`,
      subValue: `${currentChapterIndex + 1} of ${totalChapters} chapters`,
      color: currentTheme.accent,
    },
    {
      icon: Clock,
      label: 'Est. Reading Time',
      value: hoursRead > 0 ? `${hoursRead}h ${minutesRead}m` : `${minutesRead}m`,
      subValue: `~${estimatedWordsRead.toLocaleString()} words read`,
      color: '#3B82F6',
    },
    {
      icon: Layers,
      label: 'Highlights',
      value: totalHighlights.toString(),
      subValue: totalHighlights === 1 ? '1 annotation' : `${totalHighlights} annotations`,
      color: '#F59E0B',
    },
    {
      icon: BookOpen,
      label: 'Bookmarks',
      value: totalBookmarks.toString(),
      subValue: totalBookmarks === 1 ? '1 bookmark' : `${totalBookmarks} bookmarks`,
      color: '#10B981',
    },
  ];

  const bookScopeStats = showBookScope
    ? [
        {
          icon: BarChart2,
          label: 'Whole book',
          value:
            bookTotalWords >= 1000
              ? `${(bookTotalWords / 1000).toFixed(1)}k words`
              : `${bookTotalWords} words`,
          subValue: 'Estimated from EPUB text',
          color: '#8B5CF6',
        },
        {
          icon: Clock,
          label: 'Remaining',
          value:
            wordsRemaining >= 1000
              ? `${(wordsRemaining / 1000).toFixed(1)}k words`
              : `${Math.max(0, wordsRemaining)} words`,
          subValue:
            bookFinishEtaMinutes > 0
              ? `~${bookFinishEtaMinutes} min at your pace`
              : 'Almost done',
          color: '#EC4899',
        },
      ]
    : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        entering={SlideInUp.duration(250)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.card,
          {
            backgroundColor: currentTheme.cardBackground,
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText variant="primary" size="header" weight="bold">
              Reading Stats
            </ThemedText>
            <ThemedText variant="secondary" size="caption" numberOfLines={1}>
              {book.title}
            </ThemedText>
          </View>
          <PressableScale onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={currentTheme.secondaryText} />
          </PressableScale>
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: currentTheme.secondaryText + '20' }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: currentTheme.accent,
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <ThemedText variant="secondary" size="caption">Start</ThemedText>
            <ThemedText
              style={[styles.progressPct, { color: currentTheme.accent }]}
            >
              {Math.round(progress)}%
            </ThemedText>
            <ThemedText variant="secondary" size="caption">End</ThemedText>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[...bookScopeStats, ...stats].map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <View style={[styles.statIconBg, { backgroundColor: stat.color + '15' }]}>
                <stat.icon size={18} color={stat.color} strokeWidth={2} />
              </View>
              <ThemedText
                style={[styles.statValue, { color: currentTheme.text }]}
              >
                {stat.value}
              </ThemedText>
              <ThemedText
                style={[styles.statLabel, { color: currentTheme.secondaryText }]}
              >
                {stat.label}
              </ThemedText>
              <ThemedText
                style={[styles.statSubValue, { color: currentTheme.secondaryText }]}
                numberOfLines={2}
              >
                {stat.subValue}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Book info */}
        <View style={[styles.bookInfoRow, { borderTopColor: currentTheme.secondaryText + '15' }]}>
          <View style={styles.bookInfoItem}>
            <ThemedText variant="secondary" size="caption">Status</ThemedText>
            <ThemedText variant="primary" size="caption" weight="semibold" style={{ textTransform: 'capitalize' }}>
              {book.readingStatus}
            </ThemedText>
          </View>
          <View style={[styles.bookInfoDivider, { backgroundColor: currentTheme.secondaryText + '20' }]} />
          <View style={styles.bookInfoItem}>
            <ThemedText variant="secondary" size="caption">Last Read</ThemedText>
            <ThemedText variant="primary" size="caption" weight="semibold">
              {formatDate(book.lastReadAt)}
            </ThemedText>
          </View>
          <View style={[styles.bookInfoDivider, { backgroundColor: currentTheme.secondaryText + '20' }]} />
          <View style={styles.bookInfoItem}>
            <ThemedText variant="secondary" size="caption">Added</ThemedText>
            <ThemedText variant="primary" size="caption" weight="semibold">
              {formatDate(book.dateAdded)}
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  closeBtn: { padding: 4, marginTop: 2 },
  progressSection: {
    marginBottom: 20,
    gap: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statSubValue: {
    fontSize: 11,
    lineHeight: 15,
  },
  bookInfoRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  bookInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bookInfoDivider: {
    width: 1,
    height: 32,
    alignSelf: 'center',
  },
});
