import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { AppDialog } from '@/components/ui/AppDialog';
import { ThemeCard } from '@/components/themes/ThemeCard';
import { Theme } from '@/types/theme';
import {
  getThemeCategory,
  getThemeEffectPack,
  getThemePerformanceHint,
  getThemeUiSectionsCopy,
  isSpecialTheme,
} from '@/utils/theme-effects';
import { X, Palette } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemePickerModal({ visible, onClose }: ThemePickerModalProps) {
  const { currentTheme, setTheme, themes, readingSettings, setReadingSettings } = useTheme();
  const insets = useSafeAreaInsets();
  const [showInfo, setShowInfo] = useState(false);

  const builtInThemes = useMemo(() => themes.filter(theme => !theme.isCustom), [themes]);
  const normalThemes = useMemo(
    () => builtInThemes.filter(theme => getThemeCategory(theme) === 'normal'),
    [builtInThemes]
  );
  const specialThemes = useMemo(
    () => builtInThemes.filter(theme => getThemeCategory(theme) === 'special'),
    [builtInThemes]
  );
  const customThemes = useMemo(() => themes.filter(theme => theme.isCustom), [themes]);

  const activePack = getThemeEffectPack(currentTheme);
  const sectionCopy = getThemeUiSectionsCopy(currentTheme);
  const specialUiAvailable = isSpecialTheme(currentTheme);
  const specialUiEnabled = specialUiAvailable && readingSettings.specialThemeUiEnabled;

  const handleThemeSelect = (theme: Theme) => {
    setTheme(theme);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: currentTheme.background },
        ]}
      >
        <View
          style={[
            styles.header,
            { borderBottomColor: currentTheme.secondaryText + '15' },
          ]}
        >
          <View style={styles.headerLeft}>
            <Palette size={22} color={currentTheme.accent} />
            <View>
              <ThemedText variant="primary" size="header" weight="bold">
                Theme Selection
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Split between Normal UI and Special UI
              </ThemedText>
            </View>
          </View>
          <View style={styles.headerActions}>
            <PressableScale
              onPress={() => setShowInfo(true)}
              style={[
                styles.infoButton,
                { backgroundColor: currentTheme.accent + '12', borderColor: currentTheme.accent + '28' },
              ]}
            >
              <ThemedText style={{ color: currentTheme.accent, fontSize: 18, fontWeight: '800' }}>
                ?
              </ThemedText>
            </PressableScale>
            <PressableScale
              onPress={onClose}
              style={[
                styles.closeButton,
                { backgroundColor: currentTheme.secondaryText + '15' },
              ]}
            >
              <X size={20} color={currentTheme.text} />
            </PressableScale>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.currentCard,
              { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.accent + '22' },
            ]}
          >
            <View style={styles.currentCopy}>
              <ThemedText variant="accent" size="caption" weight="semibold" style={styles.cardKicker}>
                ACTIVE UI PROFILE
              </ThemedText>
              <ThemedText variant="primary" size="title" weight="bold">
                {currentTheme.name}
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={styles.performanceCopy}>
                {getThemePerformanceHint(currentTheme)}
              </ThemedText>
              <View style={styles.statusRow}>
                <View style={[styles.statusChip, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '18' }]}>
                  <ThemedText size="caption" weight="semibold" style={{ color: currentTheme.accent }}>
                    {getThemeCategory(currentTheme) === 'special'
                      ? specialUiEnabled
                        ? 'Special UI Active'
                        : 'Special Palette Only'
                      : 'Normal UI'}
                  </ThemedText>
                </View>
              </View>
            </View>
            {activePack ? (
              <Image source={activePack.hero} resizeMode="contain" style={styles.currentArt} />
            ) : (
              <View style={[styles.staticSwatch, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '18' }]}>
                <View style={[styles.staticLine, { backgroundColor: currentTheme.accent }]} />
                <View style={[styles.staticLineSmall, { backgroundColor: currentTheme.secondaryText + '5A' }]} />
              </View>
            )}
          </View>

          <View
            style={[
              styles.fxCard,
              { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.accent + '18' },
            ]}
          >
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.cardKicker}>
              SPECIAL UI CONTROLS
            </ThemedText>
            <ThemedText variant="primary" size="body" weight="semibold">
              Decorative UI is separate from the palette.
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.fxCopy}>
              Use Special UI for themed ornaments and loading surfaces without the heavier animated boost layer.
            </ThemedText>
            <View style={styles.fxActions}>
              <PressableScale
                onPress={() => setReadingSettings({ specialThemeUiEnabled: !readingSettings.specialThemeUiEnabled })}
                style={[
                  styles.fxToggle,
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
                  ? 'Current special theme will use these controls immediately.'
                  : 'Select a special UI theme below to see the full decorative layer.'}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionTitle}>
              NORMAL UI
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.sectionCopy}>
              {sectionCopy.normal}
            </ThemedText>
            <View style={styles.grid}>
              {normalThemes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isSelected={currentTheme.id === theme.id}
                  onSelect={() => handleThemeSelect(theme)}
                />
              ))}
            </View>
          </View>

          <View
            style={[
              styles.specialBanner,
              { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.accent + '22' },
            ]}
          >
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.cardKicker}>
              SPECIAL UI
            </ThemedText>
            <ThemedText variant="primary" size="body" weight="semibold">
              Themed surfaces and stronger loading art without a separate VFX boost mode.
            </ThemedText>
            <ThemedText variant="secondary" size="caption" style={styles.sectionCopy}>
              {sectionCopy.special}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionTitle}>
              SPECIAL UI
            </ThemedText>
            <View style={styles.grid}>
              {specialThemes.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isSelected={currentTheme.id === theme.id}
                  onSelect={() => handleThemeSelect(theme)}
                />
              ))}
            </View>
          </View>

          {customThemes.length > 0 ? (
            <View style={styles.section}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.sectionTitle}>
                CUSTOM THEMES
              </ThemedText>
              <View style={styles.grid}>
                {customThemes.map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={currentTheme.id === theme.id}
                    onSelect={() => handleThemeSelect(theme)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <AppDialog
          visible={showInfo}
          title="Normal UI vs Special UI"
          message="Normal UI keeps the palette static. Special UI adds themed artwork, loading surfaces, and optional decorative motion."
          actions={[{ label: 'Close', onPress: () => setShowInfo(false) }]}
          onClose={() => setShowInfo(false)}
        >
          <View style={styles.infoStack}>
            <View style={[styles.infoCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
              <ThemedText variant="accent" size="caption" weight="semibold" style={styles.cardKicker}>
                NORMAL UI
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={styles.sectionCopy}>
                Minimal visual overhead. Best for low-end devices, long reading sessions, and the cleanest screen.
              </ThemedText>
            </View>
            <View style={[styles.infoCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
              <ThemedText variant="accent" size="caption" weight="semibold" style={styles.cardKicker}>
                SPECIAL UI
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={styles.sectionCopy}>
                Adds ornament art and themed splash/loading surfaces while keeping decorative motion restrained.
              </ThemedText>
            </View>
          </View>
        </AppDialog>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 18,
  },
  currentCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentCopy: {
    flex: 1,
    gap: 8,
  },
  cardKicker: {
    letterSpacing: 1.1,
  },
  performanceCopy: {
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  currentArt: {
    width: 108,
    height: 108,
    opacity: 0.94,
  },
  staticSwatch: {
    width: 96,
    height: 96,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  staticLine: {
    width: 44,
    height: 10,
    borderRadius: 999,
  },
  staticLineSmall: {
    width: 28,
    height: 8,
    borderRadius: 999,
  },
  fxCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  fxCopy: {
    lineHeight: 18,
  },
  fxActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fxToggle: {
    minWidth: 140,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    letterSpacing: 1,
  },
  sectionCopy: {
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialBanner: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  infoStack: {
    gap: 12,
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
});
