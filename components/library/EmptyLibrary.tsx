import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { BookOpen, Plus, FolderOpen } from 'lucide-react-native';

interface EmptyLibraryProps {
  onImport: () => void;
}

export function EmptyLibrary({ onImport }: EmptyLibraryProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.content}>
        <View style={styles.illustration}>
          <View style={styles.bookStack}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.stackBook,
                  {
                    backgroundColor: currentTheme.accent + (i === 0 ? 'DD' : i === 1 ? 'AA' : '66'),
                    transform: [
                      { rotate: `${(i - 1) * 8}deg` },
                      { translateX: (i - 1) * 8 },
                    ],
                  },
                ]}
              >
                <View style={[styles.stackBookSpine, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
              </View>
            ))}
          </View>

          <View style={[styles.iconRing, { backgroundColor: currentTheme.accent + '20', borderColor: currentTheme.accent + '30' }]}>
            <BookOpen size={36} color={currentTheme.accent} />
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
            Your library is empty
          </ThemedText>
          <ThemedText variant="secondary" size="body" style={styles.description}>
            Import your EPUB books to start reading. Books are stored securely on your device for offline access.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.actions}>
          <PressableScale
            onPress={onImport}
            style={[styles.primaryButton, { backgroundColor: currentTheme.accent }]}
          >
            <Plus size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Import EPUB Books</ThemedText>
          </PressableScale>

          <View style={styles.hintRow}>
            <FolderOpen size={14} color={currentTheme.secondaryText} />
            <ThemedText variant="secondary" size="caption">Supports .epub format</ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.features}>
          {[
            { icon: '📚', text: 'Full EPUB 2 & 3 support' },
            { icon: '🎨', text: 'Customizable themes & typography' },
            { icon: '🔖', text: 'Bookmarks, highlights & notes' },
          ].map((feature, i) => (
            <View key={i} style={[styles.featureRow, { backgroundColor: currentTheme.cardBackground }]}>
              <ThemedText style={styles.featureIcon}>{feature.icon}</ThemedText>
              <ThemedText variant="secondary" size="body">{feature.text}</ThemedText>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 360,
  },
  illustration: {
    position: 'relative',
    width: 140,
    height: 140,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookStack: {
    position: 'absolute',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackBook: {
    position: 'absolute',
    width: 70,
    height: 88,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  stackBookSpine: {
    width: 5,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  features: {
    width: '100%',
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
});
