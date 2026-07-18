import {
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  Download,
  Languages,
  ListChecks,
  RotateCcw,
  Timer,
} from 'lucide-react'
import { useNavigate } from 'react-router'

import { BrandMark } from '@/components/layout/BrandMark'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { ConversationTurnCard } from '@/components/meeting/ConversationTurnCard'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useClipboard } from '@/hooks/useClipboard'
import { useRoomSession } from '@/hooks/useRoomSession'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'
import { createRoomId } from '@/lib/meetingIdentity'
import {
  formatDurationLabel,
  formatLanguagePair,
} from '@/lib/formatters'
import {
  createTranscriptFileName,
  createTranscriptText,
} from '@/lib/transcript'
import { useMeetingStore } from '@/store/meetingStore'
import type { ActionItem } from '@/types/meeting'

export default function MeetingSummaryPage() {
  const navigate = useNavigate()
  const { locale, t } = useTranslation()
  useRoomSession()
  const meeting = useMeetingStore((state) => state.meeting)
  const prepareAnotherMeeting = useMeetingStore(
    (state) => state.prepareAnotherMeeting,
  )
  const { copy, copyState } = useClipboard()
  const displayedTurns = meeting.turns
  const displayedDuration = meeting.durationSeconds
  const displayedNotes = meeting.notes

  let summaryText = ''
  let actionItems: ActionItem[]
  let decisions: string[]

  {
    if (displayedTurns.length === 0 && displayedNotes.length === 0) {
      summaryText = t('summary.emptyTitle')
    } else {
      summaryText = t(
        displayedTurns.length === 1
          ? 'summary.generatedOne'
          : 'summary.generatedMany',
        {
          title: meeting.title,
          count: displayedTurns.length,
        },
      )

      const participantNames = meeting.participants
        .map((participant) => participant.name.trim())
        .filter(Boolean)
        .join(', ')
      if (participantNames) {
        summaryText += ` ${t('summary.participantsSentence', {
          participants: participantNames,
        })}`
      }

      if (displayedNotes.length > 0) {
        summaryText += ` ${t('summary.notesSentence', {
          notes: displayedNotes
            .map((note) => note.text)
            .join('; '),
        })}`
      }
    }

    const actionNotes = displayedNotes.filter((note) => {
      const textLower = note.text.toLowerCase()
      return (
        textLower.includes('việc cần làm') ||
        textLower.includes('cần làm') ||
        textLower.includes('todo') ||
        textLower.includes('action') ||
        textLower.includes('task')
      )
    })

    actionItems = actionNotes.map((note, index) => {
      let owner = t('summary.unassigned')
      for (const participant of meeting.participants) {
        if (
          participant.name &&
          note.text
            .toLowerCase()
            .includes(participant.name.toLowerCase())
        ) {
          owner = participant.name
          break
        }
      }

      let title = note.text
      const prefixes = [
        'việc cần làm:',
        'việc cần làm',
        'cần làm:',
        'cần làm',
        'todo:',
        'todo',
        'action:',
        'action',
        'task:',
        'task',
      ]
      for (const prefix of prefixes) {
        if (title.toLowerCase().startsWith(prefix)) {
          title = title.substring(prefix.length).trim()
          if (title.startsWith(':') || title.startsWith('-')) {
            title = title.substring(1).trim()
          }
          break
        }
      }
      title = title.charAt(0).toUpperCase() + title.slice(1)

      return {
        id: `action-dynamic-${index}`,
        title,
        owner,
        status: 'open' as const,
      }
    })

    const decisionNotes = displayedNotes.filter((note) => {
      const textLower = note.text.toLowerCase()
      return (
        textLower.includes('quyết định') ||
        textLower.includes('decision') ||
        textLower.includes('thống nhất') ||
        textLower.includes('agree')
      )
    })

    decisions = decisionNotes.map((note) => {
      let title = note.text
      const prefixes = [
        'quyết định:',
        'quyết định',
        'decision:',
        'decision',
        'thống nhất:',
        'thống nhất',
      ]
      for (const prefix of prefixes) {
        if (title.toLowerCase().startsWith(prefix)) {
          title = title.substring(prefix.length).trim()
          if (title.startsWith(':') || title.startsWith('-')) {
            title = title.substring(1).trim()
          }
          break
        }
      }
      return title.charAt(0).toUpperCase() + title.slice(1)
    })
  }

  const downloadTranscript = () => {
    const exportMeeting = {
      ...meeting,
      turns: displayedTurns,
      durationSeconds: displayedDuration,
    }
    const blob = new Blob(
      [`\uFEFF${createTranscriptText(exportMeeting, locale)}`],
      {
        type: 'text/plain;charset=utf-8',
      },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = createTranscriptFileName(meeting.title)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const startAnotherMeeting = () => {
    const roomId = createRoomId()
    prepareAnotherMeeting()
    useMeetingStore.getState().setMeetingId(roomId)
    navigate(ROUTES.setup(roomId))
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#summary-content">
        {t('summary.skip')}
      </a>

      <header className="border-b border-line bg-canvas-deep">
        <div className="mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandMark to="/" />
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <StatusBadge tone="success">{t('summary.ended')}</StatusBadge>
          </div>
        </div>
      </header>

      <main
        id="summary-content"
        className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
      >
        <div className="flex flex-col gap-7 border-b border-line pb-9 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-primary">
              {t('summary.eyebrow')}
            </p>
            <h1 className="mt-3 text-balance text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.05em] text-ink">
              {meeting.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leadingIcon={
                copyState === 'copied' ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )
              }
              onClick={() => void copy(summaryText)}
            >
              {copyState === 'copied'
                ? t('summary.copied')
                : t('summary.copy')}
            </Button>
            <Button
              variant="secondary"
              leadingIcon={
                <Download className="size-4" aria-hidden="true" />
              }
              onClick={downloadTranscript}
            >
              {t('summary.download')}
            </Button>
            <Button
              variant="primary"
              trailingIcon={
                <ArrowRight className="size-4" aria-hidden="true" />
              }
              onClick={startAnotherMeeting}
            >
              {t('summary.startAnotherShort')}
            </Button>
          </div>
        </div>

        <dl className="grid border-b border-line sm:grid-cols-3">
          <MetadataItem
            icon={<Timer className="size-4" aria-hidden="true" />}
            label={t('summary.duration')}
            value={formatDurationLabel(displayedDuration, locale)}
          />
          <MetadataItem
            icon={<ListChecks className="size-4" aria-hidden="true" />}
            label={t('summary.conversationTurns')}
            value={displayedTurns.length.toString()}
          />
          <MetadataItem
            icon={<Languages className="size-4" aria-hidden="true" />}
            label={t('summary.languages')}
            value={formatLanguagePair(meeting.languageOrder, locale)}
          />
        </dl>

        <div className="grid gap-6 py-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)] lg:py-14">
          <section
            aria-labelledby="summary-heading"
            className="rounded-[14px] border border-line-strong bg-panel px-5 py-6 shadow-[0_8px_24px_rgb(16_24_40/0.04)] sm:px-7 sm:py-8"
          >
            <div className="flex items-center gap-2 text-primary">
              <Clipboard className="size-4" aria-hidden="true" />
              <h2
                id="summary-heading"
                className="text-xs font-bold uppercase tracking-[0.12em]"
              >
                {t('summary.title')}
              </h2>
            </div>
            <p className="mt-5 max-w-[70ch] break-words text-base leading-8 text-ink-soft sm:text-lg">
              {summaryText}
            </p>
          </section>

          <section
            aria-labelledby="actions-heading"
            className="rounded-[14px] border border-line bg-panel px-5 py-6 sm:px-6"
          >
            <h2
              id="actions-heading"
              className="text-sm font-bold text-ink"
            >
              {t('summary.actionItems')}
            </h2>
            {actionItems.length === 0 ? (
              <p className="mt-4 text-xs text-muted leading-relaxed">
                {t('summary.noActionItems')}
              </p>
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {actionItems.map((item, index) => (
                  <li key={item.id} className="grid gap-3 py-4 first:pt-1">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xs font-bold tabular-nums text-muted">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="min-w-0 break-words text-sm font-semibold leading-6 text-ink-soft">
                        {item.title}
                      </p>
                    </div>
                    <div className="ml-7 flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words text-xs text-muted">
                        {item.owner}
                      </span>
                      <StatusBadge tone="warning">{t('common.open')}</StatusBadge>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section
          aria-labelledby="decisions-heading"
          className="border-y border-line py-8"
        >
          <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">
                {t('summary.alignedOutcomes')}
              </p>
              <h2
                id="decisions-heading"
                className="mt-2 text-xl font-bold tracking-[-0.025em]"
              >
                {t('summary.decisions')}
              </h2>
            </div>
            {decisions.length === 0 ? (
              <p className="text-xs text-muted pl-4">
                {t('summary.noDecisions')}
              </p>
            ) : (
              <ol className="grid gap-3 sm:grid-cols-2">
                {decisions.map((decision, index) => (
                  <li
                    key={`${decision}-${index}`}
                    className="flex min-w-0 gap-4 break-words border-l border-line-strong pl-4 text-sm leading-6 text-ink-soft"
                  >
                    <span className="font-bold text-primary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {decision}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section
          aria-labelledby="notes-heading"
          className="border-b border-line py-8"
        >
          <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">
                {t('sidebar.notesTitle')}
              </p>
              <h2
                id="notes-heading"
                className="mt-2 text-xl font-bold tracking-[-0.025em]"
              >
                {t('summary.notesSection')}
              </h2>
            </div>
            {displayedNotes.length === 0 ? (
              <p className="text-xs text-muted pl-4">
                {t('summary.noNotes')}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {displayedNotes.map((note, index) => (
                  <li
                    key={note.id || index}
                    className="flex min-w-0 gap-4 break-words border-l border-line-strong pl-4 text-sm leading-6 text-ink-soft"
                  >
                    {note.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="transcript-heading" className="pt-10 lg:pt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">
                {t('summary.fullRecord')}
              </p>
              <h2
                id="transcript-heading"
                className="mt-2 text-2xl font-bold tracking-[-0.03em]"
              >
                {t('summary.transcript')}
              </h2>
            </div>
            <span className="text-xs text-muted">
              {t(
                displayedTurns.length === 1
                  ? 'common.turn'
                  : 'common.turns',
                { count: displayedTurns.length },
              )}
            </span>
          </div>

          {displayedTurns.length > 0 ? (
            <ol className="grid gap-3">
              {displayedTurns.map((turn) => (
                <ConversationTurnCard
                  key={turn.id}
                  turn={turn}
                  compact
                  readOnly
                />
              ))}
            </ol>
          ) : (
            <div className="border-y border-line py-12 text-center">
              <p className="text-sm font-semibold text-ink-soft">
                {t('summary.emptyTitle')}
              </p>
              <p className="mt-2 text-xs text-muted">
                {t('summary.emptyDescription')}
              </p>
            </div>
          )}
        </section>

        <div className="mt-12 flex justify-center border-t border-line pt-8">
          <Button
            variant="secondary"
            leadingIcon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={startAnotherMeeting}
          >
            {t('summary.startAnother')}
          </Button>
        </div>

        <p className="sr-only" aria-live="polite">
          {copyState === 'copied'
            ? t('summary.copySuccess')
            : copyState === 'failed'
              ? t('summary.copyFailed')
              : ''}
        </p>
      </main>
    </div>
  )
}

interface MetadataItemProps {
  icon: React.ReactNode
  label: string
  value: string
}

function MetadataItem({ icon, label, value }: MetadataItemProps) {
  return (
    <div className="flex items-center gap-3 border-t border-line px-1 py-5 sm:border-t-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0">
      <span className="text-muted" aria-hidden="true">
        {icon}
      </span>
      <div>
        <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-muted">
          {label}
        </dt>
        <dd className="mt-1 text-sm font-semibold text-ink-soft">{value}</dd>
      </div>
    </div>
  )
}
