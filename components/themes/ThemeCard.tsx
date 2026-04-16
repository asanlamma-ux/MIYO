import React from 'react';
import { View, StyleSheet, useWindowDimensions, Image } from 'react-native';
import { Theme } from '@/types/theme';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Check } from 'lucide-react-native';
import { getThemeCategory, getThemeEffectPack } from '@/utils/theme-effects';

interface ThemeCardProps {
  theme: Theme;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

export function ThemeCard({ theme, isSelected, onSelect, onDelete }: ThemeCardProps) {
  const { currentTheme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const category = getThemeCategory(theme);
  const effectPack = getThemeEffectPack(theme);
  
  // Responsive card width
  const cardWidth = Math.min(140, (screenWidth - 48) / 2.3);

  return (
    <PressableScale
      onPress={onSelect}
      onLongPress={onDelete}
      style={[
        styles.card,
        {
          width: cardWidth,
          backgroundColor: theme.cardBackground,
          borderColor: isSelected ? theme.accent : 'transparent',
          borderWidth: isSelected ? 2 : 0,
        },
      ]}
    >
      {/* Preview area */}
      <View style={[styles.preview, { backgroundColor: theme.background }]}>
        {effectPack ? (
          <Image source={effectPack.preview} resizeMode="contain" style={styles.previewOrnament} />
        ) : null}

        {/* Simulated text lines */}
        <View
          style={[
            styles.textLine,
            styles.titleLine,
            { backgroundColor: theme.text },
          ]}
        />
        <View
          style={[
            styles.textLine,
            styles.bodyLine1,
            { backgroundColor: theme.text + '80' },
          ]}
        />
        <View
          style={[
            styles.textLine,
            styles.bodyLine2,
            { backgroundColor: theme.text + '60' },
          ]}
        />
        <View
          style={[
            styles.textLine,
            styles.bodyLine3,
            { backgroundColor: theme.text + '40' },
          ]}
        />
        
        {/* Accent element */}
        <View
          style={[
            styles.accentBar,
            { backgroundColor: theme.accent },
          ]}
        />

        {/* Noise texture overlay simulation */}
        <View style={styles.noiseOverlay} />
      </View>

      {/* Theme name */}
      <View style={styles.footer}>
        <View style={styles.nameContainer}>
          <ThemedText
            variant="primary"
            size="caption"
            weight={isSelected ? 'semibold' : 'medium'}
            numberOfLines={1}
          >
            {theme.name}
          </ThemedText>
          {theme.isCustom && (
            <View
              style={[
                styles.customBadge,
                { backgroundColor: currentTheme.accent + '20' },
              ]}
            >
              <ThemedText variant="accent" size="caption" weight="medium">
                Custom
              </ThemedText>
            </View>
          )}
          {!theme.isCustom && category === 'special' && (
            <View
              style={[
                styles.specialBadge,
                { backgroundColor: theme.accent + '18', borderColor: theme.accent + '45' },
              ]}
            >
              <ThemedText size="caption" weight="semibold" style={{ color: theme.accent }}>
                Special UI
              </ThemedText>
            </View>
          )}
        </View>
        
        {isSelected && (
          <View
            style={[
              styles.checkIcon,
              { backgroundColor: theme.accent },
            ]}
          >
            <Check size={12} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Color swatches */}
      <View style={styles.swatches}>
        <View style={[styles.swatch, { backgroundColor: theme.background }]} />
        <View style={[styles.swatch, { backgroundColor: theme.text }]} />
        <View style={[styles.swatch, { backgroundColor: theme.accent }]} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginRight: 10,
    marginBottom: 10,
  },
  preview: {
    height: 85,
    padding: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  previewOrnament: {
    position: 'absolute',
    right: -8,
    bottom: -6,
    width: 72,
    height: 72,
    opacity: 0.88,
  },
  textLine: {
    borderRadius: 2,
    marginBottom: 5,
  },
  titleLine: {
    width: '55%',
    height: 6,
  },
  bodyLine1: {
    width: '100%',
    height: 3,
    marginTop: 6,
  },
  bodyLine2: {
    width: '90%',
    height: 3,
  },
  bodyLine3: {
    width: '70%',
    height: 3,
  },
  accentBar: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    backgroundColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 8,
    paddingTop: 6,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  customBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  specialBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatches: {
    flexDirection: 'row',
    gap: 3,
    padding: 8,
    paddingTop: 0,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
