import { FlaskConical, Gauge, Hash, Radio, Volume2 } from 'lucide-react'

import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { useMeetingStore } from '@/store/meetingStore'
import type { RealtimeSessionStatus } from '@/types/realtime'

const connectionValueKeys = {
  connecting: 'system.connecting',
  reconnecting: 'system.reconnecting',
  'gateway-connected': 'system.gatewayConnected',
  ended: 'system.sessionEnded',
  error: 'system.connectionIssue',
} as const satisfies Record<RealtimeSessionStatus, TranslationKey>

export function SystemStatus() {
  const { t } = useTranslation()
  const meetingId = useMeetingStore((state) => state.meeting.id)
  const realtimeStatus = useMeetingStore(
    (state) => state.realtimeSession.status,
  )
  const noiseLevel = useMeetingStore((state) => state.noiseLevel)
  const noiseValueKey =
    noiseLevel === 'unknown'
      ? 'system.awaitingMetrics'
      : (`common.${noiseLevel}` as const)
  const latencyValueKey =
    realtimeStatus === 'error'
      ? 'system.unavailable'
      : 'system.awaitingMetrics'
  const statusItems = [
    {
      labelKey: 'system.room',
      value: meetingId,
      icon: Hash,
    },
    {
      labelKey: 'system.connection',
      valueKey: connectionValueKeys[realtimeStatus],
      icon: Radio,
    },
    {
      labelKey: 'system.latency',
      valueKey: latencyValueKey,
      icon: Gauge,
    },
    {
      labelKey: 'system.noise',
      valueKey: noiseValueKey,
      icon: Volume2,
    },
    {
      labelKey: 'system.mode',
      valueKey: 'system.realtimeGateway',
      icon: FlaskConical,
    },
  ] as const satisfies readonly {
    labelKey: TranslationKey
    value?: string
    valueKey?: TranslationKey
    icon: typeof Radio
  }[]

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
              <dd className="max-w-[10rem] truncate text-right font-semibold text-muted-strong">
                {'valueKey' in item ? t(item.valueKey) : item.value}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
