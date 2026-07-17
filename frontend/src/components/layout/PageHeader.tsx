import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import { BrandMark } from '@/components/layout/BrandMark'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { useTranslation } from '@/hooks/useTranslation'

export interface PageHeaderProps {
  title: string
  eyebrow?: string
  backTo?: string
  actions?: ReactNode
}

export function PageHeader({
  title,
  eyebrow,
  backTo,
  actions,
}: PageHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <BrandMark to="/" compact />
        <span className="h-6 w-px bg-line" aria-hidden="true" />
        {backTo && (
          <Link
            to={backTo}
            aria-label={t('nav.goBack')}
            className="grid size-10 shrink-0 place-items-center rounded-[10px] text-muted-strong transition-colors hover:bg-panel-raised hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-sm font-bold tracking-[-0.01em] text-ink sm:text-base">
            {title}
          </h1>
        </div>
        <LocaleSwitcher />
        {actions}
      </div>
    </header>
  )
}
