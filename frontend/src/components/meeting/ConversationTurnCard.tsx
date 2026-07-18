import { useState } from 'react'
import { Check, Copy, PencilLine } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { IconButton } from '@/components/ui/IconButton'
import { useClipboard } from '@/hooks/useClipboard'
import { useTranslation } from '@/hooks/useTranslation'
import { LANGUAGE_SHORT_LABELS } from '@/lib/constants'
import { formatElapsedTime, getInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'
import type { ConversationTurn, Language } from '@/types/meeting'
import { TranslationStatusBadge } from './TranslationStatusBadge'

export interface ConversationTurnCardProps {
  turn: ConversationTurn
  compact?: boolean
  readOnly?: boolean
  variant?: 'card' | 'panel'
  prioritizedLanguage?: Language
}

export function ConversationTurnCard({
  turn,
  compact = false,
  readOnly = false,
  variant = 'card',
  prioritizedLanguage,
}: ConversationTurnCardProps) {
  const { t } = useTranslation()
  const correctTranslation = useMeetingStore(
    (state) => state.correctTranslation,
  )
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false)
  const [correction, setCorrection] = useState('')
  const { copy, copyState } = useClipboard()
  const isVietnamese = turn.sourceLanguage === 'vi'
  const canAct = turn.translatedText.trim().length > 0
  const translationIsPrioritized =
    prioritizedLanguage === undefined ||
    turn.targetLanguage === prioritizedLanguage
  const languageLabel = (language: Language) =>
    t(language === 'vi' ? 'common.vietnamese' : 'common.english')

  const handleSaveCorrection = () => {
    const normalizedCorrection = correction.trim()
    if (normalizedCorrection.length === 0) {
      return
    }

    correctTranslation(turn.id, normalizedCorrection)
    setIsCorrectionOpen(false)
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative bg-panel',
        variant === 'panel'
          ? 'px-4 py-4 sm:px-5'
          : 'overflow-hidden rounded-[10px] border border-line p-4 sm:p-5',
        compact && variant !== 'panel' ? 'p-4' : '',
      )}
    >
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-[3px]',
            translationIsPrioritized
              ? 'bg-vietnamese'
              : isVietnamese
                ? 'bg-primary'
                : 'bg-vietnamese',
          )}
          aria-hidden="true"
        />
        <div className="flex items-start gap-3">
          {variant !== 'panel' && (
            <div
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full border text-[0.6875rem] font-extrabold',
                isVietnamese
                  ? 'border-vietnamese/25 bg-[#f0fdfa] text-vietnamese'
                  : 'border-primary/20 bg-[#eff6ff] text-primary',
              )}
              aria-hidden="true"
            >
              {getInitials(turn.speakerName)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate text-sm font-bold text-ink">
                {turn.speakerName}
              </p>
              <span className="rounded-md bg-panel-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-strong">
                {LANGUAGE_SHORT_LABELS[turn.sourceLanguage]} →{' '}
                {LANGUAGE_SHORT_LABELS[turn.targetLanguage]}
              </span>
              <span className="text-xs tabular-nums text-muted">
                {formatElapsedTime(turn.timestampSeconds)}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {turn.isEdited && (
                  <span className="text-[0.6875rem] font-semibold text-muted-strong">
                    {t('common.edited')}
                  </span>
                )}
                <TranslationStatusBadge status={turn.status} />
              </div>
            </div>

            <div className={cn('mt-3 grid', compact ? 'gap-3' : 'gap-3')}>
              <div>
                <p className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  {t('turn.original', {
                    language: languageLabel(turn.sourceLanguage),
                  })}
                </p>
                <p
                  lang={turn.sourceLanguage}
                  className={cn(
                    'min-h-5 break-words leading-6 text-muted-strong',
                    compact ? 'text-sm' : 'text-sm',
                  )}
                >
                  {turn.originalText ||
                    (turn.status === 'failed'
                      ? t('turn.processingFailed')
                      : turn.status === 'listening'
                      ? t('turn.waiting')
                      : t('turn.transcribing'))}
                </p>
              </div>

              <div className="border-t border-line pt-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-vietnamese">
                    {t('turn.translation', {
                      language: languageLabel(turn.targetLanguage),
                    })}
                  </p>
                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <IconButton
                        label={
                          copyState === 'copied'
                            ? t('turn.translationCopied')
                            : t('turn.copyTranslation')
                        }
                        icon={
                          copyState === 'copied' ? (
                            <Check className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Copy className="size-3.5" aria-hidden="true" />
                          )
                        }
                        disabled={!canAct}
                        onClick={() => void copy(turn.translatedText)}
                      />
                      <IconButton
                        label={t('turn.correctTranslation')}
                        icon={
                          <PencilLine
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        }
                        disabled={!canAct}
                        onClick={() => {
                          setCorrection(turn.translatedText)
                          setIsCorrectionOpen(true)
                        }}
                      />
                    </div>
                  )}
                </div>
                <p
                  lang={turn.targetLanguage}
                  className={cn(
                    'min-h-7 break-words font-semibold leading-7 text-ink',
                    compact ? 'text-sm' : 'text-[0.9375rem]',
                    turn.status === 'draft' && 'text-ink-soft',
                  )}
                >
                  {turn.translatedText ||
                    (turn.status === 'failed'
                      ? t('turn.processingFailed')
                      : turn.status === 'listening' ||
                          turn.status === 'transcribing'
                        ? t('turn.translationPending')
                        : t('turn.preparingTranslation'))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {turn.status === 'final' && (
          <span className="sr-only" aria-live="polite">
            {t('turn.finalAvailable', { speaker: turn.speakerName })}
          </span>
        )}

      <Dialog
        open={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        title={t('turn.correctionTitle')}
        description={t('turn.correctionDescription')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCorrectionOpen(false)}>
              {t('turn.keepCurrent')}
            </Button>
            <Button variant="primary" onClick={handleSaveCorrection}>
              {t('turn.saveCorrection')}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">
              {t('turn.source')}
            </p>
            <p
              lang={turn.sourceLanguage}
              className="break-words rounded-lg border border-line bg-canvas px-4 py-3 text-sm leading-6 text-ink-soft"
            >
              {turn.originalText}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-ink-soft">
            {t('turn.translationField')}
            <textarea
              autoFocus
              value={correction}
              onChange={(event) => setCorrection(event.target.value)}
              rows={5}
              className="resize-y rounded-lg border border-line-strong bg-canvas px-4 py-3 font-normal leading-6 text-ink outline-none placeholder:text-muted focus:border-primary"
            />
          </label>
        </div>
      </Dialog>
    </motion.li>
  )
}
