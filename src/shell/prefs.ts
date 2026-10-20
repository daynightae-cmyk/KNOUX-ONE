/**
 * KNOUX ONE — Local preferences.
 *
 * Persisted only to the user's local device (`localStorage`). Nothing is ever
 * sent to a remote endpoint. Keys are namespaced to avoid collisions.
 */

const PREFIX = 'knoux.one.';

function load(key: string, fallback: string): string {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const value = window.localStorage.getItem(`${PREFIX}${key}`);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    // Storage disabled or quota exceeded: preference is session-only.
  }
}

export type KnouxStoredTheme = 'dark' | 'light' | 'system';
export type KnouxStoredLanguage = 'en' | 'ar';

export const loadTheme = (): KnouxStoredTheme => load('theme', 'dark') as KnouxStoredTheme;
export const saveTheme = (value: KnouxStoredTheme): void => save('theme', value);

export const loadLanguage = (): KnouxStoredLanguage => load('lang', 'en') as KnouxStoredLanguage;
export const saveLanguage = (value: KnouxStoredLanguage): void => save('lang', value);

export const loadFirstRunWizardCompleted = (): boolean => load('firstRunCompleted', 'false') === 'true';
export const saveFirstRunWizardCompleted = (value: boolean): void => save('firstRunCompleted', value ? 'true' : 'false');

export const clearAll = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
};
