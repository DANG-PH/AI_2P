import { Cloud, Gauge, Radio, Volume2 } from 'lucide-react'

import { mockSystemStatus } from '@/data/mockMeeting'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { formatLatency } from '@/lib/formatters'

const statusItems = [
  {
    labelKey: 'system.connection',
    valueKey: 'system.excellent',
    icon: Radio,
  },
  {
    labelKey: 'system.latency',
    value: formatLatency(mockSystemStatus.translationLatencyMs),
    icon: Gauge,
  },
  {
    labelKey: 'system.noise',
    valueKey: 'common.low',
    icon: Volume2,
  },
  {
    labelKey: 'system.mode',
    valueKey: 'system.cloudPrototype',
    icon: Cloud,
  },
] as const satisfies readonly {
  labelKey: TranslationKey
  value?: string
  valueKey?: TranslationKey
  icon: typeof Radio
}[]

export function SystemStatus() {
  const { t } = useTranslation()

  return (
    <section
      className="border-t border-line px-4 py-4"
      aria-labelledby="system-status-heading"
    >
      <h3
        id="system-status-heading"
        className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted"
      >
        {t('system.title')}
      </h3>
      <dl className="mt-3 grid gap-2.5">
        {statusItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.labelKey}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <dt className="flex items-center gap-2 text-muted">
                <Icon className="size-3.5" aria-hidden="true" />
                {t(item.labelKey)}
              </dt>
              <dd className="text-right font-semibold text-muted-strong">
                {'valueKey' in item ? t(item.valueKey) : item.value}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
