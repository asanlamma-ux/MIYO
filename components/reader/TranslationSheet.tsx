import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Languages } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { translateTextFree } from '@/utils/inline-translate';

type Props = {
  visible: boolean;
  sourceText: string;
  onClose: () => void;
  /** When true, use slightly longer timeout / show "signed-in" hint (reserved for future premium API). */
  advanced?: boolean;
};

export function TranslationSheet({ visible, sourceText, onClose, advanced }: Props) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState('');

  useEffect(() => {
    if (!visible || !sourceText.trim()) {
      setTranslated('');
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTranslated('');

    const run = async () => {
      try {
        const { translatedText } = await translateTextFree(sourceText, 'en');
        if (!cancelled) {
          setTranslated(translatedText);
        }
      } catch {
        if (!cancelled) {
          setError('Translation unavailable. Check your connection or try shorter text.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [visible, sourceText, advanced]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close translation" />
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.cardBackground,
              paddingBottom: Math.max(insets.bottom, 12) + 16,
              paddingTop: 8,
              borderTopColor: currentTheme.secondaryText + '22',
            },
          ]}
        >
        <View style={[styles.handle, { backgroundColor: currentTheme.secondaryText + '40' }]} />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Languages size={22} color={currentTheme.accent} />
            <ThemedText variant="primary" size="header" weight="bold">
              Translation
            </ThemedText>
          </View>
          <PressableScale onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={currentTheme.secondaryText} />
          </PressableScale>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText variant="secondary" size="caption" weight="semibold" style={styles.label}>
            Original
          </ThemedText>
          <ThemedText variant="primary" size="body" style={styles.block}>
            {sourceText}
          </ThemedText>

          <ThemedText variant="secondary" size="caption" weight="semibold" style={[styles.label, { marginTop: 14 }]}>
            English
          </ThemedText>
          {loading && (
            <View style={styles.centerRow}>
              <ActivityIndicator color={currentTheme.accent} />
              <ThemedText variant="secondary" size="caption" style={{ marginLeft: 10 }}>
                Translating…
              </ThemedText>
            </View>
          )}
          {error && !loading && (
            <ThemedText variant="secondary" size="body" style={{ color: '#DC2626' }}>
              {error}
            </ThemedText>
          )}
          {!loading && !error && translated ? (
            <ThemedText variant="primary" size="body" style={styles.block}>
              {translated}
            </ThemedText>
          ) : null}
        </ScrollView>

        <ThemedText variant="secondary" size="caption" style={styles.footnote}>
          Free translation service; limit applies to long text. Stays in the app — no browser tab.
        </ThemedText>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    zIndex: 2,
    elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeBtn: { padding: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { maxHeight: Platform.OS === 'web' ? 360 : 320 },
  label: { marginBottom: 6, letterSpacing: 0.4 },
  block: { lineHeight: 24 },
  centerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  footnote: { marginTop: 12, opacity: 0.75, lineHeight: 18 },
});
