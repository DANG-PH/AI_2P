import { create } from 'zustand'

import { translate } from '@/i18n/translations'
import type { Locale } from '@/types/i18n'

const LOCALE_STORAGE_KEY = 'vienmeet-locale'

const detectInitialLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  try {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (savedLocale === 'en' || savedLocale === 'vi') {
      return savedLocale
    }
  } catch {
    // Browser privacy settings can disable localStorage.
  }

  return window.navigator.language.toLowerCase().startsWith('vi')
    ? 'vi'
    : 'en'
}

const applyLocaleToDocument = (locale: Locale) => {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = locale
  document.title = translate(locale, 'meta.title')

  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  )
  description?.setAttribute(
    'content',
    translate(locale, 'meta.description'),
  )
}

export interface LocaleStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const initialLocale = detectInitialLocale()
applyLocaleToDocument(initialLocale)

export const useLocaleStore = create<LocaleStore>()((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // The locale still changes for the current session.
    }

    applyLocaleToDocument(locale)
    set({ locale })
  },
}))
