import { Languages } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'

export interface LocaleSwitcherProps {
  className?: string
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale, t } = useTranslation()
  const nextLocale = locale === 'en' ? 'vi' : 'en'
  const label =
    locale === 'en'
      ? t('locale.currentEnglish')
      : t('locale.currentVietnamese')

  return (
    <button
      type="button"
      aria-label={`${t('locale.selector')}. ${label}`}
      title={label}
      onClick={() => setLocale(nextLocale)}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] border border-line-strong bg-panel px-2.5 text-xs font-semibold text-muted-strong transition-colors hover:bg-panel-raised hover:text-ink',
        className,
      )}
    >
      <Languages className="size-3.5" aria-hidden="true" />
      <span aria-hidden="true">{locale.toUpperCase()}</span>
    </button>
  )
}
