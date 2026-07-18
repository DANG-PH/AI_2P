import type { Language } from '@/types/meeting'
import type {
  RealtimeErrorEvent,
  SessionParticipantsEvent,
  SessionReadyEvent,
  SttFinalEvent,
  SttPartialEvent,
  TranslateDoneEvent,
  TranslateTokenEvent,
} from '@/types/realtime'

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const asOptionalString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

const asLanguage = (value: unknown): Language | null =>
  value === 'vi' || value === 'en' ? value : null

const participantMetadata = (payload: Record<string, unknown>) => ({
  clientId: asOptionalString(payload.clientId),
  displayName: asOptionalString(payload.displayName),
})

export const parseSessionReady = (
  value: unknown,
): SessionReadyEvent | null => {
  const payload = asRecord(value)
  const clientId = payload && asNonEmptyString(payload.clientId)
  const sessionId = payload && asNonEmptyString(payload.sessionId)

  return clientId && sessionId
    ? { type: 'session.ready', clientId, sessionId }
    : null
}

export const parseSessionParticipants = (
  value: unknown,
): SessionParticipantsEvent => {
  const payload = asRecord(value)
  const candidates = Array.isArray(payload?.participants)
    ? payload.participants
    : []

  return {
    type: 'session.participants',
    participants: candidates.flatMap((candidate) => {
      const participant = asRecord(candidate)
      const clientId =
        participant && asNonEmptyString(participant.clientId)
      const displayName =
        participant && asOptionalString(participant.displayName)
      const language = participant && asLanguage(participant.language)

      if (!clientId || displayName === null) {
        return []
      }

      return [
        {
          clientId,
          displayName,
          ...(language ? { language } : {}),
        },
      ]
    }),
  }
}

export const parseSttPartial = (
  value: unknown,
): SttPartialEvent | null => {
  const payload = asRecord(value)
  const text = payload && asOptionalString(payload.text)
  const speaker = payload && asLanguage(payload.speaker)
  const utteranceId = payload && asNonEmptyString(payload.utteranceId)

  return payload && text !== null && speaker && utteranceId
    ? {
        type: 'stt.partial',
        text,
        speaker,
        utteranceId,
        ...participantMetadata(payload),
      }
    : null
}

export const parseSttFinal = (
  value: unknown,
): SttFinalEvent | null => {
  const event = parseSttPartial(value)

  return event ? { ...event, type: 'stt.final' } : null
}

export const parseTranslateToken = (
  value: unknown,
): TranslateTokenEvent | null => {
  const payload = asRecord(value)
  const token = payload && asOptionalString(payload.token)
  const utteranceId = payload && asNonEmptyString(payload.utteranceId)

  return payload && token !== null && utteranceId
    ? {
        type: 'translate.token',
        token,
        utteranceId,
        ...(payload.reset === true ? { reset: true } : {}),
        ...participantMetadata(payload),
      }
    : null
}

export const parseTranslateDone = (
  value: unknown,
): TranslateDoneEvent | null => {
  const payload = asRecord(value)
  const fullText = payload && asOptionalString(payload.fullText)
  const sourceText = payload && asOptionalString(payload.sourceText)
  const speaker = payload && asLanguage(payload.speaker)
  const utteranceId = payload && asNonEmptyString(payload.utteranceId)

  return (
    payload &&
    fullText !== null &&
    sourceText !== null &&
    speaker &&
    utteranceId
      ? {
          type: 'translate.done',
          fullText,
          sourceText,
          speaker,
          utteranceId,
          ...participantMetadata(payload),
        }
      : null
  )
}

export const parseRealtimeError = (
  value: unknown,
): RealtimeErrorEvent => {
  const payload = asRecord(value)

  return {
    type: 'error',
    code:
      (payload && asNonEmptyString(payload.code)) ?? 'UNKNOWN_ERROR',
    message:
      (payload && asOptionalString(payload.message)) ??
      'REALTIME_SERVICE_ERROR',
    clientId: payload ? asOptionalString(payload.clientId) : null,
    displayName: payload
      ? asOptionalString(payload.displayName)
      : null,
  }
}
