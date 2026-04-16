/**
 * Storage Permission Utility for Miyo EPUB Reader
 * Handles storage permission requests for Android
 */

import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { logger } from './logger';

const PERMISSION_ASKED_KEY = '@miyo/permission_asked';
const PERMISSION_GRANTED_KEY = '@miyo/permission_granted';
const STORAGE_DIR_KEY = '@miyo/storage_directory';

export interface PermissionStatus {
  hasAsked: boolean;
  isGranted: boolean;
}

/**
 * Check if storage permission has been requested before
 */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  try {
    const [hasAsked, isGranted] = await Promise.all([
      AsyncStorage.getItem(PERMISSION_ASKED_KEY),
      AsyncStorage.getItem(PERMISSION_GRANTED_KEY),
    ]);

    return {
      hasAsked: hasAsked === 'true',
      isGranted: isGranted === 'true',
    };
  } catch (error) {
    logger.error('Failed to get permission status', error);
    return { hasAsked: false, isGranted: false };
  }
}

/**
 * Mark that permission has been asked
 */
export async function markPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');
    logger.info('Permission marked as asked');
  } catch (error) {
    logger.error('Failed to mark permission as asked', error);
  }
}

/**
 * Mark that permission has been granted/ or selected an internal or storage folder
 */
export async function markPermissionGranted(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_GRANTED_KEY, granted ? 'true' : 'false');
    logger.info(`Permission granted status: ${granted}`);
  } catch (error) {
    logger.error('Failed to mark permission granted', error);
  }
}

/**
 * Open device settings for the app
 */
export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Linking.openSettings();
      logger.info('Opened app settings');
    } else if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
      logger.info('Opened iOS app settings');
    }
  } catch (error) {
    logger.error('Failed to open app settings', error);
    Alert.alert(
      'Unable to Open Settings',
      'Please manually open your device settings and grant storage permission to Miyo.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Prompt user to select a directory using StorageAccessFramework
 */
export async function requestStorageDirectory(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        await AsyncStorage.setItem(STORAGE_DIR_KEY, permissions.directoryUri);
        logger.info('Storage directory picked', { uri: permissions.directoryUri });
        return permissions.directoryUri;
      }
    }
  } catch (error) {
    logger.error('Failed to request storage directory', error);
  }
  return null;
}

/**
 * Get the saved storage directory URI
 */
export async function getStorageDirectory(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_DIR_KEY);
  } catch (error) {
    logger.error('Failed to get storage directory', error);
    return null;
  }
}

export function getStorageDirectoryLabel(uri: string | null | undefined): string {
  if (!uri) return 'No folder selected';
  try {
    const decoded = decodeURIComponent(uri);
    const marker = '/tree/';
    const markerIndex = decoded.indexOf(marker);
    const relevant = markerIndex >= 0 ? decoded.slice(markerIndex + marker.length) : decoded;
    return relevant.replace(/^primary:/, 'Internal storage/');
  } catch {
    return 'Selected Android folder';
  }
}

/**
 * Reset permission status (for testing)
 */
export async function resetPermissionStatus(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(PERMISSION_ASKED_KEY),
      AsyncStorage.removeItem(PERMISSION_GRANTED_KEY),
    ]);
    logger.info('Permission status reset');
  } catch (error) {
    logger.error('Failed to reset permission status', error);
  }
}
