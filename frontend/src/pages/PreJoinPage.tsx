import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { MicrophoneTest } from '@/components/setup/MicrophoneTest'
import { PreJoinDeviceSetup } from '@/components/setup/PreJoinDeviceSetup'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useMediaDevices } from '@/hooks/useMediaDevices'
import { useRoomSession } from '@/hooks/useRoomSession'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'

export default function PreJoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const roomId = useRoomSession()
  const meeting = useMeetingStore((state) => state.meeting)
  const microphoneEnabled = useMeetingStore(
    (state) => state.microphoneEnabled,
  )
  const mediaDevices = useMediaDevices()
  const startMeeting = useMeetingStore((state) => state.startMeeting)
  const isJoining = searchParams.get('join') === '1'
  const setupRoute = isJoining
    ? ROUTES.joinSetup(roomId)
    : ROUTES.setup(roomId)
  const participantName =
    meeting.participants.find(
      (participant) =>
        participant.language === meeting.localLanguage,
    )?.name ?? ''
  const missingDetails =
    !participantName.trim() ||
    (!isJoining && !meeting.title.trim())

  useEffect(() => {
    if (missingDetails) {
      navigate(setupRoute, { replace: true })
    }
  }, [missingDetails, navigate, setupRoute])

  const handleEnterMeeting = () => {
    startMeeting()
    navigate(ROUTES.meeting(roomId))
  }

  if (missingDetails) {
    return null
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#prejoin-main" className="skip-link">
        {t('prejoin.skip')}
      </a>

      <PageHeader
        title={t('prejoin.pageTitle')}
        eyebrow={t('prejoin.pageEyebrow')}
        backTo={setupRoute}
        actions={
          <span className="hidden sm:inline">
            <StatusBadge tone="info">
              {t('common.languagePair')}
            </StatusBadge>
          </span>
        }
      />

      <main
        id="prejoin-main"
        className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-11 lg:px-8"
      >
        <div className="mb-8 flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {t('prejoin.room')}
            </p>
            <p className="mt-1 truncate text-lg font-semibold text-ink">
              {meeting.title || roomId}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {roomId}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              trailingIcon={
                <ArrowRight aria-hidden="true" className="size-4" />
              }
              onClick={handleEnterMeeting}
              className="sm:w-auto"
            >
              {t(isJoining ? 'prejoin.enter' : 'prejoin.start')}
            </Button>
            <p className="max-w-sm text-xs leading-5 text-muted sm:text-right">
              {t('prejoin.connectionNote')}
            </p>
          </div>
        </div>

        <PreJoinDeviceSetup mediaDevices={mediaDevices} />

        {microphoneEnabled && (
          <div className="mt-8">
            <MicrophoneTest mediaDevices={mediaDevices} />
          </div>
        )}
      </main>
    </div>
  )
}
