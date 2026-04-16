import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedAmbientBackdrop } from '@/components/ui/ThemedAmbientBackdrop';
import { getThemeCategory, getThemeSceneCopy } from '@/utils/theme-effects';

interface SplashScreenProps {
  onComplete?: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { currentTheme, readingSettings } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const riseAnim = React.useRef(new Animated.Value(10)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const category = getThemeCategory(currentTheme);
  const splashCopy = getThemeSceneCopy(currentTheme, 'splash', {
    intense: readingSettings.specialThemeVfxBoost,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(riseAnim, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1850,
      useNativeDriver: false,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start(() => onComplete?.());
    });
  }, [fadeAnim, onComplete, progressAnim, riseAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['12%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: currentTheme.background, opacity: fadeAnim }]}> 
      <ThemedAmbientBackdrop variant="splash" />

      <Animated.View
        style={[
          styles.content,
          {
            backgroundColor: currentTheme.cardBackground + 'E8',
            borderColor: currentTheme.secondaryText + '18',
            transform: [{ translateY: riseAnim }],
          },
        ]}
      >
        <View style={[styles.logoSeal, { backgroundColor: currentTheme.accent + '18', borderColor: currentTheme.accent + '35' }]}> 
          <BookOpen size={40} color={currentTheme.accent} />
        </View>

        <ThemedText style={styles.appName} size="title" weight="bold">
          Miyo
        </ThemedText>

        <ThemedText variant="secondary" style={styles.tagline} size="body">
          {category === 'special' ? splashCopy : 'Opening your reading library'}
        </ThemedText>

        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: currentTheme.secondaryText + '16' }]}> 
            <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: currentTheme.accent }]} />
          </View>
          <ThemedText variant="secondary" style={styles.loadingText} size="caption">
            {category === 'special' && readingSettings.specialThemeVfxBoost
              ? 'Loading books, theme art, and boosted effects...'
              : 'Loading books, themes, and reading state...'}
          </ThemedText>
        </View>
      </Animated.View>

      <ThemedText style={[styles.version, { color: currentTheme.secondaryText + 'B0' }]} size="caption">
        Version 1.0.0
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    overflow: 'hidden',
  },
  content: {
    width: '82%',
    maxWidth: 340,
    minHeight: 260,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 12,
  },
  logoSeal: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  appName: {
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  tagline: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  loadingText: {
    marginTop: 14,
    textAlign: 'center',
  },
  version: {
    position: 'absolute',
    bottom: 42,
  },
});
