import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { useNavigate } from 'react-router'

import { ConversationFeed } from '@/components/meeting/ConversationFeed'
import { LiveKitMeetingStage } from '@/components/meeting/LiveKitMeetingStage'
import { MeetingControls } from '@/components/meeting/MeetingControls'
import { MeetingHeader } from '@/components/meeting/MeetingHeader'
import { MeetingSidebar } from '@/components/meeting/MeetingSidebar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useMeetingClock } from '@/hooks/useMeetingClock'
import { usePushToTalk } from '@/hooks/usePushToTalk'
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection'
import { useRoomSession } from '@/hooks/useRoomSession'
import { useTranslation } from '@/hooks/useTranslation'
import { API_URL, LIVEKIT_URL } from '@/lib/config'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'

type MediaError =
  | 'connection'
  | 'microphone'
  | 'camera'
  | 'screen'
  | null

const LIVEKIT_CONNECT_OPTIONS = { autoSubscribe: true } as const

export default function LiveMeetingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const roomId = useRoomSession()
  const meeting = useMeetingStore((state) => state.meeting)
  const microphoneEnabled = useMeetingStore(
    (state) => state.microphoneEnabled,
  )
  const realtimeStatus = useMeetingStore(
    (state) => state.realtimeSession.status,
  )
  const clientId = useMeetingStore(
    (state) => state.realtimeSession.clientId,
  )
  const setMicrophoneEnabled = useMeetingStore(
    (state) => state.setMicrophoneEnabled,
  )
  const toggleMicrophone = useMeetingStore(
    (state) => state.toggleMicrophone,
  )
  const setConversationMode = useMeetingStore(
    (state) => state.setConversationMode,
  )
  const swapLanguages = useMeetingStore(
    (state) => state.swapLanguages,
  )
  const addNote = useMeetingStore((state) => state.addNote)
  const endMeeting = useMeetingStore((state) => state.endMeeting)

  const [contextOpen, setContextOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [sharingEnabled, setSharingEnabled] = useState(false)
  const [microphoneTrack, setMicrophoneTrack] =
    useState<MediaStreamTrack | null>(null)
  const [livekitToken, setLivekitToken] = useState('')
  const [livekitRoomId, setLivekitRoomId] = useState('')
  const [livekitUrl, setLivekitUrl] = useState(LIVEKIT_URL)
  const [livekitConnected, setLivekitConnected] = useState(false)
  const [mediaError, setMediaError] = useState<MediaError>(null)

  const elapsedSeconds = useMeetingClock(
    meeting.startedAt,
    meeting.status,
    meeting.durationSeconds,
  )
  const pushToTalk = usePushToTalk(
    meeting.conversationMode,
    microphoneEnabled && livekitConnected,
  )
  const transmitAudio =
    microphoneEnabled &&
    (meeting.conversationMode === 'auto' || pushToTalk.active)
  const { endSession } = useRealtimeConnection({
    microphoneTrack,
    transmitAudio,
  })

  const localParticipantName =
    meeting.participants.find(
      (participant) =>
        participant.language === meeting.localLanguage,
    )?.name ?? clientId

  useEffect(() => {
    if (meeting.status === 'setup') {
      navigate(ROUTES.setup(roomId), { replace: true })
    } else if (meeting.status === 'ended') {
      navigate(ROUTES.summary(roomId), { replace: true })
    }
  }, [meeting.status, navigate, roomId])

  useEffect(() => {
    if (
      realtimeStatus === 'ended' &&
      meeting.status === 'live'
    ) {
      endMeeting(new Date().toISOString(), elapsedSeconds)
    }
  }, [
    elapsedSeconds,
    endMeeting,
    meeting.status,
    realtimeStatus,
  ])

  useEffect(() => {
    if (meeting.status !== 'live') {
      return
    }

    const controller = new AbortController()

    const fetchToken = async () => {
      try {
        const response = await fetch(`${API_URL}/livekit/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName: roomId,
            participantName: clientId,
            displayName: localParticipantName,
            language: meeting.localLanguage,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('LIVEKIT_TOKEN_FAILED')
        }

        const data = (await response.json()) as {
          token?: unknown
          url?: unknown
        }

        if (typeof data.token !== 'string' || data.token.length === 0) {
          throw new Error('LIVEKIT_TOKEN_INVALID')
        }

        setLivekitToken(data.token)
        setLivekitRoomId(roomId)
        setLivekitUrl(
          typeof data.url === 'string' && data.url.length > 0
            ? data.url
            : LIVEKIT_URL,
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }
        setMediaError('connection')
      }
    }

    void fetchToken()
    return () => controller.abort()
  }, [
    clientId,
    localParticipantName,
    meeting.localLanguage,
    meeting.status,
    roomId,
  ])

  const handleMediaRejected = useCallback(
    (kind: Exclude<MediaError, 'connection' | null>) => {
      setMediaError(kind)

      if (kind === 'microphone') {
        setMicrophoneEnabled(false)
      } else if (kind === 'camera') {
        setCameraEnabled(false)
      } else {
        setSharingEnabled(false)
      }
    },
    [setMicrophoneEnabled],
  )

  const handleLiveKitConnected = useCallback(() => {
    setLivekitConnected(true)
    setMediaError(null)
  }, [])

  const handleLiveKitDisconnected = useCallback(() => {
    setLivekitConnected(false)
    setMicrophoneTrack(null)
  }, [])

  const handleLiveKitError = useCallback(() => {
    setMediaError('connection')
  }, [])

  const handleEndMeeting = async () => {
    await endSession()
    const currentState = useMeetingStore.getState()

    if (currentState.meeting.status === 'live') {
      currentState.endMeeting(
        new Date().toISOString(),
        elapsedSeconds,
      )
    }
  }

  const handleToggleMode = () => {
    const nextMode =
      meeting.conversationMode === 'auto'
        ? 'push-to-talk'
        : 'auto'

    if (nextMode === 'push-to-talk' && !microphoneEnabled) {
      setMicrophoneEnabled(true)
    }
    setConversationMode(nextMode)
  }

  const handleNoteSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!noteText.trim()) {
      return
    }

    addNote(noteText)
    setNoteText('')
    setNoteDialogOpen(false)
  }

  const mediaErrorKey =
    mediaError === null
      ? null
      : (`stage.error.${mediaError}` as const)

  return (
    <div className="flex h-dvh min-h-[32rem] flex-col overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#meeting-conversation">
        {t('meeting.skip')}
      </a>

      <MeetingHeader
        title={meeting.title}
        roomId={roomId}
        elapsedSeconds={elapsedSeconds}
      />

      <main
        id="meeting-conversation"
        className={cn(
          'relative flex min-h-0 flex-1 flex-col overflow-hidden bg-meeting-stage pb-[4.75rem] md:block md:overflow-y-auto lg:overflow-hidden lg:pb-0',
          captionsEnabled &&
            'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]',
        )}
      >
        {livekitToken && livekitRoomId === roomId ? (
          <section className="relative min-h-0 flex-1 bg-meeting-stage p-3 md:min-h-[30rem] md:flex-none md:p-5 lg:h-full lg:min-h-0">
            <div className="relative h-full min-h-[15rem] overflow-hidden rounded-[12px] border border-white/6 bg-slate-950">
              <LiveKitRoom
                video={false}
                audio={false}
                token={livekitToken}
                serverUrl={livekitUrl}
                connectOptions={LIVEKIT_CONNECT_OPTIONS}
                data-lk-theme="default"
                onConnected={handleLiveKitConnected}
                onDisconnected={handleLiveKitDisconnected}
                onError={handleLiveKitError}
                style={{ height: '100%' }}
              >
                {livekitConnected ? (
                  <LiveKitMeetingStage
                    microphoneEnabled={transmitAudio}
                    cameraEnabled={cameraEnabled}
                    sharingEnabled={sharingEnabled}
                    onMicrophoneTrackChange={setMicrophoneTrack}
                    onMediaStateRejected={handleMediaRejected}
                  />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center text-sm text-stage-muted">
                    {t('stage.connecting')}
                  </div>
                )}
                <RoomAudioRenderer />
              </LiveKitRoom>
              {mediaErrorKey && (
                <p
                  role="status"
                  className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-[8px] bg-[#111214]/90 px-3 py-2 text-xs text-stage-ink shadow-sm"
                >
                  {t(mediaErrorKey)}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="relative min-h-0 flex-1 bg-meeting-stage p-3 md:min-h-[30rem] md:flex-none md:p-5 lg:h-full lg:min-h-0">
            <div
              role={mediaError === 'connection' ? 'alert' : 'status'}
              className="grid h-full min-h-[15rem] place-items-center rounded-[12px] border border-white/6 bg-slate-950 px-6 text-center text-sm text-stage-muted"
            >
              {t(
                mediaError === 'connection'
                  ? 'stage.error.connection'
                  : 'stage.connecting',
              )}
            </div>
          </section>
        )}

        {captionsEnabled && (
          <ConversationFeed
            turns={meeting.turns}
            conversationMode={meeting.conversationMode}
            languageOrder={meeting.languageOrder}
            localLanguage={meeting.localLanguage}
            activePushLanguage={
              pushToTalk.active ? meeting.localLanguage : null
            }
            onToggleMode={handleToggleMode}
            onSwapLanguages={swapLanguages}
            onAddNote={() => setNoteDialogOpen(true)}
            realtimeStatus={realtimeStatus}
          />
        )}
      </main>

      <MeetingControls
        microphoneEnabled={microphoneEnabled}
        cameraEnabled={cameraEnabled}
        captionsEnabled={captionsEnabled}
        sharingEnabled={sharingEnabled}
        conversationMode={meeting.conversationMode}
        pushToTalkActive={pushToTalk.active}
        conversationVisible={captionsEnabled}
        mediaControlsDisabled={!livekitConnected}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={() =>
          setCameraEnabled((enabled) => !enabled)
        }
        onToggleCaptions={() =>
          setCaptionsEnabled((enabled) => !enabled)
        }
        onToggleSharing={() =>
          setSharingEnabled((enabled) => !enabled)
        }
        onOpenContext={() => setContextOpen(true)}
        onEndMeeting={() => void handleEndMeeting()}
        onPushToTalkStart={pushToTalk.start}
        onPushToTalkStop={pushToTalk.stop}
      />

      <Dialog
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        title={t('meeting.contextTitle')}
        description={t('meeting.contextDescription')}
        size="lg"
      >
        <div className="-m-5 h-[68vh] min-h-[28rem] sm:-m-6">
          <MeetingSidebar className="h-full border-l-0" />
        </div>
      </Dialog>

      <Dialog
        open={noteDialogOpen}
        onClose={() => setNoteDialogOpen(false)}
        title={t('meeting.noteDialogTitle')}
        description={t('meeting.noteDialogDescription')}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setNoteDialogOpen(false)}
            >
              {t('meeting.keepOpen')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="quick-note-form"
            >
              {t('meeting.addNote')}
            </Button>
          </>
        }
      >
        <form id="quick-note-form" onSubmit={handleNoteSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-ink-soft">
            {t('meeting.note')}
            <textarea
              autoFocus
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              rows={5}
              maxLength={500}
              placeholder={t('meeting.notePlaceholder')}
              className="resize-y rounded-[10px] border border-line-strong bg-panel px-4 py-3 font-normal leading-6 text-ink outline-none placeholder:text-muted focus:border-primary"
            />
          </label>
        </form>
      </Dialog>
    </div>
  )
}
