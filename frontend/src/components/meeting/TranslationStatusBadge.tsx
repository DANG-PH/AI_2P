import {
  AudioLines,
  Check,
  Ear,
  FilePenLine,
  TriangleAlert,
} from 'lucide-react'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import type { TranslationStatus } from '@/types/meeting'

export interface TranslationStatusBadgeProps {
  status: TranslationStatus
}

const statusDetails = {
  listening: {
    tone: 'info',
    icon: Ear,
    labelKey: 'status.listening',
  },
  transcribing: {
    tone: 'info',
    icon: AudioLines,
    labelKey: 'status.transcribing',
  },
  draft: {
    tone: 'warning',
    icon: FilePenLine,
    labelKey: 'status.draft',
  },
  final: {
    tone: 'success',
    icon: Check,
    labelKey: 'status.final',
  },
  'low-confidence': {
    tone: 'warning',
    icon: TriangleAlert,
    labelKey: 'status.lowConfidence',
  },
} as const satisfies Record<
  TranslationStatus,
  {
    tone: 'info' | 'success' | 'warning'
    icon: typeof Ear
    labelKey: TranslationKey
  }
>

export function TranslationStatusBadge({
  status,
}: TranslationStatusBadgeProps) {
  const { t } = useTranslation()
  const details = statusDetails[status]
  const Icon = details.icon

  return (
    <StatusBadge
      tone={details.tone}
      icon={<Icon className="size-3" aria-hidden="true" />}
    >
      {t(details.labelKey)}
    </StatusBadge>
  )
}
