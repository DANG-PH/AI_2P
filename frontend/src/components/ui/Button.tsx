import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover active:bg-primary-deep',
  secondary:
    'border-line-strong bg-panel text-ink hover:border-muted hover:bg-panel-raised',
  ghost:
    'border-transparent bg-transparent text-muted-strong hover:bg-panel-raised hover:text-ink',
  danger:
    'border-danger/25 bg-danger/8 text-danger hover:border-danger/40 hover:bg-danger/12',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-sm',
}

export function Button({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
}
