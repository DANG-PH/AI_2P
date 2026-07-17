import { Mic, MonitorUp, VideoOff } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { LanguageOrder, Participant } from '@/types/meeting'

export interface MeetingStageProps {
  participants: Participant[]
  languageOrder: LanguageOrder
  microphoneEnabled: boolean
  cameraEnabled: boolean
  sharingEnabled: boolean
}

export function MeetingStage({
  participants,
  languageOrder,
  microphoneEnabled,
  cameraEnabled,
  sharingEnabled,
}: MeetingStageProps) {
  const { t } = useTranslation()
  const localParticipant =
    participants.find(
      (participant) => participant.language === languageOrder[0],
    ) ?? participants[0]
  const remoteParticipant =
    participants.find(
      (participant) => participant.language === languageOrder[1],
    ) ?? participants[1]

  return (
    <section
      aria-label={t('stage.ariaLabel')}
      className="relative min-h-0 flex-1 bg-meeting-stage p-3 pb-24 md:min-h-[30rem] md:flex-none md:p-5 md:pb-24 lg:h-full lg:min-h-0"
    >
      <div className="relative h-full min-h-[15rem] overflow-hidden rounded-[12px] border border-white/6 bg-video-tile">
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid justify-items-center gap-4">
            <div className="grid size-24 place-items-center rounded-full bg-[#34373d] text-2xl font-semibold text-stage-ink ring-1 ring-white/8 sm:size-28 sm:text-3xl">
              {remoteParticipant
                ? getInitials(remoteParticipant.name)
                : 'EN'}
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-stage-ink">
                {remoteParticipant?.name ?? t('details.englishParticipant')}
              </p>
              <p className="mt-1 text-xs text-stage-muted">
                {remoteParticipant
                  ? t(
                      remoteParticipant.language === 'vi'
                        ? 'common.vietnamese'
                        : 'common.english',
                    )
                  : t('common.english')}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-[8px] bg-[#111214]/80 px-2.5 py-2 text-xs text-stage-muted sm:left-4 sm:top-4">
          <Mic className="size-3.5 text-[#68d5c9]" aria-hidden="true" />
          {t('stage.activeSpeaker')}
        </div>

        {sharingEnabled && (
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-[8px] bg-stage-ink px-3 py-2 text-xs font-semibold text-meeting-stage shadow-sm sm:top-4">
            <MonitorUp className="size-3.5" aria-hidden="true" />
            {t('stage.sharing')}
          </div>
        )}

        <div
          className={cn(
            'absolute bottom-4 right-4 grid h-28 w-36 place-items-center overflow-hidden rounded-[12px] border border-white/10 bg-[#303238] shadow-[0_8px_24px_rgb(0_0_0/0.22)] sm:h-36 sm:w-52',
            !cameraEnabled && 'bg-[#202226]',
          )}
        >
          {cameraEnabled ? (
            <span className="grid size-14 place-items-center rounded-full bg-[#3a3d43] text-sm font-semibold text-stage-ink sm:size-16">
              {localParticipant ? getInitials(localParticipant.name) : 'VI'}
            </span>
          ) : (
            <div className="grid justify-items-center gap-2 text-stage-muted">
              <VideoOff className="size-5" aria-hidden="true" />
              <span className="text-[0.6875rem]">
                {t('stage.cameraOff')}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[#111214]/75 px-2.5 py-2 text-[0.6875rem]">
            <span className="truncate font-medium text-stage-ink">
              {t('stage.you')} ·{' '}
              {localParticipant?.name ?? t('details.vietnameseParticipant')}
            </span>
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                microphoneEnabled ? 'bg-[#68d5c9]' : 'bg-danger',
              )}
              aria-label={
                microphoneEnabled
                  ? t('stage.microphoneOn')
                  : t('stage.microphoneOff')
              }
            />
          </div>
        </div>

        <p className="absolute bottom-4 left-4 max-w-[10rem] text-[0.625rem] leading-4 text-stage-muted/75 sm:max-w-none">
          {t('stage.noStream')}
        </p>
      </div>
    </section>
  )
}
