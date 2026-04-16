import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar, setStatusBarBackgroundColor } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LibraryProvider, useLibrary } from '@/context/LibraryContext';
import { AuthProvider } from '@/context/AuthContext';
import { TermsProvider } from '@/context/TermsContext';
import { SyncProvider } from '@/context/SyncContext';
import { DictionaryProvider } from '@/context/DictionaryContext';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { PermissionModal } from '@/components/ui/PermissionModal';
import {
  getPermissionStatus,
  markPermissionAsked,
  markPermissionGranted,
  requestStorageDirectory,
  getStorageDirectory,
} from '@/utils/permissions';
import { importBookFromSource } from '@/utils/library-import';
import { logger } from '@/utils/logger';
import { nativeFontLoadMap } from '@/utils/fonts';
import 'react-native-reanimated';
import '../global.css';

// Prevent the splash screen from auto-hiding before asset loading is complete.
ExpoSplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { currentTheme, isLoading } = useTheme();
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const { addBook, books } = useLibrary();

  // Listen for incoming Intents (.epub files opened with Miyo)
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      // expo-linking will provide the file intent uri
      try {
        if (url.includes('.epub') || url.startsWith('content://') || url.startsWith('file://')) {
          logger.info('Received incoming file intent', { url });
          const storageDir = await getStorageDirectory();
          await importBookFromSource({
            sourceUri: url,
            sourceFileName: `Intent_Import_${Date.now()}.epub`,
            existingBooks: books,
            storageDirUri: storageDir,
            addBook,
            usedNames: new Set(),
          });
          logger.info('Successfully imported intent file.');
        }
      } catch (err) {
        logger.error('Failed to import incoming intent file', err);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [addBook, books]);

  // Update status bar color when theme changes
  useEffect(() => {
    if (Platform.OS === 'android') {
      setStatusBarBackgroundColor(currentTheme.background, true);
    }
  }, [currentTheme]);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const status = await getPermissionStatus();
        logger.info('Permission status checked', status);
        
        // Show modal if permission hasn't been asked yet
        if (!status.hasAsked) {
          // Delay showing modal until after splash
          setTimeout(() => {
            setShowPermissionModal(true);
          }, 2500);
        }
      } catch (error) {
        logger.error('Failed to check permission status', error);
      } finally {
        setPermissionChecked(true);
      }
    };

    checkPermission();
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowCustomSplash(false);
    logger.info('Splash screen completed');
  }, []);

  const handleGrantAccess = async () => {
    try {
      await markPermissionAsked();
      await markPermissionGranted(true);
      setShowPermissionModal(false);
      logger.info('User granted permission, opening SAF directory picker');
      await requestStorageDirectory();
    } catch (error) {
      logger.error('Error handling grant access', error);
    }
  };

  const handleDismissPermission = async () => {
    try {
      await markPermissionAsked();
      await markPermissionGranted(false);
      setShowPermissionModal(false);
      logger.info('User dismissed permission modal');
    } catch (error) {
      logger.error('Error dismissing permission modal', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar
        style={currentTheme.isDark ? 'light' : 'dark'}
        backgroundColor={currentTheme.background}
        translucent={false}
      />
      <Stack
        screenOptions={({ route }) => ({
          headerShown: !route.name.startsWith('tempobook'),
          contentStyle: { backgroundColor: currentTheme.background },
          animation: 'fade',
          navigationBarColor: currentTheme.background,
        })}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth/confirm"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="reader/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
      </Stack>

      {/* Custom Splash Screen */}
      {showCustomSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {/* Permission Modal */}
      <PermissionModal
        visible={showPermissionModal}
        onGrantAccess={handleGrantAccess}
        onDismiss={handleDismissPermission}
      />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...nativeFontLoadMap,
  });

  useEffect(() => {
    if (loaded) {
      ExpoSplashScreen.hideAsync();
      logger.info('App initialized - fonts loaded');
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider>
        <AuthProvider>
          <LibraryProvider>
            <DictionaryProvider>
              <TermsProvider>
                <SyncProvider>
                  <RootLayoutNav />
                </SyncProvider>
              </TermsProvider>
            </DictionaryProvider>
          </LibraryProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
