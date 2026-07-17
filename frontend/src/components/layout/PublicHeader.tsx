import { Link } from 'react-router'

import { BrandMark } from '@/components/layout/BrandMark'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { useTranslation } from '@/hooks/useTranslation'

export function PublicHeader() {
  const { t } = useTranslation()

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <BrandMark to="/" />
        <nav
          className="flex items-center gap-1"
          aria-label={t('nav.main')}
        >
          <a
            href="#how-it-works"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted-strong transition-colors hover:text-ink sm:inline-flex"
          >
            {t('nav.howItWorks')}
          </a>
          <a
            href="#privacy"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted-strong transition-colors hover:text-ink sm:inline-flex"
          >
            {t('nav.privacy')}
          </a>
          <LocaleSwitcher className="ml-1" />
          <Link
            to="/setup"
            className="inline-flex min-h-10 items-center rounded-[10px] border border-primary bg-primary px-4 text-sm font-semibold text-white transition-colors hover:border-primary-hover hover:bg-primary-hover"
          >
            {t('nav.startMeeting')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
