import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowRight, MailCheck, Sparkles } from 'lucide-react-native';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { PressableScale } from '@/components/ui/PressableScale';
import { ThemedAmbientBackdrop } from '@/components/ui/ThemedAmbientBackdrop';
import { useTheme } from '@/context/ThemeContext';
import { verifyEmailLink } from '@/lib/google-oauth';

type Status = 'verifying' | 'success' | 'manual' | 'error';

export default function AuthConfirmScreen() {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
    code?: string;
  }>();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('Finalizing your sign-in link and confirming your email.');

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await verifyEmailLink({
        token_hash: params.token_hash,
        type: params.type,
        code: params.code,
      });

      if (!active) return;
      if (result.success) {
        setStatus(result.requiresManualSignIn ? 'manual' : 'success');
        setMessage(
          result.requiresManualSignIn
            ? 'Your email is verified. Sign in once in Miyo to finish linking this device to your account.'
            : 'Your email is verified. You can return to Miyo and continue reading.'
        );
      } else {
        setStatus('error');
        setMessage(result.error || 'This verification link is invalid or has already been used.');
      }
    })();

    return () => {
      active = false;
    };
  }, [params.code, params.token_hash, params.type]);

  const accentSoft = useMemo(() => currentTheme.accent + '18', [currentTheme.accent]);
  const accentStrong = useMemo(() => currentTheme.accent + '2B', [currentTheme.accent]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.canvas, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
        <ThemedAmbientBackdrop variant="auth" />

        <View style={[styles.card, { backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.secondaryText + '18' }]}>
          <View style={[styles.heroBadge, { backgroundColor: status === 'error' ? '#EF444420' : accentSoft, borderColor: status === 'error' ? '#EF444438' : accentStrong }]}>
            {status === 'error' ? (
              <AlertTriangle size={28} color="#EF4444" />
            ) : status === 'success' ? (
              <MailCheck size={28} color={currentTheme.accent} />
            ) : (
              <Sparkles size={28} color={currentTheme.accent} />
            )}
          </View>

          <ThemedText variant="primary" size="title" weight="bold" style={styles.title}>
            {status === 'verifying'
              ? 'Verifying Your Email'
              : status === 'success'
                ? 'Welcome To Miyo'
                : status === 'manual'
                  ? 'Email Confirmed'
                : 'Verification Failed'}
          </ThemedText>

          <ThemedText variant="secondary" size="body" style={styles.message}>
            {message}
          </ThemedText>

          <View style={[styles.infoPanel, { backgroundColor: currentTheme.background, borderColor: currentTheme.secondaryText + '16' }]}>
            <ThemedText variant="accent" size="caption" weight="semibold" style={styles.infoLabel}>
              RETURN PATH
            </ThemedText>
            <ThemedText variant="primary" size="body" style={styles.infoBody}>
              {status === 'manual'
                ? 'The email redirect worked correctly. This link verified your account, but this device still needs a normal sign-in session.'
                : 'The email redirect returned to the app instead of a dead localhost page. If you reached this screen from your email, the deep link is working correctly.'}
            </ThemedText>
          </View>

          <PressableScale
            onPress={() => router.replace(status === 'manual' ? '/settings' : '/library')}
            style={[styles.primaryButton, { backgroundColor: status === 'error' ? '#EF4444' : currentTheme.accent }]}
          >
            <ThemedText style={styles.primaryButtonText}>
              {status === 'manual' ? 'Open Sign-In' : status === 'success' ? 'Open Library' : 'Back To Miyo'}
            </ThemedText>
            <ArrowRight size={18} color="#FFFFFF" />
          </PressableScale>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 34,
    elevation: 16,
  },
  heroBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 18,
  },
  infoPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  infoLabel: {
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  infoBody: {
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
