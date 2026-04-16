import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Animated, { SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useTerms } from '@/context/TermsContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { X, Plus, Check, Copy } from 'lucide-react-native';

interface AddTermModalProps {
  visible: boolean;
  /** Pre-filled original text (from reader selection) */
  initialText?: string;
  /** Pre-selected group ID */
  groupId?: string;
  /** When set, the group is applied to this book so replacements work in the reader */
  bookId?: string;
  onClose: () => void;
}

export function AddTermModal({ visible, initialText, groupId, bookId, onClose }: AddTermModalProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { termGroups, addTerm, createGroup, applyGroupToBook } = useTerms();

  const [originalText, setOriginalText] = useState('');
  const [translationText, setTranslationText] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [contextText, setContextText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setOriginalText(initialText ?? '');
    setTranslationText('');
    setCorrectedText('');
    setContextText('');
    setImageUri(null);
    setSelectedGroupId(groupId ?? (termGroups.length > 0 ? termGroups[0].id : null));
    setShowCreateGroup(false);
    setNewGroupName('');
  }, [visible, initialText, groupId]);

  useEffect(() => {
    if (!visible || groupId) return;
    setSelectedGroupId(prev => prev ?? (termGroups[0]?.id ?? null));
  }, [visible, groupId, termGroups]);

  const isDark = currentTheme.isDark;

  const handleSave = async () => {
    if (!originalText.trim() || !correctedText.trim()) return;

    let targetGroupId = selectedGroupId;

    if (showCreateGroup && newGroupName.trim()) {
      const newGroup = await createGroup(newGroupName.trim());
      targetGroupId = newGroup.id;
    }

    if (!targetGroupId) return;

    await addTerm(
      targetGroupId,
      originalText.trim(),
      correctedText.trim(),
      contextText.trim() || undefined,
      {
        translationText: translationText.trim() || undefined,
        imageUri: imageUri || undefined,
      }
    );
    if (bookId) {
      await applyGroupToBook(targetGroupId, bookId);
    }
    onClose();
  };

  const handlePickImage = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }
    setImageUri(result.assets[0].uri);
  };

  const copyOriginalToTranslation = () => {
    if (originalText.trim()) setCorrectedText(originalText.trim());
  };

  const canSave =
    originalText.trim().length > 0 &&
    correctedText.trim().length > 0 &&
    (selectedGroupId != null || (showCreateGroup && newGroupName.trim().length > 0));

  if (!visible) return null;

  const bottomPad = Math.max(insets.bottom, 12) + 8;
  const inputSurface = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />

        <KeyboardAvoidingView
          style={styles.sheetHost}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 12}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={SlideInUp.duration(180)}
            exiting={SlideOutDown.duration(140)}
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.cardBackground,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                paddingBottom: bottomPad,
              },
            ]}
          >
            <View style={[styles.header, { paddingTop: Math.max(insets.top * 0.25, 4) }]}>
              <View style={styles.headerTitles}>
                <ThemedText variant="primary" size="header" weight="bold">
                  Add term
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={styles.subtitle}>
                  Original text is replaced while you read.
                </ThemedText>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [
                  styles.closeHit,
                  pressed && { opacity: 0.65 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close add term"
              >
                <X size={22} color={currentTheme.secondaryText} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.fields}
              contentContainerStyle={styles.fieldsContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.label}>
                ORIGINAL (AS IN BOOK)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: currentTheme.text,
                    backgroundColor: inputSurface,
                    borderColor: currentTheme.secondaryText + '25',
                  },
                ]}
                value={originalText}
                onChangeText={setOriginalText}
                placeholder="Word or phrase to match"
                placeholderTextColor={currentTheme.secondaryText + '80'}
                multiline
              />

              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.label}>
                TRANSLATION (OPTIONAL)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: currentTheme.text,
                    backgroundColor: inputSurface,
                    borderColor: currentTheme.secondaryText + '25',
                  },
                ]}
                value={translationText}
                onChangeText={setTranslationText}
                placeholder="MTL or source-side translation to show in the reader popup"
                placeholderTextColor={currentTheme.secondaryText + '80'}
                multiline
              />

              <View style={styles.rowBetween}>
                <ThemedText variant="secondary" size="caption" weight="medium" style={styles.labelFlat}>
                  ADDED TERM / REPLACEMENT
                </ThemedText>
                <PressableScale
                  onPress={copyOriginalToTranslation}
                  style={styles.miniAction}
                  disabled={!originalText.trim()}
                >
                  <Copy size={14} color={currentTheme.accent} />
                  <ThemedText variant="accent" size="caption" weight="semibold">
                    Copy original
                  </ThemedText>
                </PressableScale>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: currentTheme.text,
                    backgroundColor: inputSurface,
                    borderColor: currentTheme.secondaryText + '25',
                  },
                ]}
                value={correctedText}
                onChangeText={setCorrectedText}
                placeholder="What you want to see instead"
                placeholderTextColor={currentTheme.secondaryText + '80'}
                multiline
              />

              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.label}>
                IMAGE (OPTIONAL)
              </ThemedText>
              <View style={styles.imageBlock}>
                <PressableScale
                  onPress={handlePickImage}
                  style={[
                    styles.imagePickerBtn,
                    {
                      backgroundColor: inputSurface,
                      borderColor: currentTheme.secondaryText + '25',
                    },
                  ]}
                >
                  <Plus size={16} color={currentTheme.accent} />
                  <ThemedText variant="accent" size="caption" weight="semibold">
                    {imageUri ? 'Replace image' : 'Add image'}
                  </ThemedText>
                </PressableScale>
                {imageUri ? (
                  <View
                    style={[
                      styles.imagePreviewCard,
                      {
                        backgroundColor: inputSurface,
                        borderColor: currentTheme.secondaryText + '25',
                      },
                    ]}
                  >
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                    <View style={styles.imagePreviewMeta}>
                      <ThemedText variant="secondary" size="caption" numberOfLines={1}>
                        {imageUri.split('/').pop() || 'Attached image'}
                      </ThemedText>
                      <PressableScale onPress={() => setImageUri(null)} style={styles.miniAction}>
                        <X size={14} color={currentTheme.accent} />
                        <ThemedText variant="accent" size="caption" weight="semibold">
                          Remove
                        </ThemedText>
                      </PressableScale>
                    </View>
                  </View>
                ) : null}
              </View>

              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.label}>
                NOTE (OPTIONAL)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: currentTheme.text,
                    backgroundColor: inputSurface,
                    borderColor: currentTheme.secondaryText + '25',
                  },
                ]}
                value={contextText}
                onChangeText={setContextText}
                placeholder="Reminder or gloss — not shown inline"
                placeholderTextColor={currentTheme.secondaryText + '80'}
              />

              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.label}>
                GROUP
              </ThemedText>

              {!showCreateGroup ? (
                <View style={styles.groupChips}>
                  {termGroups.map(g => {
                    const isActive = selectedGroupId === g.id;
                    return (
                      <PressableScale
                        key={g.id}
                        onPress={() => setSelectedGroupId(g.id)}
                        style={[
                          styles.groupChip,
                          {
                            backgroundColor: isActive ? currentTheme.accent + '20' : currentTheme.background,
                            borderColor: isActive ? currentTheme.accent : currentTheme.secondaryText + '25',
                          },
                        ]}
                      >
                        <ThemedText
                          variant={isActive ? 'accent' : 'secondary'}
                          size="caption"
                          weight={isActive ? 'semibold' : 'regular'}
                        >
                          {g.name}
                        </ThemedText>
                      </PressableScale>
                    );
                  })}
                  <PressableScale
                    onPress={() => setShowCreateGroup(true)}
                    style={[
                      styles.groupChip,
                      { backgroundColor: currentTheme.background, borderColor: currentTheme.accent + '40', borderStyle: 'dashed' },
                    ]}
                  >
                    <Plus size={14} color={currentTheme.accent} />
                    <ThemedText variant="accent" size="caption" weight="medium">
                      New group
                    </ThemedText>
                  </PressableScale>
                </View>
              ) : (
                <View style={styles.newGroupRow}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        color: currentTheme.text,
                        backgroundColor: inputSurface,
                        borderColor: currentTheme.accent,
                      },
                    ]}
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                    placeholder="New group name"
                    placeholderTextColor={currentTheme.secondaryText + '80'}
                    autoFocus
                  />
                  <Pressable
                    onPress={() => setShowCreateGroup(false)}
                    hitSlop={12}
                    style={({ pressed }) => [styles.closeHit, pressed && { opacity: 0.65 }]}
                    accessibilityLabel="Cancel new group"
                  >
                    <X size={18} color={currentTheme.secondaryText} />
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <PressableScale
              onPress={handleSave}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: currentTheme.accent,
                  opacity: canSave ? 1 : 0.5,
                },
              ]}
              disabled={!canSave}
            >
              <Check size={18} color="#FFFFFF" />
              <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Save term</ThemedText>
            </PressableScale>
          </Animated.View>
        </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 0,
  },
  sheetHost: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.85,
    lineHeight: 18,
  },
  closeHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -8,
  },
  fields: {
    marginBottom: 12,
    maxHeight: 420,
  },
  fieldsContent: {
    paddingBottom: 12,
  },
  label: {
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  labelFlat: {
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 0,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  miniAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  imageBlock: {
    gap: 10,
  },
  imagePickerBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePreviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 140,
  },
  imagePreviewMeta: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  newGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
