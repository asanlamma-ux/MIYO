import React from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { isSafeEmbeddedUrl, isSafeExternalUrl } from '@/utils/url-safety';

type Props = {
  visible: boolean;
  title: string;
  uri: string;
  onClose: () => void;
};

/**
 * In-app browser for dictionary / Wikipedia so the user stays in the app.
 */
export function InlineLookupModal({ visible, title, uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: currentTheme.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: currentTheme.secondaryText + '22' }]}>
          <View style={styles.headerText}>
            <ThemedText variant="primary" size="body" weight="semibold" numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText variant="secondary" size="caption" numberOfLines={1}>
              In-app view · stays in Miyo
            </ThemedText>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.65 }]}
            accessibilityLabel="Close"
          >
            <X size={24} color={currentTheme.text} />
          </Pressable>
        </View>
        <WebView
          source={{ uri }}
          style={styles.web}
          originWhitelist={['https://*', 'http://*', 'about:blank']}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: currentTheme.background }]}>
              <ActivityIndicator size="large" color={currentTheme.accent} />
            </View>
          )}
          onShouldStartLoadWithRequest={request => {
            return isSafeEmbeddedUrl(request.url) || isSafeExternalUrl(request.url);
          }}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          {...(Platform.OS === 'android' ? { overScrollMode: 'never' as const } : {})}
        />
        <View style={{ height: Math.max(insets.bottom, 8) }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
