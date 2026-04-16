import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';
import { Home, Library, Clock, Settings, Languages } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarHeight = 56;
  const totalTabBarHeight = tabBarHeight + Math.max(insets.bottom, 8);

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          height: totalTabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          backgroundColor: currentTheme.cardBackground,
          borderTopWidth: 1,
          borderTopColor: currentTheme.isDark
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(0, 0, 0, 0.05)',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: currentTheme.isDark ? 0.25 : 0.08,
          shadowRadius: 8,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              style={StyleSheet.absoluteFill}
              tint={currentTheme.isDark ? 'dark' : 'light'}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: currentTheme.cardBackground },
              ]}
            />
          ),
        tabBarActiveTintColor: currentTheme.accent,
        tabBarInactiveTintColor: currentTheme.secondaryText,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarShowLabel: true,
        ...(Platform.OS === 'android' && {
          tabBarHideOnKeyboard: true,
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && (
                <View style={[styles.activeIndicator, { backgroundColor: currentTheme.accent }]} />
              )}
              <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && (
                <View style={[styles.activeIndicator, { backgroundColor: currentTheme.accent }]} />
              )}
              <Library size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="terms"
        options={{
          title: 'Terms',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && (
                <View style={[styles.activeIndicator, { backgroundColor: currentTheme.accent }]} />
              )}
              <Languages size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && (
                <View style={[styles.activeIndicator, { backgroundColor: currentTheme.accent }]} />
              )}
              <Clock size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              {focused && (
                <View style={[styles.activeIndicator, { backgroundColor: currentTheme.accent }]} />
              )}
              <Settings size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      {/* Hide old themes tab */}
      <Tabs.Screen
        name="themes"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
});
