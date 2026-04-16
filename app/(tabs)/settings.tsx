import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Modal, Pressable, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useLibrary } from '@/context/LibraryContext';
import { useAuth } from '@/context/AuthContext';
import { getDailyReadingGoalMinutes, setDailyReadingGoalMinutes } from '@/utils/reading-stats';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { LoggerModal } from '@/components/ui/LoggerModal';
import { PermissionModal } from '@/components/ui/PermissionModal';
import { DictionaryLibraryModal } from '@/components/dictionary/DictionaryLibraryModal';
import { AppDialog, AppDialogAction, AppDialogTone } from '@/components/ui/AppDialog';
import { fontOptions, defaultTypography, defaultReadingSettings } from '@/types/theme';
import { getNativeFontFamily, isSystemFontValue } from '@/utils/fonts';
import { logger } from '@/utils/logger';
import {
  openAppSettings,
  resetPermissionStatus,
  getStorageDirectory,
  getStorageDirectoryLabel,
  requestStorageDirectory,
  markPermissionGranted,
} from '@/utils/permissions';
import { auditLibraryDuplicates } from '@/utils/book-identity';
import {
  Type,
  SlidersHorizontal,
  Moon,
  Volume2,
  Eye,
  Minimize2,
  Smartphone,
  Database,
  Trash2,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  AlignLeft,
  AlignJustify,
  Bug,
  Shield,
  User,
  LogIn,
  LogOut,
  Mail,
  Lock,
  Languages,
  Cloud,
  Timer,
  HardDrive,
  ArrowDownToLine,
  BookOpen,
  EyeOff,
  CircleSlash,
} from 'lucide-react-native';

function formatStorageBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SettingsScreen() {
  const {
    currentTheme,
    typography,
    setTypography,
    readingSettings,
    setReadingSettings,
  } = useTheme();
  const { clearCache, rescanLibrary, books, estimateLibraryStorageBytes } = useLibrary();
  const {
    user,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    isLoading: authLoading,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const [showTypographyModal, setShowTypographyModal] = useState(false);
  const [showLoggerModal, setShowLoggerModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showDictionaryLibrary, setShowDictionaryLibrary] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutesState] = useState(30);
  const [libraryBytes, setLibraryBytes] = useState<number | null>(null);
  const [storageDirectoryUri, setStorageDirectoryUri] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    tone?: AppDialogTone;
    actions: AppDialogAction[];
  } | null>(null);

  useEffect(() => {
    getDailyReadingGoalMinutes().then(setDailyGoalMinutesState);
  }, []);

  useEffect(() => {
    getStorageDirectory().then(setStorageDirectoryUri);
  }, []);

  useEffect(() => {
    if (books.length === 0) {
      setLibraryBytes(0);
      return;
    }
    estimateLibraryStorageBytes().then(setLibraryBytes);
  }, [books, estimateLibraryStorageBytes]);

  // Bottom padding for tab bar
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  const showDialog = (
    title: string,
    message: string,
    tone: AppDialogTone = 'default',
    actions?: AppDialogAction[]
  ) => {
    setDialogState({
      visible: true,
      title,
      message,
      tone,
      actions: actions || [{ label: 'OK', onPress: () => setDialogState(null) }],
    });
  };

  const handleClearCache = () => {
    showDialog(
      'Clear Temporary Cache',
      'This removes chapter cache and temporary downloads only. Your books, bookmarks, highlights, reading stats, and reading position stay intact.',
      'warning',
      [
        { label: 'Cancel', variant: 'secondary', onPress: () => setDialogState(null) },
        {
          label: 'Clear Cache',
          variant: 'danger',
          onPress: async () => {
            try {
              await clearCache();
              setDialogState(null);
              showDialog('Cache Cleared', 'Temporary reader cache was cleared successfully.', 'success');
            } catch (e) {
              showDialog('Cache Error', 'Failed to clear the temporary cache.', 'danger');
            }
          },
        },
      ]
    );
  };

  const handleRescanLibrary = () => {
    showDialog(
      'Rescan Library',
      'This verifies tracked books, removes orphaned entries, and imports new EPUBs found in your watched folder.',
      'default',
      [
        { label: 'Cancel', variant: 'secondary', onPress: () => setDialogState(null) },
        {
          label: 'Rescan',
          variant: 'primary',
          onPress: async () => {
            try {
              const result = await rescanLibrary();
              setDialogState(null);
              showDialog(
                'Rescan Complete',
                `${result.valid} book(s) now tracked in library.\n` +
                  `${result.imported > 0 ? `Imported ${result.imported} new book(s).\n` : ''}` +
                  `${result.skippedDuplicates > 0 ? `Skipped ${result.skippedDuplicates} duplicate file(s).\n` : ''}` +
                  `${result.removed > 0 ? `Removed ${result.removed} orphaned entry(s).\n` : 'No orphaned entries found.\n'}` +
                  `${storageDirectoryUri ? `Watched folder items scanned: ${result.watchedFolderFiles}.` : 'No watched folder selected.'}`,
                'success'
              );
            } catch (e) {
              showDialog('Rescan Error', 'Failed to rescan the library.', 'danger');
            }
          },
        },
      ]
    );
  };

  const handleDuplicateAudit = () => {
    const audit = auditLibraryDuplicates(books);
    if (audit.exactGroups.length === 0 && audit.probableGroups.length === 0) {
      showDialog('Library Audit', 'No duplicate book groups were found.', 'success');
      return;
    }

    const sampleGroups = [...audit.exactGroups, ...audit.probableGroups]
      .slice(0, 4)
      .map(group => group.books.map(book => book.title).join(' / '))
      .join('\n\n');

    showDialog(
      'Library Audit',
      `Exact duplicate groups: ${audit.exactGroups.length}\n` +
        `Probable duplicate groups: ${audit.probableGroups.length}\n\n` +
        `${sampleGroups ? `Examples:\n${sampleGroups}` : ''}`,
      'warning'
    );
  };

  const handleResetPreferences = () => {
    showDialog(
      'Reset Preferences',
      'This resets reading and display settings back to their defaults.',
      'warning',
      [
        { label: 'Cancel', variant: 'secondary', onPress: () => setDialogState(null) },
        {
          label: 'Reset',
          variant: 'danger',
          onPress: () => {
            setTypography({ ...defaultTypography });
            setReadingSettings({ ...defaultReadingSettings });
            setDialogState(null);
            showDialog('Preferences Reset', 'Reading and display settings were restored to default values.', 'success');
          },
        },
      ]
    );
  };

  const currentFont = fontOptions.find(f => f.value === typography.fontFamily)?.label || 'System Default';

  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: tabBarHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
          Settings
        </ThemedText>

        {/* Account Section */}
        <SettingsSection title="Account">
          {isAuthenticated ? (
            <>
              <SettingsRow
                icon={<Mail size={18} color={currentTheme.accent} />}
                title={user?.email ?? 'Signed In'}
                subtitle="Signed in with email"
              />
              <SettingsRow
                icon={<LogOut size={18} color="#EF4444" />}
                title="Sign Out"
                onPress={() => {
                  showDialog(
                    'Sign Out',
                    'Sign out of your Miyo account on this device?',
                    'warning',
                    [
                      { label: 'Cancel', variant: 'secondary', onPress: () => setDialogState(null) },
                      {
                        label: 'Sign Out',
                        variant: 'danger',
                        onPress: async () => {
                          await signOut();
                          setDialogState(null);
                        },
                      },
                    ]
                  );
                }}
                danger
              />
            </>
          ) : (
            <SettingsRow
              icon={<LogIn size={18} color={currentTheme.accent} />}
              title="Sign In / Sign Up"
              subtitle="Unlock auto-translation features"
              showChevron
              onPress={() => {
                setAuthMode('login');
                resetAuthForm();
                setShowAuthModal(true);
              }}
            />
          )}
        </SettingsSection>

        {/* Translation Settings (requires login) */}
        {isAuthenticated && (
          <SettingsSection title="Translations">
            <SettingsRow
              icon={<Languages size={18} color={currentTheme.accent} />}
              title="Auto Translation Mode"
              value={readingSettings.autoTranslationMode === 'off' ? 'Off'
                : readingSettings.autoTranslationMode === 'normal' ? 'Normal' : 'Advanced'}
              showChevron
              onPress={() => {
                const modes = ['off', 'normal', 'advanced'] as const;
                const currentIndex = modes.indexOf(readingSettings.autoTranslationMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                setReadingSettings({ autoTranslationMode: modes[nextIndex] });
              }}
            />
          </SettingsSection>
        )}

        {/* Reading goal (Koodo-style habit target) */}
        <SettingsSection title="Daily Goal">
          <View style={{ padding: 16, paddingBottom: 16 }}>
            <ThemedText variant="secondary" size="caption" style={{ marginBottom: 14, lineHeight: 18 }}>
              Minutes to aim for each day. Progress appears on the Home tab using logged reading time.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[15, 30, 45].map(m => {
                const active = dailyGoalMinutes === m;
                return (
                  <PressableScale
                    key={m}
                    onPress={async () => {
                      await setDailyReadingGoalMinutes(m);
                      setDailyGoalMinutesState(m);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      alignItems: 'center',
                      backgroundColor: active ? currentTheme.accent : currentTheme.cardBackground,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '25',
                    }}
                  >
                    <ThemedText
                      style={{
                        color: active ? '#FFFFFF' : currentTheme.text,
                        fontSize: 14,
                        fontWeight: active ? '700' : '400',
                      }}
                    >
                      {m} min
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {[60, 90, 120].map(m => {
                const active = dailyGoalMinutes === m;
                return (
                  <PressableScale
                    key={m}
                    onPress={async () => {
                      await setDailyReadingGoalMinutes(m);
                      setDailyGoalMinutesState(m);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      alignItems: 'center',
                      backgroundColor: active ? currentTheme.accent : currentTheme.cardBackground,
                      borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '25',
                    }}
                  >
                    <ThemedText
                      style={{
                        color: active ? '#FFFFFF' : currentTheme.text,
                        fontSize: 14,
                        fontWeight: active ? '700' : '400',
                      }}
                    >
                      {m} min
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </SettingsSection>

        {/* Reading Settings */}
        <SettingsSection title="Reading">
          <SettingsRow
            icon={<Type size={18} color={currentTheme.accent} />}
            title="Typography"
            subtitle={`${currentFont}, ${typography.fontSize}px`}
            showChevron
            onPress={() => setShowTypographyModal(true)}
          />
          <SettingsRow
            icon={<SlidersHorizontal size={18} color={currentTheme.accent} />}
            title="Page Animation"
            value={readingSettings.pageAnimation.charAt(0).toUpperCase() + readingSettings.pageAnimation.slice(1)}
            showChevron
            onPress={() => {
              const options = ['slide', 'fade', 'curl'] as const;
              const currentIndex = options.indexOf(readingSettings.pageAnimation);
              const nextIndex = (currentIndex + 1) % options.length;
              setReadingSettings({ pageAnimation: options[nextIndex] });
            }}
          />
          <SettingsRow
            icon={<Smartphone size={18} color={currentTheme.accent} />}
            title="Tap Zones"
            subtitle="Enable left/right edge taps in the reader"
            toggle={{
              value: readingSettings.tapZonesEnabled,
              onToggle: value => setReadingSettings({ tapZonesEnabled: value }),
            }}
          />
          <SettingsRow
            icon={<SlidersHorizontal size={18} color={currentTheme.accent} />}
            title="Side tap & swipe"
            subtitle={
              readingSettings.tapZoneNavMode === 'scroll'
                ? 'Scroll within chapter (default)'
                : 'Jump to previous / next chapter'
            }
            showChevron
            onPress={() =>
              setReadingSettings({
                tapZoneNavMode: readingSettings.tapZoneNavMode === 'scroll' ? 'chapter' : 'scroll',
              })
            }
          />
          <SettingsRow
            icon={<Timer size={18} color={currentTheme.accent} />}
            title="Sleep timer"
            subtitle={
              readingSettings.sleepTimerMinutes <= 0
                ? 'Off'
                : `${readingSettings.sleepTimerMinutes} min (while reading)`
            }
            showChevron
            onPress={() => {
              const opts = [0, 15, 30, 45, 60] as const;
              let i = opts.indexOf(readingSettings.sleepTimerMinutes as (typeof opts)[number]);
              if (i < 0) i = 0;
              setReadingSettings({ sleepTimerMinutes: opts[(i + 1) % opts.length] });
            }}
          />
          <SettingsRow
            icon={<ArrowDownToLine size={18} color={currentTheme.accent} />}
            title="Continuous chapter loading"
            subtitle="Append the next chapter in the same reading space when you reach the end"
            toggle={{
              value: readingSettings.autoAdvanceChapter,
              onToggle: value => setReadingSettings({ autoAdvanceChapter: value }),
            }}
          />
          <SettingsRow
            icon={<Volume2 size={18} color={currentTheme.accent} />}
            title="Volume Button Navigation"
            subtitle="Use volume buttons to turn pages"
            toggle={{
              value: readingSettings.volumeButtonPageTurn,
              onToggle: value => setReadingSettings({ volumeButtonPageTurn: value }),
            }}
          />
          <SettingsRow
            icon={<SlidersHorizontal size={18} color={currentTheme.accent} />}
            title="Bionic reading"
            subtitle="Emphasize word beginnings in the reader"
            toggle={{
              value: readingSettings.bionicReading,
              onToggle: value => setReadingSettings({ bionicReading: value }),
            }}
          />
          <SettingsRow
            icon={<Smartphone size={18} color={currentTheme.accent} />}
            title="Keep screen on"
            subtitle="While a book is open in the reader"
            toggle={{
              value: readingSettings.keepScreenOn,
              onToggle: value => setReadingSettings({ keepScreenOn: value }),
            }}
          />
        </SettingsSection>

        {/* Display Settings */}
        <SettingsSection title="Display">
          <SettingsRow
            icon={<Eye size={18} color={currentTheme.accent} />}
            title="Immersive Mode"
            subtitle="Hide status and navigation bars"
            toggle={{
              value: readingSettings.immersiveMode,
              onToggle: value => setReadingSettings({ immersiveMode: value }),
            }}
          />
        </SettingsSection>

        {/* Storage */}
        <SettingsSection title="Storage">
          <SettingsRow
            icon={<Database size={18} color={currentTheme.accent} />}
            title="Storage Location"
            subtitle={
              Platform.OS === 'android'
                ? 'Select the folder used for new imports and watched-folder rescans'
                : 'Books live in app storage'
            }
            value={Platform.OS === 'android' ? getStorageDirectoryLabel(storageDirectoryUri) : 'App storage'}
            showChevron
            onPress={async () => {
              if (Platform.OS !== 'android') {
                showDialog('Storage', 'On iOS, imported books are stored inside the app sandbox.', 'default');
                return;
              }
              const uri = await requestStorageDirectory();
              if (uri) {
                await markPermissionGranted(true);
                setStorageDirectoryUri(uri);
              }
            }}
          />
          <SettingsRow
            icon={<HardDrive size={18} color={currentTheme.accent} />}
            title="Library size"
            subtitle={`${books.length} book(s) on disk`}
            value={libraryBytes == null ? '…' : formatStorageBytes(libraryBytes)}
            showChevron={false}
          />
          <SettingsRow
            icon={<FolderOpen size={18} color={currentTheme.accent} />}
            title="Watched Folder"
            subtitle={
              storageDirectoryUri
                ? 'Rescan imports new EPUBs from this folder without copying them again'
                : 'No folder selected yet'
            }
            value={storageDirectoryUri ? 'Active' : 'Off'}
            showChevron={false}
          />
          <SettingsRow
            icon={<Trash2 size={18} color="#EF4444" />}
            title="Clear Cache"
            subtitle="Remove temporary reading data"
            onPress={handleClearCache}
            danger
          />
        </SettingsSection>

        {/* Sync & Backup */}
        <SettingsSection title="Cloud Sync & Backup">
          <SettingsRow
            icon={<CircleSlash size={18} color={currentTheme.accent} />}
            title="Cloud Sync Unavailable"
            subtitle="Disabled for the beta build while backup providers are being stabilized"
            showChevron={false}
          />
        </SettingsSection>

        {/* Permissions */}
        <SettingsSection title="Permissions">
          <SettingsRow
            icon={<Shield size={18} color={currentTheme.accent} />}
            title="Storage Permission"
            subtitle="Required to import and read EPUB files"
            showChevron
            onPress={() => setShowPermissionModal(true)}
          />
          <SettingsRow
            icon={<FolderOpen size={18} color={currentTheme.accent} />}
            title="Open App Settings"
            subtitle="Manage app permissions"
            showChevron
            onPress={async () => {
              await openAppSettings();
            }}
          />
        </SettingsSection>

        <SettingsSection title="Language Tools">
          <SettingsRow
            icon={<BookOpen size={18} color={currentTheme.accent} />}
            title="Dictionary Library"
            subtitle="Download offline dictionaries and manage lookup packages"
            showChevron
            onPress={() => setShowDictionaryLibrary(true)}
          />
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection title="Advanced">
          <SettingsRow
            icon={<Minimize2 size={18} color={currentTheme.accent} />}
            title="Reduced Motion"
            subtitle="Minimize animations"
            toggle={{
              value: readingSettings.reducedMotion,
              onToggle: value => setReadingSettings({ reducedMotion: value }),
            }}
          />
          <SettingsRow
            icon={<RefreshCw size={18} color={currentTheme.accent} />}
            title="Rescan Library"
            subtitle="Find missing or new books"
            showChevron
            onPress={handleRescanLibrary}
          />
          <SettingsRow
            icon={<Database size={18} color={currentTheme.accent} />}
            title="Duplicate Audit"
            subtitle="Detect exact and probable duplicate book entries"
            showChevron
            onPress={handleDuplicateAudit}
          />
          {__DEV__ && (
            <SettingsRow
              icon={<Bug size={18} color={currentTheme.accent} />}
              title="View Console Logs"
              subtitle="Debug and error information"
              showChevron
              onPress={() => setShowLoggerModal(true)}
            />
          )}
          <SettingsRow
            icon={<RotateCcw size={18} color="#EF4444" />}
            title="Reset All Preferences"
            subtitle="Restore default settings"
            onPress={handleResetPreferences}
            danger
          />
        </SettingsSection>

        {/* About */}
        <View style={styles.aboutSection}>
          <ThemedText variant="secondary" size="caption" style={styles.aboutText}>
            Miyo EPUB Reader
          </ThemedText>
          <ThemedText variant="secondary" size="caption" style={styles.aboutText}>
            Version 1.0.0
          </ThemedText>
        </View>
      </ScrollView>

      {/* Typography Modal */}
      <Modal
        visible={showTypographyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTypographyModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: currentTheme.background },
          ]}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <PressableScale onPress={() => setShowTypographyModal(false)}>
              <X size={24} color={currentTheme.secondaryText} />
            </PressableScale>
            <ThemedText variant="primary" size="header" weight="semibold">
              Typography
            </ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Font Family */}
            <View style={styles.settingGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.settingLabel}
              >
                FONT FAMILY
              </ThemedText>
              <View style={styles.fontOptions}>
                {fontOptions.map(font => (
                  <PressableScale
                    key={font.value}
                    onPress={() => setTypography({ fontFamily: font.value })}
                    style={[
                      styles.fontOption,
                      {
                        backgroundColor:
                          typography.fontFamily === font.value
                            ? currentTheme.accent + '20'
                            : currentTheme.cardBackground,
                        borderColor:
                          typography.fontFamily === font.value
                            ? currentTheme.accent
                            : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText
                      variant={typography.fontFamily === font.value ? 'accent' : 'primary'}
                      size="body"
                      weight={typography.fontFamily === font.value ? 'semibold' : 'regular'}
                      style={!isSystemFontValue(font.value) ? { fontFamily: getNativeFontFamily(font.value) } : undefined}
                    >
                      {font.label}
                    </ThemedText>
                    {typography.fontFamily === font.value && (
                      <Check size={18} color={currentTheme.accent} />
                    )}
                  </PressableScale>
                ))}
              </View>
            </View>

            {/* Font Size */}
            <View style={styles.settingGroup}>
              <View style={styles.sliderHeader}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.settingLabel}
                >
                  FONT SIZE
                </ThemedText>
                <ThemedText variant="accent" size="body" weight="semibold">
                  {typography.fontSize}px
                </ThemedText>
              </View>
              <View style={styles.sliderContainer}>
                <ThemedText variant="secondary" size="caption">12</ThemedText>
                <View style={styles.slider}>
                  <View 
                    style={[
                      styles.sliderTrack, 
                      { backgroundColor: currentTheme.secondaryText + '30' }
                    ]}
                  >
                    <View 
                      style={[
                        styles.sliderFill, 
                        { 
                          backgroundColor: currentTheme.accent,
                          width: `${((typography.fontSize - 12) / (28 - 12)) * 100}%`
                        }
                      ]}
                    />
                  </View>
                  <PressableScale
                    style={[
                      styles.sliderThumb,
                      { 
                        backgroundColor: currentTheme.accent,
                        left: `${((typography.fontSize - 12) / (28 - 12)) * 100}%`
                      }
                    ]}
                  />
                </View>
                <ThemedText variant="secondary" size="caption">28</ThemedText>
              </View>
              <View style={styles.sizeButtons}>
                <PressableScale
                  onPress={() => setTypography({ fontSize: Math.max(12, typography.fontSize - 1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="body" weight="bold">A-</ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => setTypography({ fontSize: Math.min(28, typography.fontSize + 1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="header" weight="bold">A+</ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Line Height */}
            <View style={styles.settingGroup}>
              <View style={styles.sliderHeader}>
                <ThemedText
                  variant="secondary"
                  size="caption"
                  weight="medium"
                  style={styles.settingLabel}
                >
                  LINE HEIGHT
                </ThemedText>
                <ThemedText variant="accent" size="body" weight="semibold">
                  {typography.lineHeight.toFixed(1)}
                </ThemedText>
              </View>
              <View style={styles.sizeButtons}>
                <PressableScale
                  onPress={() => setTypography({ lineHeight: Math.max(1.2, typography.lineHeight - 0.1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="body">Compact</ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => setTypography({ lineHeight: Math.min(2.0, typography.lineHeight + 0.1) })}
                  style={[styles.sizeButton, { backgroundColor: currentTheme.cardBackground }]}
                >
                  <ThemedText variant="primary" size="body">Relaxed</ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Text Alignment */}
            <View style={styles.settingGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.settingLabel}
              >
                TEXT ALIGNMENT
              </ThemedText>
              <View style={styles.alignmentOptions}>
                <PressableScale
                  onPress={() => setTypography({ textAlign: 'left' })}
                  style={[
                    styles.alignmentOption,
                    {
                      backgroundColor:
                        typography.textAlign === 'left'
                          ? currentTheme.accent + '20'
                          : currentTheme.cardBackground,
                      borderColor:
                        typography.textAlign === 'left'
                          ? currentTheme.accent
                          : 'transparent',
                    },
                  ]}
                >
                  <AlignLeft
                    size={20}
                    color={
                      typography.textAlign === 'left'
                        ? currentTheme.accent
                        : currentTheme.secondaryText
                    }
                  />
                  <ThemedText
                    variant={typography.textAlign === 'left' ? 'accent' : 'secondary'}
                    size="caption"
                    weight="medium"
                  >
                    Left
                  </ThemedText>
                </PressableScale>
                <PressableScale
                  onPress={() => setTypography({ textAlign: 'justify' })}
                  style={[
                    styles.alignmentOption,
                    {
                      backgroundColor:
                        typography.textAlign === 'justify'
                          ? currentTheme.accent + '20'
                          : currentTheme.cardBackground,
                      borderColor:
                        typography.textAlign === 'justify'
                          ? currentTheme.accent
                          : 'transparent',
                    },
                  ]}
                >
                  <AlignJustify
                    size={20}
                    color={
                      typography.textAlign === 'justify'
                        ? currentTheme.accent
                        : currentTheme.secondaryText
                    }
                  />
                  <ThemedText
                    variant={typography.textAlign === 'justify' ? 'accent' : 'secondary'}
                    size="caption"
                    weight="medium"
                  >
                    Justify
                  </ThemedText>
                </PressableScale>
              </View>
            </View>

            {/* Preview */}
            <View style={styles.settingGroup}>
              <ThemedText
                variant="secondary"
                size="caption"
                weight="medium"
                style={styles.settingLabel}
              >
                PREVIEW
              </ThemedText>
              <View
                style={[
                  styles.preview,
                  { backgroundColor: currentTheme.cardBackground },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: typography.fontSize,
                    lineHeight: typography.fontSize * typography.lineHeight,
                    letterSpacing: typography.letterSpacing,
                    textAlign: typography.textAlign,
                    fontWeight: String(typography.fontWeight) as '400',
                    ...(!isSystemFontValue(typography.fontFamily) && {
                      fontFamily: getNativeFontFamily(typography.fontFamily),
                    }),
                  }}
                >
                  The quick brown fox jumps over the lazy dog. This is a preview of how your reading text will appear with the current typography settings.
                </ThemedText>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Logger Modal */}
      <LoggerModal
        visible={showLoggerModal}
        onClose={() => setShowLoggerModal(false)}
      />

      {/* Permission Modal */}
      <PermissionModal
        visible={showPermissionModal}
        onGrantAccess={async () => {
          setShowPermissionModal(false);
          await openAppSettings();
        }}
        onDismiss={() => setShowPermissionModal(false)}
      />

      <DictionaryLibraryModal
        visible={showDictionaryLibrary}
        onClose={() => setShowDictionaryLibrary(false)}
      />

      <AppDialog
        visible={!!dialogState?.visible}
        title={dialogState?.title || ''}
        message={dialogState?.message || ''}
        tone={dialogState?.tone}
        actions={dialogState?.actions || [{ label: 'OK', onPress: () => setDialogState(null) }]}
        onClose={() => setDialogState(null)}
      />

      {/* Auth Modal */}
      <Modal
        visible={showAuthModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAuthModal(false);
          resetAuthForm();
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.background }]}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <PressableScale onPress={() => {
              setShowAuthModal(false);
              resetAuthForm();
            }}>
              <X size={24} color={currentTheme.secondaryText} />
            </PressableScale>
            <ThemedText variant="primary" size="header" weight="semibold">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.authHeroCard,
                {
                  backgroundColor: currentTheme.cardBackground,
                  borderColor: currentTheme.accent + '22',
                },
              ]}
            >
              <ThemedText variant="accent" size="caption" weight="semibold" style={styles.authHeroLabel}>
                MIYO ACCOUNT
              </ThemedText>
              <ThemedText variant="primary" size="title" weight="bold" style={{ marginBottom: 8 }}>
                {authMode === 'login' ? 'Welcome back' : 'Create your reading profile'}
              </ThemedText>
              <ThemedText variant="secondary" size="body" style={{ lineHeight: 22 }}>
                {authMode === 'login'
                  ? 'Sign in to sync reading progress, save dictionaries, and keep translation tools available across sessions.'
                  : 'Create an account, confirm it by email on this device, and unlock sync, dictionaries, and translation tools.'}
              </ThemedText>

              <View style={styles.authModeSwitch}>
                {(['login', 'signup'] as const).map(mode => {
                  const active = authMode === mode;
                  return (
                    <PressableScale
                      key={mode}
                      onPress={() => {
                        setAuthMode(mode);
                        setAuthError('');
                        setAuthPassword('');
                        setAuthConfirmPassword('');
                      }}
                      style={[
                        styles.authModeChip,
                        {
                          backgroundColor: active ? currentTheme.accent : currentTheme.background,
                          borderColor: active ? currentTheme.accent : currentTheme.secondaryText + '20',
                        },
                      ]}
                    >
                      <ThemedText
                        size="caption"
                        weight="semibold"
                        style={{ color: active ? '#FFFFFF' : currentTheme.text }}
                      >
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                      </ThemedText>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            {authError ? (
              <View style={[styles.authErrorBox, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
                <ThemedText style={{ color: '#EF4444', fontSize: 13, lineHeight: 18 }}>{authError}</ThemedText>
              </View>
            ) : null}

            <View style={[styles.authSectionCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '16' }]}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.settingLabel}>
                GOOGLE ACCOUNT
              </ThemedText>
              <View style={[styles.authNoticeCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
                <ThemedText variant="secondary" size="caption" style={{ lineHeight: 18 }}>
                  Google account sign-in is temporarily disabled in the beta build. Use email and password for now.
                </ThemedText>
              </View>
            </View>

            <View style={[styles.authSectionCard, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '16' }]}>
              <ThemedText variant="secondary" size="caption" weight="medium" style={styles.settingLabel}>
                EMAIL AND PASSWORD
              </ThemedText>
              <ThemedText variant="secondary" size="caption" style={styles.authHelperText}>
                Email/password login is the only account option enabled in this beta build.
              </ThemedText>

              <TextInput
                style={[
                  styles.authInput,
                  {
                    color: currentTheme.text,
                    backgroundColor: currentTheme.background,
                    borderColor: currentTheme.secondaryText + '25',
                  },
                ]}
                placeholder="your@email.com"
                placeholderTextColor={currentTheme.secondaryText + '70'}
                value={authEmail}
                onChangeText={setAuthEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View
                style={[
                  styles.authInputRow,
                  {
                    backgroundColor: currentTheme.background,
                    borderColor: currentTheme.secondaryText + '25',
                  },
                ]}
              >
                <TextInput
                  style={[styles.authInlineInput, { color: currentTheme.text }]}
                  placeholder="Password"
                  placeholderTextColor={currentTheme.secondaryText + '70'}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(value => !value)} hitSlop={10}>
                  {showPassword ? (
                    <EyeOff size={18} color={currentTheme.secondaryText} />
                  ) : (
                    <Eye size={18} color={currentTheme.secondaryText} />
                  )}
                </Pressable>
              </View>

              {authMode === 'signup' ? (
                <View
                  style={[
                    styles.authInputRow,
                    {
                      backgroundColor: currentTheme.background,
                      borderColor: currentTheme.secondaryText + '25',
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.authInlineInput, { color: currentTheme.text }]}
                    placeholder="Confirm password"
                    placeholderTextColor={currentTheme.secondaryText + '70'}
                    value={authConfirmPassword}
                    onChangeText={setAuthConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <Pressable onPress={() => setShowConfirmPassword(value => !value)} hitSlop={10}>
                    {showConfirmPassword ? (
                      <EyeOff size={18} color={currentTheme.secondaryText} />
                    ) : (
                      <Eye size={18} color={currentTheme.secondaryText} />
                    )}
                  </Pressable>
                </View>
              ) : null}

              <View style={[styles.authNoticeCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
                <ThemedText variant="secondary" size="caption" style={{ lineHeight: 18 }}>
                  {authMode === 'login'
                    ? 'Use the same email you verified in Miyo.'
                    : 'Passwords must be at least 8 characters. Create the account, then open the verification email on this device.'}
                </ThemedText>
              </View>

              <PressableScale
                onPress={async () => {
                  setAuthError('');
                  const email = authEmail.trim();
                  const password = authPassword.trim();
                  if (!email || !password) {
                    setAuthError('Please enter both email and password.');
                    return;
                  }
                  if (authMode === 'signup') {
                    if (password.length < 8) {
                      setAuthError('Use at least 8 characters for your password.');
                      return;
                    }
                    if (!authConfirmPassword.trim()) {
                      setAuthError('Confirm your password before creating the account.');
                      return;
                    }
                    if (password !== authConfirmPassword.trim()) {
                      setAuthError('The password confirmation does not match.');
                      return;
                    }
                  }

                  setAuthBusy(true);
                  try {
                    const result =
                      authMode === 'login'
                        ? await signIn(email, password)
                        : await signUp(email, password);
                    if (result.error) {
                      setAuthError(result.error);
                    } else {
                      setShowAuthModal(false);
                      resetAuthForm();
                      showDialog(
                        authMode === 'login' ? 'Signed In' : 'Check Your Email',
                        authMode === 'login'
                          ? 'Signed in successfully.'
                          : 'Account created. Open the verification email on this device to finish setup in Miyo.',
                        'success'
                      );
                    }
                  } finally {
                    setAuthBusy(false);
                  }
                }}
                disabled={authBusy}
                style={[styles.authSubmitBtn, { backgroundColor: currentTheme.accent, opacity: authBusy ? 0.7 : 1 }]}
              >
                <ThemedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                  {authBusy ? 'Working…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                </ThemedText>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                  setAuthPassword('');
                  setAuthConfirmPassword('');
                }}
                style={styles.authToggle}
              >
                <ThemedText variant="secondary" size="body">
                  {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                </ThemedText>
                <ThemedText variant="accent" size="body" weight="semibold">
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </ThemedText>
              </PressableScale>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  title: {
    marginBottom: 24,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  aboutText: {
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  settingGroup: {
    marginBottom: 28,
  },
  settingLabel: {
    letterSpacing: 1,
    marginBottom: 12,
  },
  fontOptions: {
    gap: 8,
  },
  fontOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  slider: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sizeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  alignmentOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  alignmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
  },
  preview: {
    padding: 16,
    borderRadius: 12,
  },
  authErrorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  authHeroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  authHeroLabel: {
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  authModeSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  authModeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  authSectionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  googleBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineGuideBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  authHelperText: {
    lineHeight: 18,
    marginBottom: 12,
  },
  authInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    marginBottom: 10,
  },
  authInputRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  authInlineInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  authNoticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authSubmitBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 18,
  },
  authToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
});
