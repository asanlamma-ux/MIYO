import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { AppDialog, AppDialogAction, AppDialogTone } from '@/components/ui/AppDialog';
import { ThemeCard } from '@/components/themes/ThemeCard';
import { Theme } from '@/types/theme';
import { getThemeCategory, getThemeEffectPack, getThemePerformanceHint, getThemeUiSectionsCopy } from '@/utils/theme-effects';
import { Plus, X, Check } from 'lucide-react-native';

const colorPresets = [
  '#F4EFE8', '#1A1A1A', '#E8F0E8', '#F0EBF4', '#000000', '#FFFBF5',
  '#F5F5F5', '#E8F1F5', '#FFF5ED', '#1E2430', '#FDF2F4', '#1C1816',
  '#3A3228', '#E8E6E3', '#2D3E2D', '#3E3548', '#CCCCCC', '#2C2416',
  '#8B6F47', '#A78BFA', '#4A7C59', '#9B7EBD', '#00D9FF', '#9D7651',
  '#666666', '#2D7D9A', '#D97706', '#88C0D0', '#D4687A', '#C4A77D',
];

export default function ThemesScreen() {
  const { currentTheme, setTheme, themes, addCustomTheme, removeCustomTheme, readingSettings, setReadingSettings } =
    useTheme();
  const insets = useSafeAreaInsets();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTheme, setNewTheme] = useState<Partial<Theme>>({
    name: '',
    background: '#F4EFE8',
    text: '#3A3228',
    accent: '#8B6F47',
    secondaryText: '#6B5D4D',
    cardBackground: '#FFFBF5',
    isDark: false,
  });
  const [activeColorPicker, setActiveColorPicker] = useState<
    'background' | 'text' | 'accent' | null
  >(null);
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    tone?: AppDialogTone;
    actions: AppDialogAction[];
  } | null>(null);
  const [showThemeInfo, setShowThemeInfo] = useState(false);

  const builtInThemes = themes.filter(t => !t.isCustom);
  const normalThemes = builtInThemes.filter(theme => getThemeCategory(theme) === 'normal');
  const specialThemes = builtInThemes.filter(theme => getThemeCategory(theme) === 'special');
  const customThemes = themes.filter(t => t.isCustom);
  const activePack = getThemeEffectPack(currentTheme);
  const specialUiAvailable = getThemeCategory(currentTheme) === 'special';
  const sectionCopy = getThemeUiSectionsCopy(currentTheme);

  const handleThemeSelect = (theme: Theme) => {
    setTheme(theme);
  };

  const handleCreateTheme = () => {
    if (!newTheme.name?.trim()) {
      setDialogState({
        visible: true,
        title: 'Name Required',
        message: 'Please enter a name for your theme.',
        tone: 'warning',
        actions: [{ label: 'OK', onPress: () => setDialogState(null) }],
      });
      return;
    }

    const theme: Theme = {
      id: `custom_${Date.now()}`,
      name: newTheme.name.trim(),
      background: newTheme.background!,
      text: newTheme.text!,
      accent: newTheme.accent!,
      secondaryText: newTheme.secondaryText!,
      cardBackground: newTheme.cardBackground!,
      isDark:
        newTheme.background!.toLowerCase() === '#000000' ||
        newTheme.background!.toLowerCase() === '#1a1a1a' ||
        newTheme.background!.toLowerCase() === '#1e2430' ||
        newTheme.background!.toLowerCase() === '#1c1816',
      isCustom: true,
      category: 'normal',
      performanceHint: 'standard',
    };

    addCustomTheme(theme);
    setShowCreateModal(false);
    setNewTheme({
      name: '',
      background: '#F4EFE8',
      text: '#3A3228',
      accent: '#8B6F47',
      secondaryText: '#6B5D4D',
      cardBackground: '#FFFBF5',
      isDark: false,
    });
  };

  const handleDeleteCustomTheme = (theme: Theme) => {
    setDialogState({
      visible: true,
      title: 'Delete Theme',
      message: `Delete "${theme.name}"?`,
      tone: 'danger',
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => setDialogState(null) },
        {
          label: 'Delete',
          variant: 'danger',
          onPress: () => {
            removeCustomTheme(theme.id);
            setDialogState(null);
          },
        },
      ],
    });
  };

  const updateThemeColor = (
    key: 'background' | 'text' | 'accent',
    color: string
  ) => {
    const updates: Partial<Theme> = { [key]: color };

    // Auto-calculate secondary text and card background based on selection
    if (key === 'background') {
      // Determine if dark based on color
      const isDark = ['#000000', '#1a1a1a', '#1e2430', '#1c1816'].includes(
        color.toLowerCase()
      );
      updates.isDark = isDark;
      // Lighten for card background
      updates.cardBackground = isDark ? lightenColor(color, 0.1) : lightenColor(color, 0.03);
    }
    if (key === 'text') {
      updates.secondaryText = adjustOpacity(color, 0.7);
    }

    setNewTheme(prev => ({ ...prev, ...updates }));
    setActiveColorPicker(null);
  };

  const lightenColor = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.floor((num >> 16) + 255 * amount));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00ff) + 255 * amount));
    const b = Math.min(255, Math.floor((num & 0x0000ff) + 255 * amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  };

  const adjustOpacity = (hex: string, opacity: number): string => {
    // Simple opacity adjustment - blend with background
    return hex + Math.floor(opacity * 255).toString(16).padStart(2, '0');
  };

  // Bottom padding for tab bar
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

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
        <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
          Themes
        </ThemedText>
        <ThemedText variant="secondary" size="body" style={styles.subtitle}>
          Choose a reading theme that suits your mood
        </ThemedText>

        <View
          style={[
            styles.currentThemeCard,
            {
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.accent + '20',
            },
          ]}
        >
          <View style={{ flex: 1, gap: 8 }}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.currentThemeLabel}>
              CURRENT THEME
            </ThemedText>
            <ThemedText variant="primary" size="title" weight="bold">
              {currentTheme.name}
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.currentThemeCopy}>
              {getThemePerformanceHint(currentTheme)}
            </ThemedText>
            <View style={styles.currentThemeMeta}>
              <View style={[styles.metaChip, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '20' }]}>
                <ThemedText size="caption" weight="semibold" style={{ color: currentTheme.accent }}>
                  {getThemeCategory(currentTheme) === 'special'
                    ? readingSettings.specialThemeUiEnabled
                      ? 'Special UI Active'
                      : 'Special Palette Only'
                    : 'Normal UI'}
                </ThemedText>
              </View>
              <View style={[styles.metaChip, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '20' }]}>
                <ThemedText variant="secondary" size="caption" weight="semibold">
                  {currentTheme.isDark ? 'Dark' : 'Light'}
                </ThemedText>
              </View>
            </View>
          </View>
          {activePack ? (
            <Image source={activePack.hero} resizeMode="contain" style={styles.currentThemeArt} />
          ) : (
            <View style={[styles.currentThemeSwatch, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
              <View style={[styles.currentThemeLine, { backgroundColor: currentTheme.accent }]} />
              <View style={[styles.currentThemeLineShort, { backgroundColor: currentTheme.secondaryText + '70' }]} />
            </View>
          )}
        </View>

        {/* Normal Themes */}
        <View style={styles.section}>
          <ThemedText
            variant="secondary"
            size="caption"
            weight="medium"
            style={styles.sectionTitle}
          >
            NORMAL UI
          </ThemedText>
          <ThemedText variant="secondary" size="caption" style={styles.sectionDescription}>
            {sectionCopy.normal}
          </ThemedText>
          <View style={styles.themesGrid}>
            {normalThemes.map((theme, index) => (
              <Animated.View
                key={theme.id}
                entering={FadeIn.delay(index * 50)}
                layout={LinearTransition.duration(200)}
              >
                <ThemeCard
                  theme={theme}
                  isSelected={currentTheme.id === theme.id}
                  onSelect={() => handleThemeSelect(theme)}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.specialWarning,
            {
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.accent + '22',
            },
          ]}
        >
          <View style={styles.specialWarningHeader}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.specialWarningLabel}>
              SPECIAL UI
            </ThemedText>
            <PressableScale
              onPress={() => setShowThemeInfo(true)}
              style={[
                styles.helpButton,
                { backgroundColor: currentTheme.accent + '12', borderColor: currentTheme.accent + '28' },
              ]}
            >
              <ThemedText style={{ color: currentTheme.accent, fontSize: 16, fontWeight: '800' }}>
                ?
              </ThemedText>
            </PressableScale>
          </View>
          <ThemedText variant="primary" size="body" weight="semibold">
            Decorative themes use themed artwork and loading surfaces without a separate VFX boost mode.
          </ThemedText>
          <ThemedText variant="secondary" size="caption" style={styles.specialWarningCopy}>
            {sectionCopy.special}
          </ThemedText>
        </View>

        <View
          style={[
            styles.fxControlCard,
            {
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.accent + '20',
            },
          ]}
        >
          <ThemedText variant="accent" size="caption" weight="semibold" style={styles.specialWarningLabel}>
            SPECIAL UI CONTROLS
          </ThemedText>
          <ThemedText variant="secondary" size="caption" style={styles.specialWarningCopy}>
            Keep the special palette and switch the themed UI on or off without a separate VFX boost mode.
          </ThemedText>
          <View style={styles.fxButtonRow}>
            <PressableScale
              onPress={() => setReadingSettings({ specialThemeUiEnabled: !readingSettings.specialThemeUiEnabled })}
              style={[
                styles.fxButton,
                {
                  backgroundColor: readingSettings.specialThemeUiEnabled ? currentTheme.accent : currentTheme.background,
                  borderColor: readingSettings.specialThemeUiEnabled ? currentTheme.accent : currentTheme.secondaryText + '22',
                },
              ]}
            >
              <ThemedText
                style={{
                  color: readingSettings.specialThemeUiEnabled ? '#FFFFFF' : currentTheme.text,
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                {readingSettings.specialThemeUiEnabled ? 'Special UI On' : 'Special UI Off'}
              </ThemedText>
            </PressableScale>
          </View>
          <ThemedText variant="secondary" size="caption">
            {readingSettings.reducedMotion
              ? 'Reduced Motion is active, so decorative motion stays minimal.'
              : specialUiAvailable
                ? 'The current special theme will reflect these controls on splash, loading, and verification screens.'
                : 'Choose a special UI theme below to use the decorative layer.'}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText
            variant="secondary"
            size="caption"
            weight="medium"
            style={styles.sectionTitle}
          >
            SPECIAL UI
          </ThemedText>
          <View style={styles.themesGrid}>
            {specialThemes.map((theme, index) => (
              <Animated.View
                key={theme.id}
                entering={FadeIn.delay(index * 50)}
                layout={LinearTransition.duration(200)}
              >
                <ThemeCard
                  theme={theme}
                  isSelected={currentTheme.id === theme.id}
                  onSelect={() => handleThemeSelect(theme)}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Custom Themes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText
              variant="secondary"
              size="caption"
              weight="medium"
              style={styles.sectionTitle}
            >
              CUSTOM THEMES
            </ThemedText>
            <PressableScale
              onPress={() => setShowCreateModal(true)}
              style={[
                styles.addButton,
                { backgroundColor: currentTheme.accent + '20' },
              ]}
            >
              <Plus size={16} color={currentTheme.accent} />
              <ThemedText variant="accent" size="caption" weight="semibold">
                Create
              </ThemedText>
            </PressableScale>
          </View>

          {customThemes.length === 0 ? (
            <View
              style={[
                styles.emptyCustom,
                { backgroundColor: currentTheme.cardBackground },
              ]}
            >
              <ThemedText variant="secondary" size="body">
                No custom themes yet
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Create your own theme with custom colors
              </ThemedText>
            </View>
          ) : (
            <View style={styles.themesGrid}>
              {customThemes.map((theme, index) => (
                <Animated.View
                  key={theme.id}
                  entering={FadeIn.delay(index * 50)}
                  layout={LinearTransition.duration(200)}
                >
                  <ThemeCard
                    theme={theme}
                    isSelected={currentTheme.id === theme.id}
                    onSelect={() => handleThemeSelect(theme)}
                    onDelete={() => handleDeleteCustomTheme(theme)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        {/* Current Theme Preview */}
        <View style={styles.section}>
          <ThemedText
            variant="secondary"
            size="caption"
            weight="medium"
            style={styles.sectionTitle}
          >
            CURRENT THEME PREVIEW
          </ThemedText>
          <View
            style={[
              styles.previewCard,
              { backgroundColor: currentTheme.background },
            ]}
          >
            <View style={styles.previewContent}>
              <ThemedText variant="primary" size="header" weight="bold">
                {currentTheme.name}
              </ThemedText>
              <View style={styles.previewText}>
                <ThemedText variant="primary" size="body">
                  The quick brown fox jumps over the lazy dog.
                </ThemedText>
                <ThemedText variant="secondary" size="caption" style={styles.previewSecondary}>
                  Secondary text appears like this.
                </ThemedText>
                <View style={styles.previewAccentRow}>
                  <View
                    style={[
                      styles.previewAccentBar,
                      { backgroundColor: currentTheme.accent },
                    ]}
                  />
                <ThemedText variant="accent" size="caption" weight="semibold">
                    {getThemeCategory(currentTheme) === 'special' ? 'Special Theme Active' : 'Accent Color'}
                  </ThemedText>
                </View>
                <ThemedText variant="secondary" size="caption" style={styles.previewSecondary}>
                  {getThemeCategory(currentTheme) === 'special'
                    ? 'Ambient ornaments appear on splash, loading, and verification screens.'
                    : 'Standard themes stay static for maximum reading performance.'}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Create Theme Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: currentTheme.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <PressableScale onPress={() => setShowCreateModal(false)}>
              <X size={24} color={currentTheme.secondaryText} />
            </PressableScale>
            <ThemedText variant="primary" size="header" weight="semibold">
              Create Theme
            </ThemedText>
            <PressableScale onPress={handleCreateTheme}>
              <Check size={24} color={currentTheme.accent} />
            </PressableScale>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
          >
            {/* Theme Name */}
            <View style={styles.inputGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.inputLabel}
              >
                THEME NAME
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: currentTheme.cardBackground,
                    color: currentTheme.text,
                    borderColor: currentTheme.secondaryText + '30',
                  },
                ]}
                placeholder="My Custom Theme"
                placeholderTextColor={currentTheme.secondaryText}
                value={newTheme.name}
                onChangeText={name => setNewTheme(prev => ({ ...prev, name }))}
              />
            </View>

            {/* Color Pickers */}
            {(['background', 'text', 'accent'] as const).map(colorKey => (
              <View key={colorKey} style={styles.inputGroup}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.inputLabel}
                >
                  {colorKey.toUpperCase()} COLOR
                </ThemedText>
                <PressableScale
                  onPress={() =>
                    setActiveColorPicker(
                      activeColorPicker === colorKey ? null : colorKey
                    )
                  }
                  style={[
                    styles.colorSelector,
                    {
                      backgroundColor: currentTheme.cardBackground,
                      borderColor: currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: newTheme[colorKey] },
                    ]}
                  />
                  <ThemedText variant="primary" size="body">
                    {newTheme[colorKey]}
                  </ThemedText>
                </PressableScale>

                {activeColorPicker === colorKey && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.colorPalette}
                  >
                    {colorPresets.map(color => (
                      <PressableScale
                        key={color}
                        onPress={() => updateThemeColor(colorKey, color)}
                        style={[
                          styles.paletteColor,
                          { backgroundColor: color },
                          ...(newTheme[colorKey] === color ? [styles.selectedColor] : []),
                        ]}
                      />
                    ))}
                  </Animated.View>
                )}
              </View>
            ))}

            {/* Live Preview */}
            <View style={styles.inputGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.inputLabel}
              >
                PREVIEW
              </ThemedText>
              <View
                style={[
                  styles.livePreview,
                  { backgroundColor: newTheme.background },
                ]}
              >
                <View style={[styles.previewLine1, { backgroundColor: newTheme.text }]} />
                <View
                  style={[styles.previewLine2, { backgroundColor: newTheme.text + '80' }]}
                />
                <View
                  style={[styles.previewLine3, { backgroundColor: newTheme.text + '60' }]}
                />
                <View
                  style={[styles.previewAccent, { backgroundColor: newTheme.accent }]}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <AppDialog
        visible={!!dialogState?.visible}
        title={dialogState?.title || ''}
        message={dialogState?.message || ''}
        tone={dialogState?.tone}
        actions={dialogState?.actions || [{ label: 'OK', onPress: () => setDialogState(null) }]}
        onClose={() => setDialogState(null)}
      />
      <AppDialog
        visible={showThemeInfo}
        title="Normal UI vs Special UI"
        message="Normal UI keeps the palette static. Special UI adds themed artwork, loading surfaces, and optional decorative motion."
        actions={[{ label: 'Close', onPress: () => setShowThemeInfo(false) }]}
        onClose={() => setShowThemeInfo(false)}
      >
        <View style={styles.infoStack}>
          <View style={[styles.infoCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.specialWarningLabel}>
              NORMAL UI
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.specialWarningCopy}>
              Best for low-end phones and the cleanest reading surface. No decorative motion, only the palette.
            </ThemedText>
          </View>
          <View style={[styles.infoCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.specialWarningLabel}>
              SPECIAL UI
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.specialWarningCopy}>
              Adds blossom, coffee, parchment, or matcha artwork while keeping the motion layer restrained.
            </ThemedText>
          </View>
        </View>
      </AppDialog>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  currentThemeCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  currentThemeLabel: {
    letterSpacing: 1.1,
  },
  currentThemeCopy: {
    lineHeight: 19,
  },
  currentThemeMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  currentThemeArt: {
    width: 108,
    height: 108,
    opacity: 0.94,
  },
  currentThemeSwatch: {
    width: 96,
    height: 96,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  currentThemeLine: {
    width: 44,
    height: 10,
    borderRadius: 999,
  },
  currentThemeLineShort: {
    width: 28,
    height: 8,
    borderRadius: 999,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionDescription: {
    marginTop: -6,
    marginBottom: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCustom: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  previewCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewContent: {
    padding: 20,
  },
  previewText: {
    marginTop: 12,
  },
  previewSecondary: {
    marginTop: 8,
  },
  previewAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  specialWarning: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 26,
    gap: 6,
  },
  specialWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  specialWarningLabel: {
    letterSpacing: 1.1,
  },
  specialWarningCopy: {
    lineHeight: 19,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxControlCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 26,
    gap: 10,
  },
  fxButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fxButton: {
    minWidth: 140,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAccentBar: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  colorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  paletteColor: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  livePreview: {
    height: 120,
    borderRadius: 10,
    padding: 16,
  },
  previewLine1: {
    width: '50%',
    height: 10,
    borderRadius: 5,
    marginBottom: 12,
  },
  previewLine2: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  previewLine3: {
    width: '60%',
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
  },
  previewAccent: {
    width: 40,
    height: 6,
    borderRadius: 3,
  },
  infoStack: {
    gap: 12,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
});
