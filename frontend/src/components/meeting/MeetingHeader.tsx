import { Radio } from 'lucide-react'

import { BrandMark } from '@/components/layout/BrandMark'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import { formatElapsedTime } from '@/lib/formatters'

export interface MeetingHeaderProps {
  title: string
  elapsedSeconds: number
}

export function MeetingHeader({
  title,
  elapsedSeconds,
}: MeetingHeaderProps) {
  const { t } = useTranslation()
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
