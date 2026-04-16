import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, WifiOff, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useDictionary } from '@/context/DictionaryContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { DictionaryLookupResult } from '@/types/dictionary';

interface DictionaryLookupModalProps {
  visible: boolean;
  word: string;
  onClose: () => void;
  onManageDictionaries: () => void;
}

export function DictionaryLookupModal({ visible, word, onClose, onManageDictionaries }: DictionaryLookupModalProps) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { lookupWord, downloadedDictionaries } = useDictionary();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);

  useEffect(() => {
    if (!visible || !word.trim()) return;
    (async () => {
      setLoading(true);
      setResult(await lookupWord(word));
      setLoading(false);
    })();
  }, [visible, word, lookupWord]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.52)' }]}> 
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.cardBackground,
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="primary" size="header" weight="bold">
                Define: {word}
              </ThemedText>
              <ThemedText variant="secondary" size="caption">
                {result ? `${result.source === 'offline' ? 'Offline' : 'Online'} · ${result.dictionaryName}` : 'Looking up definition'}
              </ThemedText>
            </View>
            <PressableScale onPress={onClose} style={styles.iconBtn}>
              <X size={20} color={currentTheme.secondaryText} />
            </PressableScale>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={currentTheme.accent} />
            </View>
          ) : result ? (
            <ScrollView style={styles.list} contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
              {result.entries.map((entry, index) => (
                <View
                  key={`${entry.term}-${index}`}
                  style={[styles.entryCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}
                >
                  <View style={styles.entryTopRow}>
                    <ThemedText variant="primary" size="body" weight="semibold">{entry.term}</ThemedText>
                    <View style={[styles.badge, { backgroundColor: result.source === 'offline' ? '#22C55E20' : '#3B82F620' }]}> 
                      <ThemedText size="caption" style={{ color: result.source === 'offline' ? '#22C55E' : '#3B82F6', fontWeight: '700' }}>
                        {result.source === 'offline' ? 'Offline' : 'Online'}
                      </ThemedText>
                    </View>
                  </View>
                  {!!entry.partOfSpeech && (
                    <ThemedText variant="accent" size="caption" weight="medium">{entry.partOfSpeech}</ThemedText>
                  )}
                  <ThemedText variant="primary" size="body" style={{ lineHeight: 22 }}>
                    {entry.definition}
                  </ThemedText>
                  {!!entry.example && (
                    <ThemedText variant="secondary" size="caption" style={{ fontStyle: 'italic', lineHeight: 18 }}>
                      Example: {entry.example}
                    </ThemedText>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.centerState}>
              {downloadedDictionaries.length > 0 ? (
                <WifiOff size={34} color={currentTheme.secondaryText} />
              ) : (
                <BookOpen size={34} color={currentTheme.secondaryText} />
              )}
              <ThemedText variant="primary" size="body" weight="semibold" style={{ marginTop: 12, textAlign: 'center' }}>
                No local or online definition found
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={{ marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                {downloadedDictionaries.length > 0
                  ? 'Your downloaded dictionaries did not contain this word, and the online lookup was unavailable.'
                  : 'Download an offline dictionary package for local lookup when you are not connected.'}
              </ThemedText>
            </View>
          )}

          <View style={styles.footerActions}>
            <PressableScale
              onPress={onManageDictionaries}
              style={[styles.secondaryBtn, { borderColor: currentTheme.secondaryText + '24' }]}
            >
              <BookOpen size={16} color={currentTheme.text} />
              <ThemedText variant="primary" size="caption" weight="semibold">Manage Dictionaries</ThemedText>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    maxHeight: '90%',
    minHeight: '64%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1 },
  entryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
