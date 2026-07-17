import { useCallback } from 'react'

import {
  translate,
  type TranslationKey,
} from '@/i18n/translations'
import { useLocaleStore } from '@/store/localeStore'
import type { TranslationValues } from '@/types/i18n'

export function useTranslation() {
  const locale = useLocaleStore((state) => state.locale)
  const setLocale = useLocaleStore((state) => state.setLocale)
  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) =>
      translate(locale, key, values),
    [locale],
  )

  return { locale, setLocale, t }
}
