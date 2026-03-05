import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import Svg, { Path, Circle } from 'react-native-svg';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthScreen() {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGitHub, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Local loading state for button

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim()) {
      setError(t('auth.error_email_required'));
      return;
    }

    if (mode === 'forgotPassword') {
      setIsSubmitting(true);
      try {
        const result = await resetPassword(email);
        if (result.success) {
          Alert.alert(t('auth.alert_success'), t('auth.alert_reset_sent'));
          setMode('signIn');
        } else {
          setError(result.error || t('auth.error_unexpected'));
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password.trim() || password.length < 6) {
      setError(t('auth.error_password_short'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signUp') {
        const result = await signUp(email, password, displayName || undefined);
        if (!result.success) {
          setError(result.error || t('auth.error_unexpected'));
          setIsSubmitting(false);
        } else if (result.needsEmailConfirmation) {
          Alert.alert(t('auth.alert_success'), t('auth.alert_confirm_sent'));
          setMode('signIn');
          setIsSubmitting(false);
        }
        // If success without email confirmation, don't reset isSubmitting
        // Navigation will happen and component will unmount
      } else {
        const result = await signIn(email, password);
        if (!result.success) {
          setError(result.error || t('auth.error_unexpected'));
          setIsSubmitting(false);
        }
        // If success, don't reset isSubmitting - navigation will happen
      }
    } catch (e) {
      setError(t('auth.error_unexpected'));
      setIsSubmitting(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithGitHub();
      if (!result.success) {
        setError(result.error || t('auth.error_unexpected'));
        setIsSubmitting(false);
      }
      // If success, don't reset - navigation will happen
    } catch (e) {
      setError(t('auth.error_unexpected'));
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.background, '#1a1a2e', colors.background]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoRing}>
              <Svg width={80} height={80} viewBox="0 0 100 100">
                <Circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={colors.primary}
                  strokeWidth="6"
                  fill="none"
                />
                <Circle
                  cx="50"
                  cy="50"
                  r="25"
                  stroke={colors.accent}
                  strokeWidth="4"
                  fill="none"
                  opacity={0.6}
                />
              </Svg>
            </View>
            <Text style={styles.logoText}>{t('auth.logo_text')}</Text>
            <Text style={styles.tagline}>{t('auth.tagline')}</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {mode === 'signIn' && t('auth.title_sign_in')}
              {mode === 'signUp' && t('auth.title_sign_up')}
              {mode === 'forgotPassword' && t('auth.title_forgot_password')}
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {mode === 'signUp' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('auth.label_display_name')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.placeholder_display_name')}
                  placeholderTextColor={colors.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('auth.label_email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.placeholder_email')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {mode !== 'forgotPassword' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('auth.label_password')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.placeholder_password')}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'signIn' && t('auth.button_sign_in')}
                  {mode === 'signUp' && t('auth.button_sign_up')}
                  {mode === 'forgotPassword' && t('auth.button_reset')}
                </Text>
              )}
            </TouchableOpacity>

            {mode !== 'forgotPassword' && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('auth.divider_or')}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.githubButton}
                  onPress={handleGitHubSignIn}
                  disabled={isSubmitting}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.text}>
                    <Path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </Svg>
                  <Text style={styles.githubButtonText}>{t('auth.button_github')}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Mode Switcher */}
            <View style={styles.modeSwitcher}>
              {mode === 'signIn' && (
                <>
                  <TouchableOpacity onPress={() => setMode('forgotPassword')}>
                    <Text style={styles.linkText}>{t('auth.link_forgot')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode('signUp')}>
                    <Text style={styles.linkText}>{t('auth.link_create')}</Text>
                  </TouchableOpacity>
                </>
              )}
              {mode === 'signUp' && (
                <TouchableOpacity onPress={() => setMode('signIn')}>
                  <Text style={styles.linkText}>{t('auth.link_sign_in')}</Text>
                </TouchableOpacity>
              )}
              {mode === 'forgotPassword' && (
                <TouchableOpacity onPress={() => setMode('signIn')}>
                  <Text style={styles.linkText}>{t('auth.link_back')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoRing: {
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
  },
  githubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  githubButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  modeSwitcher: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: fontSize.sm,
  },
});

export default AuthScreen;



