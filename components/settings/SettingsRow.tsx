import React from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { ChevronRight } from 'lucide-react-native';

interface SettingsRowProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  showChevron?: boolean;
  toggle?: {
    value: boolean;
    onToggle: (value: boolean) => void;
  };
  onPress?: () => void;
  danger?: boolean;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  showChevron = false,
  toggle,
  onPress,
  danger = false,
}: SettingsRowProps) {
  const { currentTheme } = useTheme();

  const content = (
    <View style={styles.row}>
      {icon && (
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: danger
                ? '#EF444420'
                : currentTheme.accent + '15',
            },
          ]}
        >
          {icon}
        </View>
      )}
      <View style={styles.content}>
        <ThemedText
          variant={danger ? 'primary' : 'primary'}
          size="body"
          weight="medium"
          style={danger ? { color: '#EF4444' } : undefined}
        >
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText variant="secondary" size="caption" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {value && (
        <ThemedText variant="secondary" size="caption" style={styles.value}>
          {value}
        </ThemedText>
      )}
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onToggle}
          trackColor={{
            false: currentTheme.secondaryText + '40',
            true: currentTheme.accent + '60',
          }}
          thumbColor={toggle.value ? currentTheme.accent : '#FFFFFF'}
        />
      )}
      {showChevron && (
        <ChevronRight size={20} color={currentTheme.secondaryText} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={styles.pressable}>
        {content}
      </PressableScale>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  pressable: {
    // Pressable wrapper
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  value: {
    marginRight: 8,
  },
});
