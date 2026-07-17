import {
  Captions,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  ScreenShare,
  Video,
  VideoOff,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'

export interface MeetingControlsProps {
  microphoneEnabled: boolean
  cameraEnabled: boolean
  captionsEnabled: boolean
  sharingEnabled: boolean
  onToggleMicrophone: () => void
  onToggleCamera: () => void
  onToggleCaptions: () => void
  onToggleSharing: () => void
  onOpenContext: () => void
  onEndMeeting: () => void
}

export function MeetingControls({
  microphoneEnabled,
  cameraEnabled,
  captionsEnabled,
  sharingEnabled,
  onToggleMicrophone,
  onToggleCamera,
  onToggleCaptions,
  onToggleSharing,
  onOpenContext,
  onEndMeeting,
}: MeetingControlsProps) {
  const { t } = useTranslation()

  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-2 z-30 flex justify-center px-2 sm:bottom-4 lg:right-[33.333%]">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-[14px] border border-line-strong bg-panel p-1.5 shadow-[0_10px_28px_rgb(16_24_40/0.14)] sm:gap-2 sm:p-2">
        <ControlButton
          label={
            microphoneEnabled
              ? t('controls.microphone')
              : t('controls.unmute')
          }
          icon={
            microphoneEnabled ? (
              <Mic className="size-4" aria-hidden="true" />
            ) : (
              <MicOff className="size-4" aria-hidden="true" />
            )
          }
          pressed={microphoneEnabled}
          deviceOff={!microphoneEnabled}
          onClick={onToggleMicrophone}
        />
        <ControlButton
          label={
            cameraEnabled ? t('controls.camera') : t('controls.startVideo')
          }
          icon={
            cameraEnabled ? (
              <Video className="size-4" aria-hidden="true" />
            ) : (
              <VideoOff className="size-4" aria-hidden="true" />
            )
          }
          pressed={cameraEnabled}
          deviceOff={!cameraEnabled}
          onClick={onToggleCamera}
        />
        <ControlButton
          label={t('controls.captions')}
          icon={<Captions className="size-4" aria-hidden="true" />}
          active={captionsEnabled}
          pressed={captionsEnabled}
          onClick={onToggleCaptions}
        />
        <ControlButton
          label={
            sharingEnabled ? t('controls.stopShare') : t('controls.share')
          }
          icon={<ScreenShare className="size-4" aria-hidden="true" />}
          active={sharingEnabled}
          pressed={sharingEnabled}
          onClick={onToggleSharing}
        />
        <ControlButton
          label={t('controls.more')}
          icon={<MoreHorizontal className="size-4" aria-hidden="true" />}
          onClick={onOpenContext}
        />
        <span className="mx-0.5 h-8 w-px bg-line" aria-hidden="true" />
        <ControlButton
          label={t('controls.endCall')}
          icon={<PhoneOff className="size-4" aria-hidden="true" />}
          onClick={onEndMeeting}
          endCall
        />
      </div>
    </div>
  )
}

interface ControlButtonProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  pressed?: boolean
  deviceOff?: boolean
  endCall?: boolean
}

function ControlButton({
  label,
  icon,
  onClick,
  active = false,
  pressed,
  deviceOff = false,
  endCall = false,
}: ControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-muted-strong transition-colors sm:h-12 sm:w-[3.75rem] sm:flex-col sm:gap-0.5',
        'hover:bg-panel-raised hover:text-ink',
        active && 'bg-[#eff6ff] text-primary hover:bg-[#e0ecff]',
        deviceOff && 'bg-[#fef2f2] text-danger hover:bg-[#fee2e2]',
        endCall &&
          'bg-danger text-white hover:bg-[#b91c1c] hover:text-white sm:w-[4.25rem]',
      )}
    >
      {icon}
      <span className="hidden text-[0.625rem] font-semibold sm:block">
        {label}
      </span>
    </button>
  )
}
