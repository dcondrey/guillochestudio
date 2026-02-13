import { browser } from '$app/environment';
import { init, register, getLocaleFromNavigator, locale, waitLocale } from 'svelte-i18n';

// Supported locales
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'zh'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Espanol',
  fr: 'Francais',
  de: 'Deutsch',
  ja: 'Japanese',
  zh: 'Chinese',
};

// Default locale
export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

// Cookie name for storing locale preference
export const LOCALE_COOKIE_NAME = 'guilloche_locale';

// Register locales with lazy loading
register('en', () => import('./locales/en.json'));
register('es', () => import('./locales/es.json'));
register('fr', () => import('./locales/fr.json'));
register('de', () => import('./locales/de.json'));
register('ja', () => import('./locales/ja.json'));
register('zh', () => import('./locales/zh.json'));

/**
 * Get the initial locale based on priority:
 * 1. Cookie preference
 * 2. Browser locale
 * 3. Default locale
 */
function getInitialLocale(): string {
  if (browser) {
    // Check for cookie preference
    const cookieLocale = getCookieLocale();
    if (cookieLocale && isValidLocale(cookieLocale)) {
      return cookieLocale;
    }

    // Check browser locale
    const browserLocale = getLocaleFromNavigator();
    if (browserLocale) {
      const shortLocale = browserLocale.split('-')[0];
      if (isValidLocale(shortLocale)) {
        return shortLocale;
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Get locale from cookie
 */
function getCookieLocale(): string | null {
  if (!browser) return null;

  const match = document.cookie.match(new RegExp(`(^| )${LOCALE_COOKIE_NAME}=([^;]+)`));
  return match ? match[2] : null;
}

/**
 * Check if a locale is supported
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Set locale in cookie for persistence
 */
export function setLocaleCookie(locale: SupportedLocale): void {
  if (!browser) return;

  // Set cookie with 1 year expiry
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Initialize i18n with configuration
 */
export function initializeI18n(): void {
  const initialLocale = getInitialLocale();

  init({
    fallbackLocale: FALLBACK_LOCALE,
    initialLocale,
  });
}

/**
 * Change the current locale and persist to cookie
 */
export async function changeLocale(newLocale: SupportedLocale): Promise<void> {
  locale.set(newLocale);
  setLocaleCookie(newLocale);
  await waitLocale(newLocale);
}

/**
 * Get the current locale value
 */
export function getCurrentLocale(): SupportedLocale {
  let currentLocale: SupportedLocale = DEFAULT_LOCALE;
  const unsubscribe = locale.subscribe((value) => {
    if (value && isValidLocale(value)) {
      currentLocale = value;
    }
  });
  unsubscribe();
  return currentLocale;
}

// Re-export svelte-i18n utilities
export { locale, _, t, time, date, number, json } from 'svelte-i18n';
export { waitLocale } from 'svelte-i18n';
