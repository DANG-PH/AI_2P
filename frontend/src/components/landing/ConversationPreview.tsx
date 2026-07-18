import { AudioLines, Check, FileText, Languages } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'

const audioLevels = [24, 48, 68, 42, 82, 58, 34, 72, 52, 88, 46, 64, 30, 54]

interface PreviewTurn {
  id: string
  speakerKey: TranslationKey
  sourceLanguage: 'VI' | 'EN'
  timestamp: string
  originalKey: TranslationKey
  translationKey: TranslationKey
}

const previewTurns: readonly PreviewTurn[] = [
  {
    id: 'preview-nguyen-minh',
    speakerKey: 'preview.turnOneSpeaker',
    sourceLanguage: 'VI',
    timestamp: '00:08',
    originalKey: 'preview.turnOneOriginal',
    translationKey: 'preview.turnOneTranslation',
  },
  {
    id: 'preview-james-tan',
    speakerKey: 'preview.turnTwoSpeaker',
    sourceLanguage: 'EN',
    timestamp: '00:24',
    originalKey: 'preview.turnTwoOriginal',
    translationKey: 'preview.turnTwoTranslation',
  },
]

const accentClasses = {
  VI: {
    dot: 'bg-vietnamese',
    label: 'text-vietnamese-soft',
    translation: 'bg-vietnamese/6',
  },
  EN: {
    dot: 'bg-english',
    label: 'text-english-soft',
    translation: 'bg-english/6',
  },
} as const

export function ConversationPreview() {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('preview.ariaLabel')}
      className="relative w-full min-w-0 max-w-full overflow-hidden rounded-[14px] border border-line-strong bg-panel shadow-[0_16px_40px_rgb(16_24_40/0.08)]"
    >
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
            <AudioLines aria-hidden="true" className="size-3.5" />
            {t('preview.monitor')}
          </div>
          <p className="mt-1 truncate text-sm font-medium text-ink-soft">
            {t('preview.meetingTitle')}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line-strong bg-panel-muted px-2.5 py-1.5 text-[0.625rem] font-semibold tracking-[0.12em] text-muted-strong uppercase">
          <span className="size-1.5 rounded-full bg-warning" />
          {t('common.example')}
        </span>
      </div>

      <div className="border-b border-line bg-panel-muted px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="text-[0.625rem] font-bold tracking-[0.14em] text-vietnamese-soft">
            VI
          </span>
          <div
            aria-label={t('preview.audioLevel')}
            className="flex h-5 flex-1 items-center gap-1"
            role="img"
          >
            {audioLevels.map((level, index) => (
              <span
                className="w-1 rounded-full bg-primary/55"
                key={`${level}-${index.toString()}`}
                style={{ height: `${level}%` }}
              />
            ))}
          </div>
          <Languages aria-hidden="true" className="size-3.5 text-muted" />
          <span className="text-[0.625rem] font-bold tracking-[0.14em] text-english-soft">
            EN
          </span>
        </div>
      </div>

      <div>
        {previewTurns.map((turn) => {
          const accent = accentClasses[turn.sourceLanguage]
          const targetLanguage = turn.sourceLanguage === 'VI' ? 'EN' : 'VI'

          return (
            <article
              className="border-b border-line/80 px-4 py-5 last:border-b-0 sm:px-5 sm:py-6"
              key={turn.id}
            >
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${accent.dot}`}
                />
                <h2 className="text-sm font-semibold text-ink">
                  {t(turn.speakerKey)}
                </h2>
                <span
                  className={`text-[0.625rem] font-bold tracking-[0.14em] ${accent.label}`}
                >
                  {turn.sourceLanguage}
                </span>
                <time className="ml-auto text-xs tabular-nums text-muted">
                  {turn.timestamp}
                </time>
              </header>

              <p className="mt-3 text-[0.9375rem] leading-6 text-ink-soft">
                {t(turn.originalKey)}
              </p>

              <div
                className={`mt-4 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-t border-line px-0 pt-3 ${accent.translation}`}
              >
                <span className="pt-0.5 text-[0.625rem] font-bold tracking-[0.14em] text-muted">
                  {targetLanguage}
                </span>
                <p className="min-w-0 break-words text-sm leading-6 text-muted-strong">
                  {t(turn.translationKey)}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1.5 text-[0.6875rem] font-medium text-muted">
                <Check aria-hidden="true" className="size-3.5 text-success" />
                {t('preview.finalTranslation')}
              </div>
            </article>
          )
        })}
      </div>

      <footer className="grid gap-2 border-t border-line bg-panel-muted px-4 py-3 text-[0.6875rem] text-muted sm:grid-cols-3 sm:px-5">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" />
          {t('preview.connection')}
        </span>
        <span className="flex items-center gap-2 sm:justify-center">
          <FileText aria-hidden="true" className="size-3.5" />
          {t('preview.transcript')}
        </span>
        <span className="sm:text-right">{t('preview.latency')}</span>
      </footer>
    </section>
  )
}
