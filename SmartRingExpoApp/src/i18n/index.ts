import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';

const LANGUAGE_KEY = 'app_language_v1';

/** Detect device locale using Intl — no native module required. */
function getDeviceLanguage(): string {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.split(/[-_]/)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

async function getInitialLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved) return saved;
  } catch {}
  const deviceLang = getDeviceLanguage();
  return ['es'].includes(deviceLang) ? deviceLang : 'en';
}

// Bootstrap: init synchronously with 'en', then switch to saved/device lang
i18next
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

// Async switch to the correct language after AsyncStorage is readable
getInitialLanguage().then(lang => {
  if (lang !== i18next.language) {
    i18next.changeLanguage(lang);
  }
});

export default i18next;
