import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { TermGroup } from '@/types/terms';
import { BookOpen, ChevronRight } from 'lucide-react-native';

interface TermGroupCardProps {
  group: TermGroup;
  onPress: () => void;
}

export function TermGroupCard({ group, onPress }: TermGroupCardProps) {
  const { currentTheme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: currentTheme.cardBackground,
          borderColor: currentTheme.secondaryText + '18',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: currentTheme.accent + '18' }]}>
            <BookOpen size={18} color={currentTheme.accent} strokeWidth={2} />
          </View>
          <View style={styles.titleSection}>
            <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={1}>
              {group.name}
            </ThemedText>
            {group.description ? (
              <ThemedText variant="secondary" size="caption" numberOfLines={1} style={styles.description}>
                {group.description}
              </ThemedText>
            ) : null}
          </View>
          <ChevronRight size={18} color={currentTheme.secondaryText} />
        </View>

        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: currentTheme.accent + '14' }]}>
            <ThemedText variant="accent" size="caption" weight="medium">
              {group.terms.length} term{group.terms.length !== 1 ? 's' : ''}
            </ThemedText>
          </View>
          {group.appliedToBooks.length > 0 && (
            <View style={[styles.badge, { backgroundColor: currentTheme.secondaryText + '12' }]}>
              <ThemedText variant="secondary" size="caption" weight="medium">
                {group.appliedToBooks.length} book{group.appliedToBooks.length !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    flex: 1,
  },
  description: {
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 50,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
