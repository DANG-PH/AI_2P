import { Mic, Volume2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import type { MediaDevicesState } from '@/hooks/useMediaDevices'
import type { TranslationKey } from '@/i18n/translations'
import { AudioStreamer } from '@/lib/audioStreamer'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'
import type { MicrophoneTestStatus } from '@/types/meeting'

const METER_SEGMENT_COUNT = 12
const TEST_DURATION_MS = 5_000
const MINIMUM_DETECTED_LEVEL = 0.02

const microphoneStatusKeys: Record<
  MicrophoneTestStatus,
  TranslationKey
> = {
  idle: 'microphone.statusIdle',
  testing: 'microphone.statusTesting',
  complete: 'microphone.statusComplete',
  'no-input': 'microphone.statusNoInput',
  'permission-denied': 'microphone.statusPermissionDenied',
  'no-device': 'microphone.statusNoDevice',
  unsupported: 'microphone.statusUnsupported',
  error: 'microphone.statusError',
}

export interface MicrophoneTestProps {
  mediaDevices: MediaDevicesState
}

export function MicrophoneTest({ mediaDevices }: MicrophoneTestProps) {
  const { t } = useTranslation()
  const microphoneId = useMeetingStore(
    (state) => state.meeting.microphoneId,
  )
  const audioInputLevel = useMeetingStore(
    (state) => state.audioInputLevel,
  )
  const microphoneTestStatus = useMeetingStore(
    (state) => state.microphoneTestStatus,
  )
  const setAudioInputLevel = useMeetingStore(
    (state) => state.setAudioInputLevel,
  )
  const setMicrophoneTestStatus = useMeetingStore(
    (state) => state.setMicrophoneTestStatus,
  )
  const noiseLevel = useMeetingStore((state) => state.noiseLevel)
  const setNoiseLevel = useMeetingStore((state) => state.setNoiseLevel)
  const streamerRef = useRef<AudioStreamer | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const runIdRef = useRef(0)
  const peakLevelRef = useRef(0)
  const volumeSamplesRef = useRef<number[]>([])

  const stopTest = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = null
    streamerRef.current?.stop()
    streamerRef.current = null
  }

  useEffect(
    () => () => {
      runIdRef.current += 1
      stopTest()
    },
    [],
  )

  const runMicrophoneTest = async () => {
    stopTest()
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    peakLevelRef.current = 0
    volumeSamplesRef.current = []
    setAudioInputLevel(0)
    setNoiseLevel('unknown')
    setMicrophoneTestStatus('testing')

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophoneTestStatus('unsupported')
      return
    }

    if (
      mediaDevices.permissionState === 'granted' &&
      mediaDevices.listStatus === 'ready' &&
      mediaDevices.microphones.length === 0
    ) {
      setMicrophoneTestStatus('no-device')
      return
    }

    const streamer = new AudioStreamer({
      sampleRate: 16_000,
      deviceId: microphoneId || undefined,
      onAudioChunk: () => undefined,
      onVolume: (volume) => {
        if (runIdRef.current !== runId) {
          return
        }
        const normalizedLevel = volume / 100
        peakLevelRef.current = Math.max(
          peakLevelRef.current,
          normalizedLevel,
        )
        volumeSamplesRef.current.push(normalizedLevel)
        setAudioInputLevel(normalizedLevel)
      },
    })

    try {
      await streamer.start()
      if (runIdRef.current !== runId) {
        streamer.stop()
        return
      }

      streamerRef.current = streamer
      await mediaDevices.refresh()
      timeoutRef.current = window.setTimeout(() => {
        if (runIdRef.current !== runId) {
          return
        }

        stopTest()
        const sortedSamples = [...volumeSamplesRef.current].sort(
          (left, right) => left - right,
        )
        const baselineIndex = Math.floor(
          Math.max(0, sortedSamples.length - 1) * 0.2,
        )
        const backgroundLevel = sortedSamples[baselineIndex] ?? 0
        setNoiseLevel(
          sortedSamples.length === 0
            ? 'unknown'
            : backgroundLevel < 0.06
              ? 'low'
              : backgroundLevel < 0.14
                ? 'medium'
                : 'high',
        )
        setMicrophoneTestStatus(
          peakLevelRef.current >= MINIMUM_DETECTED_LEVEL
            ? 'complete'
            : 'no-input',
        )
      }, TEST_DURATION_MS)
    } catch (error) {
      streamer.stop()
      if (runIdRef.current === runId) {
        setAudioInputLevel(0)
        setNoiseLevel('unknown')
        setMicrophoneTestStatus(
          error instanceof DOMException &&
            error.name === 'NotAllowedError'
            ? 'permission-denied'
            : error instanceof DOMException &&
                error.name === 'NotFoundError'
              ? 'no-device'
              : 'error',
        )
        await mediaDevices.refresh()
      }
    }
  }

  const activeSegments = Math.ceil(
    audioInputLevel * METER_SEGMENT_COUNT,
  )

  return (
    <section
      aria-labelledby="microphone-heading"
      className="border-t border-line pt-7"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2
            id="microphone-heading"
            className="text-base font-semibold text-ink"
          >
            {t('microphone.title')}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {t('microphone.description')}
          </p>
        </div>
        <StatusBadge tone="info">
          {t('microphone.audioInput')}
        </StatusBadge>
      </div>

      <Button
        type="button"
        onClick={() => void runMicrophoneTest()}
        disabled={microphoneTestStatus === 'testing'}
        aria-describedby="microphone-test-note"
        variant="secondary"
        size="lg"
        leadingIcon={
          microphoneTestStatus === 'testing' ? (
            <Volume2 aria-hidden="true" className="size-4" />
          ) : (
            <Mic aria-hidden="true" className="size-4" />
          )
        }
        className="min-w-40 disabled:cursor-wait"
      >
        {microphoneTestStatus === 'testing'
          ? t('microphone.testing')
          : t('microphone.test')}
      </Button>
      <p
        id="microphone-test-note"
        className="mt-2 text-xs text-muted"
      >
        {t('microphone.testNote')}
      </p>

      <div className="mt-5 rounded-[10px] border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {t('microphone.inputLevel')}
          </span>
          <span
            aria-live="polite"
            className={cn(
              'text-right text-xs font-medium text-muted-strong',
              microphoneTestStatus === 'error' && 'text-danger',
              microphoneTestStatus === 'no-input' &&
                'text-warning',
            )}
          >
            {t(microphoneStatusKeys[microphoneTestStatus])}
          </span>
        </div>
        <div
          role="meter"
          aria-label={t('microphone.levelAria')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(audioInputLevel * 100)}
          className="mt-4 grid h-8 grid-cols-12 items-end gap-1"
        >
          {Array.from(
            { length: METER_SEGMENT_COUNT },
            (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  'block rounded-[2px] transition-colors duration-150',
                  index < activeSegments
                    ? index > 8
                      ? 'bg-warning'
                      : 'bg-primary'
                    : 'bg-line',
                )}
                style={{
                  height: `${36 + ((index * 17) % 58)}%`,
                }}
              />
            ),
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {t('microphone.backgroundLevel')}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {t('microphone.backgroundEstimate')}
            </p>
          </div>
          <StatusBadge
            tone={
              noiseLevel === 'high'
                ? 'danger'
                : noiseLevel === 'medium'
                  ? 'warning'
                  : noiseLevel === 'low'
                    ? 'success'
                    : 'neutral'
            }
          >
            {noiseLevel === 'unknown'
              ? t('microphone.notMeasured')
              : t(`common.${noiseLevel}` as const)}
          </StatusBadge>
        </div>
        {noiseLevel === 'high' && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-warning/25 bg-warning/8 px-3 py-2 text-xs leading-5 text-warning-soft"
          >
            {t('microphone.noiseWarning')}
          </p>
        )}
      </div>
    </section>
  )
}
