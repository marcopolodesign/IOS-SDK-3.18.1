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
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const RING_HERO = require('../../assets/images/ring-hero.png');

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthScreen() {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGitHub, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      } else {
        const result = await signIn(email, password);
        if (!result.success) {
          setError(result.error || t('auth.error_unexpected'));
          setIsSubmitting(false);
        }
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
    } catch (e) {
      setError(t('auth.error_unexpected'));
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Ring hero */}
      <View style={styles.heroSection}>
        <Image source={RING_HERO} style={styles.ringImage} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', '#000000']}
          style={styles.heroFade}
        />
      </View>

      {/* Brand */}
      <View style={styles.brandSection}>
        <Text style={styles.brandName}>{t('auth.logo_text')}</Text>
        <Text style={styles.tagline}>{t('auth.tagline')}</Text>
      </View>

      {/* Form */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formWrapper}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>
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
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholder_display_name')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder={t('auth.placeholder_email')}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {mode !== 'forgotPassword' && (
            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholder_password')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textInverse} />
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
                activeOpacity={0.8}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
                  <Path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </Svg>
                <Text style={styles.githubButtonText}>{t('auth.button_github')}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Mode switcher */}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const HERO_HEIGHT = height * 0.38;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  heroSection: {
    height: HERO_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  ringImage: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.5,
  },
  brandSection: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  brandName: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  formWrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: spacing.md,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  githubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: spacing.md,
  },
  githubButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  modeSwitcher: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  linkText: {
    color: colors.primary,
    fontSize: fontSize.sm,
  },
});

export default AuthScreen;
