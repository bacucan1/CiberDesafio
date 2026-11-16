import { Injectable, computed, signal } from '@angular/core';
import { SupportedLanguage, TRANSLATIONS, Translations } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = 'ciberdesafio.language';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private readonly languageSignal = signal<SupportedLanguage>(this.detectInitialLanguage());

  readonly currentLanguage = this.languageSignal.asReadonly();
  readonly supportedLanguages: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ];

  private detectInitialLanguage(): SupportedLanguage {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
        if (stored && (stored === 'es' || stored === 'en' || stored === 'fr')) {
          return stored;
        }
      } catch {
        // ignore
      }
    }

    if (typeof navigator !== 'undefined' && navigator.language) {
      const navLang = navigator.language.slice(0, 2).toLowerCase();
      if (navLang === 'en' || navLang === 'fr') {
        return navLang;
      }
    }

    return 'es';
  }

  setLanguage(lang: SupportedLanguage): void {
    if (lang !== 'es' && lang !== 'en' && lang !== 'fr') return;
    this.languageSignal.set(lang);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch {
        // ignore
      }
    }
  }

  getLanguage(): SupportedLanguage {
    return this.languageSignal();
  }

  t(path: string, params?: Record<string, string | number>): string {
    const lang = this.languageSignal();
    const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.es;
    const fallbackDictionary = TRANSLATIONS.es;

    const value = this.resolvePath(dictionary, path) ?? this.resolvePath(fallbackDictionary, path) ?? path;

    if (typeof value !== 'string') {
      return path;
    }

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce((acc, [k, v]) => {
      return acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
    }, value);
  }

  private resolvePath(dict: Translations, path: string): string | null {
    const keys = path.split('.');
    let current: any = dict;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    return typeof current === 'string' ? current : null;
  }
}

