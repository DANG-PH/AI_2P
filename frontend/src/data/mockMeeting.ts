import type {
  ConversationTurn,
  DemoTurnScript,
  GlossaryTerm,
  Meeting,
  MicrophoneOption,
  Participant,
  SystemStatus,
} from '../types/meeting'

export const DEFAULT_MEETING_TITLE =
  'Vietnam–Singapore Partnership Discussion'

export const mockParticipants: readonly Participant[] = [
  {
    id: 'participant-vi',
    name: 'Nguyễn Minh',
    language: 'vi',
  },
  {
    id: 'participant-en',
    name: 'James Tan',
    language: 'en',
  },
]

export const initialGlossary: readonly GlossaryTerm[] = [
  {
    id: 'glossary-aisoft',
    originalTerm: 'AISoft',
    preferredOutput: 'AISoft',
  },
  {
    id: 'glossary-nic',
    originalTerm: 'NIC',
    preferredOutput: 'National Innovation Center',
  },
  {
    id: 'glossary-poc',
    originalTerm: 'POC',
    preferredOutput: 'Proof of Concept',
  },
  {
    id: 'glossary-zalo-mini-app',
    originalTerm: 'Zalo Mini App',
    preferredOutput: 'Zalo Mini App',
  },
]

export const demoTurnScripts: readonly DemoTurnScript[] = [
  {
    id: 'turn-1',
    speakerId: 'participant-vi',
    speakerName: 'Nguyễn Minh',
    sourceLanguage: 'vi',
    targetLanguage: 'en',
    timestampSeconds: 8,
    originalText:
      'Xin chào ông James. Chúng tôi muốn thảo luận về khả năng triển khai một dự án thử nghiệm tại Việt Nam.',
    draftTranslation:
      'Hello, Mr. James. We want to discuss the possibility of deploying a trial project in Vietnam.',
    finalTranslation:
      'Hello, James. We would like to discuss the possibility of launching a pilot project in Vietnam.',
  },
  {
    id: 'turn-2',
    speakerId: 'participant-en',
    speakerName: 'James Tan',
    sourceLanguage: 'en',
    targetLanguage: 'vi',
    timestampSeconds: 24,
    originalText:
      'That sounds promising. What timeline are you considering?',
    draftTranslation:
      'Điều đó có vẻ đầy hứa hẹn. Bạn đang cân nhắc mốc thời gian nào?',
    finalTranslation:
      'Điều đó nghe rất triển vọng. Các bạn đang dự kiến tiến độ như thế nào?',
  },
  {
    id: 'turn-3',
    speakerId: 'participant-vi',
    speakerName: 'Nguyễn Minh',
    sourceLanguage: 'vi',
    targetLanguage: 'en',
    timestampSeconds: 42,
    originalText:
      'Chúng tôi dự kiến bắt đầu vào tháng Chín và thực hiện trong ba tháng.',
    draftTranslation:
      'We plan to begin in September and carry it out for three months.',
    finalTranslation:
      'We expect to start in September and run the pilot for three months.',
  },
  {
    id: 'turn-4',
    speakerId: 'participant-en',
    speakerName: 'James Tan',
    sourceLanguage: 'en',
    targetLanguage: 'vi',
    timestampSeconds: 58,
    originalText:
      'Please send us a technical proposal after this meeting.',
    draftTranslation:
      'Xin hãy gửi cho chúng tôi một đề xuất kỹ thuật sau cuộc họp.',
    finalTranslation:
      'Vui lòng gửi cho chúng tôi đề xuất kỹ thuật sau cuộc họp này.',
  },
]

export const mockConversationTurns: readonly ConversationTurn[] =
  demoTurnScripts.map((script) => ({
    id: script.id,
    speakerId: script.speakerId,
    speakerName: script.speakerName,
    sourceLanguage: script.sourceLanguage,
    targetLanguage: script.targetLanguage,
    timestampSeconds: script.timestampSeconds,
    originalText: script.originalText,
    translatedText: script.finalTranslation,
    status: 'final',
  }))

export const microphoneOptions: readonly MicrophoneOption[] = [
  {
    id: 'built-in-microphone',
    label: 'Built-in Microphone',
  },
  {
    id: 'conference-speakerphone',
    label: 'Conference Speakerphone',
  },
  {
    id: 'studio-usb-microphone',
    label: 'Studio USB Microphone',
  },
]

export const mockSystemStatus: SystemStatus = {
  connection: 'excellent',
  translationLatencyMs: 780,
  noiseLevel: 'low',
  translationMode: 'cloud-prototype',
}

const cloneParticipants = (): Participant[] =>
  mockParticipants.map((participant) => ({ ...participant }))

const cloneGlossary = (): GlossaryTerm[] =>
  initialGlossary.map((term) => ({ ...term }))

export const createInitialMeeting = (): Meeting => ({
  id: 'meeting-demo',
  title: DEFAULT_MEETING_TITLE,
  participants: cloneParticipants(),
  conversationMode: 'auto',
  microphoneId: microphoneOptions[0]?.id ?? 'built-in-microphone',
  languageOrder: ['vi', 'en'],
  glossary: cloneGlossary(),
  turns: [],
  notes: [],
  status: 'setup',
  startedAt: null,
  endedAt: null,
  durationSeconds: 0,
})

export const mockMeeting: Meeting = createInitialMeeting()
