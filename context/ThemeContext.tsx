import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Theme,
  ThemeMode,
  TypographySettings,
  ReadingSettings,
  defaultThemes,
  defaultTypography,
  defaultReadingSettings,
} from '@/types/theme';
import { normalizeFontValue } from '@/utils/fonts';
import { logger, captureError } from '@/utils/logger';
import { StorageQueue } from '@/utils/storage-queue';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleThemeMode: () => void;
  themes: Theme[];
  addCustomTheme: (theme: Theme) => void;
  removeCustomTheme: (themeId: string) => void;
  typography: TypographySettings;
  setTypography: (settings: Partial<TypographySettings>) => void;
  readingSettings: ReadingSettings;
  setReadingSettings: (settings: Partial<ReadingSettings>) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@miyo/theme';
const TYPOGRAPHY_STORAGE_KEY = '@miyo/typography';
const READING_SETTINGS_KEY = '@miyo/reading-settings';
const CUSTOM_THEMES_KEY = '@miyo/custom-themes';
const LAST_LIGHT_THEME_KEY = '@miyo/last-light-theme';
const LAST_DARK_THEME_KEY = '@miyo/last-dark-theme';

function normalizeTheme(theme: Theme): Theme {
  return {
    ...theme,
    category: theme.category || 'normal',
    performanceHint: theme.performanceHint || (theme.category === 'special' ? 'decorative' : 'standard'),
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(normalizeTheme(defaultThemes[0]));
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [typography, setTypographyState] = useState<TypographySettings>(defaultTypography);
  const [readingSettings, setReadingSettingsState] = useState<ReadingSettings>(defaultReadingSettings);
  const [isLoading, setIsLoading] = useState(true);

  const themes = [...defaultThemes.map(normalizeTheme), ...customThemes.map(normalizeTheme)];
  const getThemeByMode = useCallback(
    (mode: ThemeMode, themeList: Theme[] = themes) =>
      themeList.find(theme => theme.isDark === (mode === 'dark')) ??
      defaultThemes.find(theme => theme.isDark === (mode === 'dark')) ??
      defaultThemes[0],
    [themes]
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [themeId, typographyJson, readingJson, customThemesJson, lastLightThemeId, lastDarkThemeId] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(TYPOGRAPHY_STORAGE_KEY),
        AsyncStorage.getItem(READING_SETTINGS_KEY),
        AsyncStorage.getItem(CUSTOM_THEMES_KEY),
        AsyncStorage.getItem(LAST_LIGHT_THEME_KEY),
        AsyncStorage.getItem(LAST_DARK_THEME_KEY),
      ]);

      const parsedCustomThemes = customThemesJson ? JSON.parse(customThemesJson).map(normalizeTheme) : [];
      const allThemes = [...defaultThemes.map(normalizeTheme), ...parsedCustomThemes];

      if (customThemesJson) {
        setCustomThemes(parsedCustomThemes);
      }

      if (themeId) {
        const savedTheme = allThemes.find(t => t.id === themeId);
        if (savedTheme) {
          setCurrentTheme(normalizeTheme(savedTheme));
        }
      } else {
        const savedLightTheme = allThemes.find(t => t.id === lastLightThemeId && !t.isDark);
        if (savedLightTheme) {
          setCurrentTheme(normalizeTheme(savedLightTheme));
        }
      }

      StorageQueue.enqueue(
        LAST_LIGHT_THEME_KEY,
        allThemes.find(theme => theme.id === lastLightThemeId && !theme.isDark)?.id ??
          allThemes.find(theme => !theme.isDark)?.id ??
          defaultThemes[0].id
      );
      StorageQueue.enqueue(
        LAST_DARK_THEME_KEY,
        allThemes.find(theme => theme.id === lastDarkThemeId && theme.isDark)?.id ??
          allThemes.find(theme => theme.isDark)?.id ??
          defaultThemes[1].id
      );

      if (typographyJson) {
        const savedTypography = { ...defaultTypography, ...JSON.parse(typographyJson) };
        setTypographyState({
          ...savedTypography,
          fontFamily: normalizeFontValue(savedTypography.fontFamily),
        });
      }

      if (readingJson) {
        setReadingSettingsState({
          ...defaultReadingSettings,
          ...JSON.parse(readingJson),
          specialThemeVfxBoost: false,
        });
      }
      logger.info('Theme settings loaded successfully');
    } catch (error) {
      captureError('Load Theme Settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = useCallback((theme: Theme) => {
    setCurrentTheme(normalizeTheme(theme));
    StorageQueue.enqueue(THEME_STORAGE_KEY, theme.id);
    StorageQueue.enqueue(theme.isDark ? LAST_DARK_THEME_KEY : LAST_LIGHT_THEME_KEY, theme.id);
  }, []);

  const toggleThemeMode = useCallback(() => {
    const nextMode: ThemeMode = currentTheme.isDark ? 'light' : 'dark';
    const storageKey = nextMode === 'dark' ? LAST_DARK_THEME_KEY : LAST_LIGHT_THEME_KEY;
    const fallbackTheme = getThemeByMode(nextMode);

    AsyncStorage.getItem(storageKey)
      .then(savedThemeId => {
        const nextTheme =
          themes.find(theme => theme.id === savedThemeId && theme.isDark === (nextMode === 'dark')) ??
          fallbackTheme;
        setCurrentTheme(nextTheme);
        StorageQueue.enqueue(THEME_STORAGE_KEY, nextTheme.id);
        StorageQueue.enqueue(storageKey, nextTheme.id);
      })
      .catch(() => {
        setCurrentTheme(fallbackTheme);
        StorageQueue.enqueue(THEME_STORAGE_KEY, fallbackTheme.id);
        StorageQueue.enqueue(storageKey, fallbackTheme.id);
      });
  }, [currentTheme.isDark, getThemeByMode, themes]);

  const addCustomTheme = useCallback((theme: Theme) => {
    const newCustomThemes = [...customThemes, normalizeTheme({ ...theme, isCustom: true, category: 'normal' })];
    setCustomThemes(newCustomThemes);
    StorageQueue.enqueueJSON(CUSTOM_THEMES_KEY, newCustomThemes);
  }, [customThemes]);

  const removeCustomTheme = useCallback((themeId: string) => {
    const newCustomThemes = customThemes.filter(t => t.id !== themeId);
    setCustomThemes(newCustomThemes);
    StorageQueue.enqueueJSON(CUSTOM_THEMES_KEY, newCustomThemes);
    if (currentTheme.id === themeId) {
      setTheme(defaultThemes[0]);
    }
  }, [customThemes, currentTheme.id, setTheme]);

  const setTypography = useCallback((settings: Partial<TypographySettings>) => {
    setTypographyState(prev => {
      const newTypography = {
        ...prev,
        ...settings,
        fontFamily: normalizeFontValue(settings.fontFamily ?? prev.fontFamily),
      };
      StorageQueue.enqueueJSON(TYPOGRAPHY_STORAGE_KEY, newTypography);
      return newTypography;
    });
  }, []);

  const setReadingSettings = useCallback((settings: Partial<ReadingSettings>) => {
    setReadingSettingsState(prev => {
      const newSettings = { ...prev, ...settings, specialThemeVfxBoost: false };
      StorageQueue.enqueueJSON(READING_SETTINGS_KEY, newSettings);
      return newSettings;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        toggleThemeMode,
        themes,
        addCustomTheme,
        removeCustomTheme,
        typography,
        setTypography,
        readingSettings,
        setReadingSettings,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
