import { translate } from '@/i18n/translations'
import { formatElapsedTime, formatLanguagePair } from './formatters'
import type { Locale } from '@/types/i18n'
import type { ConversationTurn, Meeting } from '../types/meeting'

export const formatTranscriptTurn = (
  turn: ConversationTurn,
  locale: Locale,
): string => {
  const languageLabel = (language: ConversationTurn['sourceLanguage']) =>
    translate(
      locale,
      language === 'vi' ? 'common.vietnamese' : 'common.english',
    )
  const editedLabel = turn.isEdited
    ? ` · ${translate(locale, 'transcript.edited')}`
    : ''

  return [
    `[${formatElapsedTime(turn.timestampSeconds)}] ${turn.speakerName} (${languageLabel(turn.sourceLanguage)})${editedLabel}`,
    `${translate(locale, 'transcript.original')} — ${languageLabel(turn.sourceLanguage)}:`,
    turn.originalText,
    `${translate(locale, 'transcript.translation')} — ${languageLabel(turn.targetLanguage)}:`,
    turn.translatedText,
  ].join('\n')
}

export const createTranscriptText = (
  meeting: Meeting,
  locale: Locale,
): string => {
  const header = [
    translate(locale, 'transcript.title'),
    meeting.title,
    `${translate(locale, 'transcript.languages')}: ${formatLanguagePair(meeting.languageOrder, locale)}`,
    `${translate(locale, 'transcript.duration')}: ${formatElapsedTime(meeting.durationSeconds)}`,
  ]

  const transcript =
    meeting.turns.length > 0
      ? meeting.turns
          .map((turn) => formatTranscriptTurn(turn, locale))
          .join('\n\n')
      : translate(locale, 'transcript.empty')

  return `${header.join('\n')}\n\n${transcript}\n`
}

const sanitizeFileName = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'meeting'
}

export const createTranscriptFileName = (meetingTitle: string): string =>
  `${sanitizeFileName(meetingTitle)}-transcript.txt`
