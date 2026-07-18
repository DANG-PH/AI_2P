import {
  AudioLines,
  Check,
  FileText,
  Languages,
  Mic2,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'

const audioLevels = [28, 54, 82, 48, 92, 64, 36, 72, 46, 86, 58, 74, 38]

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
    label: 'text-vietnamese',
    wash: 'bg-[#e4f0ea]',
  },
  EN: {
    dot: 'bg-primary',
    label: 'text-primary',
    wash: 'bg-[#e8edff]',
  },
} as const

export function ConversationPreview() {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('preview.ariaLabel')}
      className="landing-preview relative w-full min-w-0 max-w-full overflow-hidden rounded-[30px_30px_12px_30px] border border-ink/15 bg-[#fbfaf6] shadow-[0_28px_70px_rgb(28_35_32/0.14)]"
    >
      <header className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 border-b border-ink/10 bg-ink px-5 py-4 text-stage-ink sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.625rem] font-bold tracking-[0.16em] text-stage-muted uppercase">
            <AudioLines aria-hidden="true" className="size-3.5" />
            {t('preview.monitor')}
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-stage-ink">
            {t('preview.meetingTitle')}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stage-muted/30 px-3 py-1.5 text-[0.625rem] font-bold tracking-[0.12em] text-stage-ink uppercase">
          <span className="size-1.5 rounded-full bg-warning" />
          {t('common.example')}
        </span>
      </header>

      <div className="grid grid-cols-[4rem_minmax(0,1fr)] border-b border-ink/10 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
        <div className="flex items-center justify-center border-r border-ink/10 bg-[#f0eee7]">
          <Mic2 aria-hidden="true" className="size-4 text-muted" />
        </div>
        <div className="flex min-h-12 items-center gap-3 px-4 sm:px-5">
          <span className="text-[0.625rem] font-bold tracking-[0.14em] text-vietnamese">
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
          <span className="text-[0.625rem] font-bold tracking-[0.14em] text-primary">
            EN
          </span>
        </div>
      </div>

      <div>
        {previewTurns.map((turn, index) => {
          const accent = accentClasses[turn.sourceLanguage]
          const targetLanguage = turn.sourceLanguage === 'VI' ? 'EN' : 'VI'

          return (
            <article
              className="grid grid-cols-[4rem_minmax(0,1fr)] border-b border-ink/10 last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)]"
              key={turn.id}
            >
              <div className="relative flex flex-col items-center border-r border-ink/10 bg-[#f0eee7] px-2 py-5">
                <span
                  aria-hidden="true"
                  className={`relative z-10 mt-1 size-2.5 rounded-full ring-4 ring-[#f0eee7] ${accent.dot}`}
                />
                {index < previewTurns.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-7 bottom-0 w-px bg-ink/15"
                  />
                ) : null}
                <time className="mt-3 text-[0.625rem] tabular-nums text-muted">
                  {turn.timestamp}
                </time>
              </div>

              <div className="min-w-0 px-4 py-5 sm:px-5 sm:py-6">
                <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h2 className="text-sm font-semibold text-ink">
                    {t(turn.speakerKey)}
                  </h2>
                  <span
                    className={`text-[0.625rem] font-bold tracking-[0.14em] ${accent.label}`}
                  >
                    {turn.sourceLanguage}
                  </span>
                </header>

                <p className="mt-2.5 text-sm leading-6 text-muted-strong">
                  {t(turn.originalKey)}
                </p>

                <div
                  className={`mt-4 rounded-[6px_16px_16px_16px] p-3.5 ${accent.wash}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[0.625rem] font-bold tracking-[0.14em] text-ink-soft">
                      {targetLanguage} · {t('turn.translationField')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold text-success-soft">
                      <Check aria-hidden="true" className="size-3" />
                      {t('status.final')}
                    </span>
                  </div>
                  <p className="mt-2 min-w-0 break-words text-sm leading-6 font-medium text-ink">
                    {t(turn.translationKey)}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <footer className="grid gap-2 border-t border-ink/10 bg-[#f0eee7] px-5 py-3 text-[0.6875rem] text-muted sm:grid-cols-3 sm:px-6">
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
