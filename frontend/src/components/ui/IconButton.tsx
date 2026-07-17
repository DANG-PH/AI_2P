import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  icon: ReactNode
  tone?: 'default' | 'danger'
}

export function IconButton({
  label,
  icon,
  className,
  tone = 'default',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        tone === 'danger'
          ? 'border-danger/25 bg-danger/8 text-danger hover:bg-danger/12'
          : 'border-line bg-panel text-muted-strong hover:border-line-strong hover:bg-panel-raised hover:text-ink',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}
