import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  Image,
  useWindowDimensions,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Book } from '@/types/book';
import { BookOpen, Clock, ChevronRight, Trash2, X, CheckCircle2, Circle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const { books, clearHistoryEntry } = useLibrary();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  const readingHistory = useMemo(() => {
    return books
      .filter(b => b.lastReadAt)
      .sort((a, b) => {
        const dateA = new Date(a.lastReadAt!).getTime();
        const dateB = new Date(b.lastReadAt!).getTime();
        return dateB - dateA;
      });
  }, [books]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getGroupLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return 'This Week';
    if (days < 30) return 'This Month';
    return 'Earlier';
  };

  const groupedHistory = useMemo(() => {
    const groups: { label: string; data: Book[] }[] = [];
    const groupMap = new Map<string, Book[]>();

    readingHistory.forEach(book => {
      const label = getGroupLabel(book.lastReadAt!);
      if (!groupMap.has(label)) {
        groupMap.set(label, []);
      }
      groupMap.get(label)!.push(book);
    });

    groupMap.forEach((data, label) => {
      groups.push({ label, data });
    });

    return groups;
  }, [readingHistory]);

  const handleBookPress = useCallback((book: Book) => {
    if (isSelecting) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(book.id)) next.delete(book.id);
        else next.add(book.id);
        return next;
      });
      return;
    }
    router.push(`/reader/${book.id}`);
  }, [isSelecting, router]);

  const handleLongPress = useCallback((book: Book) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isSelecting) {
      setIsSelecting(true);
      setSelectedIds(new Set([book.id]));
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(book.id)) next.delete(book.id);
        else next.add(book.id);
        return next;
      });
    }
  }, [isSelecting]);

  const handleCancelSelect = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      'Remove from History',
      `Remove ${count} book${count !== 1 ? 's' : ''} from reading history? Your reading progress won't be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await clearHistoryEntry(id);
            }
            setIsSelecting(false);
            setSelectedIds(new Set());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [selectedIds, clearHistoryEntry]);

  const renderHistoryItem = ({ item }: { item: Book }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <PressableScale
        onPress={() => handleBookPress(item)}
        onLongPress={() => handleLongPress(item)}
        style={[
          styles.historyItem,
          {
            backgroundColor: isSelected
              ? currentTheme.accent + '18'
              : currentTheme.cardBackground,
            borderWidth: isSelected ? 1.5 : 0,
            borderColor: isSelected ? currentTheme.accent : 'transparent',
          },
        ]}
      >
        {/* Selection indicator */}
        {isSelecting && (
          <View style={styles.selectionIcon}>
            {isSelected
              ? <CheckCircle2 size={20} color={currentTheme.accent} />
              : <Circle size={20} color={currentTheme.secondaryText + '60'} />}
          </View>
        )}

        {/* Cover or placeholder */}
        <View style={styles.coverContainer}>
          {item.coverUri ? (
            <Image
              source={{ uri: item.coverUri.startsWith('data:') ? item.coverUri : `data:image/jpeg;base64,${item.coverUri}` }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.coverPlaceholder,
                { backgroundColor: currentTheme.accent + '20' },
              ]}
            >
              <BookOpen size={20} color={currentTheme.accent} />
            </View>
          )}
        </View>

        <View style={styles.itemContent}>
          <ThemedText
            variant="primary"
            size="body"
            weight="semibold"
            numberOfLines={1}
          >
            {item.title}
          </ThemedText>
          <ThemedText variant="secondary" size="caption" numberOfLines={1}>
            {item.author}
          </ThemedText>
          <View style={styles.metaRow}>
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: currentTheme.secondaryText + '20' },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${item.progress}%`,
                      backgroundColor: currentTheme.accent,
                    },
                  ]}
                />
              </View>
              <ThemedText variant="secondary" size="caption">
                {item.progress}%
              </ThemedText>
            </View>
            <View style={styles.timeRow}>
              <Clock size={12} color={currentTheme.secondaryText} />
              <ThemedText variant="secondary" size="caption">
                {formatDate(item.lastReadAt!)}
              </ThemedText>
            </View>
          </View>
        </View>

        {!isSelecting && <ChevronRight size={18} color={currentTheme.secondaryText} />}
      </PressableScale>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <View>
            <ThemedText variant="primary" size="title" weight="bold">
              History
            </ThemedText>
            <ThemedText variant="secondary" size="caption">
              {readingHistory.length} {readingHistory.length === 1 ? 'book' : 'books'} read
            </ThemedText>
          </View>
          {isSelecting && (
            <Pressable onPress={handleCancelSelect} hitSlop={10}>
              <X size={22} color={currentTheme.secondaryText} />
            </Pressable>
          )}
        </View>

        {isSelecting && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            style={[styles.selectionBar, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '15' }]}
          >
            <ThemedText variant="secondary" size="caption">
              {selectedIds.size} selected
            </ThemedText>
            <Pressable
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              style={[styles.deleteBtn, { backgroundColor: '#EF4444', opacity: selectedIds.size === 0 ? 0.4 : 1 }]}
            >
              <Trash2 size={14} color="#FFFFFF" />
              <ThemedText style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                Remove
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}

        {readingHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: currentTheme.accent + '15' },
              ]}
            >
              <Clock size={48} color={currentTheme.accent} />
            </View>
            <ThemedText
              variant="primary"
              size="header"
              weight="semibold"
              style={styles.emptyTitle}
            >
              No Reading History
            </ThemedText>
            <ThemedText
              variant="secondary"
              size="body"
              style={styles.emptyDescription}
            >
              Start reading a book and it will appear here. Your reading progress will be tracked automatically.
            </ThemedText>
          </View>
        ) : (
          <SectionList
            sections={groupedHistory.map(g => ({ title: g.label, data: g.data }))}
            renderItem={renderHistoryItem}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <ThemedText variant="secondary" size="caption" weight="semibold">
                  {title}
                </ThemedText>
              </View>
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingTop: 16,
    marginBottom: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  selectionIcon: {
    marginRight: -4,
  },
  coverContainer: {
    width: 48,
    height: 68,
    borderRadius: 6,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  progressTrack: {
    width: 50,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
