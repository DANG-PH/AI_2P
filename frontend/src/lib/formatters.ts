import { translate } from '@/i18n/translations'
import type { Locale } from '@/types/i18n'
import type { LanguageOrder } from '../types/meeting'

const padTimePart = (value: number): string =>
  Math.max(0, Math.floor(value)).toString().padStart(2, '0')

export const formatElapsedTime = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3_600)
  const minutes = Math.floor((safeSeconds % 3_600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}`
  }

  return `${padTimePart(minutes)}:${padTimePart(seconds)}`
}

export const formatDurationLabel = (
  totalSeconds: number,
  locale: Locale = 'en',
): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3_600)
  const minutes = Math.floor((safeSeconds % 3_600) / 60)
  const seconds = safeSeconds % 60
  const unitSeparator = locale === 'vi' ? ' ' : ''

  if (hours > 0) {
    return `${hours}${unitSeparator}${translate(locale, 'time.hourShort')} ${minutes}${unitSeparator}${translate(locale, 'time.minuteShort')} ${seconds}${unitSeparator}${translate(locale, 'time.secondShort')}`
  }

  if (minutes > 0) {
    return `${minutes}${unitSeparator}${translate(locale, 'time.minuteShort')} ${seconds}${unitSeparator}${translate(locale, 'time.secondShort')}`
  }

  return `${seconds}${unitSeparator}${translate(locale, 'time.secondShort')}`
}

export const formatLanguagePair = (
  languageOrder: LanguageOrder,
  locale: Locale = 'en',
): string => {
  const languageLabel = (language: LanguageOrder[number]) =>
    translate(
      locale,
      language === 'vi' ? 'common.vietnamese' : 'common.english',
    )

  return `${languageLabel(languageOrder[0])} ⇄ ${languageLabel(languageOrder[1])}`
}

export const formatLatency = (latencyMs: number): string =>
  `~${Math.max(0, Math.round(latencyMs))} ms`

export const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return '—'
  }

  if (words.length === 1) {
    return words[0]?.slice(0, 2).toLocaleUpperCase() ?? '—'
  }

  const firstInitial = words[0]?.slice(0, 1) ?? ''
  const lastInitial = words.at(-1)?.slice(0, 1) ?? ''

  return `${firstInitial}${lastInitial}`.toLocaleUpperCase()
}

export const formatDateTime = (
  isoTimestamp: string,
  locale = 'en',
): string => {
  const date = new Date(isoTimestamp)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
