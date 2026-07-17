import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router'

import { GlossaryEditor } from '@/components/setup/GlossaryEditor'
import {
  MEETING_SETUP_FORM_ID,
  MeetingDetailsForm,
} from '@/components/setup/MeetingDetailsForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'

export default function MeetingSetupPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const startMeeting = useMeetingStore((state) => state.startMeeting)

  const handleStartMeeting = () => {
    startMeeting()
    navigate(ROUTES.meeting)
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#setup-main" className="skip-link">
        {t('setup.skip')}
      </a>

      <PageHeader
        title={t('setup.title')}
        eyebrow={t('setup.eyebrow')}
        backTo={ROUTES.landing}
        actions={
          <span className="hidden sm:inline">
            <StatusBadge tone="info">{t('common.languagePair')}</StatusBadge>
          </span>
        }
      />

      <main
        id="setup-main"
        className="mx-auto w-full max-w-[82rem] px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-11 lg:px-8"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t('setup.preparation')}
          </p>
          <h2 className="mt-3 text-balance text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-ink">
            {t('setup.headline')}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-strong">
            {t('setup.description')}
          </p>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(22rem,5fr)] lg:items-start xl:gap-14">
          <MeetingDetailsForm onValidSubmit={handleStartMeeting} />
          <GlossaryEditor />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-muted">
            {t('setup.prototypeNote')}
          </p>
          <Button
            type="submit"
            form={MEETING_SETUP_FORM_ID}
            variant="primary"
            size="lg"
            fullWidth
            trailingIcon={
              <ArrowRight aria-hidden="true" className="size-4" />
            }
            className="sm:w-auto"
          >
            {t('setup.start')}
          </Button>
        </div>
      </main>
    </div>
  )
}
