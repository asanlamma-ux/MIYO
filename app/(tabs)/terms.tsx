import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useTerms } from '@/context/TermsContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { TermGroupCard } from '@/components/terms/TermGroupCard';
import { TermGroupDetail } from '@/components/terms/TermGroupDetail';
import { TermGroupExportModal } from '@/components/terms/TermGroupExportModal';
import { CommunityTermGroupsModal } from '@/components/terms/CommunityTermGroupsModal';
import { Plus, Search, Languages, FolderUp, Globe2 } from 'lucide-react-native';

export default function TermsScreen() {
  const { currentTheme } = useTheme();
  const { termGroups, createGroup } = useTerms();
  const insets = useSafeAreaInsets();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  useEffect(() => {
    (globalThis as any).__openCommunityGroups = () => setShowCommunityModal(true);
    return () => { delete (globalThis as any).__openCommunityGroups; };
  }, []);

  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  const filteredGroups = searchQuery.trim()
    ? termGroups.filter(
        g =>
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.terms.some(t =>
            t.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.correctedText.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : termGroups;

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    const group = await createGroup(newGroupName.trim());
    setNewGroupName('');
    setShowCreateInput(false);
    setSelectedGroupId(group.id);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: tabBarHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
              Terms
            </ThemedText>
            <ThemedText variant="secondary" size="caption">
              Manage translation corrections for your novels
            </ThemedText>
          </View>
          <View style={styles.headerBtns}>
            <PressableScale
              onPress={() => setShowExportModal(true)}
              style={[styles.headerBtn, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '20' }]}
            >
              <FolderUp size={18} color={currentTheme.secondaryText} strokeWidth={2} />
            </PressableScale>
            <PressableScale
              onPress={() => setShowCommunityModal(true)}
              style={[styles.headerBtn, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '20' }]}
            >
              <Globe2 size={18} color={currentTheme.secondaryText} strokeWidth={2} />
            </PressableScale>
            <PressableScale
              onPress={() => setShowCreateInput(true)}
              style={[styles.headerBtn, { backgroundColor: currentTheme.accent }]}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </PressableScale>
          </View>
        </View>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.secondaryText + '18',
            },
          ]}
        >
          <Search size={18} color={currentTheme.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.text }]}
            placeholder="Search groups or terms..."
            placeholderTextColor={currentTheme.secondaryText + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {showCreateInput && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.createCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.accent + '40' }]}
          >
            <TextInput
              style={[styles.createInput, { color: currentTheme.text, borderColor: currentTheme.secondaryText + '25', backgroundColor: currentTheme.secondaryText + '08' }]}
              placeholder="New group name..."
              placeholderTextColor={currentTheme.secondaryText + '80'}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
              onSubmitEditing={handleCreateGroup}
              returnKeyType="done"
            />
            <View style={styles.createBtnRow}>
              <PressableScale
                onPress={() => { setShowCreateInput(false); setNewGroupName(''); }}
                style={[styles.createCancelBtn, { borderColor: currentTheme.secondaryText + '30' }]}
              >
                <ThemedText variant="secondary" size="body" weight="medium">Cancel</ThemedText>
              </PressableScale>
              <PressableScale
                onPress={handleCreateGroup}
                style={[styles.createConfirmBtn, { backgroundColor: newGroupName.trim() ? currentTheme.accent : currentTheme.accent + '50' }]}
                disabled={!newGroupName.trim()}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Create</ThemedText>
              </PressableScale>
            </View>
          </Animated.View>
        )}

        {filteredGroups.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: currentTheme.accent + '15' }]}>
              <Languages size={40} color={currentTheme.accent} strokeWidth={1.5} />
            </View>
            <ThemedText variant="primary" size="header" weight="bold" style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No Results' : 'No Term Groups Yet'}
            </ThemedText>
            <ThemedText variant="secondary" size="body" style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? 'Try a different search query.'
                : 'Create a term group to start correcting MTL translations. Select text in the reader and tap "Add Term" to begin.'}
            </ThemedText>
            {!searchQuery.trim() && (
              <PressableScale
                onPress={() => setShowCreateInput(true)}
                style={[styles.emptyBtn, { backgroundColor: currentTheme.accent }]}
              >
                <Plus size={18} color="#FFFFFF" />
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                  Create First Group
                </ThemedText>
              </PressableScale>
            )}
          </Animated.View>
        ) : (
          filteredGroups.map((group, index) => (
            <Animated.View key={group.id} entering={FadeIn.delay(index * 50).duration(250)}>
              <TermGroupCard
                group={group}
                onPress={() => setSelectedGroupId(group.id)}
              />
            </Animated.View>
          ))
        )}

        {termGroups.length > 0 && (
          <View style={styles.footer}>
            <ThemedText variant="secondary" size="caption" style={{ textAlign: 'center' }}>
              {termGroups.length} group{termGroups.length !== 1 ? 's' : ''} · {termGroups.reduce((sum, g) => sum + g.terms.length, 0)} total terms
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <TermGroupDetail
        visible={!!selectedGroupId}
        groupId={selectedGroupId}
        onClose={() => setSelectedGroupId(null)}
      />

      <TermGroupExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <CommunityTermGroupsModal
        visible={showCommunityModal}
        onClose={() => setShowCommunityModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { marginBottom: 4 },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 10,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  createCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  createInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  createBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  createCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  createConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
