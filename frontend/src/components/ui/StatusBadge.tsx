import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface StatusBadgeProps {
  children: ReactNode
  tone?: StatusTone
  icon?: ReactNode
  className?: string
}

const toneClasses: Record<StatusTone, string> = {
  neutral: 'border-line bg-panel-muted text-muted-strong',
  info: 'border-primary/20 bg-[#eff6ff] text-info-soft',
  success: 'border-success/20 bg-[#f0fdf4] text-success-soft',
  warning: 'border-warning/20 bg-[#fffbeb] text-warning-soft',
  danger: 'border-danger/20 bg-[#fef2f2] text-danger-soft',
}

export function StatusBadge({
  children,
  tone = 'neutral',
  icon,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem] font-bold tracking-[0.04em]',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
