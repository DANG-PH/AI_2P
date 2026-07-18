import { Mic, Volume2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
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
  error: 'microphone.statusError',
}

export function MicrophoneTest() {
  const { t } = useTranslation()
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
  const streamerRef = useRef<AudioStreamer | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const runIdRef = useRef(0)
  const peakLevelRef = useRef(0)

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
    setAudioInputLevel(0)
    setMicrophoneTestStatus('testing')

    const streamer = new AudioStreamer({
      sampleRate: 16_000,
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
      timeoutRef.current = window.setTimeout(() => {
        if (runIdRef.current !== runId) {
          return
        }

        stopTest()
        setMicrophoneTestStatus(
          peakLevelRef.current >= MINIMUM_DETECTED_LEVEL
            ? 'complete'
            : 'no-input',
        )
      }, TEST_DURATION_MS)
    } catch {
      streamer.stop()
      if (runIdRef.current === runId) {
        setAudioInputLevel(0)
        setMicrophoneTestStatus('error')
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
      </div>
    </section>
  )
}
