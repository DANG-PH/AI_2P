import type {
  ConversationTurn,
  Language,
  Meeting,
} from '@/types/meeting'
import type { RealtimeTranscriptEvent } from '@/types/realtime'

export interface RealtimeTranscriptUpdate {
  meeting: Meeting
  activeTurnId: string
}

const getTargetLanguage = (sourceLanguage: Language): Language =>
  sourceLanguage === 'vi' ? 'en' : 'vi'

const getElapsedSeconds = (meeting: Meeting, receivedAt: number): number => {
  if (meeting.startedAt === null) {
    return 0
  }

  const startedAt = new Date(meeting.startedAt).getTime()

  if (!Number.isFinite(startedAt)) {
    return 0
  }

  return Math.max(0, Math.floor((receivedAt - startedAt) / 1_000))
}

const createTurn = (
  meeting: Meeting,
  event: Exclude<
    RealtimeTranscriptEvent,
    { type: 'translate.token' }
  >,
  receivedAt: number,
): ConversationTurn => {
  const speaker =
    meeting.participants.find((participant) => participant.id === event.clientId) ??
    meeting.participants.find((participant) => participant.language === event.speaker)
  const speakerName =
    event.displayName?.trim() ||
    speaker?.name.trim() ||
    event.speaker.toUpperCase()

  return {
    id: event.utteranceId,
    roomId: meeting.id,
    sequenceNumber: meeting.turns.length + 1,
    speakerId: event.clientId ?? speaker?.id ?? `speaker-${event.speaker}`,
    speakerName,
    sourceLanguage: event.speaker,
    targetLanguage: getTargetLanguage(event.speaker),
    timestampSeconds: getElapsedSeconds(meeting, receivedAt),
    startedAt: receivedAt,
    originalText:
      event.type === 'translate.done' ? event.sourceText : event.text,
    translatedText:
      event.type === 'translate.done' ? event.fullText : '',
    status: event.type === 'stt.partial' ? 'transcribing' : 'draft',
  }
}

export const applyRealtimeTranscriptEvent = (
  meeting: Meeting,
  event: RealtimeTranscriptEvent,
  receivedAt: number,
): RealtimeTranscriptUpdate | null => {
  const currentTurn = meeting.turns.find(
    (turn) => turn.id === event.utteranceId,
  )

  if (
    currentTurn?.status === 'final' &&
    event.type !== 'translate.done'
  ) {
    return null
  }

  let baseTurn = currentTurn

  if (!baseTurn) {
    if (event.type === 'translate.token') {
      return null
    }

    baseTurn = createTurn(meeting, event, receivedAt)
  }

  const eventDisplayName = event.displayName?.trim()
  if (eventDisplayName && baseTurn.speakerName !== eventDisplayName) {
    baseTurn = {
      ...baseTurn,
      speakerName: eventDisplayName,
    }
  }

  let nextTurn: ConversationTurn

  switch (event.type) {
    case 'stt.partial':
      nextTurn = {
        ...baseTurn,
        originalText: event.text,
        status: 'transcribing',
      }
      break
    case 'stt.final':
      nextTurn = {
        ...baseTurn,
        originalText: event.text,
        status: 'draft',
      }
      break
    case 'translate.token':
      nextTurn = {
        ...baseTurn,
        translatedText: `${baseTurn.translatedText}${event.token}`,
        status: 'draft',
      }
      break
    case 'translate.done':
      nextTurn = {
        ...baseTurn,
        originalText: event.sourceText,
        translatedText: event.fullText,
        status: 'final',
        endedAt: receivedAt,
      }
      break
  }

  const turns = currentTurn
    ? meeting.turns.map((turn) => (turn.id === nextTurn.id ? nextTurn : turn))
    : [...meeting.turns, nextTurn]

  return {
    meeting: {
      ...meeting,
      turns,
    },
    activeTurnId: nextTurn.id,
  }
}
