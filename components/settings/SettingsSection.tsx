import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText
        variant="secondary"
        size="caption"
        weight="medium"
        style={styles.title}
      >
        {title.toUpperCase()}
      </ThemedText>
      <View
        style={[
          styles.content,
          { backgroundColor: currentTheme.cardBackground },
        ]}
      >
        {React.Children.map(children, (child, index) => (
          <>
            {child}
            {index < React.Children.count(children) - 1 && (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: currentTheme.secondaryText + '15' },
                ]}
              />
            )}
          </>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
    marginLeft: 16,
    letterSpacing: 1,
  },
  content: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
});
