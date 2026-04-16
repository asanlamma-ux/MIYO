import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useTerms } from '@/context/TermsContext';
import { useLibrary } from '@/context/LibraryContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { AddTermModal } from './AddTermModal';
import {
  X,
  Trash2,
  Plus,
  BookOpen,
  ArrowRight,
  Check,
  Edit3,
  AlertTriangle,
} from 'lucide-react-native';

interface TermGroupDetailProps {
  visible: boolean;
  groupId: string | null;
  onClose: () => void;
}

export function TermGroupDetail({ visible, groupId, onClose }: TermGroupDetailProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { termGroups, updateGroup, removeTerm, updateTerm, deleteGroup, applyGroupToBook, removeGroupFromBook } = useTerms();
  const { books } = useLibrary();

  const group = termGroups.find(g => g.id === groupId) ?? null;

  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState('');
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [editTermId, setEditTermId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState('');
  const [editCorrected, setEditCorrected] = useState('');
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteTermId, setPendingDeleteTermId] = useState<string | null>(null);

  useEffect(() => {
    if (group) {
      setNameText(group.name);
    }
  }, [group?.name]);

  useEffect(() => {
    if (!visible) {
      setEditingName(false);
      setShowAddTerm(false);
      setEditTermId(null);
      setShowBookSelector(false);
      setShowDeleteConfirm(false);
      setPendingDeleteTermId(null);
    }
  }, [visible]);

  if (!visible || !group) return null;

  const handleSaveName = async () => {
    if (nameText.trim()) {
      await updateGroup(group.id, { name: nameText.trim() });
    }
    setEditingName(false);
  };

  const handleSaveEditTerm = async () => {
    if (!editTermId) return;
    await updateTerm(group.id, editTermId, {
      originalText: editOriginal.trim(),
      correctedText: editCorrected.trim(),
    });
    setEditTermId(null);
  };

  const handleDeleteGroup = async () => {
    await deleteGroup(group.id);
    onClose();
  };

  const handleToggleBook = async (bookId: string) => {
    if (group.appliedToBooks.includes(bookId)) {
      await removeGroupFromBook(group.id, bookId);
    } else {
      await applyGroupToBook(group.id, bookId);
    }
  };

  const handleDeleteTerm = async (termId: string) => {
    await removeTerm(group.id, termId);
    setPendingDeleteTermId(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: currentTheme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 12}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.secondaryText + '18', paddingTop: insets.top + 10 }]}>
          <PressableScale onPress={onClose} style={styles.headerIconBtn}>
            <X size={20} color={currentTheme.secondaryText} />
          </PressableScale>

          <View style={styles.headerCenter}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={[styles.nameInput, { color: currentTheme.text, borderColor: currentTheme.accent }]}
                  value={nameText}
                  onChangeText={setNameText}
                  autoFocus
                  onBlur={handleSaveName}
                  onSubmitEditing={handleSaveName}
                />
                <PressableScale onPress={handleSaveName} style={styles.headerIconBtn}>
                  <Check size={18} color={currentTheme.accent} />
                </PressableScale>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.nameRow}>
                <ThemedText variant="primary" size="header" weight="bold" numberOfLines={1}>
                  {group.name}
                </ThemedText>
                <Edit3 size={13} color={currentTheme.secondaryText} />
              </Pressable>
            )}
          </View>

          <PressableScale
            onPress={() => setShowDeleteConfirm(true)}
            style={[styles.headerIconBtn, styles.deleteIconBtn]}
          >
            <Trash2 size={18} color="#EF4444" />
          </PressableScale>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Terms List */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionLabel}>
                TERMS ({group.terms.length})
              </ThemedText>
              <PressableScale
                onPress={() => setShowAddTerm(true)}
                style={[styles.addBtn, { backgroundColor: currentTheme.accent }]}
              >
                <Plus size={15} color="#FFFFFF" />
                <ThemedText style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Add Term</ThemedText>
              </PressableScale>
            </View>

            {group.terms.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: currentTheme.cardBackground }]}>
                <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                  No terms yet. Tap Add Term or use the reader to add translation corrections.
                </ThemedText>
              </View>
            ) : (
              group.terms.map((term) => {
                const isEditing = editTermId === term.id;
                const isPendingDelete = pendingDeleteTermId === term.id;
                return (
                  <View
                    key={term.id}
                    style={[styles.termCard, { backgroundColor: currentTheme.cardBackground, borderColor: isPendingDelete ? '#EF444440' : currentTheme.secondaryText + '12' }]}
                  >
                    {isEditing ? (
                      <View style={styles.termEditContainer}>
                        <TextInput
                          style={[styles.termEditInput, { color: currentTheme.text, borderColor: currentTheme.secondaryText + '30' }]}
                          value={editOriginal}
                          onChangeText={setEditOriginal}
                          placeholder="Original text"
                          placeholderTextColor={currentTheme.secondaryText + '60'}
                        />
                        <ArrowRight size={16} color={currentTheme.accent} />
                        <TextInput
                          style={[styles.termEditInput, { color: currentTheme.text, borderColor: currentTheme.secondaryText + '30' }]}
                          value={editCorrected}
                          onChangeText={setEditCorrected}
                          placeholder="Corrected text"
                          placeholderTextColor={currentTheme.secondaryText + '60'}
                        />
                        <PressableScale onPress={handleSaveEditTerm} style={styles.termActionBtn}>
                          <Check size={18} color={currentTheme.accent} />
                        </PressableScale>
                        <PressableScale onPress={() => setEditTermId(null)} style={styles.termActionBtn}>
                          <X size={16} color={currentTheme.secondaryText} />
                        </PressableScale>
                      </View>
                    ) : isPendingDelete ? (
                      <View style={styles.deleteConfirmRow}>
                        <ThemedText variant="secondary" size="caption" style={{ flex: 1 }}>
                          Remove {`\u201c${term.originalText}\u201d`}?
                        </ThemedText>
                        <PressableScale
                          onPress={() => handleDeleteTerm(term.id)}
                          style={[styles.deleteConfirmBtn, { backgroundColor: '#EF4444' }]}
                        >
                          <ThemedText style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Delete</ThemedText>
                        </PressableScale>
                        <PressableScale
                          onPress={() => setPendingDeleteTermId(null)}
                          style={[styles.deleteConfirmBtn, { backgroundColor: currentTheme.secondaryText + '18' }]}
                        >
                          <ThemedText variant="secondary" style={{ fontSize: 12, fontWeight: '600' }}>Cancel</ThemedText>
                        </PressableScale>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setEditTermId(term.id);
                          setEditOriginal(term.originalText);
                          setEditCorrected(term.correctedText);
                        }}
                        style={styles.termRow}
                      >
                        <View style={styles.termTextCol}>
                          <ThemedText variant="primary" size="body" numberOfLines={2}>
                            {term.originalText}
                          </ThemedText>
                          {term.translationText ? (
                            <ThemedText variant="secondary" size="caption" numberOfLines={1} style={{ marginTop: 2 }}>
                              Translation: {term.translationText}
                            </ThemedText>
                          ) : null}
                          {term.context ? (
                            <ThemedText variant="secondary" size="caption" numberOfLines={1} style={{ marginTop: 2 }}>
                              {term.context}
                            </ThemedText>
                          ) : null}
                        </View>
                        <ArrowRight size={13} color={currentTheme.secondaryText} style={{ marginHorizontal: 8 }} />
                        <View style={styles.termTextCol}>
                          <ThemedText variant="accent" size="body" weight="semibold" numberOfLines={2}>
                            {term.correctedText}
                          </ThemedText>
                          {term.imageUri ? (
                            <Image source={{ uri: term.imageUri }} style={styles.termImagePreview} resizeMode="cover" />
                          ) : null}
                        </View>
                        <PressableScale
                          onPress={() => setPendingDeleteTermId(term.id)}
                          style={styles.deleteTermBtn}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </PressableScale>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Applied Books */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionLabel}>
                APPLIED TO BOOKS ({group.appliedToBooks.length})
              </ThemedText>
              <PressableScale
                onPress={() => setShowBookSelector(!showBookSelector)}
                style={[styles.addBtn, { backgroundColor: currentTheme.accent + '20' }]}
              >
                <BookOpen size={15} color={currentTheme.accent} />
                <ThemedText variant="accent" size="caption" weight="semibold">
                  {showBookSelector ? 'Done' : 'Manage'}
                </ThemedText>
              </PressableScale>
            </View>

            {showBookSelector ? (
              books.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: currentTheme.cardBackground }]}>
                  <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                    No books in your library yet.
                  </ThemedText>
                </View>
              ) : (
                books.map((book) => {
                  const isApplied = group.appliedToBooks.includes(book.id);
                  return (
                    <PressableScale
                      key={book.id}
                      onPress={() => handleToggleBook(book.id)}
                      style={[
                        styles.bookItem,
                        {
                          backgroundColor: isApplied ? currentTheme.accent + '12' : currentTheme.cardBackground,
                          borderColor: isApplied ? currentTheme.accent + '40' : currentTheme.secondaryText + '12',
                        },
                      ]}
                    >
                      <ThemedText
                        variant={isApplied ? 'accent' : 'primary'}
                        size="body"
                        weight={isApplied ? 'semibold' : 'regular'}
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {book.title}
                      </ThemedText>
                      {isApplied && <Check size={18} color={currentTheme.accent} />}
                    </PressableScale>
                  );
                })
              )
            ) : (
              group.appliedToBooks.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: currentTheme.cardBackground }]}>
                  <ThemedText variant="secondary" size="body" style={{ textAlign: 'center' }}>
                    Not applied to any books. Tap Manage to link this group.
                  </ThemedText>
                </View>
              ) : (
                group.appliedToBooks.map((bookId) => {
                  const book = books.find(b => b.id === bookId);
                  return (
                    <View key={bookId} style={[styles.bookItem, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '12' }]}>
                      <ThemedText variant="primary" size="body" numberOfLines={1} style={{ flex: 1 }}>
                        {book?.title ?? 'Unknown Book'}
                      </ThemedText>
                      <ThemedText variant="secondary" size="caption">Active</ThemedText>
                    </View>
                  );
                })
              )
            )}
          </View>
        </ScrollView>

        {/* Inline Delete Group Confirmation */}
        {showDeleteConfirm && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            style={[styles.deleteOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          >
            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
              style={[styles.deleteDialog, { backgroundColor: currentTheme.cardBackground }]}
            >
              <View style={[styles.deleteDialogIcon, { backgroundColor: '#EF444415' }]}>
                <AlertTriangle size={28} color="#EF4444" />
              </View>
              <ThemedText variant="primary" size="header" weight="bold" style={styles.deleteDialogTitle}>
                Delete Group
              </ThemedText>
              <ThemedText variant="secondary" size="body" style={styles.deleteDialogMsg}>
                Delete {`\u201c${group.name}\u201d`} and all its {group.terms.length} term{group.terms.length !== 1 ? 's' : ''}? This cannot be undone.
              </ThemedText>
              <View style={styles.deleteDialogBtns}>
                <PressableScale
                  onPress={() => setShowDeleteConfirm(false)}
                  style={[styles.deleteDialogBtn, { backgroundColor: currentTheme.secondaryText + '15' }]}
                >
                  <ThemedText variant="primary" size="body" weight="semibold">Cancel</ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={handleDeleteGroup}
                  style={[styles.deleteDialogBtn, { backgroundColor: '#EF4444' }]}
                >
                  <ThemedText style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Delete</ThemedText>
                </PressableScale>
              </View>
            </Animated.View>
          </Animated.View>
        )}

        <AddTermModal
          visible={showAddTerm}
          groupId={group.id}
          onClose={() => setShowAddTerm(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerCenter: { flex: 1 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBtn: {
    backgroundColor: '#EF444415',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingVertical: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: { letterSpacing: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  termCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  termTextCol: { flex: 1 },
  termImagePreview: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginTop: 8,
  },
  termEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 6,
  },
  termEditInput: {
    flex: 1,
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  termActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  deleteConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteTermBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteDialog: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  deleteDialogIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteDialogTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteDialogMsg: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteDialogBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteDialogBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
});
