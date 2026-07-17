import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ConversationFeed } from '@/components/meeting/ConversationFeed'
import { MeetingControls } from '@/components/meeting/MeetingControls'
import { MeetingHeader } from '@/components/meeting/MeetingHeader'
import { MeetingSidebar } from '@/components/meeting/MeetingSidebar'
import { MeetingStage } from '@/components/meeting/MeetingStage'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useDemoSimulation } from '@/hooks/useDemoSimulation'
import { useMeetingClock } from '@/hooks/useMeetingClock'
import { usePushToTalk } from '@/hooks/usePushToTalk'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'

export default function LiveMeetingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [contextOpen, setContextOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [sharingEnabled, setSharingEnabled] = useState(false)
  const meeting = useMeetingStore((state) => state.meeting)
  const microphoneEnabled = useMeetingStore(
    (state) => state.microphoneEnabled,
  )
  const demoStatus = useMeetingStore((state) => state.demoStatus)
  const toggleMicrophone = useMeetingStore((state) => state.toggleMicrophone)
  const setConversationMode = useMeetingStore(
    (state) => state.setConversationMode,
  )
  const swapLanguages = useMeetingStore((state) => state.swapLanguages)
  const addNote = useMeetingStore((state) => state.addNote)
  const endMeeting = useMeetingStore((state) => state.endMeeting)
  const elapsedSeconds = useMeetingClock(
    meeting.startedAt,
    meeting.status,
    meeting.durationSeconds,
  )
  const activePushLanguage = usePushToTalk(meeting.conversationMode)
  const { runDemo, resetDemo } = useDemoSimulation()

  const handleRunOrResetDemo = () => {
    if (demoStatus === 'idle') {
      runDemo()
    } else {
      resetDemo()
    }
  }

  const handleEndMeeting = () => {
    endMeeting(new Date().toISOString(), elapsedSeconds)
    navigate(ROUTES.summary)
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

  return (
    <div className="flex h-dvh min-h-[32rem] flex-col overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#meeting-conversation">
        {t('meeting.skip')}
      </a>

      <MeetingHeader
        title={meeting.title}
        elapsedSeconds={elapsedSeconds}
      />

      <main
        id="meeting-conversation"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-meeting-stage md:block md:overflow-y-auto lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)] lg:overflow-hidden"
      >
        <MeetingStage
          participants={meeting.participants}
          languageOrder={meeting.languageOrder}
          microphoneEnabled={microphoneEnabled}
          cameraEnabled={cameraEnabled}
          sharingEnabled={sharingEnabled}
        />
        <ConversationFeed
          turns={meeting.turns}
          onRunDemo={runDemo}
          conversationMode={meeting.conversationMode}
          languageOrder={meeting.languageOrder}
          demoStatus={demoStatus}
          activePushLanguage={activePushLanguage}
          onToggleMode={() =>
            setConversationMode(
              meeting.conversationMode === 'auto' ? 'push-to-talk' : 'auto',
            )
          }
          onSwapLanguages={swapLanguages}
          onAddNote={() => setNoteDialogOpen(true)}
          onRunOrResetDemo={handleRunOrResetDemo}
        />
      </main>

      <MeetingControls
        microphoneEnabled={microphoneEnabled}
        cameraEnabled={cameraEnabled}
        captionsEnabled={captionsEnabled}
        sharingEnabled={sharingEnabled}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={() => setCameraEnabled((enabled) => !enabled)}
        onToggleCaptions={() => setCaptionsEnabled((enabled) => !enabled)}
        onToggleSharing={() => setSharingEnabled((enabled) => !enabled)}
        onOpenContext={() => setContextOpen(true)}
        onEndMeeting={handleEndMeeting}
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
