import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark as BookmarkIcon, Highlighter, X, Trash2, FileText, FileCode } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { AppDialog } from '@/components/ui/AppDialog';
import { Bookmark, Highlight } from '@/types/book';

interface AnnotationsDrawerProps {
  visible: boolean;
  onClose: () => void;
  bookTitle: string;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  currentChapterIndex: number;
  onGoToChapter: (index: number) => void;
  onDeleteBookmark: (id: string) => void;
  onDeleteHighlight: (id: string) => void;
  chapterTitles: string[];
  onExportTxt?: () => void;
  onExportMarkdown?: () => void;
}

type TabType = 'bookmarks' | 'highlights';

export function AnnotationsDrawer({
  visible,
  onClose,
  bookTitle,
  bookmarks,
  highlights,
  currentChapterIndex,
  onGoToChapter,
  onDeleteBookmark,
  onDeleteHighlight,
  chapterTitles,
  onExportTxt,
  onExportMarkdown,
}: AnnotationsDrawerProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('highlights');
  const [pendingDelete, setPendingDelete] = useState<
    | { type: 'bookmark'; id: string }
    | { type: 'highlight'; id: string }
    | null
  >(null);

  const isDark = currentTheme.isDark;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleDeleteBookmark = (id: string) => {
    setPendingDelete({ type: 'bookmark', id });
  };

  const handleDeleteHighlight = (id: string) => {
    setPendingDelete({ type: 'highlight', id });
  };

  const sortedBookmarks = [...bookmarks].sort(
    (a, b) => a.chapterIndex - b.chapterIndex
  );

  const sortedHighlights = [...highlights].sort(
    (a, b) => a.chapterIndex - b.chapterIndex
  );

  const renderBookmarkItem = ({ item }: { item: Bookmark }) => {
    const isCurrentChapter = item.chapterIndex === currentChapterIndex;
    return (
      <PressableScale
        onPress={() => {
          onGoToChapter(item.chapterIndex);
          onClose();
        }}
        style={[
          styles.annotationItem,
          {
            backgroundColor: isCurrentChapter
              ? currentTheme.accent + '10'
              : currentTheme.background,
            borderColor: isCurrentChapter
              ? currentTheme.accent + '25'
              : currentTheme.secondaryText + '12',
          },
        ]}
      >
        <View style={styles.annotationLeft}>
          <View style={[styles.bookmarkDot, { backgroundColor: currentTheme.accent }]}>
            <BookmarkIcon size={10} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          <View style={styles.annotationContent}>
            <ThemedText
              style={[styles.annotationChapterName, { color: currentTheme.accent }]}
              numberOfLines={1}
            >
              {chapterTitles[item.chapterIndex] || `Chapter ${item.chapterIndex + 1}`}
            </ThemedText>
            <ThemedText
              style={[styles.annotationText, { color: currentTheme.text }]}
              numberOfLines={2}
            >
              {item.text}
            </ThemedText>
            <ThemedText
              style={[styles.annotationDate, { color: currentTheme.secondaryText }]}
            >
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => handleDeleteBookmark(item.id)}
          style={styles.deleteBtn}
          hitSlop={10}
        >
          <Trash2 size={14} color={currentTheme.secondaryText + '70'} />
        </Pressable>
      </PressableScale>
    );
  };

  const renderHighlightItem = ({ item }: { item: Highlight }) => {
    const isCurrentChapter = item.chapterIndex === currentChapterIndex;
    return (
      <PressableScale
        onPress={() => {
          onGoToChapter(item.chapterIndex);
          onClose();
        }}
        style={[
          styles.annotationItem,
          {
            backgroundColor: isCurrentChapter
              ? currentTheme.accent + '10'
              : currentTheme.background,
            borderColor: isCurrentChapter
              ? currentTheme.accent + '25'
              : currentTheme.secondaryText + '12',
          },
        ]}
      >
        <View style={styles.annotationLeft}>
          <View style={[styles.highlightDot, { backgroundColor: item.color }]} />
          <View style={styles.annotationContent}>
            <ThemedText
              style={[styles.annotationChapterName, { color: currentTheme.accent }]}
              numberOfLines={1}
            >
              {chapterTitles[item.chapterIndex] || `Chapter ${item.chapterIndex + 1}`}
            </ThemedText>
            <View style={[styles.highlightTextBg, { backgroundColor: item.color + '40' }]}>
              <ThemedText
                style={[styles.highlightText, { color: item.textColor || currentTheme.text }]}
                numberOfLines={3}
              >
                {item.text}
              </ThemedText>
            </View>
            {item.note && (
              <ThemedText
                style={[styles.noteText, { color: currentTheme.secondaryText }]}
                numberOfLines={2}
              >
                Note: {item.note}
              </ThemedText>
            )}
            <ThemedText
              style={[styles.annotationDate, { color: currentTheme.secondaryText }]}
            >
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
        </View>
        <Pressable
          onPress={() => handleDeleteHighlight(item.id)}
          style={styles.deleteBtn}
          hitSlop={10}
        >
          <Trash2 size={14} color={currentTheme.secondaryText + '70'} />
        </Pressable>
      </PressableScale>
    );
  };

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
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={[
          styles.card,
          {
            backgroundColor: currentTheme.cardBackground,
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) + 12,
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText variant="primary" size="header" weight="bold">
              Annotations
            </ThemedText>
            <ThemedText variant="secondary" size="caption" numberOfLines={1}>
              {bookTitle}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            {onExportTxt && (
              <PressableScale onPress={onExportTxt} style={styles.exportBtn} hitSlop={8}>
                <FileText size={18} color={currentTheme.accent} />
              </PressableScale>
            )}
            {onExportMarkdown && (
              <PressableScale onPress={onExportMarkdown} style={styles.exportBtn} hitSlop={8}>
                <FileCode size={18} color={currentTheme.accent} />
              </PressableScale>
            )}
            <PressableScale onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
          {([
            { id: 'highlights', label: `Highlights (${highlights.length})`, icon: Highlighter },
            { id: 'bookmarks', label: `Bookmarks (${bookmarks.length})`, icon: BookmarkIcon },
          ] as const).map(tab => (
            <Pressable
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && {
                  backgroundColor: currentTheme.cardBackground,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                },
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <tab.icon
                size={15}
                color={activeTab === tab.id ? currentTheme.accent : currentTheme.secondaryText}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === tab.id ? currentTheme.accent : currentTheme.secondaryText,
                    fontWeight: activeTab === tab.id ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        {activeTab === 'highlights' ? (
          <FlatList
            data={sortedHighlights}
            renderItem={renderHighlightItem}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Highlighter size={40} color={currentTheme.secondaryText + '50'} />
                <ThemedText variant="secondary" size="body" style={{ marginTop: 12, textAlign: 'center' }}>
                  No highlights yet
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginTop: 4 }}>
                  Select text while reading to add highlights
                </ThemedText>
              </View>
            }
          />
        ) : (
          <FlatList
            data={sortedBookmarks}
            renderItem={renderBookmarkItem}
            keyExtractor={item => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <BookmarkIcon size={40} color={currentTheme.secondaryText + '50'} />
                <ThemedText variant="secondary" size="body" style={{ marginTop: 12, textAlign: 'center' }}>
                  No bookmarks yet
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginTop: 4 }}>
                  Tap the bookmark icon while reading
                </ThemedText>
              </View>
            }
          />
        )}
      </Animated.View>

      <AppDialog
        visible={!!pendingDelete}
        title={pendingDelete?.type === 'bookmark' ? 'Delete Bookmark' : 'Delete Highlight'}
        message={
          pendingDelete?.type === 'bookmark'
            ? 'Remove this bookmark from the book?'
            : 'Remove this highlight from the book?'
        }
        tone="danger"
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => setPendingDelete(null) },
          {
            label: 'Delete',
            variant: 'danger',
            onPress: () => {
              if (pendingDelete?.type === 'bookmark') {
                onDeleteBookmark(pendingDelete.id);
              } else if (pendingDelete?.type === 'highlight') {
                onDeleteHighlight(pendingDelete.id);
              }
              setPendingDelete(null);
            },
          },
        ]}
        onClose={() => setPendingDelete(null)}
      />
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
    maxHeight: '85%',
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
    marginBottom: 16,
    gap: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  exportBtn: { padding: 8, borderRadius: 10 },
  closeBtn: { padding: 4 },
  tabs: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 13,
  },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 20 },
  annotationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  annotationLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  bookmarkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  highlightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
    marginTop: 5,
  },
  annotationContent: {
    flex: 1,
    gap: 4,
  },
  annotationChapterName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  annotationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  highlightTextBg: {
    borderRadius: 8,
    padding: 8,
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  annotationDate: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
    marginTop: -2,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
});
