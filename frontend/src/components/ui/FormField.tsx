import type { ReactNode } from 'react'

export interface FormFieldProps {
  htmlFor: string
  label: string
  children: ReactNode
  description?: string
  error?: string
  required?: boolean
}

export function FormField({
  htmlFor,
  label,
  children,
  description,
  error,
  required,
}: FormFieldProps) {
  const supportId = `${htmlFor}-support`

  return (
    <div className="grid gap-2">
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold tracking-[-0.01em] text-ink-soft"
      >
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {(error ?? description) && (
        <p
          id={supportId}
          className={error ? 'text-xs text-danger-soft' : 'text-xs text-muted'}
        >
          {error ?? description}
        </p>
      )}
    </div>
  )
}
