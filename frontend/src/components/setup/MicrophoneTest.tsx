import { Mic, Volume2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { microphoneOptions } from '@/data/mockMeeting'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { MOCK_AUDIO_LEVEL_SEQUENCE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'
import type { MicrophoneTestStatus, NoiseLevel } from '@/types/meeting'

const METER_SEGMENT_COUNT = 12
const TEST_STEP_DURATION_MS = 220

const microphoneStatusKeys: Record<
  MicrophoneTestStatus,
  TranslationKey
> = {
  idle: 'microphone.statusIdle',
  testing: 'microphone.statusTesting',
  complete: 'microphone.statusComplete',
}

const microphoneLabelKeys: Partial<Record<string, TranslationKey>> = {
  'built-in-microphone': 'microphone.builtIn',
  'conference-speakerphone': 'microphone.conference',
  'studio-usb-microphone': 'microphone.studio',
}

const noiseLevelKeys: Record<NoiseLevel, TranslationKey> = {
  low: 'common.low',
  medium: 'common.medium',
  high: 'common.high',
}

export function MicrophoneTest() {
  const { t } = useTranslation()
  const microphoneId = useMeetingStore(
    (state) => state.meeting.microphoneId,
  )
  const audioInputLevel = useMeetingStore((state) => state.audioInputLevel)
  const noiseLevel = useMeetingStore((state) => state.noiseLevel)
  const microphoneTestStatus = useMeetingStore(
    (state) => state.microphoneTestStatus,
  )
  const setMicrophone = useMeetingStore((state) => state.setMicrophone)
  const setAudioInputLevel = useMeetingStore(
    (state) => state.setAudioInputLevel,
  )
  const setMicrophoneTestStatus = useMeetingStore(
    (state) => state.setMicrophoneTestStatus,
  )
  const intervalRef = useRef<number | null>(null)

  const clearTestInterval = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(
    () => () => {
      clearTestInterval()
    },
    [],
  )

  const runMicrophoneTest = () => {
    clearTestInterval()

    let sequenceIndex = 0
    setMicrophoneTestStatus('testing')
    setAudioInputLevel(MOCK_AUDIO_LEVEL_SEQUENCE[sequenceIndex] ?? 0)

    intervalRef.current = window.setInterval(() => {
      sequenceIndex += 1

      if (sequenceIndex >= MOCK_AUDIO_LEVEL_SEQUENCE.length) {
        clearTestInterval()
        setMicrophoneTestStatus('complete')
        return
      }

      setAudioInputLevel(MOCK_AUDIO_LEVEL_SEQUENCE[sequenceIndex] ?? 0)
    }, TEST_STEP_DURATION_MS)
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
        <StatusBadge tone="neutral">
          {t('common.simulated')}
        </StatusBadge>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <label
            htmlFor="microphone-select"
            className="mb-2 block text-sm font-medium text-ink-soft"
          >
            {t('microphone.audioInput')}
          </label>
          <div className="relative">
            <Mic
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <select
              id="microphone-select"
              value={microphoneId}
              onChange={(event) => setMicrophone(event.target.value)}
              className="h-12 w-full appearance-none rounded-[10px] border border-line-strong bg-panel pl-10 pr-10 text-base text-ink transition-colors hover:border-muted focus:border-primary"
            >
              {microphoneOptions.map((option) => {
                const labelKey = microphoneLabelKeys[option.id]

                return (
                  <option key={option.id} value={option.id}>
                    {labelKey ? t(labelKey) : option.label}
                  </option>
                )
              })}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted"
            >
              ▾
            </span>
          </div>
        </div>

        <Button
          type="button"
          onClick={runMicrophoneTest}
          disabled={microphoneTestStatus === 'testing'}
          aria-describedby="microphone-test-note"
          variant="secondary"
          size="lg"
          leadingIcon={<Volume2 aria-hidden="true" className="size-4" />}
          className="min-w-40 disabled:cursor-wait"
        >
          {microphoneTestStatus === 'testing'
            ? t('microphone.testing')
            : t('microphone.test')}
        </Button>
      </div>

      <p id="microphone-test-note" className="mt-2 text-xs text-muted">
        {t('microphone.testNote')}
      </p>

      <div className="mt-5 rounded-[10px] border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {t('microphone.inputLevel')}
          </span>
          <span
            aria-live="polite"
            className="text-xs font-medium text-muted-strong"
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
          {Array.from({ length: METER_SEGMENT_COUNT }, (_, index) => (
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
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-3">
          <span className="text-xs text-muted">
            {t('microphone.roomNoise')}
          </span>
          <StatusBadge
            tone="success"
            icon={
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-success"
              />
            }
            className="capitalize"
          >
            {t(noiseLevelKeys[noiseLevel])}
          </StatusBadge>
        </div>
      </div>
    </section>
  )
}
