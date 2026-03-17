import { useCallback } from 'react';
import i18next from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'app_language_v1';

export function useLanguage() {
  const changeLanguage = useCallback(async (lang: string) => {
    await i18next.changeLanguage(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    } catch {}
  }, []);

  return {
    currentLanguage: i18next.language,
    changeLanguage,
  };
}
