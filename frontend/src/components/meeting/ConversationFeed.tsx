import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  AudioLines,
  CircleAlert,
  FilePlus2,
  Languages,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { cn } from '@/lib/utils'
import type {
  ConversationMode,
  ConversationTurn,
  Language,
  LanguageOrder,
} from '@/types/meeting'
import type { RealtimeSessionStatus } from '@/types/realtime'
import { ConversationTurnCard } from './ConversationTurnCard'

export interface ConversationFeedProps {
  turns: ConversationTurn[]
  conversationMode: ConversationMode
  languageOrder: LanguageOrder
  localLanguage: Language
  activePushLanguage: Language | null
  onToggleMode: () => void
  onSwapLanguages: () => void
  onAddNote: () => void
  onRetryRealtime: () => void
  realtimeStatus?: RealtimeSessionStatus
  prioritizeTranslation?: boolean
}

export function ConversationFeed({
  turns,
  conversationMode,
  languageOrder,
  localLanguage,
  activePushLanguage,
  onToggleMode,
  onSwapLanguages,
  onAddNote,
  onRetryRealtime,
  realtimeStatus,
  prioritizeTranslation = false,
}: ConversationFeedProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [followTail, setFollowTail] = useState(true)
  const lastTurn = turns.at(-1)
  const languageLabel = (language: Language) =>
    t(language === 'vi' ? 'common.vietnamese' : 'common.english')
  const effectiveRealtimeStatus = realtimeStatus ?? 'connecting'
  const realtimeState = {
    connecting: {
      titleKey: 'feed.connectingTitle',
      descriptionKey: 'feed.connectingDescription',
      tone: 'neutral',
    },
    reconnecting: {
      titleKey: 'feed.reconnectingTitle',
      descriptionKey: 'feed.reconnectingDescription',
      tone: 'warning',
    },
    'gateway-connected': {
      titleKey: 'feed.readyTitle',
      descriptionKey:
        conversationMode === 'push-to-talk'
          ? 'feed.pushReadyDescription'
          : 'feed.autoHint',
      tone: 'ready',
    },
    ended: {
      titleKey: 'feed.endedTitle',
      descriptionKey: 'feed.endedDescription',
      tone: 'neutral',
    },
    error: {
      titleKey: 'feed.errorTitle',
      descriptionKey: 'feed.errorDescription',
      tone: 'danger',
    },
  } as const satisfies Record<
    RealtimeSessionStatus,
    {
      titleKey: TranslationKey
      descriptionKey: TranslationKey
      tone: 'neutral' | 'warning' | 'ready' | 'danger'
    }
  >
  const currentRealtimeState = realtimeState[effectiveRealtimeStatus]

  const scrollToTail = (behavior: ScrollBehavior) => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    container.scrollTo({ top: container.scrollHeight, behavior })
  }

  useEffect(() => {
    if (!lastTurn) {
      return
    }

    if (!followTail) {
      return
    }

    scrollToTail(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    )
  }, [followTail, lastTurn])

  return (
    <section
      className={cn(
        'relative z-10 flex flex-col overflow-hidden rounded-t-[14px] border-t border-line-strong bg-panel md:h-auto md:min-h-[30rem] md:rounded-none lg:h-full lg:min-h-0 lg:border-l lg:border-t-0',
        prioritizeTranslation
          ? 'min-h-[18rem] flex-1'
          : 'h-[44%] min-h-[17rem] shrink-0',
      )}
      aria-labelledby="conversation-heading"
    >
      <div className="border-b border-line bg-panel px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-vietnamese">
              {t('feed.liveTranslation')}
            </p>
            <h2
              id="conversation-heading"
              className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-ink"
            >
              {t('feed.priority', {
                language: languageLabel(languageOrder[0]),
              })}
            </h2>
          </div>
          <span className="text-xs text-muted">
            {t(turns.length === 1 ? 'common.turn' : 'common.turns', {
              count: turns.length,
            })}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMode}
            className="w-full gap-1 whitespace-nowrap px-0 text-[0.625rem] sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            {conversationMode === 'auto'
              ? t('feed.autoMode')
              : t('feed.pushToTalk')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Languages className="size-3.5" aria-hidden="true" />}
            onClick={onSwapLanguages}
            className="w-full gap-1 whitespace-nowrap px-0 text-[0.625rem] sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            {languageOrder[0].toUpperCase()} → {languageOrder[1].toUpperCase()}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<FilePlus2 className="size-3.5" aria-hidden="true" />}
            onClick={onAddNote}
            className="w-full gap-1 whitespace-nowrap px-0 text-[0.625rem] sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            {t('meeting.note')}
          </Button>
        </div>

        {conversationMode === 'push-to-talk' && (
          <p className="mt-2 text-[0.6875rem] leading-4 text-muted">
            {t('feed.pushHint', {
              language: languageLabel(localLanguage),
            })}
            {activePushLanguage && (
              <strong className="ml-2 font-semibold text-primary">
                {t('feed.languageActive', {
                  language: languageLabel(activePushLanguage),
                })}
              </strong>
            )}
          </p>
        )}
      </div>

      {turns.length > 0 &&
        effectiveRealtimeStatus !== 'gateway-connected' && (
          <RealtimeStatusNotice
            status={effectiveRealtimeStatus}
            title={t(currentRealtimeState.titleKey)}
            description={t(currentRealtimeState.descriptionKey)}
            onRetry={onRetryRealtime}
            retryLabel={t('feed.retry')}
          />
        )}

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget
          const distanceFromBottom =
            target.scrollHeight - target.scrollTop - target.clientHeight
          setFollowTail(distanceFromBottom < 120)
        }}
        className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto pb-24"
      >
        <div className="w-full">
          {turns.length === 0 ? (
            <div className="grid min-h-[16rem] place-items-center px-6 pb-28 pt-6 text-center sm:py-10">
              <div className="max-w-sm">
                <div
                  className={cn(
                    'mx-auto mb-4 grid size-10 place-items-center rounded-[10px]',
                    currentRealtimeState.tone === 'danger'
                      ? 'bg-danger/8 text-danger'
                      : currentRealtimeState.tone === 'warning'
                        ? 'bg-warning/10 text-warning-soft'
                        : 'bg-[#f0fdfa] text-vietnamese',
                  )}
                >
                  {effectiveRealtimeStatus === 'connecting' ||
                  effectiveRealtimeStatus === 'reconnecting' ? (
                    <LoaderCircle
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : effectiveRealtimeStatus === 'error' ? (
                    <CircleAlert className="size-5" aria-hidden="true" />
                  ) : (
                    <AudioLines className="size-5" aria-hidden="true" />
                  )}
                </div>
                <h3
                  className="text-sm font-semibold text-ink"
                  role={
                    effectiveRealtimeStatus === 'error' ? 'alert' : 'status'
                  }
                >
                  {t(currentRealtimeState.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {effectiveRealtimeStatus === 'gateway-connected' &&
                  conversationMode === 'push-to-talk'
                    ? t('feed.pushHint', {
                        language: languageLabel(localLanguage),
                      })
                    : t(currentRealtimeState.descriptionKey)}
                </p>
                {effectiveRealtimeStatus === 'error' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                    }
                    onClick={onRetryRealtime}
                    className="mt-4"
                  >
                    {t('feed.retry')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ol
              className="divide-y divide-line"
              aria-label={t('feed.conversationTurns')}
            >
              {turns.map((turn) => (
                <ConversationTurnCard
                  key={turn.id}
                  turn={turn}
                  variant="panel"
                  prioritizedLanguage={languageOrder[0]}
                />
              ))}
            </ol>
          )}
        </div>
      </div>

      {!followTail && lastTurn && (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<ArrowDown className="size-3.5" aria-hidden="true" />}
          onClick={() => {
            setFollowTail(true)
            scrollToTail('smooth')
          }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 shadow-[0_6px_18px_rgb(16_24_40/0.12)]"
        >
          {t('feed.newTurn')}
        </Button>
      )}
    </section>
  )
}

interface RealtimeStatusNoticeProps {
  status: RealtimeSessionStatus
  title: string
  description: string
  retryLabel: string
  onRetry: () => void
}

function RealtimeStatusNotice({
  status,
  title,
  description,
  retryLabel,
  onRetry,
}: RealtimeStatusNoticeProps) {
  return (
    <div
      role={status === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col gap-3 border-b px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5',
        status === 'error'
          ? 'border-danger/20 bg-danger/6'
          : 'border-warning/20 bg-warning/8',
      )}
    >
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 leading-5 text-muted">{description}</p>
      </div>
      {status === 'error' && (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<RefreshCw className="size-3.5" aria-hidden="true" />}
          onClick={onRetry}
          className="shrink-0"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
