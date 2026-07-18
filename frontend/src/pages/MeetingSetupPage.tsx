import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'

import { GlossaryEditor } from '@/components/setup/GlossaryEditor'
import {
  MEETING_SETUP_FORM_ID,
  MeetingDetailsForm,
} from '@/components/setup/MeetingDetailsForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useRoomSession } from '@/hooks/useRoomSession'
import { useTranslation } from '@/hooks/useTranslation'
import { API_URL } from '@/lib/config'
import { ROUTES } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'

type SessionCheckStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'not-found'
  | 'error'

export default function MeetingSetupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const roomId = useRoomSession()
  const startMeeting = useMeetingStore((state) => state.startMeeting)
  const isJoining = searchParams.get('join') === '1'
  const [sessionCheckStatus, setSessionCheckStatus] =
    useState<SessionCheckStatus>(isJoining ? 'checking' : 'idle')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!isJoining || !roomId) {
      return
    }

    const controller = new AbortController()
    const checkSession = async () => {
      setSessionCheckStatus('checking')
      try {
        const response = await fetch(`${API_URL}/sessions/${roomId}`, {
          signal: controller.signal,
        })

        if (response.status === 404) {
          setSessionCheckStatus('not-found')
          return
        }
        if (!response.ok) {
          throw new Error('SESSION_CHECK_FAILED')
        }

        const data = (await response.json()) as {
          exists?: unknown
          title?: unknown
        }

        if (data.exists !== true) {
          setSessionCheckStatus('not-found')
          return
        }

        if (typeof data.title === 'string' && data.title.trim()) {
          useMeetingStore.getState().setMeetingTitle(data.title)
        }
        setSessionCheckStatus('ready')
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }
        setSessionCheckStatus('error')
      }
    }

    void checkSession()
    return () => controller.abort()
  }, [isJoining, retryCount, roomId])

  const handleStartMeeting = () => {
    if (isJoining && sessionCheckStatus !== 'ready') {
      return
    }

    startMeeting()
    navigate(ROUTES.meeting(roomId))
  }

  const joinUnavailable =
    isJoining &&
    (sessionCheckStatus === 'not-found' ||
      sessionCheckStatus === 'error')

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#setup-main" className="skip-link">
        {t('setup.skip')}
      </a>

      <PageHeader
        title={t('setup.title')}
        eyebrow={t('setup.eyebrow')}
        backTo={ROUTES.landing}
        actions={
          <span className="hidden sm:inline">
            <StatusBadge tone="info">{t('common.languagePair')}</StatusBadge>
          </span>
        }
      />

      <main
        id="setup-main"
        className="mx-auto w-full max-w-[82rem] px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-11 lg:px-8"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('setup.preparation')}
          </p>
          <h2 className="mt-3 text-balance text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
            {t(isJoining ? 'setup.joinHeadline' : 'setup.headline')}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-strong">
            {t(isJoining ? 'setup.joinDescription' : 'setup.description')}
          </p>
        </div>

        {isJoining && sessionCheckStatus !== 'ready' && (
          <div
            role={joinUnavailable ? 'alert' : 'status'}
            className={`mt-8 max-w-3xl rounded-[10px] border px-4 py-3 text-sm leading-6 ${
              joinUnavailable
                ? 'border-danger/25 bg-danger/8 text-danger-soft'
                : 'border-line bg-panel text-muted-strong'
            }`}
          >
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <span>
                {t(
                  sessionCheckStatus === 'not-found'
                    ? 'setup.roomNotFound'
                    : sessionCheckStatus === 'error'
                      ? 'setup.roomCheckError'
                      : 'setup.checkingRoom',
                )}
              </span>
              {joinUnavailable && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setRetryCount((current) => current + 1)
                  }
                >
                  {t('setup.retry')}
                </Button>
              )}
            </div>
          </div>
        )}

        <div
          className={
            isJoining
              ? 'mt-10 max-w-3xl'
              : 'mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(22rem,5fr)] lg:items-start xl:gap-14'
          }
        >
          <MeetingDetailsForm
            onValidSubmit={handleStartMeeting}
            isJoining={isJoining}
          />
          {!isJoining && <GlossaryEditor />}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-muted">
            {t('setup.connectionNote')}
          </p>
          <Button
            type="submit"
            form={MEETING_SETUP_FORM_ID}
            variant="primary"
            size="lg"
            fullWidth
            disabled={
              isJoining && sessionCheckStatus !== 'ready'
            }
            trailingIcon={
              <ArrowRight aria-hidden="true" className="size-4" />
            }
            className="sm:w-auto"
          >
            {isJoining
              ? sessionCheckStatus === 'checking'
                ? t('setup.checking')
                : t('setup.join')
              : t('setup.start')}
          </Button>
        </div>
      </main>
    </div>
  )
}
