import type { Language } from '@/types/meeting'

export interface SessionReadyEvent {
  type: 'session.ready'
  clientId: string
  sessionId: string
}

export interface SessionParticipantsEvent {
  type: 'session.participants'
  participants: Array<{
    clientId: string
    displayName: string
    language?: Language
  }>
}

export interface SttPartialEvent {
  type: 'stt.partial'
  text: string
  speaker: Language
  utteranceId: string
  clientId?: string | null
  displayName?: string | null
}

export interface SttFinalEvent {
  type: 'stt.final'
  text: string
  speaker: Language
  utteranceId: string
  clientId?: string | null
  displayName?: string | null
}

export interface TranslateTokenEvent {
  type: 'translate.token'
  token: string
  utteranceId: string
  clientId?: string | null
  displayName?: string | null
}

export interface TranslateDoneEvent {
  type: 'translate.done'
  fullText: string
  sourceText: string
  speaker: Language
  utteranceId: string
  clientId?: string | null
  displayName?: string | null
}

export interface SessionEndedEvent {
  type: 'session.ended'
}

export interface RealtimeErrorEvent {
  type: 'error'
  code: string
  message: string
}

export type RealtimeTranscriptEvent =
  | SttPartialEvent
  | SttFinalEvent
  | TranslateTokenEvent
  | TranslateDoneEvent

export type RealtimeServerEvent =
  | SessionReadyEvent
  | SessionParticipantsEvent
  | RealtimeTranscriptEvent
  | SessionEndedEvent
  | RealtimeErrorEvent

export type RealtimeSessionStatus =
  | 'connecting'
  | 'gateway-connected'
  | 'ended'
  | 'error'

export interface RealtimeSessionState {
  clientId: string
  status: RealtimeSessionStatus
  lastError: RealtimeErrorEvent | null
}

export interface RealtimeConnectionQuery {
  sessionId: string
  clientId: string
  domain: 'business'
  languagePair: 'vi-en'
}

export interface SpeakerSwitchCommand {
  speaker: Language
}

export interface LiveKitTokenRequest {
  roomName: string
  participantName: string
  displayName: string
  language: Language
}

export interface LiveKitTokenResponse {
  token: string
  url: string
}
