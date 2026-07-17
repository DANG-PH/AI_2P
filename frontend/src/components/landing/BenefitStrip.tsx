import {
  BookOpenText,
  RadioTower,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'

interface Benefit {
  index: string
  icon: LucideIcon
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}

const benefits: readonly Benefit[] = [
  {
    index: '01',
    icon: RadioTower,
    titleKey: 'landing.benefitRealtimeTitle',
    descriptionKey: 'landing.benefitRealtimeDescription',
  },
  {
    index: '02',
    icon: BookOpenText,
    titleKey: 'landing.benefitGlossaryTitle',
    descriptionKey: 'landing.benefitGlossaryDescription',
  },
  {
    index: '03',
    icon: ShieldCheck,
    titleKey: 'landing.benefitPrivacyTitle',
    descriptionKey: 'landing.benefitPrivacyDescription',
  },
]

export function BenefitStrip() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="how-it-works-title"
      className="scroll-mt-24 border-y border-line bg-panel"
      id="how-it-works"
    >
      <h2 className="sr-only" id="how-it-works-title">
        {t('landing.benefitsHeading')}
      </h2>

      <div className="mx-auto grid max-w-[1180px] md:grid-cols-3">
        {benefits.map((benefit) => {
          const Icon = benefit.icon

          return (
            <article
              className="group grid grid-cols-[2.5rem_1fr] gap-3 border-b border-line px-5 py-7 last:border-b-0 sm:px-6 md:border-r md:border-b-0 md:last:border-r-0 lg:px-8 lg:py-9"
              key={benefit.index}
            >
              <span className="pt-0.5 text-[0.625rem] font-bold tracking-[0.16em] text-muted">
                {benefit.index}
              </span>
              <div>
                <div className="flex items-center gap-2.5">
                  <Icon
                    aria-hidden="true"
                    className="size-4 text-primary transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
                  />
                  <h3 className="text-sm font-semibold text-ink">
                    {t(benefit.titleKey)}
                  </h3>
                </div>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                  {t(benefit.descriptionKey)}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
