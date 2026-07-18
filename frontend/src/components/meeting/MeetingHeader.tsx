import { Check, Copy, Radio } from 'lucide-react'

import { BrandMark } from '@/components/layout/BrandMark'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import { useClipboard } from '@/hooks/useClipboard'
import { formatElapsedTime } from '@/lib/formatters'

export interface MeetingHeaderProps {
  title: string
  roomId: string
  elapsedSeconds: number
}

export function MeetingHeader({
  title,
  roomId,
  elapsedSeconds,
}: MeetingHeaderProps) {
  const { t } = useTranslation()
  const { copy, copyState } = useClipboard()
  const elapsedTime = formatElapsedTime(elapsedSeconds)

  return (
    <header className="relative z-20 border-b border-line bg-panel">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2 sm:px-6">
        <BrandMark to="/" compact />
        <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="hidden text-[0.625rem] font-bold uppercase tracking-[0.12em] text-muted sm:block">
            {t('meeting.active')}
          </p>
          <h1 className="truncate text-sm font-bold text-ink sm:mt-0.5">
            {title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void copy(roomId)}
          className="hidden min-w-0 items-center gap-2 rounded-[10px] border border-line-strong bg-panel-muted px-3 py-2 text-left transition-colors hover:border-primary sm:flex"
          aria-label={t('meeting.copyRoomCode', { code: roomId })}
        >
          <span className="min-w-0">
            <span className="block text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-muted">
              {t('meeting.roomCode')}
            </span>
            <span className="block max-w-44 truncate font-mono text-xs font-semibold text-ink-soft">
              {roomId}
            </span>
          </span>
          {copyState === 'copied' ? (
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-4 shrink-0 text-muted" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void copy(roomId)}
          className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-line-strong text-muted transition-colors hover:border-primary hover:text-primary sm:hidden"
          aria-label={t('meeting.copyRoomCode', { code: roomId })}
        >
          {copyState === 'copied' ? (
            <Check className="size-4 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>

        <LocaleSwitcher className="size-10 justify-center px-0 [&>span]:hidden" />
        <StatusBadge
          tone="danger"
          icon={<Radio className="size-3 fill-current" aria-hidden="true" />}
        >
          {t('common.live')}
        </StatusBadge>
        <span
          className="min-w-[4rem] text-right text-sm font-semibold tabular-nums text-ink-soft"
          aria-label={t('meeting.elapsed', { time: elapsedTime })}
        >
          {elapsedTime}
        </span>
      </div>
    </header>
  )
}
