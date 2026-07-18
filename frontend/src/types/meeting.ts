export type Language = 'vi' | 'en'

export type LanguageOrder = [Language, Language]

export type ConversationMode = 'auto' | 'push-to-talk'

export type TranslationStatus =
  | 'listening'
  | 'transcribing'
  | 'draft'
  | 'final'
  | 'low-confidence'
  | 'failed'

export type MeetingStatus = 'setup' | 'live' | 'ended'

export type MicrophoneTestStatus =
  | 'idle'
  | 'testing'
  | 'complete'
  | 'no-input'
  | 'error'

export type NoiseLevel = 'low' | 'medium' | 'high'

export type ActionItemStatus = 'open' | 'completed'

export interface Participant {
  id: string
  name: string
  language: Language
}

export interface GlossaryTerm {
  id: string
  originalTerm: string
  preferredOutput: string
}

export interface MeetingNote {
  id: string
  text: string
  createdAt: string
}

export interface ConversationTurn {
  id: string
  roomId: string
  sequenceNumber: number
  speakerId: string
  speakerName: string
  sourceLanguage: Language
  targetLanguage: Language
  timestampSeconds: number
  startedAt: number
  endedAt?: number
  originalText: string
  translatedText: string
  status: TranslationStatus
  isEdited?: boolean
}

export interface Meeting {
  id: string
  title: string
  participants: Participant[]
  localLanguage: Language
  conversationMode: ConversationMode
  microphoneId: string
  languageOrder: LanguageOrder
  glossary: GlossaryTerm[]
  turns: ConversationTurn[]
  notes: MeetingNote[]
  status: MeetingStatus
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number
}

export interface ActionItem {
  id: string
  title: string
  owner: string
  status: ActionItemStatus
}

export interface MicrophoneOption {
  id: string
  label: string
}

export type GlossaryTermInput = Omit<GlossaryTerm, 'id'>

export type GlossaryTermUpdate = Partial<GlossaryTermInput>

export type ConversationTurnUpdate = Partial<
  Omit<ConversationTurn, 'id' | 'speakerId'>
>
