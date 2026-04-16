import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface ThemedViewProps extends ViewProps {
  variant?: 'background' | 'card' | 'transparent';
}

export function ThemedView({ style, variant = 'background', ...props }: ThemedViewProps) {
  const { currentTheme } = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'card':
        return currentTheme.cardBackground;
      case 'transparent':
        return 'transparent';
      default:
        return currentTheme.background;
    }
  };

  return (
    <View
      style={[
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
      {...props}
    />
  );
}
