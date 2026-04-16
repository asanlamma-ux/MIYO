import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Share,
  Clipboard,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  PenLine,
  Circle,
  Copy,
  Compass,
  BookOpen,
  Languages,
  X,
  Trash2,
  Check,
  Bookmark,
  Underline,
  BookPlus,
  Globe2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface SelectionData {
  text: string;
  x: number;
  y: number;
}

export interface HighlightData {
  text: string;
  color: string;
  note?: string;
  textColor?: string;
}

interface SelectionToolbarProps {
  selection: SelectionData | null;
  onClose: () => void;
  onHighlight: (data: HighlightData) => void;
  onNote: (data: HighlightData) => void;
  onCopy: (text: string) => void;
  onShare: (text: string) => void;
  onDictionary: (text: string) => void;
  onWikipedia: (text: string) => void;
  onTranslate: (text: string) => void;
  onBookmarkSelection?: (text: string) => void;
  onUnderline?: (data: HighlightData) => void;
  onAddTerm?: (text: string) => void;
}

const HIGHLIGHT_COLORS = [
  { color: '#E8D97A', label: 'Yellow' },
  { color: '#8DB870', label: 'Green' },
  { color: '#6EC4B0', label: 'Teal' },
  { color: '#74B4E6', label: 'Blue' },
];

const TEXT_COLORS = [
  { color: '#222222', label: 'Black' },
  { color: '#CC3333', label: 'Red' },
  { color: '#2255CC', label: 'Blue' },
  { color: '#229944', label: 'Green' },
];

const TOOLBAR_ITEMS = [
  { id: 'note', icon: PenLine, label: 'Note' },
  { id: 'highlight', icon: Circle, label: 'Highlight' },
  { id: 'underline', icon: Underline, label: 'Underline' },
  { id: 'bookmark', icon: Bookmark, label: 'Bookmark' },
  { id: 'addTerm', icon: BookPlus, label: 'Term' },
  { id: 'copy', icon: Copy, label: 'Copy' },
  { id: 'share', icon: Compass, label: 'Share' },
  { id: 'dictionary', icon: BookOpen, label: 'Define' },
  { id: 'wikipedia', icon: Globe2, label: 'Wiki' },
  { id: 'translate', icon: Languages, label: 'Translate' },
];

export function SelectionToolbar({
  selection,
  onClose,
  onHighlight,
  onNote,
  onCopy,
  onShare,
  onDictionary,
  onWikipedia,
  onTranslate,
  onBookmarkSelection,
  onUnderline,
  onAddTerm,
}: SelectionToolbarProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const [showColorRow, setShowColorRow] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(HIGHLIGHT_COLORS[0].color);

  useEffect(() => {
    if (!selection) {
      setShowColorRow(false);
      setShowNoteModal(false);
    }
  }, [selection]);

  if (!selection) return null;

  const handleAction = (id: string) => {
    switch (id) {
      case 'note':
        setShowNoteModal(true);
        break;
      case 'highlight':
        setShowColorRow(prev => !prev);
        break;
      case 'copy':
        onCopy(selection.text);
        onClose();
        break;
      case 'share':
        onShare(selection.text);
        onClose();
        break;
      case 'dictionary':
        onDictionary(selection.text);
        onClose();
        break;
      case 'wikipedia':
        onWikipedia(selection.text);
        onClose();
        break;
      case 'translate':
        onTranslate(selection.text);
        onClose();
        break;
      case 'bookmark':
        onBookmarkSelection?.(selection.text);
        onClose();
        break;
      case 'underline':
        setShowColorRow(prev => !prev);
        break;
      case 'addTerm':
        onAddTerm?.(selection.text);
        onClose();
        break;
    }
  };

  const handleHighlightColorSelect = (color: string) => {
    setSelectedHighlightColor(color);
    onHighlight({ text: selection.text, color });
    setShowColorRow(false);
    onClose();
  };

  const handleTextColorSelect = (color: string) => {
    onHighlight({ text: selection.text, color: selectedHighlightColor, textColor: color });
    setShowColorRow(false);
    onClose();
  };

  const iconColor = '#FFFFFF';
  const labelColor = 'rgba(255,255,255,0.78)';
  const dividerColor = 'rgba(255,255,255,0.12)';
  /** Android gesture nav often reports 0 inset — keep tools above the home pill */
  const bottomPad =
    Math.max(insets.bottom, Platform.OS === 'android' ? 18 : 12) + (Platform.OS === 'android' ? 10 : 6);

  const ToolbarSurface = Platform.OS === 'ios' ? BlurView : View;
  const toolbarSurfaceProps =
    Platform.OS === 'ios'
      ? { intensity: 50, tint: 'dark' as const }
      : {};

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(160)}
        style={[styles.toolbarWrapper, { pointerEvents: 'box-none' }]}
      >
        <ToolbarSurface
          {...toolbarSurfaceProps}
          style={[
            styles.toolbarCard,
            Platform.OS === 'android' && styles.toolbarCardAndroid,
            { paddingBottom: bottomPad },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <Text style={styles.swipeHint} numberOfLines={1}>
            Swipe sideways for more tools
          </Text>

          {/* Bounded width + horizontal scroll so items never clip past screen edge */}
          <View style={[styles.iconRowOuter, { width: screenWidth }]}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator
              {...(Platform.OS === 'ios' ? { indicatorStyle: 'white' as const } : {})}
              style={styles.iconRowScroll}
              contentContainerStyle={[
                styles.iconRowContent,
                {
                  paddingLeft: Math.max(insets.left, 12),
                  paddingRight: Math.max(insets.right, 12),
                },
              ]}
            >
              {TOOLBAR_ITEMS.map((item, idx) => {
                const IconComp = item.icon;
                const isHighlight = item.id === 'highlight';
                const isActive = isHighlight && showColorRow;
                return (
                  <React.Fragment key={item.id}>
                    {idx > 0 && (
                      <View style={[styles.vertDivider, { backgroundColor: dividerColor }]} />
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconBtn,
                        isActive && { backgroundColor: 'rgba(255,255,255,0.09)' },
                        pressed && { backgroundColor: 'rgba(255,255,255,0.14)' },
                      ]}
                      onPress={() => handleAction(item.id)}
                    >
                      <IconComp
                        size={20}
                        color={isActive ? currentTheme.accent : iconColor}
                        strokeWidth={1.85}
                      />
                      <ThemedText
                        style={[styles.iconLabel, { color: isActive ? currentTheme.accent : labelColor }]}
                        numberOfLines={2}
                      >
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </View>

          {/* Color row (expand) */}
          {showColorRow && (
            <Animated.View
              entering={FadeIn.duration(180)}
              style={[
                styles.colorRow,
                {
                  borderTopColor: dividerColor,
                  paddingLeft: Math.max(insets.left, 12),
                  paddingRight: Math.max(insets.right, 12),
                },
              ]}
            >
              {HIGHLIGHT_COLORS.map(hc => (
                <Pressable
                  key={hc.color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: hc.color },
                    selectedHighlightColor === hc.color && styles.colorSwatchSelected,
                  ]}
                  onPress={() => handleHighlightColorSelect(hc.color)}
                />
              ))}

              <View style={[styles.colorDivider, { backgroundColor: dividerColor }]} />

              {TEXT_COLORS.map(tc => (
                <Pressable
                  key={tc.color}
                  style={styles.textColorBtn}
                  onPress={() => handleTextColorSelect(tc.color)}
                >
                  <ThemedText style={[styles.textColorA, { color: tc.color }]}>A</ThemedText>
                  <View style={[styles.textColorUnderline, { backgroundColor: tc.color }]} />
                </Pressable>
              ))}
            </Animated.View>
          )}
        </ToolbarSurface>
      </Animated.View>

      {/* Note Modal */}
      <NoteModal
        visible={showNoteModal}
        selectedText={selection?.text || ''}
        onClose={() => setShowNoteModal(false)}
        onConfirm={(note, color, textColor) => {
          onNote({ text: selection.text, color, note, textColor });
          setShowNoteModal(false);
          onClose();
        }}
        onDelete={() => {
          setShowNoteModal(false);
          onClose();
        }}
        onCopy={() => onCopy(selection.text)}
        currentTheme={currentTheme}
      />
    </>
  );
}

interface NoteModalProps {
  visible: boolean;
  selectedText: string;
  onClose: () => void;
  onConfirm: (note: string, color: string, textColor?: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  currentTheme: any;
}

export function NoteModal({
  visible,
  selectedText,
  onClose,
  onConfirm,
  onDelete,
  onCopy,
  currentTheme,
}: NoteModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].color);
  const [selectedTextColor, setSelectedTextColor] = useState<string | undefined>(undefined);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!visible) {
      setNoteText('');
      setSelectedColor(HIGHLIGHT_COLORS[0].color);
      setSelectedTextColor(undefined);
    }
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(noteText, selectedColor, selectedTextColor);
    setNoteText('');
  };

  const isDark = currentTheme.isDark;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.noteModalRoot}>
        <Pressable style={styles.noteModalBackdrop} onPress={onClose} accessibilityLabel="Close note" />

        <KeyboardAvoidingView
          style={styles.noteModalKav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={SlideInUp.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.noteModalCard,
              {
                backgroundColor: currentTheme.cardBackground,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                paddingBottom: Math.max(insets.bottom, 12) + 16,
              },
            ]}
          >
          {/* Quote bar + text */}
          <View style={styles.noteQuoteContainer}>
            <View style={[styles.noteQuoteBar, { backgroundColor: currentTheme.accent }]} />
            <ThemedText
              style={[styles.noteQuoteText, { color: currentTheme.text }]}
              numberOfLines={3}
            >
              {selectedText}
            </ThemedText>
          </View>

          {/* Input */}
          <TextInput
            style={[
              styles.noteInput,
              {
                color: currentTheme.text,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              },
            ]}
            placeholder="Enter your thoughts"
            placeholderTextColor={currentTheme.secondaryText + '90'}
            multiline
            value={noteText}
            onChangeText={setNoteText}
            textAlignVertical="top"
          />

          {/* Color swatches */}
          <View style={styles.noteColorsRow}>
            {HIGHLIGHT_COLORS.map(hc => (
              <Pressable
                key={hc.color}
                style={[
                  styles.noteColorSwatch,
                  { backgroundColor: hc.color },
                  selectedColor === hc.color && [
                    styles.noteColorSwatchSelected,
                    { borderColor: currentTheme.accent },
                  ],
                ]}
                onPress={() => setSelectedColor(hc.color)}
              />
            ))}

            <View style={[styles.noteColorDivider, { backgroundColor: currentTheme.secondaryText + '25' }]} />

            {TEXT_COLORS.map(tc => (
              <Pressable
                key={tc.color}
                style={styles.noteTextColorBtn}
                onPress={() => setSelectedTextColor(prev => (prev === tc.color ? undefined : tc.color))}
              >
                <ThemedText
                  style={[
                    styles.noteTextColorA,
                    {
                      color: tc.color,
                      fontWeight: selectedTextColor === tc.color ? '800' : '600',
                    },
                  ]}
                >
                  A
                </ThemedText>
                <View style={[styles.noteTextColorUnderline, { backgroundColor: tc.color }]} />
              </Pressable>
            ))}
          </View>

          {/* Actions */}
          <View style={[styles.noteActionsRow, { borderTopColor: currentTheme.secondaryText + '15' }]}>
            <Pressable style={styles.noteActionBtn} onPress={onDelete}>
              <ThemedText style={[styles.noteActionText, { color: '#E0533A' }]}>Delete</ThemedText>
            </Pressable>
            <Pressable style={styles.noteActionBtn} onPress={onClose}>
              <ThemedText style={[styles.noteActionText, { color: currentTheme.secondaryText }]}>Cancel</ThemedText>
            </Pressable>
            <Pressable style={styles.noteActionBtn} onPress={onCopy}>
              <ThemedText style={[styles.noteActionText, { color: currentTheme.secondaryText }]}>Copy</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.noteActionBtn, styles.noteConfirmBtn, { backgroundColor: currentTheme.accent }]}
              onPress={handleConfirm}
            >
              <ThemedText style={[styles.noteActionText, { color: '#FFFFFF', fontWeight: '700' }]}>
                Confirm
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toolbarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toolbarCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 30,
    overflow: 'hidden',
  },
  toolbarCardAndroid: {
    backgroundColor: 'rgba(24,24,32,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.42)',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  iconRowOuter: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  iconRowScroll: {
    width: '100%',
    flexGrow: 0,
    paddingBottom: 12,
  },
  iconRowContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 6,
  },
  vertDivider: {
    width: 1,
    height: 34,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 58,
    minWidth: 64,
    maxWidth: 70,
    flexShrink: 0,
  },
  iconLabel: {
    fontSize: 10,
    lineHeight: 11,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.12,
    textAlign: 'center',
    width: 62,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 14,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
  },
  colorDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 4,
  },
  textColorBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  textColorA: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '600',
  },
  textColorUnderline: {
    height: 2.5,
    width: 20,
    borderRadius: 1.5,
    marginTop: 2,
  },

  // Note modal
  noteModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  noteModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 0,
  },
  noteModalKav: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  noteModalCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 28,
    gap: 16,
  },
  noteQuoteContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 8,
  },
  noteQuoteBar: {
    width: 3.5,
    borderRadius: 2,
    minHeight: 44,
    flexShrink: 0,
  },
  noteQuoteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
    opacity: 0.72,
  },
  noteInput: {
    height: 100,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
  },
  noteColorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  noteColorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  noteColorSwatchSelected: {
    borderWidth: 2.5,
    transform: [{ scale: 1.15 }],
  },
  noteColorDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
  noteTextColorBtn: {
    alignItems: 'center',
    minWidth: 26,
    opacity: 0.88,
  },
  noteTextColorA: {
    fontSize: 18,
    lineHeight: 22,
  },
  noteTextColorUnderline: {
    height: 2,
    width: 18,
    borderRadius: 1,
    marginTop: 2,
  },
  noteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    borderTopWidth: 1,
    paddingTop: 14,
    justifyContent: 'flex-end',
  },
  noteActionBtn: {
    minWidth: 74,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteConfirmBtn: {
    paddingHorizontal: 20,
  },
  noteActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
