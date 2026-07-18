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
import type { ConversationMode } from '@/types/meeting'

export interface MeetingControlsProps {
  microphoneEnabled: boolean
  cameraEnabled: boolean
  captionsEnabled: boolean
  sharingEnabled: boolean
  conversationMode: ConversationMode
  pushToTalkActive: boolean
  conversationVisible: boolean
  translationFocused?: boolean
  mediaControlsDisabled?: boolean
  onToggleMicrophone: () => void
  onToggleCamera: () => void
  onToggleCaptions: () => void
  onToggleSharing: () => void
  onOpenContext: () => void
  onEndMeeting: () => void
  onPushToTalkStart: () => void
  onPushToTalkStop: () => void
}

export function MeetingControls({
  microphoneEnabled,
  cameraEnabled,
  captionsEnabled,
  sharingEnabled,
  conversationMode,
  pushToTalkActive,
  conversationVisible,
  translationFocused = false,
  mediaControlsDisabled = false,
  onToggleMicrophone,
  onToggleCamera,
  onToggleCaptions,
  onToggleSharing,
  onOpenContext,
  onEndMeeting,
  onPushToTalkStart,
  onPushToTalkStop,
}: MeetingControlsProps) {
  const { t } = useTranslation()
  const isPushToTalk = conversationMode === 'push-to-talk'
  const microphoneActive =
    microphoneEnabled &&
    (isPushToTalk ? pushToTalkActive : microphoneEnabled)
  const canHoldToTalk =
    isPushToTalk && microphoneEnabled && !mediaControlsDisabled

  return (
    <div
      className={cn(
        'safe-bottom pointer-events-none fixed inset-x-0 bottom-2 z-30 flex justify-center px-2 sm:bottom-4',
        conversationVisible &&
          (translationFocused
            ? 'lg:right-[57.5%]'
            : 'lg:right-[33.333%]'),
      )}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-[14px] border border-line-strong bg-panel p-1 shadow-[0_10px_28px_rgb(16_24_40/0.14)] sm:gap-1.5 sm:p-2">
        <ControlButton
          label={
            !microphoneEnabled
              ? t('controls.unmute')
              : isPushToTalk
                ? t(
                  pushToTalkActive
                    ? 'controls.talking'
                    : 'controls.holdToTalk',
                )
                : t(
                  microphoneEnabled
                    ? 'controls.mute'
                    : 'controls.unmute',
                )
          }
          icon={
            microphoneActive ? (
              <Mic className="size-4" aria-hidden="true" />
            ) : (
              <MicOff className="size-4" aria-hidden="true" />
            )
          }
          pressed={microphoneActive}
          active={isPushToTalk && pushToTalkActive}
          deviceOff={!microphoneEnabled}
          disabled={mediaControlsDisabled}
          onClick={canHoldToTalk ? undefined : onToggleMicrophone}
          onHoldStart={canHoldToTalk ? onPushToTalkStart : undefined}
          onHoldEnd={canHoldToTalk ? onPushToTalkStop : undefined}
        />
        <ControlButton
          label={
            cameraEnabled
              ? t('controls.stopVideo')
              : t('controls.startVideo')
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
          disabled={mediaControlsDisabled}
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
          disabled={mediaControlsDisabled}
          onClick={onToggleSharing}
        />
        <ControlButton
          label={t('controls.more')}
          icon={<MoreHorizontal className="size-4" aria-hidden="true" />}
          onClick={onOpenContext}
        />
        <span
          className="mx-0.5 hidden h-8 w-px bg-line sm:block"
          aria-hidden="true"
        />
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
  onClick?: () => void
  onHoldStart?: () => void
  onHoldEnd?: () => void
  active?: boolean
  pressed?: boolean
  deviceOff?: boolean
  endCall?: boolean
  disabled?: boolean
}

function ControlButton({
  label,
  icon,
  onClick,
  onHoldStart,
  onHoldEnd,
  active = false,
  pressed,
  deviceOff = false,
  endCall = false,
  disabled = false,
}: ControlButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      onPointerDown={
        onHoldStart
          ? (event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              onHoldStart()
            }
          : undefined
      }
      onPointerUp={onHoldEnd}
      onPointerCancel={onHoldEnd}
      onLostPointerCapture={onHoldEnd}
      onKeyDown={
        onHoldStart
          ? (event) => {
              if (
                !event.repeat &&
                (event.code === 'Space' || event.code === 'Enter')
              ) {
                event.preventDefault()
                onHoldStart()
              }
            }
          : undefined
      }
      onKeyUp={
        onHoldEnd
          ? (event) => {
              if (
                event.code === 'Space' ||
                event.code === 'Enter'
              ) {
                event.preventDefault()
                onHoldEnd()
              }
            }
          : undefined
      }
      className={cn(
        'flex size-11 shrink-0 touch-none items-center justify-center rounded-[10px] border border-transparent text-muted-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-12 sm:w-[4.75rem] sm:flex-col sm:gap-0.5',
        'hover:bg-panel-raised hover:text-ink',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-strong',
        active && 'bg-[#eff6ff] text-primary hover:bg-[#e0ecff]',
        deviceOff && 'bg-[#fef2f2] text-danger hover:bg-[#fee2e2]',
        endCall &&
          'bg-danger text-white hover:bg-[#b91c1c] hover:text-white sm:w-[4.75rem]',
      )}
    >
      {icon}
      <span className="hidden max-w-full px-1 text-center text-[0.625rem] font-semibold leading-[0.7rem] sm:line-clamp-2">
        {label}
      </span>
    </button>
  )
}
