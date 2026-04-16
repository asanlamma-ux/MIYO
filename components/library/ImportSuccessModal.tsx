import React from 'react';
import { View, StyleSheet, Modal, Pressable, ScrollView, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { CheckCircle2, X, BookHeart } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { BlurView } from 'expo-blur';

type Props = {
  visible: boolean;
  titles: string[];
  failedCount?: number;
  skippedExactCount?: number;
  skippedProbableCount?: number;
  onClose: () => void;
};

export function ImportSuccessModal({
  visible,
  titles,
  failedCount = 0,
  skippedExactCount = 0,
  skippedProbableCount = 0,
  onClose,
}: Props) {
  const { currentTheme } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={Platform.OS === 'ios' ? 30 : 60} tint={currentTheme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.card,
            {
              backgroundColor: currentTheme.cardBackground + 'E6', // slightly transparent glass
              borderColor: currentTheme.secondaryText + '25',
              shadowColor: currentTheme.accent,
            },
          ]}
        >
          <PressableScale onPress={onClose} style={styles.closeBtn}>
            <View style={[styles.closeBg, { backgroundColor: currentTheme.secondaryText + '15' }]}>
              <X size={18} color={currentTheme.secondaryText} strokeWidth={2.5} />
            </View>
          </PressableScale>

          <View style={styles.headerArea}>
            <Animated.View
              entering={SlideInUp.delay(80).duration(220)}
              style={[styles.iconWrap, { backgroundColor: currentTheme.accent + '20' }]}
            >
              <CheckCircle2 size={46} color={currentTheme.accent} strokeWidth={2.2} />
            </Animated.View>

            <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
              Success!
            </ThemedText>
            <ThemedText variant="secondary" size="body" style={styles.subtitle}>
              {titles.length === 1
                ? 'Your book is ready to read.'
                : `${titles.length} books added to your library.`}
              {failedCount > 0 ? `\nNote: ${failedCount} file(s) could not be imported.` : ''}
              {skippedExactCount > 0 ? `\nSkipped ${skippedExactCount} exact duplicate(s).` : ''}
              {skippedProbableCount > 0 ? `\nSkipped ${skippedProbableCount} probable duplicate(s).` : ''}
            </ThemedText>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {titles.map((t, i) => (
              <Animated.View
                key={`${t}-${i}`}
                entering={FadeIn.delay(200 + i * 50).duration(300)}
                style={[
                  styles.listRow,
                  { backgroundColor: currentTheme.background + '80', borderColor: currentTheme.secondaryText + '15' }
                ]}
              >
                <View style={[styles.bookIconBg, { backgroundColor: currentTheme.accent + '15' }]}>
                  <BookHeart size={20} color={currentTheme.accent} />
                </View>
                <ThemedText variant="primary" size="body" weight="medium" numberOfLines={2} style={styles.bookTitleText}>
                  {t}
                </ThemedText>
              </Animated.View>
            ))}
          </ScrollView>

          <PressableScale
            onPress={onClose}
            style={[styles.primaryBtn, { backgroundColor: currentTheme.accent }]}
          >
            <ThemedText style={styles.primaryBtnText}>Let's Read</ThemedText>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    maxHeight: Platform.OS === 'web' ? '80%' : '75%',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    padding: 4,
  },
  closeBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.9,
  },
  list: {
    maxHeight: 240,
    marginBottom: 24,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  bookIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitleText: {
    flex: 1,
    lineHeight: 20,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
