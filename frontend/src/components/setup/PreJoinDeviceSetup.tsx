import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Camera,
  CameraOff,
  Languages,
  LoaderCircle,
  Mic,
  MicOff,
  Speaker,
} from 'lucide-react'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import type {
  MediaDevicesState,
  MicrophonePermissionState,
} from '@/hooks/useMediaDevices'
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

const microphonePermissionKeys: Record<
  MicrophonePermissionState,
  TranslationKey
> = {
  unknown: 'devices.permissionUnknown',
  prompt: 'devices.permissionPrompt',
  granted: 'devices.permissionGranted',
  denied: 'devices.permissionDenied',
  unsupported: 'devices.permissionOnUse',
}

export interface PreJoinDeviceSetupProps {
  mediaDevices: MediaDevicesState
}

export function PreJoinDeviceSetup({
  mediaDevices,
}: PreJoinDeviceSetupProps) {
  const { t } = useTranslation()
  const meeting = useMeetingStore((state) => state.meeting)
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
  const setMicrophone = useMeetingStore((state) => state.setMicrophone)
  const setSpeaker = useMeetingStore((state) => state.setSpeaker)
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

          <div className="mt-5 grid gap-4 border-t border-line pt-5">
            <label className="grid gap-2 text-xs font-semibold text-ink-soft">
              {t('devices.microphone')}
              <select
                value={meeting.microphoneId}
                onChange={(event) => setMicrophone(event.target.value)}
                disabled={
                  mediaDevices.listStatus !== 'ready' ||
                  mediaDevices.microphones.length === 0
                }
                aria-describedby="microphone-device-status"
                className="h-11 min-w-0 rounded-[10px] border border-line-strong bg-panel px-3 text-sm text-ink outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mediaDevices.microphones.length === 0 ? (
                  <option value="">{t('devices.noMicrophone')}</option>
                ) : (
                  mediaDevices.microphones.map((device, index) => (
                    <option key={device.id} value={device.id}>
                      {device.label ||
                        t('devices.microphoneFallback', {
                          count: index + 1,
                        })}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div id="microphone-device-status">
              <StatusBadge
                tone={
                  mediaDevices.permissionState === 'denied'
                    ? 'danger'
                    : mediaDevices.permissionState === 'granted'
                      ? 'success'
                      : 'neutral'
                }
              >
                {t(
                  microphonePermissionKeys[
                    mediaDevices.permissionState
                  ],
                )}
              </StatusBadge>
            </div>

            <label className="grid gap-2 text-xs font-semibold text-ink-soft">
              {t('devices.speaker')}
              {mediaDevices.outputSelectionSupported &&
              mediaDevices.speakers.length > 0 ? (
                <select
                  value={meeting.speakerId}
                  onChange={(event) => setSpeaker(event.target.value)}
                  className="h-11 min-w-0 rounded-[10px] border border-line-strong bg-panel px-3 text-sm text-ink outline-none focus:border-primary"
                >
                  {mediaDevices.speakers.map((device, index) => (
                    <option key={device.id} value={device.id}>
                      {device.label ||
                        t('devices.speakerFallback', {
                          count: index + 1,
                        })}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex min-h-11 items-center gap-3 rounded-[10px] border border-line bg-panel-muted/65 px-3 text-sm font-normal text-muted-strong">
                  <Speaker className="size-4 shrink-0" aria-hidden="true" />
                  {t('devices.systemSpeaker')}
                </div>
              )}
            </label>

            <div className="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-panel-muted/65 px-3 py-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-strong">
                <Languages className="size-4" aria-hidden="true" />
                {t('devices.speakingLanguage')}
              </span>
              <span className="text-sm font-semibold text-ink">
                {t(
                  meeting.localLanguage === 'vi'
                    ? 'common.vietnamese'
                    : 'common.english',
                )}
              </span>
            </div>
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
