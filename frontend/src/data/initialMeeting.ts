import type { Meeting } from '@/types/meeting'

export const createInitialMeeting = (): Meeting => ({
  id: '',
  title: '',
  participants: [
    { id: 'participant-vi', name: '', language: 'vi' },
    { id: 'participant-en', name: '', language: 'en' },
  ],
  localLanguage: 'vi',
  conversationMode: 'auto',
  microphoneId: '',
  languageOrder: ['vi', 'en'],
  glossary: [],
  turns: [],
  notes: [],
  status: 'setup',
  startedAt: null,
  endedAt: null,
  durationSeconds: 0,
})
