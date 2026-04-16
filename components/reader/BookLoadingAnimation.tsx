import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedAmbientBackdrop } from '@/components/ui/ThemedAmbientBackdrop';
import { getThemeCategory, getThemeSceneCopy } from '@/utils/theme-effects';

interface BookLoadingAnimationProps {
  title?: string;
}

export function BookLoadingAnimation({ title }: BookLoadingAnimationProps) {
  const { currentTheme, readingSettings } = useTheme();
  const pulse = useSharedValue(0);
  const progress = useSharedValue(0);
  const category = getThemeCategory(currentTheme);
  const loadingCopy = getThemeSceneCopy(currentTheme, 'loading', {
    intense: readingSettings.specialThemeVfxBoost,
  });

  useEffect(() => {
    if (readingSettings.reducedMotion) {
      pulse.value = 0.4;
      progress.value = 0.68;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.14, { duration: 0 })
      ),
      -1,
      false
    );
  }, [pulse, progress, readingSettings.reducedMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.985, 1.02]) }],
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.12, 0.2]),
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [18, 94])}%`,
    opacity: interpolate(progress.value, [0, 1], [0.45, 1]),
  }));

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}> 
      <ThemedAmbientBackdrop variant="loading" />

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: currentTheme.cardBackground + 'F2',
            borderColor: currentTheme.accent + '24',
            shadowColor: currentTheme.accent,
          },
          cardStyle,
        ]}
      >
        <View style={[styles.badge, { backgroundColor: currentTheme.accent + '16', borderColor: currentTheme.accent + '2A' }]} />
        <View style={[styles.line, styles.linePrimary, { backgroundColor: currentTheme.accent + '3F' }]} />
        <View style={[styles.line, styles.lineSecondary, { backgroundColor: currentTheme.secondaryText + '24' }]} />
        <View style={[styles.line, styles.lineTertiary, { backgroundColor: currentTheme.secondaryText + '18' }]} />
      </Animated.View>

      <View style={styles.textWrap}>
        <ThemedText variant="primary" size="body" weight="semibold" style={styles.loadingText}>
          {title ? `Opening "${title}"` : 'Opening book'}
        </ThemedText>
        <ThemedText variant="secondary" size="caption" style={styles.caption}>
          {category === 'special'
            ? loadingCopy
            : 'Preparing chapters, highlights, and reading position.'}
        </ThemedText>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: currentTheme.secondaryText + '14' }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: currentTheme.accent }, progressFillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  card: {
    width: 188,
    minHeight: 198,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 26,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 28,
    elevation: 14,
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    marginBottom: 24,
  },
  line: {
    borderRadius: 999,
    height: 10,
    marginBottom: 14,
  },
  linePrimary: {
    width: '72%',
    height: 12,
  },
  lineSecondary: {
    width: '56%',
  },
  lineTertiary: {
    width: '42%',
  },
  textWrap: {
    marginTop: 28,
    alignItems: 'center',
    gap: 8,
    maxWidth: 320,
  },
  loadingText: {
    textAlign: 'center',
  },
  caption: {
    textAlign: 'center',
    lineHeight: 20,
  },
  progressTrack: {
    width: '72%',
    maxWidth: 260,
    height: 8,
    borderRadius: 999,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
