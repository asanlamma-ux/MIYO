import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getBackdropParticleCount, getThemeEffectPack, type ThemeEffectVariant } from '@/utils/theme-effects';

interface ThemedAmbientBackdropProps {
  variant: ThemeEffectVariant;
  style?: ViewStyle;
}

const HERO_SIZES: Record<ThemeEffectVariant, number> = {
  splash: 320,
  loading: 240,
  auth: 228,
  card: 88,
};

export function ThemedAmbientBackdrop({ variant, style }: ThemedAmbientBackdropProps) {
  const { currentTheme, readingSettings } = useTheme();
  const pack = getThemeEffectPack(currentTheme);
  const specialUiEnabled = pack ? readingSettings.specialThemeUiEnabled : true;
  const activePack = pack && specialUiEnabled ? pack : null;
  const intenseVfx = activePack ? readingSettings.specialThemeVfxBoost : false;
  const particleCount =
    activePack && !readingSettings.reducedMotion
      ? getBackdropParticleCount(variant, { intense: intenseVfx })
      : 0;
  const loops = useRef<Animated.CompositeAnimation[]>([]);
  const particleValues = useRef(Array.from({ length: 16 }, () => new Animated.Value(0))).current;

  const particleSpecs = useMemo(() => {
    return Array.from({ length: particleCount }, (_, index) => ({
      id: `${variant}-${activePack?.id || 'none'}-${index}`,
      source: activePack?.particles[index % activePack.particles.length],
      left: 8 + ((index * 13) % 76),
      startY: 112 + ((index * 29) % 180),
      driftX: -28 + ((index * 17) % 56),
      travel: (intenseVfx ? 128 : 94) + ((index * 23) % (intenseVfx ? 164 : 132)),
      scale: (intenseVfx ? 0.62 : 0.52) + ((index % 4) * 0.14),
      rotation: (activePack?.id === 'coffee' ? -12 : -24) + ((index * 19) % 48),
      duration: (intenseVfx ? 5200 : 6200) + index * (intenseVfx ? 320 : 420),
      delay: index * 260,
      opacity: (intenseVfx ? 0.24 : 0.18) + ((index % 3) * 0.08),
    }));
  }, [activePack, intenseVfx, particleCount, variant]);

  useEffect(() => {
    loops.current.forEach(loop => loop.stop());
    loops.current = [];

    particleValues.forEach(value => value.setValue(0));

    if (!activePack || readingSettings.reducedMotion || particleSpecs.length === 0) {
      return;
    }

    particleSpecs.forEach((spec, index) => {
      const value = particleValues[index];
      const animation = Animated.loop(
        Animated.sequence([
          Animated.delay(spec.delay),
          Animated.timing(value, {
            toValue: 1,
            duration: spec.duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      loops.current.push(animation);
      animation.start();
    });

    return () => {
      loops.current.forEach(loop => loop.stop());
      loops.current = [];
    };
  }, [activePack, particleSpecs, particleValues, readingSettings.reducedMotion]);

  const heroSize = HERO_SIZES[variant];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View
        style={[
          styles.glow,
          styles.glowTop,
          {
            backgroundColor:
              currentTheme.accent +
              (activePack ? (intenseVfx ? '24' : '18') : '0F'),
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          styles.glowBottom,
          {
            backgroundColor:
              currentTheme.secondaryText +
              (activePack ? (intenseVfx ? '18' : '10') : '08'),
          },
        ]}
      />

      {activePack ? (
        <>
          <Image
            source={activePack.hero}
            resizeMode="contain"
            style={[
              styles.hero,
              {
                width: intenseVfx ? heroSize * 1.08 : heroSize,
                height: intenseVfx ? heroSize * 1.08 : heroSize,
                opacity: variant === 'card' ? 0.92 : intenseVfx ? 0.84 : 0.74,
                transform: [
                  { translateX: variant === 'splash' ? 28 : variant === 'auth' ? 18 : 0 },
                  { translateY: variant === 'loading' ? (intenseVfx ? -18 : -12) : 0 },
                  { rotate: intenseVfx && activePack.id === 'blossom' ? '-4deg' : '0deg' },
                ],
              },
            ]}
          />

          {particleSpecs.map((spec, index) => {
            const progress = particleValues[index];
            const animatedStyle = {
              opacity: progress.interpolate({
                inputRange: [0, 0.08, 0.92, 1],
                outputRange: [0, spec.opacity, spec.opacity, 0],
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [spec.startY, spec.startY - spec.travel],
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, spec.driftX, 0],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${spec.rotation}deg`],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [spec.scale * 0.9, spec.scale, spec.scale * 0.92],
                  }),
                },
              ],
            };

            return (
              <Animated.Image
                key={spec.id}
                source={spec.source}
                resizeMode="contain"
                style={[
                  styles.particle,
                  {
                    left: `${spec.left}%`,
                    top: spec.startY,
                  },
                  animatedStyle,
                ]}
              />
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowTop: {
    width: 280,
    height: 280,
    top: -52,
    right: -44,
  },
  glowBottom: {
    width: 220,
    height: 220,
    left: -36,
    bottom: 22,
  },
  hero: {
    position: 'absolute',
    alignSelf: 'center',
    top: '16%',
  },
  particle: {
    position: 'absolute',
    width: 72,
    height: 72,
  },
});
