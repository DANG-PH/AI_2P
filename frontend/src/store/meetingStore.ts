import { create } from 'zustand'
import { createInitialMeeting } from '../data/initialMeeting'
import { clamp, createEntityId } from '../lib/utils'
import { getOrCreateClientId } from '../lib/meetingIdentity'
import { applyRealtimeTranscriptEvent } from '../lib/realtimeEvents'
import type {
  ConversationMode,
  ConversationTurn,
  ConversationTurnUpdate,
  GlossaryTermInput,
  GlossaryTermUpdate,
  Language,
  LanguageOrder,
  Meeting,
  MeetingStatus,
  MicrophoneTestStatus,
  NoiseLevel,
} from '../types/meeting'
import type {
  RealtimeServerEvent,
  RealtimeSessionState,
  RealtimeTranscriptEvent,
} from '../types/realtime'

export interface MeetingStoreState {
  meeting: Meeting
  microphoneEnabled: boolean
  microphoneTestStatus: MicrophoneTestStatus
  audioInputLevel: number
  noiseLevel: NoiseLevel
  activeTurnId: string | null
  realtimeSession: RealtimeSessionState
}

export interface MeetingStoreActions {
  setMeetingId: (meetingId: string) => void
  setMeetingTitle: (title: string) => void
  setParticipantName: (participantId: string, name: string) => void
  setParticipantNameByLanguage: (language: Language, name: string) => void
  setLocalLanguage: (language: Language) => void
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
  setActiveTurnId: (turnId: string | null) => void
  setRealtimeStatus: (status: RealtimeSessionState['status']) => void
  applyRealtimeEvent: (
    event: RealtimeServerEvent,
    receivedAt?: number,
  ) => void
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
  activeTurnId: null,
  realtimeSession: {
    clientId: getOrCreateClientId(),
    status: 'connecting',
    lastError: null,
  },
})

const syncRealtimeParticipant = (
  meeting: Meeting,
  event: RealtimeTranscriptEvent,
): Meeting => {
  if (
    event.type === 'translate.token' ||
    !event.clientId ||
    !event.displayName?.trim()
  ) {
    return meeting
  }

  const displayName = event.displayName.trim()
  const clientId = event.clientId
  let changed = false
  const participants = meeting.participants.map((participant) => {
    if (
      participant.id !== clientId &&
      participant.language !== event.speaker
    ) {
      return participant
    }

    if (
      participant.id === clientId &&
      participant.name === displayName
    ) {
      return participant
    }

    changed = true
    return {
      ...participant,
      id: clientId,
      name: displayName,
    }
  })

  return changed ? { ...meeting, participants } : meeting
}

export const useMeetingStore = create<MeetingStore>()((set) => ({
  ...createInitialStoreState(),

  setMeetingId: (meetingId) => {
    const normalizedMeetingId = meetingId.trim()

    if (!normalizedMeetingId) {
      return
    }

    set((state) => ({
      meeting: {
        ...state.meeting,
        id: normalizedMeetingId,
      },
    }))
  },

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

  setLocalLanguage: (localLanguage) => {
    const otherLanguage: Language = localLanguage === 'vi' ? 'en' : 'vi'

    set((state) => ({
      meeting: {
        ...state.meeting,
        localLanguage,
        languageOrder: [localLanguage, otherLanguage],
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
      activeTurnId: null,
      realtimeSession: {
        ...state.realtimeSession,
        status: 'connecting',
        lastError: null,
      },
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
      activeTurnId: null,
      realtimeSession: {
        ...state.realtimeSession,
        status: 'connecting',
        lastError: null,
      },
    }))
  },

  resetMeeting: () => {
    set(createInitialStoreState())
  },

  setActiveTurnId: (activeTurnId) => {
    set({ activeTurnId })
  },

  setRealtimeStatus: (status) => {
    set((state) => ({
      realtimeSession: {
        ...state.realtimeSession,
        status,
        lastError:
          status === 'error' ? state.realtimeSession.lastError : null,
      },
    }))
  },

  applyRealtimeEvent: (event, receivedAt = Date.now()) => {
    set((state) => {
      switch (event.type) {
        case 'session.ready':
          return {
            realtimeSession: {
              clientId: event.clientId,
              status: 'gateway-connected',
              lastError: null,
            },
          }
        case 'session.participants': {
          const participants = state.meeting.participants.map(
            (participant) => {
              const connectedParticipant = event.participants.find(
                (candidate) =>
                  candidate.language === participant.language,
              )

              if (connectedParticipant) {
                return {
                  ...participant,
                  id: connectedParticipant.clientId,
                  name: connectedParticipant.displayName.trim(),
                }
              }

              if (
                participant.id === state.realtimeSession.clientId
              ) {
                return participant
              }

              return {
                ...participant,
                id: `participant-${participant.language}`,
                name: '',
              }
            },
          )

          return {
            meeting: {
              ...state.meeting,
              participants,
            },
          }
        }
        case 'session.ended':
          return {
            realtimeSession: {
              ...state.realtimeSession,
              status: 'ended',
            },
          }
        case 'error':
          return {
            meeting: state.activeTurnId
              ? {
                  ...state.meeting,
                  turns: state.meeting.turns.map((turn) =>
                    turn.id === state.activeTurnId
                      ? { ...turn, status: 'failed' }
                      : turn,
                  ),
                }
              : state.meeting,
            realtimeSession: {
              ...state.realtimeSession,
              status: 'error',
              lastError: event,
            },
          }
        case 'stt.partial':
        case 'stt.final':
        case 'translate.token':
        case 'translate.done': {
          const meeting = syncRealtimeParticipant(
            state.meeting,
            event,
          )
          const update = applyRealtimeTranscriptEvent(
            meeting,
            event,
            receivedAt,
          )

          if (update === null) {
            return meeting === state.meeting
              ? state
              : { meeting }
          }

          return update
        }
      }
    })
  },
}))
