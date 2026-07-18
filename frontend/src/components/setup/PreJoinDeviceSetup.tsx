import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Camera,
  CameraOff,
  LoaderCircle,
  Mic,
  MicOff,
} from 'lucide-react'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'

type CameraPreviewStatus =
  | 'off'
  | 'requesting'
  | 'ready'
  | 'error'
  | 'unavailable'

const cameraStatusKeys: Record<
  CameraPreviewStatus,
  TranslationKey
> = {
  off: 'prejoin.cameraOff',
  requesting: 'prejoin.cameraRequesting',
  ready: 'prejoin.cameraReady',
  error: 'prejoin.cameraError',
  unavailable: 'prejoin.cameraUnavailable',
}

export function PreJoinDeviceSetup() {
  const { t } = useTranslation()
  const microphoneEnabled = useMeetingStore(
    (state) => state.microphoneEnabled,
  )
  const cameraEnabled = useMeetingStore(
    (state) => state.cameraEnabled,
  )
  const toggleMicrophone = useMeetingStore(
    (state) => state.toggleMicrophone,
  )
  const setCameraEnabled = useMeetingStore(
    (state) => state.setCameraEnabled,
  )
  const setMicrophoneTestStatus = useMeetingStore(
    (state) => state.setMicrophoneTestStatus,
  )
  const setAudioInputLevel = useMeetingStore(
    (state) => state.setAudioInputLevel,
  )
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [cameraStatus, setCameraStatus] =
    useState<CameraPreviewStatus>(
      cameraEnabled ? 'requesting' : 'off',
    )

  useEffect(() => {
    if (!cameraEnabled) {
      return
    }

    let active = true
    let previewStream: MediaStream | null = null
    const videoElement = videoRef.current

    const startPreview = async () => {
      setCameraStatus('requesting')

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('unavailable')
        setCameraEnabled(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        previewStream = stream
        if (videoElement) {
          videoElement.srcObject = stream
        }
        setCameraStatus('ready')
      } catch {
        if (active) {
          setCameraStatus('error')
          setCameraEnabled(false)
        }
      }
    }

    void startPreview()

    return () => {
      active = false
      previewStream?.getTracks().forEach((track) => track.stop())
      if (videoElement?.srcObject === previewStream) {
        videoElement.srcObject = null
      }
    }
  }, [cameraEnabled, setCameraEnabled])

  const handleMicrophoneToggle = () => {
    if (microphoneEnabled) {
      setMicrophoneTestStatus('idle')
      setAudioInputLevel(0)
    }
    toggleMicrophone()
  }

  const handleCameraToggle = () => {
    if (cameraEnabled) {
      setCameraStatus('off')
      setCameraEnabled(false)
      return
    }

    setCameraEnabled(true)
  }

  const cameraStatusTone =
    cameraStatus === 'ready'
      ? 'success'
      : cameraStatus === 'error' ||
          cameraStatus === 'unavailable'
        ? 'danger'
        : 'neutral'

  return (
    <section
      aria-labelledby="prejoin-device-heading"
    >
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {t('prejoin.eyebrow')}
        </p>
        <h2
          id="prejoin-device-heading"
          className="mt-2 text-xl font-semibold tracking-tight text-ink"
        >
          {t('prejoin.title')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {t('prejoin.description')}
        </p>
      </div>

      <div className="grid overflow-hidden rounded-xl border border-line bg-panel lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
        <div
          className="relative aspect-video min-h-52 overflow-hidden bg-meeting-stage lg:aspect-auto"
          aria-label={t('prejoin.previewAria')}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn(
              'absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity',
              cameraStatus === 'ready' ? 'opacity-100' : 'opacity-0',
            )}
          />

          {cameraStatus !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-stage-muted">
              <div className="grid justify-items-center gap-3">
                <span className="grid size-14 place-items-center rounded-full bg-white/8 ring-1 ring-white/10">
                  {cameraStatus === 'requesting' ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-6 animate-spin"
                    />
                  ) : (
                    <CameraOff aria-hidden="true" className="size-6" />
                  )}
                </span>
                <span className="text-sm font-medium">
                  {t(cameraStatusKeys[cameraStatus])}
                </span>
              </div>
            </div>
          )}

          <div className="absolute inset-x-3 bottom-3 flex justify-start">
            <StatusBadge tone={cameraStatusTone}>
              {t(cameraStatusKeys[cameraStatus])}
            </StatusBadge>
          </div>
        </div>

        <fieldset className="min-w-0 p-5 sm:p-6">
          <legend className="text-base font-semibold text-ink">
            {t('prejoin.entryState')}
          </legend>
          <p className="mt-1 text-sm leading-6 text-muted">
            {t('prejoin.entryStateDescription')}
          </p>

          <div className="mt-5 grid gap-2">
            <DeviceToggle
              enabled={microphoneEnabled}
              label={t('controls.microphone')}
              stateLabel={t(
                microphoneEnabled
                  ? 'stage.microphoneOn'
                  : 'stage.microphoneOff',
              )}
              enabledIcon={<Mic aria-hidden="true" className="size-5" />}
              disabledIcon={
                <MicOff aria-hidden="true" className="size-5" />
              }
              onClick={handleMicrophoneToggle}
            />
            <DeviceToggle
              enabled={cameraEnabled}
              label={t('controls.camera')}
              stateLabel={t(
                cameraEnabled
                  ? 'prejoin.cameraOn'
                  : 'prejoin.cameraOff',
              )}
              enabledIcon={
                <Camera aria-hidden="true" className="size-5" />
              }
              disabledIcon={
                <CameraOff aria-hidden="true" className="size-5" />
              }
              onClick={handleCameraToggle}
            />
          </div>

          <p className="mt-4 text-xs leading-5 text-muted">
            {t('prejoin.permissionNote')}
          </p>
        </fieldset>
      </div>
    </section>
  )
}

interface DeviceToggleProps {
  enabled: boolean
  label: string
  stateLabel: string
  enabledIcon: ReactNode
  disabledIcon: ReactNode
  onClick: () => void
}

function DeviceToggle({
  enabled,
  label,
  stateLabel,
  enabledIcon,
  disabledIcon,
  onClick,
}: DeviceToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onClick}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        enabled
          ? 'border-primary/30 bg-primary/8 hover:bg-primary/12'
          : 'border-line bg-panel-muted/65 hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          enabled
            ? 'bg-primary text-white'
            : 'bg-panel-raised text-muted-strong',
        )}
      >
        {enabled ? enabledIcon : disabledIcon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">
          {label}
        </span>
        <span
          className={cn(
            'mt-0.5 block text-xs',
            enabled ? 'text-primary-soft' : 'text-muted',
          )}
        >
          {stateLabel}
        </span>
      </span>
    </button>
  )
}
