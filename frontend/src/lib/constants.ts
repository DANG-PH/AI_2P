export const ROUTES = {
  landing: '/',
  setup: '/setup',
  meeting: '/meeting',
  summary: '/summary',
} as const

export const LANGUAGE_SHORT_LABELS = {
  vi: 'VI',
  en: 'EN',
} as const

export const DEMO_TIMING = {
  listeningMs: 400,
  transcriptSlices: 12,
  transcriptSliceMs: 100,
  draftAtMs: 1_600,
  finalAtMs: 2_300,
  nextTurnAtMs: 2_800,
} as const

export const MOCK_AUDIO_LEVEL_SEQUENCE = [
  0.12, 0.28, 0.46, 0.62, 0.38, 0.55, 0.31, 0.18,
] as const

export const DEFAULT_TRANSLATION_LATENCY_MS = 780

export const MAX_MEETING_TITLE_LENGTH = 120

export const MAX_PARTICIPANT_NAME_LENGTH = 80

export const MAX_GLOSSARY_TERM_LENGTH = 120

export const MAX_NOTE_LENGTH = 500
