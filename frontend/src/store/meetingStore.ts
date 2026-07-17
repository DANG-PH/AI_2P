import { create } from 'zustand'
import { createInitialMeeting } from '../data/mockMeeting'
import { clamp, createEntityId } from '../lib/utils'
import type {
  ConversationMode,
  ConversationTurn,
  ConversationTurnUpdate,
  DemoStatus,
  GlossaryTermInput,
  GlossaryTermUpdate,
  Language,
  LanguageOrder,
  Meeting,
  MeetingStatus,
  MicrophoneTestStatus,
  NoiseLevel,
} from '../types/meeting'

export interface MeetingStoreState {
  meeting: Meeting
  microphoneEnabled: boolean
  microphoneTestStatus: MicrophoneTestStatus
  audioInputLevel: number
  noiseLevel: NoiseLevel
  demoStatus: DemoStatus
  demoRunId: number
  activeTurnId: string | null
}

export interface MeetingStoreActions {
  setMeetingTitle: (title: string) => void
  setParticipantName: (participantId: string, name: string) => void
  setParticipantNameByLanguage: (language: Language, name: string) => void
  setConversationMode: (mode: ConversationMode) => void
  setMicrophone: (microphoneId: string) => void
  setMicrophoneEnabled: (enabled: boolean) => void
  toggleMicrophone: () => void
  setMicrophoneTestStatus: (status: MicrophoneTestStatus) => void
  setAudioInputLevel: (level: number) => void
  setNoiseLevel: (level: NoiseLevel) => void
  setLanguageOrder: (languageOrder: LanguageOrder) => void
  swapLanguages: () => void
  addGlossaryTerm: (input: GlossaryTermInput) => void
  updateGlossaryTerm: (id: string, update: GlossaryTermUpdate) => void
  removeGlossaryTerm: (id: string) => void
  addTurn: (turn: ConversationTurn) => void
  updateTurn: (id: string, update: ConversationTurnUpdate) => void
  correctTranslation: (id: string, translatedText: string) => void
  replaceTurns: (turns: ConversationTurn[]) => void
  clearTurns: () => void
  addNote: (text: string) => void
  updateNote: (id: string, text: string) => void
  removeNote: (id: string) => void
  setMeetingStatus: (status: MeetingStatus) => void
  startMeeting: (startedAt?: string) => void
  endMeeting: (endedAt?: string, durationSeconds?: number) => void
  prepareAnotherMeeting: () => void
  resetMeeting: () => void
  setDemoStatus: (status: DemoStatus) => void
  beginDemo: () => number
  completeDemo: () => void
  resetDemo: () => void
  setActiveTurnId: (turnId: string | null) => void
}

export type MeetingStore = MeetingStoreState & MeetingStoreActions

const calculateDurationSeconds = (
  startedAt: string | null,
  endedAt: string,
): number => {
  if (startedAt === null) {
    return 0
  }

  const startTime = new Date(startedAt).getTime()
  const endTime = new Date(endedAt).getTime()

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 0
  }

  return Math.max(0, Math.floor((endTime - startTime) / 1_000))
}

const createInitialStoreState = (): MeetingStoreState => ({
  meeting: createInitialMeeting(),
  microphoneEnabled: true,
  microphoneTestStatus: 'idle',
  audioInputLevel: 0,
  noiseLevel: 'low',
  demoStatus: 'idle',
  demoRunId: 0,
  activeTurnId: null,
})

export const useMeetingStore = create<MeetingStore>()((set) => ({
  ...createInitialStoreState(),

  setMeetingTitle: (title) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        title,
      },
    }))
  },

  setParticipantName: (participantId, name) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        participants: state.meeting.participants.map((participant) =>
          participant.id === participantId
            ? { ...participant, name }
            : participant,
        ),
      },
    }))
  },

  setParticipantNameByLanguage: (language, name) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        participants: state.meeting.participants.map((participant) =>
          participant.language === language
            ? { ...participant, name }
            : participant,
        ),
      },
    }))
  },

  setConversationMode: (conversationMode) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        conversationMode,
      },
    }))
  },

  setMicrophone: (microphoneId) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        microphoneId,
      },
    }))
  },

  setMicrophoneEnabled: (microphoneEnabled) => {
    set({ microphoneEnabled })
  },

  toggleMicrophone: () => {
    set((state) => ({
      microphoneEnabled: !state.microphoneEnabled,
    }))
  },

  setMicrophoneTestStatus: (microphoneTestStatus) => {
    set({ microphoneTestStatus })
  },

  setAudioInputLevel: (audioInputLevel) => {
    set({
      audioInputLevel: clamp(audioInputLevel, 0, 1),
    })
  },

  setNoiseLevel: (noiseLevel) => {
    set({ noiseLevel })
  },

  setLanguageOrder: (languageOrder) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        languageOrder: [...languageOrder],
      },
    }))
  },

  swapLanguages: () => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        languageOrder: [
          state.meeting.languageOrder[1],
          state.meeting.languageOrder[0],
        ],
      },
    }))
  },

  addGlossaryTerm: (input) => {
    const originalTerm = input.originalTerm.trim()
    const preferredOutput = input.preferredOutput.trim()

    if (originalTerm.length === 0 || preferredOutput.length === 0) {
      return
    }

    set((state) => ({
      meeting: {
        ...state.meeting,
        glossary: [
          ...state.meeting.glossary,
          {
            id: createEntityId('glossary'),
            originalTerm,
            preferredOutput,
          },
        ],
      },
    }))
  },

  updateGlossaryTerm: (id, update) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        glossary: state.meeting.glossary.map((term) =>
          term.id === id ? { ...term, ...update } : term,
        ),
      },
    }))
  },

  removeGlossaryTerm: (id) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        glossary: state.meeting.glossary.filter((term) => term.id !== id),
      },
    }))
  },

  addTurn: (turn) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: [...state.meeting.turns, { ...turn }],
      },
      activeTurnId: turn.id,
    }))
  },

  updateTurn: (id, update) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: state.meeting.turns.map((turn) =>
          turn.id === id ? { ...turn, ...update } : turn,
        ),
      },
    }))
  },

  correctTranslation: (id, translatedText) => {
    const normalizedTranslation = translatedText.trim()

    if (normalizedTranslation.length === 0) {
      return
    }

    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: state.meeting.turns.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                translatedText: normalizedTranslation,
                status: 'final',
                isEdited: true,
              }
            : turn,
        ),
      },
    }))
  },

  replaceTurns: (turns) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: turns.map((turn) => ({ ...turn })),
      },
      activeTurnId: turns.at(-1)?.id ?? null,
    }))
  },

  clearTurns: () => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: [],
      },
      activeTurnId: null,
    }))
  },

  addNote: (text) => {
    const normalizedText = text.trim()

    if (normalizedText.length === 0) {
      return
    }

    set((state) => ({
      meeting: {
        ...state.meeting,
        notes: [
          ...state.meeting.notes,
          {
            id: createEntityId('note'),
            text: normalizedText,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }))
  },

  updateNote: (id, text) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        notes: state.meeting.notes.map((note) =>
          note.id === id ? { ...note, text } : note,
        ),
      },
    }))
  },

  removeNote: (id) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        notes: state.meeting.notes.filter((note) => note.id !== id),
      },
    }))
  },

  setMeetingStatus: (status) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        status,
      },
    }))
  },

  startMeeting: (startedAt = new Date().toISOString()) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: [],
        notes: [],
        status: 'live',
        startedAt,
        endedAt: null,
        durationSeconds: 0,
      },
      demoStatus: 'idle',
      demoRunId: state.demoRunId + 1,
      activeTurnId: null,
    }))
  },

  endMeeting: (
    endedAt = new Date().toISOString(),
    durationSeconds,
  ) => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        status: 'ended',
        endedAt,
        durationSeconds:
          durationSeconds ??
          calculateDurationSeconds(state.meeting.startedAt, endedAt),
      },
      demoStatus:
        state.demoStatus === 'running' ? 'complete' : state.demoStatus,
      demoRunId: state.demoRunId + 1,
      activeTurnId: null,
    }))
  },

  prepareAnotherMeeting: () => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: [],
        notes: [],
        status: 'setup',
        startedAt: null,
        endedAt: null,
        durationSeconds: 0,
      },
      microphoneEnabled: true,
      microphoneTestStatus: 'idle',
      audioInputLevel: 0,
      demoStatus: 'idle',
      demoRunId: state.demoRunId + 1,
      activeTurnId: null,
    }))
  },

  resetMeeting: () => {
    const initialState = createInitialStoreState()

    set((state) => ({
      ...initialState,
      demoRunId: state.demoRunId + 1,
    }))
  },

  setDemoStatus: (demoStatus) => {
    set({ demoStatus })
  },

  beginDemo: () => {
    let nextRunId = 0

    set((state) => {
      nextRunId = state.demoRunId + 1

      return {
        meeting: {
          ...state.meeting,
          turns: [],
          status: 'live',
          startedAt: state.meeting.startedAt ?? new Date().toISOString(),
          endedAt: null,
          durationSeconds: 0,
        },
        demoStatus: 'running',
        demoRunId: nextRunId,
        activeTurnId: null,
      }
    })

    return nextRunId
  },

  completeDemo: () => {
    set({
      demoStatus: 'complete',
      activeTurnId: null,
    })
  },

  resetDemo: () => {
    set((state) => ({
      meeting: {
        ...state.meeting,
        turns: [],
      },
      demoStatus: 'idle',
      demoRunId: state.demoRunId + 1,
      activeTurnId: null,
    }))
  },

  setActiveTurnId: (activeTurnId) => {
    set({ activeTurnId })
  },
}))
