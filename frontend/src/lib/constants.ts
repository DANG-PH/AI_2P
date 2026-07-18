export const ROUTES = {
  landing: '/',
  create: '/create',
  setup: (roomId: string) =>
    `/room/${encodeURIComponent(roomId)}/setup`,
  joinSetup: (roomId: string) =>
    `/room/${encodeURIComponent(roomId)}/setup?join=1`,
  meeting: (roomId: string) => `/room/${encodeURIComponent(roomId)}`,
  summary: (roomId: string) =>
    `/room/${encodeURIComponent(roomId)}/summary`,
} as const

export const LANGUAGE_SHORT_LABELS = {
  vi: 'VI',
  en: 'EN',
} as const

export const MAX_MEETING_TITLE_LENGTH = 120

export const MAX_PARTICIPANT_NAME_LENGTH = 80

export const MAX_GLOSSARY_TERM_LENGTH = 120

export const MAX_NOTE_LENGTH = 500
