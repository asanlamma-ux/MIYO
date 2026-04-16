import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { ThemePickerModal } from '@/components/ui/ThemePickerModal';
import { Book } from '@/types/book';
import {
  getReadingStats,
  getDailyReadingGoalMinutes,
  getTodayReadingMinutes,
  type ReadingStats,
} from '@/utils/reading-stats';
import {
  BookOpen,
  ChevronRight,
  Palette,
  Clock,
  TrendingUp,
  Library,
  Flame,
  Target,
} from 'lucide-react-native';

export default function HomeScreen() {
  const { currentTheme } = useTheme();
  const { books } = useLibrary();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [readingStats, setReadingStats] = useState<ReadingStats | null>(null);
  const [dailyGoalProgress, setDailyGoalProgress] = useState<{ goal: number; today: number } | null>(
    null
  );

  useEffect(() => {
    getReadingStats().then(setReadingStats);
    Promise.all([getDailyReadingGoalMinutes(), getTodayReadingMinutes()]).then(([goal, today]) =>
      setDailyGoalProgress({ goal, today })
    );
  }, [books.length]);

  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  const continueReading = useMemo(() => {
    return books
      .filter(b => b.readingStatus === 'reading' && b.lastReadAt)
      .sort((a, b) => new Date(b.lastReadAt!).getTime() - new Date(a.lastReadAt!).getTime())
      .slice(0, 5);
  }, [books]);

  const recentlyAdded = useMemo(() => {
    return books
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, 5);
  }, [books]);

  const stats = useMemo(() => {
    const total = books.length;
    const reading = books.filter(b => b.readingStatus === 'reading').length;
    const finished = books.filter(b => b.readingStatus === 'finished').length;
    return { total, reading, finished };
  }, [books]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleBookPress = (book: Book) => {
    router.push(`/reader/${book.id}`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const cardWidthSmall = Math.min(140, (screenWidth - 48) / 2.5);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: tabBarHeight + 24,
            paddingLeft: Math.max(16, insets.left),
            paddingRight: Math.max(16, insets.right),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText variant="secondary" size="body">
              {getGreeting()}
            </ThemedText>
            <ThemedText variant="primary" size="title" weight="bold">
              Miyo
            </ThemedText>
          </View>
          <PressableScale
            onPress={() => setShowThemePicker(true)}
            style={[styles.themeButton, { backgroundColor: currentTheme.accent + '15' }]}
          >
            <Palette size={20} color={currentTheme.accent} />
          </PressableScale>
        </View>

        {/* Quick Stats */}
        {books.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: currentTheme.cardBackground }]}>
              <Library size={18} color={currentTheme.accent} />
              <ThemedText variant="primary" size="header" weight="bold">{stats.total}</ThemedText>
              <ThemedText variant="secondary" size="caption">Books</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: currentTheme.cardBackground }]}>
              <BookOpen size={18} color={currentTheme.accent} />
              <ThemedText variant="primary" size="header" weight="bold">{stats.reading}</ThemedText>
              <ThemedText variant="secondary" size="caption">Reading</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: currentTheme.cardBackground }]}>
              <TrendingUp size={18} color="#22C55E" />
              <ThemedText variant="primary" size="header" weight="bold">{stats.finished}</ThemedText>
              <ThemedText variant="secondary" size="caption">Finished</ThemedText>
            </View>
          </View>
        )}

        {readingStats && (readingStats.currentStreak > 0 || readingStats.totalReadingMinutes > 0) && (
          <View
            style={[
              styles.streakBanner,
              {
                backgroundColor: currentTheme.accent + '12',
                borderColor: currentTheme.accent + '28',
              },
            ]}
          >
            <Flame size={22} color={currentTheme.accent} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="primary" size="body" weight="semibold">
                {readingStats.currentStreak} day reading streak
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                {readingStats.totalReadingMinutes} min logged · {readingStats.totalWordsRead.toLocaleString()} words
              </ThemedText>
            </View>
          </View>
        )}

        {dailyGoalProgress && dailyGoalProgress.goal > 0 && (
          <View
            style={[
              styles.goalBanner,
              {
                backgroundColor: currentTheme.cardBackground,
                borderColor: currentTheme.secondaryText + '22',
              },
            ]}
          >
            <Target size={22} color={currentTheme.accent} />
            <View style={{ flex: 1, gap: 6 }}>
              <ThemedText variant="primary" size="body" weight="semibold">
                Daily reading goal
              </ThemedText>
              <View style={[styles.goalTrack, { backgroundColor: currentTheme.secondaryText + '20' }]}>
                <View
                  style={[
                    styles.goalFill,
                    {
                      width: `${Math.min(100, (dailyGoalProgress.today / dailyGoalProgress.goal) * 100)}%`,
                      backgroundColor: currentTheme.accent,
                    },
                  ]}
                />
              </View>
              <ThemedText variant="secondary" size="caption">
                {dailyGoalProgress.today} / {dailyGoalProgress.goal} minutes today
                {dailyGoalProgress.today >= dailyGoalProgress.goal ? ' · Goal met' : ''}
              </ThemedText>
            </View>
          </View>
        )}

        {/* Continue Reading */}
        {continueReading.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="primary" size="header" weight="semibold">Continue Reading</ThemedText>
              <PressableScale onPress={() => router.push('/(tabs)/history')} style={styles.seeAllButton}>
                <ThemedText variant="accent" size="caption" weight="semibold">See All</ThemedText>
                <ChevronRight size={14} color={currentTheme.accent} />
              </PressableScale>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {continueReading.map(book => (
                <PressableScale key={book.id} onPress={() => handleBookPress(book)} style={[styles.continueCard, { backgroundColor: currentTheme.cardBackground, width: screenWidth * 0.7, maxWidth: 320 }]}>
                  <View style={styles.continueCardContent}>
                    <View style={[styles.continueCover, { backgroundColor: currentTheme.accent + '20' }]}>
                      {book.coverUri ? (
                        <Image
                          source={{ uri: book.coverUri.startsWith('data:') ? book.coverUri : `data:image/jpeg;base64,${book.coverUri}` }}
                          style={styles.fullCoverImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <BookOpen size={24} color={currentTheme.accent} />
                      )}
                    </View>
                    <View style={styles.continueInfo}>
                      <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={2}>{book.title}</ThemedText>
                      <ThemedText variant="secondary" size="caption" numberOfLines={1}>{book.author}</ThemedText>
                      <View style={styles.continueProgress}>
                        <View style={[styles.continueProgressTrack, { backgroundColor: currentTheme.secondaryText + '20' }]}>
                          <View style={[styles.continueProgressFill, { width: `${book.progress}%`, backgroundColor: currentTheme.accent }]} />
                        </View>
                        <ThemedText variant="accent" size="caption" weight="semibold">{book.progress}%</ThemedText>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.continueFooter, { borderTopColor: currentTheme.secondaryText + '10' }]}>
                    <View style={styles.lastReadRow}>
                      <Clock size={12} color={currentTheme.secondaryText} />
                      <ThemedText variant="secondary" size="caption">{formatDate(book.lastReadAt)}</ThemedText>
                    </View>
                    <ThemedText variant="accent" size="caption" weight="semibold">Resume →</ThemedText>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recently Added */}
        {recentlyAdded.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="primary" size="header" weight="semibold">Recently Added</ThemedText>
              <PressableScale onPress={() => router.push('/(tabs)/library')} style={styles.seeAllButton}>
                <ThemedText variant="accent" size="caption" weight="semibold">See All</ThemedText>
                <ChevronRight size={14} color={currentTheme.accent} />
              </PressableScale>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {recentlyAdded.map(book => (
                <PressableScale key={book.id} onPress={() => handleBookPress(book)} style={[styles.recentCard, { backgroundColor: currentTheme.cardBackground, width: cardWidthSmall }]}>
                  <View style={[styles.recentCover, { backgroundColor: currentTheme.accent + '15', height: cardWidthSmall * 1.4 }]}>
                    {book.coverUri ? (
                      <Image
                        source={{ uri: book.coverUri.startsWith('data:') ? book.coverUri : `data:image/jpeg;base64,${book.coverUri}` }}
                        style={styles.fullCoverImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <BookOpen size={28} color={currentTheme.accent} />
                    )}
                  </View>
                  <View style={styles.recentInfo}>
                    <ThemedText variant="primary" size="caption" weight="semibold" numberOfLines={2}>{book.title}</ThemedText>
                    <ThemedText variant="secondary" size="caption" numberOfLines={1}>{book.author}</ThemedText>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {books.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: currentTheme.accent + '15' }]}>
              <BookOpen size={48} color={currentTheme.accent} />
            </View>
            <ThemedText variant="primary" size="header" weight="bold" style={styles.emptyTitle}>Welcome to Miyo</ThemedText>
            <ThemedText variant="secondary" size="body" style={styles.emptyDescription}>
              Your personal reading sanctuary. Head to the Library tab to import your first EPUB book.
            </ThemedText>
            <PressableScale onPress={() => router.push('/(tabs)/library')} style={[styles.goToLibraryBtn, { backgroundColor: currentTheme.accent }]}>
              <Library size={18} color="#FFFFFF" />
              <ThemedText size="body" weight="semibold" style={{ color: '#FFFFFF' }}>Go to Library</ThemedText>
            </PressableScale>
          </View>
        )}
      </ScrollView>

      <ThemePickerModal visible={showThemePicker} onClose={() => setShowThemePicker(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: {},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  themeButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  goalTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 3 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  horizontalScroll: { gap: 12 },
  continueCard: { borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  continueCardContent: { flexDirection: 'row', padding: 12, gap: 12 },
  continueCover: { width: 56, height: 80, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fullCoverImage: { width: '100%', height: '100%' },
  continueInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  continueProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  continueProgressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  continueProgressFill: { height: '100%', borderRadius: 2 },
  continueFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  lastReadRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentCard: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  recentCover: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  recentInfo: { padding: 8, gap: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { marginBottom: 8, textAlign: 'center' },
  emptyDescription: { textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  goToLibraryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
});
