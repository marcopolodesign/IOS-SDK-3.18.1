import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { FocusLogo } from '../components/common/FocusLogo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ONBOARDING_BG = require('../../assets/onboarding-bg.jpg');
const PLACEHOLDER_COLOR = '#A5A5A5';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const SHEET_TITLES: Record<AuthMode, string> = {
  signIn: 'auth.button_continue_mail',
  signUp: 'auth.title_sign_up',
  forgotPassword: 'auth.title_forgot_password',
};

const SUBMIT_LABELS: Record<AuthMode, string> = {
  signIn: 'auth.button_sign_in',
  signUp: 'auth.button_sign_up',
  forgotPassword: 'auth.button_reset',
};

export function AuthScreen() {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { currentLanguage, changeLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openMailSheet = () => {
    setMode('signIn');
    setError(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
    bottomSheetRef.current?.expand();
  };

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
        } else if (result.needsEmailConfirmation) {
          Alert.alert(t('auth.alert_success'), t('auth.alert_confirm_sent'));
          setMode('signIn');
        }
      } else {
        const result = await signIn(email, password);
        if (!result.success) {
          setError(result.error || t('auth.error_unexpected'));
        }
      }
    } catch (e) {
      setError(t('auth.error_unexpected'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        setError(result.error || t('auth.error_unexpected'));
      }
    } catch (e) {
      setError(t('auth.error_unexpected'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Small snap for content, large snap for keyboard
  const snapPoints = useMemo(() => {
    const contentSnap = mode === 'signUp' ? '52%' : mode === 'forgotPassword' ? '32%' : '42%';
    return [contentSnap, '80%'];
  }, [mode]);

  // Snap sheet up when keyboard opens, back down when it closes
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      bottomSheetRef.current?.snapToIndex(1);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      bottomSheetRef.current?.snapToIndex(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleSheetChange = useCallback((_from: number, toIndex: number) => {
    if (toIndex >= 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={ONBOARDING_BG}
        style={styles.background}
        resizeMode="cover"
      >
        {/* Language toggle */}
        <TouchableOpacity
          style={[styles.langToggle, { top: insets.top + 12 }]}
          onPress={() => changeLanguage(currentLanguage === 'en' ? 'es' : 'en')}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={16} color="#fff" />
          <Text style={styles.langToggleText}>
            {currentLanguage.toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Bottom content area */}
        <View style={styles.bottomContent}>
          <View style={styles.logoContainer}>
            <FocusLogo width={200} height={79} />
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.whiteButton}
              onPress={handleGoogleSignIn}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons name="logo-google" size={20} color="#000" />
                  <Text style={styles.whiteButtonText}>
                    {t('auth.button_continue_google')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.whiteButton}
              onPress={openMailSheet}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <View style={styles.buttonRow}>
                <Ionicons name="mail-outline" size={20} color="#000" />
                <Text style={styles.whiteButtonText}>
                  {t('auth.button_continue_mail')}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.troubleText}>
              {t('auth.login_trouble')}{' '}
              <Text
                style={styles.contactLink}
                onPress={() => Linking.openURL('mailto:support@focusring.com')}
              >
                {t('auth.contact_us')}
              </Text>
            </Text>
          </View>
        </View>
      </ImageBackground>

      {/* Email auth bottom sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        onAnimate={handleSheetChange}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleComponent={null}
        handleStyle={styles.handle}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={10}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Text style={styles.sheetTitle}>
              {t(SHEET_TITLES[mode])}
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
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder={t('auth.placeholder_email')}
              placeholderTextColor={PLACEHOLDER_COLOR}
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
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            )}

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {t(SUBMIT_LABELS[mode])}
                </Text>
              )}
            </TouchableOpacity>

            {/* Mode switcher */}
            <View style={styles.modeSwitcher}>
              {mode === 'signIn' && (
                <>
                  <Text style={styles.switcherText}>
                    {t('auth.first_time')}{' '}
                    <Text
                      style={styles.switcherLink}
                      onPress={() => setMode('signUp')}
                    >
                      {t('auth.link_create')}
                    </Text>
                  </Text>
                  <TouchableOpacity onPress={() => setMode('forgotPassword')}>
                    <Text style={styles.switcherLink}>{t('auth.link_forgot')}</Text>
                  </TouchableOpacity>
                </>
              )}
              {mode === 'signUp' && (
                <Text style={styles.switcherText}>
                  {t('auth.already_have_account')}{' '}
                  <Text
                    style={styles.switcherLink}
                    onPress={() => setMode('signIn')}
                  >
                    {t('auth.button_sign_in')}
                  </Text>
                </Text>
              )}
              {mode === 'forgotPassword' && (
                <TouchableOpacity onPress={() => setMode('signIn')}>
                  <Text style={styles.switcherLink}>{t('auth.link_back')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonsContainer: {
    gap: 16,
    alignItems: 'center',
  },
  whiteButton: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingVertical: 20,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whiteButtonText: {
    color: '#000',
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  langToggle: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langToggleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  troubleText: {
    color: '#ccc',
    fontSize: 13,
    letterSpacing: -0.26,
    marginTop: 4,
  },
  contactLink: {
    textDecorationLine: 'underline',
  },
  // Bottom sheet styles
  sheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    height: 0,
  },
  sheetContent: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 26,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 21,
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
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: fontSize.lg,
    color: '#000',
    borderWidth: 1,
    borderColor: PLACEHOLDER_COLOR,
    marginBottom: spacing.md,
  },
  submitButton: {
    backgroundColor: '#000',
    borderRadius: borderRadius.md,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  modeSwitcher: {
    marginTop: 21,
    alignItems: 'center',
    gap: spacing.md,
  },
  switcherText: {
    color: PLACEHOLDER_COLOR,
    fontSize: fontSize.lg,
    letterSpacing: -0.32,
  },
  switcherLink: {
    color: PLACEHOLDER_COLOR,
    fontSize: fontSize.lg,
    letterSpacing: -0.32,
    textDecorationLine: 'underline' as const,
  },
});

export default AuthScreen;
