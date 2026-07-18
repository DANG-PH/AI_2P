import { Link } from 'react-router'

import { BrandMark } from '@/components/layout/BrandMark'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'

export function PublicHeader() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-[#f4f1e9]/95 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <BrandMark to="/" />
        <nav
          className="flex items-center gap-1"
          aria-label={t('nav.main')}
        >
          <a
            href="#how-it-works"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted-strong transition-colors hover:text-ink lg:inline-flex"
          >
            {t('nav.howItWorks')}
          </a>
          <a
            href="#privacy"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted-strong transition-colors hover:text-ink lg:inline-flex"
          >
            {t('nav.privacy')}
          </a>
          {/*<a
            href="#join-room"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted-strong transition-colors hover:text-ink lg:inline-flex"
          >
            {t('nav.joinRoom')}
          </a>*/}
          <LocaleSwitcher className="ml-1" />
          <Link
            to={ROUTES.create}
            className="hidden min-h-10 items-center rounded-full border border-primary bg-primary px-5 text-sm font-semibold text-white shadow-[0_6px_16px_rgb(37_99_235/0.16)] transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-primary-hover hover:bg-primary-hover sm:inline-flex"
          >
            {t('nav.startMeeting')}
          </Link>
        </nav>
      </div>
    </header>
  )
}
