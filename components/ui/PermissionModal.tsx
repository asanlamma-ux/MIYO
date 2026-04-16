import React from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { FolderOpen, Shield, ArrowRight, X } from 'lucide-react-native';

interface PermissionModalProps {
  visible: boolean;
  onGrantAccess: () => void;
  onDismiss: () => void;
}

export function PermissionModal({
  visible,
  onGrantAccess,
  onDismiss,
}: PermissionModalProps) {
  const { currentTheme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: currentTheme.cardBackground },
          ]}
        >
          {/* Close Button */}
          <PressableScale
            onPress={onDismiss}
            style={[
              styles.closeButton,
              { backgroundColor: currentTheme.secondaryText + '15' },
            ]}
          >
            <X size={20} color={currentTheme.secondaryText} />
          </PressableScale>

          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: currentTheme.accent + '15' },
            ]}
          >
            <FolderOpen size={48} color={currentTheme.accent} />
          </View>

          {/* Title */}
          <ThemedText
            variant="primary"
            size="header"
            weight="bold"
            style={styles.title}
          >
            Storage Access Required
          </ThemedText>

          {/* Description */}
          <ThemedText
            variant="secondary"
            size="body"
            style={styles.description}
          >
            Miyo needs you to select a home folder to import and store your EPUB files. Your
            books stay securely on your device and are never uploaded.
          </ThemedText>

          {/* Features List */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: currentTheme.accent + '15' },
                ]}
              >
                <FolderOpen size={18} color={currentTheme.accent} />
              </View>
              <View style={styles.featureText}>
                <ThemedText variant="primary" size="body" weight="semibold">
                  Import EPUB Files
                </ThemedText>
                <ThemedText variant="secondary" size="caption">
                  Add books from your device storage
                </ThemedText>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: currentTheme.accent + '15' },
                ]}
              >
                <Shield size={18} color={currentTheme.accent} />
              </View>
              <View style={styles.featureText}>
                <ThemedText variant="primary" size="body" weight="semibold">
                  Offline & Private
                </ThemedText>
                <ThemedText variant="secondary" size="caption">
                  All data stays on your device
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PressableScale
              onPress={onGrantAccess}
              style={[
                styles.grantButton,
                { backgroundColor: currentTheme.accent },
              ]}
            >
              <ThemedText
                size="body"
                weight="semibold"
                style={{ color: '#FFFFFF' }}
              >
                Grant Access
              </ThemedText>
              <ArrowRight size={18} color="#FFFFFF" />
            </PressableScale>

            <PressableScale onPress={onDismiss} style={styles.laterButton}>
              <ThemedText variant="secondary" size="body" weight="medium">
                Maybe Later
              </ThemedText>
            </PressableScale>
          </View>

          {/* Note */}
          <ThemedText
            variant="secondary"
            size="caption"
            style={styles.note}
          >
            {Platform.OS === 'android'
              ? "You'll be asked to pick a folder (like 'MiyoBooks') to safely store your library."
              : 'You can change this later in Settings.'}
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  featuresList: {
    width: '100%',
    gap: 16,
    marginBottom: 28,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  grantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  note: {
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
