import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { IconButton } from '@/components/ui/IconButton'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
} as const

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-[14px] border border-line-strong bg-panel p-0 text-ink shadow-[0_20px_60px_rgb(16_24_40/0.16)] backdrop:bg-[#101828]/45',
        sizeClasses[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-1">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
          {description && (
            <p className="max-w-[58ch] text-sm leading-6 text-muted">
              {description}
            </p>
          )}
        </div>
        <IconButton
          label={t('dialog.close')}
          icon={<X className="size-4" aria-hidden="true" />}
          onClick={onClose}
        />
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </dialog>
  )
}
