import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useTerms } from '@/context/TermsContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { CommunityTermGroup } from '@/types/terms';
import {
  X,
  Search,
  Download,
  Globe2,
  Info,
  Check,
  BookOpen,
  Crown,
} from 'lucide-react-native';

interface CommunityTermGroupsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CommunityTermGroupsModal({ visible, onClose }: CommunityTermGroupsModalProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { fetchCommunityGroups, downloadCommunityGroup, termGroups } = useTerms();

  const [groups, setGroups] = useState<CommunityTermGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<CommunityTermGroup | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      loadGroups();
    }
  }, [visible]);

  const loadGroups = async () => {
    setLoading(true);
    const fetched = await fetchCommunityGroups();
    setGroups(fetched);
    setLoading(false);
  };

  const handleDownload = async (group: CommunityTermGroup) => {
    setDownloadingId(group.id);
    const success = await downloadCommunityGroup(group.id);
    if (success) {
      setDownloadedIds(prev => new Set([...prev, group.id]));
    }
    setDownloadingId(null);
  };

  const filteredGroups = searchQuery.trim()
    ? groups.filter(
        g =>
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : groups;

  const isDark = currentTheme.isDark;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.cardBackground,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <ThemedText variant="primary" size="header" weight="bold">
                Community Groups
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Download pre-made term groups from the community
              </ThemedText>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={22} color={currentTheme.secondaryText} />
            </Pressable>
          </View>

          {/* Search */}
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: currentTheme.secondaryText + '25',
              },
            ]}
          >
            <Search size={18} color={currentTheme.secondaryText} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.text }]}
              placeholder="Search groups, tags..."
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Groups List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.accent} />
              <ThemedText variant="secondary" size="caption" style={{ marginTop: 12 }}>
                Loading community groups...
              </ThemedText>
            </View>
          ) : filteredGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Globe2 size={40} color={currentTheme.secondaryText} strokeWidth={1.5} />
              <ThemedText variant="secondary" size="body" style={{ textAlign: 'center', marginTop: 12 }}>
                {searchQuery.trim() ? 'No groups found' : 'No community groups available yet'}
              </ThemedText>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.list} nestedScrollEnabled>
              {filteredGroups.map((group, index) => {
                const isDownloaded = downloadedIds.has(group.id) || termGroups.some(tg => tg.name === group.name);
                const isDownloading = downloadingId === group.id;

                return (
                  <Animated.View key={group.id} entering={FadeIn.delay(index * 50).duration(200)}>
                    <Pressable
                      style={[
                        styles.groupCard,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          borderColor: currentTheme.secondaryText + '15',
                        },
                      ]}
                      onPress={() => setSelectedGroup(group)}
                    >
                      <View style={styles.groupHeader}>
                        <View style={styles.groupTitleRow}>
                          {group.isOfficial && (
                            <View style={[styles.officialBadge, { backgroundColor: currentTheme.accent + '20' }]}>
                              <Crown size={12} color={currentTheme.accent} />
                            </View>
                          )}
                          <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={1}>
                            {group.name}
                          </ThemedText>
                        </View>
                        <PressableScale
                          onPress={() => handleDownload(group)}
                          disabled={isDownloaded || isDownloading}
                          style={[
                            styles.downloadBtn,
                            {
                              backgroundColor: isDownloaded
                                ? '#22C55E20'
                                : isDownloading
                                ? currentTheme.accent + '40'
                                : currentTheme.accent,
                            },
                          ]}
                        >
                          {isDownloaded ? (
                            <Check size={16} color="#22C55E" />
                          ) : isDownloading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Download size={16} color="#FFFFFF" />
                          )}
                        </PressableScale>
                      </View>

                      {group.description && (
                        <ThemedText variant="secondary" size="caption" numberOfLines={2} style={{ marginTop: 6 }}>
                          {group.description}
                        </ThemedText>
                      )}

                      <View style={styles.groupMeta}>
                        <View style={styles.metaItem}>
                          <BookOpen size={12} color={currentTheme.secondaryText} />
                          <ThemedText variant="secondary" size="caption">
                            {group.terms.length} terms
                          </ThemedText>
                        </View>
                        <View style={styles.metaItem}>
                          <Download size={12} color={currentTheme.secondaryText} />
                          <ThemedText variant="secondary" size="caption">
                            {group.downloads}
                          </ThemedText>
                        </View>
                        {group.tags.length > 0 && (
                          <View style={styles.tagsRow}>
                            {group.tags.slice(0, 3).map(tag => (
                              <View
                                key={tag}
                                style={[
                                  styles.tagChip,
                                  { backgroundColor: currentTheme.accent + '15' },
                                ]}
                              >
                                <ThemedText variant="accent" size="caption" weight="medium">
                                  {tag}
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>

        {/* Group Detail Modal */}
        {selectedGroup && (
          <GroupDetailModal
            group={selectedGroup}
            onClose={() => setSelectedGroup(null)}
            onDownload={() => {
              handleDownload(selectedGroup);
              setSelectedGroup(null);
            }}
            isDownloaded={downloadedIds.has(selectedGroup.id)}
          />
        )}
      </View>
    </Modal>
  );
}

interface GroupDetailModalProps {
  group: CommunityTermGroup;
  onClose: () => void;
  onDownload: () => void;
  isDownloaded: boolean;
}

function GroupDetailModal({ group, onClose, onDownload, isDownloaded }: GroupDetailModalProps) {
  const { currentTheme } = useTheme();
  const isDark = currentTheme.isDark;

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.detailSheet,
            {
              backgroundColor: currentTheme.cardBackground,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleRow}>
              {group.isOfficial && (
                <View style={[styles.officialBadge, { backgroundColor: currentTheme.accent + '20' }]}>
                  <Crown size={14} color={currentTheme.accent} />
                </View>
              )}
              <ThemedText variant="primary" size="header" weight="bold" numberOfLines={2}>
                {group.name}
              </ThemedText>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={currentTheme.secondaryText} />
            </Pressable>
          </View>

          {group.description && (
            <ThemedText variant="secondary" size="body" style={{ lineHeight: 22, marginTop: 8 }}>
              {group.description}
            </ThemedText>
          )}

          <View style={styles.detailMeta}>
            <View style={styles.detailMetaItem}>
              <BookOpen size={16} color={currentTheme.accent} />
              <ThemedText variant="primary" size="body" weight="semibold">
                {group.terms.length}
              </ThemedText>
              <ThemedText variant="secondary" size="caption">Terms</ThemedText>
            </View>
            <View style={styles.detailMetaItem}>
              <Download size={16} color={currentTheme.accent} />
              <ThemedText variant="primary" size="body" weight="semibold">
                {group.downloads}
              </ThemedText>
              <ThemedText variant="secondary" size="caption">Downloads</ThemedText>
            </View>
          </View>

          {group.tags.length > 0 && (
            <View style={styles.detailTags}>
              {group.tags.map(tag => (
                <View
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: currentTheme.accent + '15' }]}
                >
                  <ThemedText variant="accent" size="body" weight="medium">
                    {tag}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          <View style={styles.termsPreview}>
            <ThemedText variant="secondary" size="caption" weight="medium" style={{ marginBottom: 8 }}>
              TERMS PREVIEW
            </ThemedText>
            {group.terms.slice(0, 5).map(term => (
              <View key={term.id} style={styles.termPreviewRow}>
                <ThemedText variant="primary" size="caption" numberOfLines={1}>
                  {term.originalText}
                </ThemedText>
                <ThemedText variant="secondary" size="caption">→</ThemedText>
                <ThemedText variant="accent" size="caption" weight="semibold" numberOfLines={1}>
                  {term.correctedText}
                </ThemedText>
              </View>
            ))}
            {group.terms.length > 5 && (
              <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center', marginTop: 4 }}>
                + {group.terms.length - 5} more terms
              </ThemedText>
            )}
          </View>

          <PressableScale
            onPress={onDownload}
            disabled={isDownloaded}
            style={[
              styles.downloadActionBtn,
              {
                backgroundColor: isDownloaded ? '#22C55E' : currentTheme.accent,
              },
            ]}
          >
            {isDownloaded ? (
              <>
                <Check size={18} color="#FFFFFF" />
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  Downloaded
                </ThemedText>
              </>
            ) : (
              <>
                <Download size={18} color="#FFFFFF" />
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  Download Group
                </ThemedText>
              </>
            )}
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  headerTitles: {
    flex: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  list: {
    maxHeight: 500,
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  officialBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 28,
    gap: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailMeta: {
    flexDirection: 'row',
    gap: 24,
  },
  detailMetaItem: {
    alignItems: 'center',
    gap: 4,
  },
  detailTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  termsPreview: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  termPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  downloadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
