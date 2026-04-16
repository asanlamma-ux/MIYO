import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import * as Brightness from 'expo-brightness';
import Slider from '@react-native-community/slider';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import {
  type ContentColumnWidth,
  type MarginPreset,
  type ReaderColumnLayout,
  type TapZoneNavMode,
} from '@/types/theme';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  X,
  Sun,
  Columns,
  AlignHorizontalSpaceAround,
  Sparkles,
  Monitor,
  ChevronsDown,
  LayoutGrid,
  Hand,
  Moon,
} from 'lucide-react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MARGIN_OPTIONS: { id: MarginPreset; label: string }[] = [
  { id: 'narrow', label: 'Narrow' },
  { id: 'medium', label: 'Medium' },
  { id: 'wide', label: 'Wide' },
];

const COLUMN_OPTIONS: { id: ContentColumnWidth; label: string }[] = [
  { id: null, label: 'Full' },
  { id: 560, label: 'Compact' },
  { id: 640, label: 'Standard' },
  { id: 720, label: 'Comfort' },
  { id: 840, label: 'Wide' },
];

const TEXT_COLUMN_LAYOUT: { id: ReaderColumnLayout; label: string; hint: string }[] = [
  { id: 'single', label: 'Single', hint: 'One column of text' },
  { id: 'two', label: 'Two', hint: 'Two columns on wide screens' },
];

const AUTO_SCROLL_OPTIONS: { speed: number; label: string }[] = [
  { speed: 0, label: 'Off' },
  { speed: 1, label: 'Slow' },
  { speed: 2, label: 'Calm' },
  { speed: 3, label: 'Med' },
  { speed: 4, label: 'Fast' },
  { speed: 5, label: 'Max' },
];

const TAP_ZONE_MODE: { id: TapZoneNavMode; label: string; hint: string }[] = [
  { id: 'scroll', label: 'Scroll', hint: 'Turn pages in the chapter' },
  { id: 'chapter', label: 'Chapters', hint: 'Jump to previous / next chapter' },
];

const SLEEP_OPTIONS: { min: number; label: string }[] = [
  { min: 0, label: 'Off' },
  { min: 15, label: '15m' },
  { min: 30, label: '30m' },
  { min: 45, label: '45m' },
  { min: 60, label: '1h' },
];

export function ReaderLayoutPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { currentTheme, readingSettings, setReadingSettings } = useTheme();
  const savedBrightness = useRef<number | null>(null);
  const [brightness, setBrightnessState] = useState(0.65);
  const [brightnessReady, setBrightnessReady] = useState(false);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        const ok = await Brightness.isAvailableAsync();
        if (!ok || cancelled) {
          setBrightnessReady(false);
          return;
        }
        await Brightness.requestPermissionsAsync().catch(() => null);
        const b = await Brightness.getBrightnessAsync();
        if (!cancelled) {
          savedBrightness.current = b;
          setBrightnessState(b);
          setBrightnessReady(true);
        }
      } catch {
        setBrightnessReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const restoreBrightness = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      if (Platform.OS === 'android') {
        await Brightness.restoreSystemBrightnessAsync();
      } else if (savedBrightness.current != null) {
        await Brightness.setBrightnessAsync(savedBrightness.current);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!visible) restoreBrightness();
  }, [visible, restoreBrightness]);

  const onBrightnessChange = async (v: number) => {
    setBrightnessState(v);
    if (Platform.OS === 'web' || !brightnessReady) return;
    try {
      await Brightness.setBrightnessAsync(v);
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <>
      <Pressable style={styles.overlay} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={[
          styles.panel,
          {
            backgroundColor: currentTheme.cardBackground,
            paddingBottom: insets.bottom + 20,
            borderTopColor: currentTheme.secondaryText + '22',
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerTitle}>
              <Columns size={22} color={currentTheme.accent} />
              <ThemedText variant="primary" size="header" weight="bold">
                Layout & display
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                Similar to Koodo-style reading controls
              </ThemedText>
            </View>
            <PressableScale onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>
 
          <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <AlignHorizontalSpaceAround size={16} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption" weight="semibold">
              MARGINS
            </ThemedText>
          </View>
          <View style={styles.chipRow}>
            {MARGIN_OPTIONS.map(opt => {
              const active = readingSettings.marginPreset === opt.id;
              return (
                <PressableScale
                  key={opt.id}
                  onPress={() => setReadingSettings({ marginPreset: opt.id })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.background,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <ThemedText variant={active ? 'accent' : 'primary'} size="caption" weight={active ? 'semibold' : 'regular'}>
                    {opt.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <Columns size={16} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption" weight="semibold">
              COLUMN WIDTH
            </ThemedText>
          </View>
          <View style={styles.chipRowWrap}>
            {COLUMN_OPTIONS.map(opt => {
              const active = readingSettings.contentColumnWidth === opt.id;
              return (
                <PressableScale
                  key={String(opt.id)}
                  onPress={() => setReadingSettings({ contentColumnWidth: opt.id })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.background,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <ThemedText variant={active ? 'accent' : 'primary'} size="caption" weight={active ? 'semibold' : 'regular'}>
                    {opt.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <LayoutGrid size={16} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption" weight="semibold">
              TEXT COLUMNS
            </ThemedText>
          </View>
          <ThemedText variant="secondary" size="caption" style={{ marginBottom: 10, opacity: 0.9 }}>
            Magazine-style layout; phones stay single column.
          </ThemedText>
          <View style={styles.chipRow}>
            {TEXT_COLUMN_LAYOUT.map(opt => {
              const active = readingSettings.columnLayout === opt.id;
              return (
                <PressableScale
                  key={opt.id}
                  onPress={() => setReadingSettings({ columnLayout: opt.id })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.background,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <ThemedText variant={active ? 'accent' : 'primary'} size="caption" weight={active ? 'semibold' : 'regular'}>
                    {opt.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <ChevronsDown size={16} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption" weight="semibold">
              AUTO SCROLL
            </ThemedText>
          </View>
          <ThemedText variant="secondary" size="caption" style={{ marginBottom: 10, opacity: 0.9 }}>
            Hands-free scrolling while you read.
          </ThemedText>
          <View style={styles.chipRowWrap}>
            {AUTO_SCROLL_OPTIONS.map(opt => {
              const active = readingSettings.autoScrollSpeed === opt.speed;
              return (
                <PressableScale
                  key={opt.speed}
                  onPress={() => setReadingSettings({ autoScrollSpeed: opt.speed })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.background,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <ThemedText variant={active ? 'accent' : 'primary'} size="caption" weight={active ? 'semibold' : 'regular'}>
                    {opt.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <Hand size={16} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption" weight="semibold">
              SIDE TAP & SWIPE
            </ThemedText>
          </View>
          <ThemedText variant="secondary" size="caption" style={{ marginBottom: 10, opacity: 0.9 }}>
            Left/right edges: scroll the page (default) or change chapter.
          </ThemedText>
          <View style={styles.chipRow}>
            {TAP_ZONE_MODE.map(opt => {
              const active = readingSettings.tapZoneNavMode === opt.id;
              return (
                <PressableScale
                  key={opt.id}
                  onPress={() => setReadingSettings({ tapZoneNavMode: opt.id })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.background,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <ThemedText variant={active ? 'accent' : 'primary'} size="caption" weight={active ? 'semibold' : 'regular'}>
                    {opt.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
          {readingSettings.tapZoneNavMode === 'scroll' && (
            <View style={{ marginTop: 12 }}>
              <ThemedText variant="secondary" size="caption" weight="semibold" style={{ marginBottom: 8 }}>
                Scroll distance · {Math.round(readingSettings.tapScrollPageRatio * 100)}% of screen
              </ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={0.45}
                maximumValue={0.95}
                step={0.05}
                value={readingSettings.tapScrollPageRatio}
                onValueChange={v => setReadingSettings({ tapScrollPageRatio: Math.round(v * 100) / 100 })}
                minimumTrackTintColor={currentTheme.accent}
                maximumTrackTintColor={currentTheme.secondaryText + '35'}
                thumbTintColor={currentTheme.accent}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <Moon size={16} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption" weight="semibold">
              SLEEP TIMER
            </ThemedText>
          </View>
          <ThemedText variant="secondary" size="caption" style={{ marginBottom: 10, opacity: 0.9 }}>
            Reminder when time is up (while this book is open).
          </ThemedText>
          <View style={styles.chipRowWrap}>
            {SLEEP_OPTIONS.map(opt => {
              const active = readingSettings.sleepTimerMinutes === opt.min;
              return (
                <PressableScale
                  key={opt.min}
                  onPress={() => setReadingSettings({ sleepTimerMinutes: opt.min })}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? currentTheme.accent + '22' : currentTheme.background,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '30',
                    },
                  ]}
                >
                  <ThemedText variant={active ? 'accent' : 'primary'} size="caption" weight={active ? 'semibold' : 'regular'}>
                    {opt.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <PressableScale
            onPress={() => setReadingSettings({ bionicReading: !readingSettings.bionicReading })}
            style={[
              styles.toggleRow,
              {
                backgroundColor: currentTheme.background,
                borderColor: readingSettings.bionicReading ? currentTheme.accent : currentTheme.secondaryText + '25',
              },
            ]}
          >
            <View style={styles.toggleLeft}>
              <Sparkles size={20} color={readingSettings.bionicReading ? currentTheme.accent : currentTheme.secondaryText} />
              <View>
                <ThemedText variant="primary" size="body" weight="semibold">
                  Bionic reading
                </ThemedText>
                <ThemedText variant="secondary" size="caption">
                  Emphasize the start of longer words
                </ThemedText>
              </View>
            </View>
            <View
              style={[
                styles.pill,
                { backgroundColor: readingSettings.bionicReading ? currentTheme.accent : currentTheme.secondaryText + '35' },
              ]}
            >
              <ThemedText size="caption" weight="bold" style={{ color: '#FFF' }}>
                {readingSettings.bionicReading ? 'ON' : 'OFF'}
              </ThemedText>
            </View>
          </PressableScale>
        </View>

        <View style={styles.section}>
          <PressableScale
            onPress={() => setReadingSettings({ keepScreenOn: !readingSettings.keepScreenOn })}
            style={[
              styles.toggleRow,
              {
                backgroundColor: currentTheme.background,
                borderColor: readingSettings.keepScreenOn ? currentTheme.accent : currentTheme.secondaryText + '25',
              },
            ]}
          >
            <View style={styles.toggleLeft}>
              <Monitor size={20} color={readingSettings.keepScreenOn ? currentTheme.accent : currentTheme.secondaryText} />
              <View>
                <ThemedText variant="primary" size="body" weight="semibold">
                  Keep screen on
                </ThemedText>
                <ThemedText variant="secondary" size="caption">
                  While this book is open
                </ThemedText>
              </View>
            </View>
            <View
              style={[
                styles.pill,
                { backgroundColor: readingSettings.keepScreenOn ? currentTheme.accent : currentTheme.secondaryText + '35' },
              ]}
            >
              <ThemedText size="caption" weight="bold" style={{ color: '#FFF' }}>
                {readingSettings.keepScreenOn ? 'ON' : 'OFF'}
              </ThemedText>
            </View>
          </PressableScale>
        </View>

        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <Sun size={16} color={currentTheme.secondaryText} />
              <ThemedText variant="secondary" size="caption" weight="semibold">
                SCREEN BRIGHTNESS
              </ThemedText>
            </View>
            {!brightnessReady ? (
              <ThemedText variant="secondary" size="caption" style={{ marginTop: 6 }}>
                Grant brightness permission in system settings to adjust from here.
              </ThemedText>
            ) : (
              <Slider
                style={styles.slider}
                minimumValue={0.15}
                maximumValue={1}
                value={brightness}
                onValueChange={onBrightnessChange}
                minimumTrackTintColor={currentTheme.accent}
                maximumTrackTintColor={currentTheme.secondaryText + '35'}
                thumbTintColor={currentTheme.accent}
              />
            )}
          </View>
        )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 400,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 410,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  headerTitle: { flex: 1, gap: 4 },
  closeBtn: { padding: 6 },
  section: { marginBottom: 18 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  slider: { width: '100%', height: 40, marginTop: 4 },
});
