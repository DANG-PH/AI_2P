import { Link } from 'react-router'

import logoUrl from '@/assets/logo-vien.png'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'

export interface BrandMarkProps {
  to?: string
  compact?: boolean
  className?: string
}

const mark = (
  <>
    <img
      aria-hidden="true"
      alt=""
      className="size-8 object-contain"
      src={logoUrl}
    />
    <span className="font-bold tracking-[-0.04em]">
      <span className="text-primary">Vi</span>
      <span className="text-vietnamese">En</span>
      <span className="text-ink">Meet</span>
    </span>
  </>
)

export function BrandMark({
  to,
  compact = false,
  className,
}: BrandMarkProps) {
  const { t } = useTranslation()
  const classes = cn(
    'relative inline-flex items-center gap-2.5 text-base',
    compact && '[&>span:last-child]:hidden sm:[&>span:last-child]:inline',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={t('nav.home')}>
        {mark}
      </Link>
    )
  }

  return <span className={classes}>{mark}</span>
}
