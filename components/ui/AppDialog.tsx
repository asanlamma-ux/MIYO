import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';

export type AppDialogTone = 'default' | 'success' | 'danger' | 'warning';

export interface AppDialogAction {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}

interface AppDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  tone?: AppDialogTone;
  actions: AppDialogAction[];
  onClose: () => void;
  dismissible?: boolean;
  children?: React.ReactNode;
}

function getToneIcon(tone: AppDialogTone, color: string) {
  switch (tone) {
    case 'success':
      return <CheckCircle2 size={26} color={color} />;
    case 'danger':
      return <XCircle size={26} color={color} />;
    case 'warning':
      return <AlertTriangle size={26} color={color} />;
    default:
      return <Info size={26} color={color} />;
  }
}

export function AppDialog({
  visible,
  title,
  message,
  tone = 'default',
  actions,
  onClose,
  dismissible = true,
  children,
}: AppDialogProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toneColor =
    tone === 'success'
      ? '#22C55E'
      : tone === 'danger'
        ? '#EF4444'
        : tone === 'warning'
          ? '#F59E0B'
          : currentTheme.accent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissible ? onClose : undefined}
        />
        <View
          style={[
            styles.card,
            {
              marginTop: insets.top + 24,
              marginBottom: Math.max(insets.bottom, 16) + 24,
              backgroundColor: currentTheme.cardBackground,
              borderColor: currentTheme.secondaryText + '18',
              shadowColor: '#000',
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: toneColor + '15' }]}>
              {getToneIcon(tone, toneColor)}
            </View>
            <ThemedText
              variant="primary"
              size="header"
              weight="bold"
              style={styles.title}
            >
              {title}
            </ThemedText>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {message ? (
              <ThemedText
                variant="secondary"
                size="body"
                style={styles.message}
              >
                {message}
              </ThemedText>
            ) : null}
            {children}
          </ScrollView>

          <View style={styles.actions}>
            {actions.map((action, index) => {
              const variant = action.variant || (index === actions.length - 1 ? 'primary' : 'secondary');
              const backgroundColor =
                variant === 'primary'
                  ? currentTheme.accent
                  : variant === 'danger'
                    ? '#EF4444'
                    : variant === 'ghost'
                      ? 'transparent'
                      : currentTheme.background;
              const borderColor =
                variant === 'ghost'
                  ? 'transparent'
                  : variant === 'primary'
                    ? currentTheme.accent
                    : variant === 'danger'
                      ? '#EF4444'
                      : currentTheme.secondaryText + '20';
              const textColor =
                variant === 'primary' || variant === 'danger'
                  ? '#FFFFFF'
                  : variant === 'ghost'
                    ? currentTheme.secondaryText
                    : currentTheme.text;

              return (
                <PressableScale
                  key={`${action.label}-${index}`}
                  onPress={action.onPress}
                  disabled={action.disabled}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor,
                      borderColor,
                      opacity: action.disabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: textColor,
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {action.label}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 8, 0.56)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    maxHeight: Platform.OS === 'web' ? '80%' : '72%',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 18,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  bodyScroll: {
    maxHeight: 260,
  },
  bodyContent: {
    gap: 12,
  },
  message: {
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 120,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
