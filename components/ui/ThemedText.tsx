import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface ThemedTextProps extends TextProps {
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'title' | 'header' | 'body' | 'caption' | 'reading';
  weight?: 'hairline' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
}

export function ThemedText({
  style,
  variant = 'primary',
  size = 'body',
  weight = 'regular',
  ...props
}: ThemedTextProps) {
  const { currentTheme, typography } = useTheme();

  const getColor = () => {
    switch (variant) {
      case 'secondary':
        return currentTheme.secondaryText;
      case 'accent':
        return currentTheme.accent;
      default:
        return currentTheme.text;
    }
  };

  const getSize = () => {
    switch (size) {
      case 'title':
        return 28;
      case 'header':
        return 18;
      case 'body':
        return 16;
      case 'caption':
        return 13;
      case 'reading':
        return typography.fontSize;
      default:
        return 16;
    }
  };

  const getFontWeight = () => {
    switch (weight) {
      case 'hairline':
        return '200';
      case 'light':
        return '300';
      case 'regular':
        return '400';
      case 'medium':
        return '500';
      case 'semibold':
        return '600';
      case 'bold':
        return '700';
      default:
        return '400';
    }
  };

  return (
    <Text
      style={[
        {
          color: getColor(),
          fontSize: getSize(),
          fontWeight: getFontWeight() as any,
          lineHeight: size === 'reading' ? getSize() * typography.lineHeight : undefined,
          letterSpacing: size === 'reading' ? typography.letterSpacing : undefined,
        },
        style,
      ]}
      {...props}
    />
  );
}
