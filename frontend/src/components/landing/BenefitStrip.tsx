import {
  AudioWaveform,
  BookOpenText,
  Split,
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
    icon: AudioWaveform,
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
    icon: Split,
    titleKey: 'landing.benefitChannelsTitle',
    descriptionKey: 'landing.benefitChannelsDescription',
  },
]

export function BenefitStrip() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="benefits-title"
      className="bg-[#eef2fa] px-5 py-18 sm:px-6 lg:px-8 lg:py-24"
      id="benefits"
    >
      <div className="mx-auto max-w-[1240px]">
        <div
          data-landing-reveal
          className="grid gap-6 border-b border-ink/15 pb-8 md:grid-cols-[0.8fr_1.2fr] md:items-end md:gap-12"
        >
          <p className="text-[0.6875rem] font-bold tracking-[0.15em] text-primary uppercase">
            {t('landing.benefitsEyebrow')}
          </p>
          <h2
            className="landing-display max-w-[18ch] text-[clamp(2.35rem,4vw,3.8rem)] leading-[0.98] font-medium tracking-[-0.045em] text-ink"
            id="benefits-title"
          >
            {t('landing.benefitsHeading')}
          </h2>
        </div>

        <div className="grid md:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon

            return (
              <article
                data-landing-reveal
                className="group border-b border-ink/15 py-8 last:border-b-0 md:border-r md:border-b-0 md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0 lg:py-10"
                key={benefit.index}
                style={{
                  '--landing-reveal-delay': `${index * 80}ms`,
                } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-[0.15em] text-muted">
                    {benefit.index}
                  </span>
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-primary transition-transform duration-300 ease-out group-hover:-translate-y-1"
                  />
                </div>
                <h3 className="mt-12 max-w-[14ch] text-xl font-semibold tracking-[-0.03em] text-ink">
                  {t(benefit.titleKey)}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted-strong">
                  {t(benefit.descriptionKey)}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
