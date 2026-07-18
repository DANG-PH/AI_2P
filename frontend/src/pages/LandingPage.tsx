import {
  ArrowDown,
  ArrowRight,
  Check,
  Headphones,
  Languages,
  Mic2,
  ShieldCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { BenefitStrip } from '@/components/landing/BenefitStrip'
import { ConversationPreview } from '@/components/landing/ConversationPreview'
import { BrandMark } from '@/components/layout/BrandMark'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { ROUTES } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'

const ROOM_CODE_PATTERN = /^vien-[a-z0-9]{8,64}$/i

const flowSteps = [
  {
    index: '01',
    titleKey: 'landing.stepCreateTitle',
    descriptionKey: 'landing.stepCreateDescription',
  },
  {
    index: '02',
    titleKey: 'landing.stepInviteTitle',
    descriptionKey: 'landing.stepInviteDescription',
  },
  {
    index: '03',
    titleKey: 'landing.stepSpeakTitle',
    descriptionKey: 'landing.stepSpeakDescription',
  },
] satisfies ReadonlyArray<{
  index: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}>

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [roomCode, setRoomCode] = useState('')
  const [roomCodeError, setRoomCodeError] = useState<
    'required' | 'invalid' | null
  >(null)

  const handleStartMeeting = () => {
    navigate(ROUTES.create)
  }

  const handleJoinMeeting = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedRoomId = roomCode.trim()
    if (!normalizedRoomId) {
      setRoomCodeError('required')
      return
    }

    if (!ROOM_CODE_PATTERN.test(normalizedRoomId)) {
      setRoomCodeError('invalid')
      return
    }

    useMeetingStore.getState().resetMeeting()
    navigate(ROUTES.joinSetup(normalizedRoomId))
  }

  return (
    <div className="landing-shell min-h-screen text-ink">
      <a className="skip-link" href="#main-content">
        {t('nav.skipContent')}
      </a>

      <PublicHeader />

      <main id="main-content">
        <section className="landing-hero relative overflow-hidden">
          <div className="landing-grid-lines" aria-hidden="true" />
          <div className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[1240px] items-center gap-14 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.91fr)_minmax(30rem,1.09fr)] lg:gap-12 lg:px-8 lg:py-24 xl:gap-20">
            <div className="relative z-10 min-w-0">
              <div className="landing-reveal flex w-fit items-center gap-2.5 rounded-full border border-primary/20 bg-primary/7 px-3 py-2 text-[0.6875rem] font-bold tracking-[0.14em] text-primary uppercase">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-25" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                {t('landing.eyebrow')}
              </div>

              <h1 className="landing-display landing-reveal landing-delay-1 mt-7 max-w-[10.5ch] text-[clamp(3.35rem,7.2vw,6.45rem)] leading-[0.88] font-medium tracking-[-0.065em] text-ink">
                {t('landing.headlineFirst')}
                <span className="mt-2 block text-primary italic">
                  {t('landing.headlineSecond')}
                </span>
              </h1>

              <p className="landing-reveal landing-delay-2 mt-8 max-w-[37rem] text-base leading-7 text-muted-strong sm:text-lg sm:leading-8">
                {t('landing.description')}
              </p>

              <div className="landing-reveal landing-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={handleStartMeeting}
                  size="lg"
                  trailingIcon={
                    <ArrowRight aria-hidden="true" className="size-4" />
                  }
                  variant="primary"
                  className="w-full rounded-full px-6 shadow-[0_10px_24px_rgb(37_99_235/0.2)] sm:w-auto"
                >
                  {t('nav.startMeeting')}
                </Button>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {t('landing.exploreHow')}
                  <ArrowDown aria-hidden="true" className="size-4" />
                </a>
              </div>

              <section
                id="join-room"
                aria-labelledby="join-room-title"
                className="landing-reveal landing-delay-4 mt-7 scroll-mt-24 rounded-[24px_24px_8px_24px] border border-primary/20 bg-[#eef2fa] p-4 shadow-[0_16px_35px_rgb(37_99_235/0.09)] sm:p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="text-[0.625rem] font-bold tracking-[0.15em] text-primary uppercase">
                      {t('landing.joinEyebrow')}
                    </p>
                    <h2
                      id="join-room-title"
                      className="mt-1 text-lg font-semibold tracking-[-0.025em] text-ink"
                    >
                      {t('landing.joinTitle')}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    {t('common.languagePair')}
                  </span>
                </div>

                <form
                  onSubmit={handleJoinMeeting}
                  className="mt-4"
                  noValidate
                >
                  <label
                    htmlFor="room-code"
                    className="sr-only"
                  >
                    {t('landing.roomCodeLabel')}
                  </label>
                  <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      id="room-code"
                      value={roomCode}
                      onChange={(event) => {
                        setRoomCode(event.target.value)
                        if (roomCodeError) {
                          setRoomCodeError(null)
                        }
                      }}
                      aria-invalid={roomCodeError !== null}
                      aria-describedby="room-code-support"
                      autoComplete="off"
                      placeholder={t('landing.roomCodePlaceholder')}
                      className={`h-12 w-full rounded-full border bg-[#fbfaf6] px-5 text-base text-ink outline-none placeholder:text-muted transition-[border-color,box-shadow] hover:border-muted focus:border-primary focus:ring-3 focus:ring-primary/12 ${
                        roomCodeError
                          ? 'border-danger'
                          : 'border-primary/25'
                      }`}
                    />
                    <Button
                      type="submit"
                      size="lg"
                      variant="primary"
                      trailingIcon={
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4"
                        />
                      }
                      className="h-12 w-full rounded-full px-6 sm:w-auto"
                    >
                      {t('landing.joinButton')}
                    </Button>
                  </div>
                  <p
                    id="room-code-support"
                    className={`mt-2 px-2 text-xs ${
                      roomCodeError
                        ? 'text-danger-soft'
                        : 'text-primary-deep'
                    }`}
                  >
                    {roomCodeError
                      ? t(
                          roomCodeError === 'required'
                            ? 'landing.roomCodeRequired'
                            : 'landing.roomCodeInvalid',
                        )
                      : t('landing.roomCodeHint')}
                  </p>
                </form>
              </section>

              <div className="landing-reveal landing-delay-4 mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-ink/10 pt-5 text-xs font-medium text-muted-strong">
                <span className="inline-flex items-center gap-2">
                  <Languages
                    aria-hidden="true"
                    className="size-3.5 text-vietnamese"
                  />
                  {t('common.languagePair')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check
                    aria-hidden="true"
                    className="size-3.5 text-vietnamese"
                  />
                  {t('landing.noAccount')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Mic2
                    aria-hidden="true"
                    className="size-3.5 text-vietnamese"
                  />
                  {t('landing.independentAudio')}
                </span>
              </div>
            </div>

            <div className="landing-reveal landing-delay-2 relative min-w-0 pb-5 lg:translate-y-2">
              <div
                aria-hidden="true"
                className="absolute -top-8 -right-16 hidden h-32 w-32 rounded-full border-[24px] border-vietnamese/10 lg:block"
              />
              <ConversationPreview />
            </div>
          </div>
        </section>

        <BenefitStrip />

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-title"
          className="relative scroll-mt-20 overflow-hidden px-5 py-20 sm:px-6 lg:px-8 lg:py-30"
        >
          <div className="mx-auto max-w-310">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
              <div>
                <p className="text-[0.6875rem] font-bold tracking-[0.15em] text-primary uppercase">
                  {t('landing.howEyebrow')}
                </p>
                <h2
                  id="how-it-works-title"
                  className="landing-display mt-4 max-w-[10ch] text-[clamp(2.65rem,5vw,4.8rem)] leading-none font-medium tracking-[-0.055em] text-ink"
                >
                  {t('landing.howTitle')}
                </h2>
              </div>
              <p className="max-w-2xl border-l-2 border-vietnamese pl-5 text-base leading-7 text-muted-strong sm:text-lg sm:leading-8">
                {t('landing.howDescription')}
              </p>
            </div>

            <div className="mt-14 grid border-t border-ink/15 md:grid-cols-3">
              {flowSteps.map((step) => (
                <article
                  className="group border-b border-ink/15 py-8 md:border-r md:border-b-0 md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0 lg:py-10"
                  key={step.index}
                >
                  <span className="text-xs font-bold tracking-[0.15em] text-primary">
                    {step.index}
                  </span>
                  <h3 className="mt-8 text-xl font-semibold tracking-[-0.03em] text-ink">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                    {t(step.descriptionKey)}
                  </p>
                  <div
                    aria-hidden="true"
                    className="mt-7 h-1 w-8 bg-ink transition-transform duration-300 ease-out group-hover:translate-x-2"
                  />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-ink/10 bg-[#e8efe9] px-5 py-18 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20">
            <div>
              <p className="text-[0.6875rem] font-bold tracking-[0.15em] text-vietnamese uppercase">
                {t('landing.channelsEyebrow')}
              </p>
              <h2 className="landing-display mt-4 max-w-[11ch] text-[clamp(2.5rem,4.5vw,4.2rem)] leading-[0.95] font-medium tracking-[-0.05em] text-ink">
                {t('landing.channelsTitle')}
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-strong">
                {t('landing.channelsDescription')}
              </p>
            </div>

            <div
              aria-label={t('landing.channelsDiagramLabel')}
              className="landing-channel-diagram relative grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
              role="img"
            >
              <div className="rounded-[28px_28px_10px_28px] border border-vietnamese/25 bg-[#f8faf6] p-5 shadow-[0_16px_35px_rgb(22_63_50/0.07)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-[0.14em] text-vietnamese uppercase">
                    VI
                  </span>
                  <Mic2 aria-hidden="true" className="size-4 text-vietnamese" />
                </div>
                <p className="mt-10 text-sm font-semibold text-ink">
                  {t('landing.vietnameseSpeaker')}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {t('landing.ownDevice')}
                </p>
              </div>

              <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-ink text-panel shadow-[0_12px_25px_rgb(28_35_32/0.18)]">
                <Languages aria-hidden="true" className="size-6" />
                <span
                  aria-hidden="true"
                  className="absolute -inset-3 rounded-full border border-ink/15"
                />
              </div>

              <div className="rounded-[28px_28px_28px_10px] border border-primary/25 bg-[#f8faf6] p-5 shadow-[0_16px_35px_rgb(22_63_50/0.07)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
                    EN
                  </span>
                  <Headphones
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                </div>
                <p className="mt-10 text-sm font-semibold text-ink">
                  {t('landing.englishSpeaker')}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {t('landing.ownDevice')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="privacy-title"
          className="scroll-mt-20 px-5 py-20 sm:px-6 lg:px-8 lg:py-28"
          id="privacy"
        >
          <div className="mx-auto grid max-w-310 gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-24">
            <div>
              <p className="text-[0.6875rem] font-bold tracking-[0.15em] text-primary uppercase">
                {t('landing.privacyEyebrow')}
              </p>
              <h2
                className="landing-display mt-4 max-w-[10ch] text-[clamp(2.5rem,4.5vw,4.2rem)] leading-[1.1] font-medium tracking-tighter text-ink"
                id="privacy-title"
              >
                {t('landing.privacyTitle')}
              </h2>
            </div>

            <div className="border-t border-ink/15 pt-7">
              <p className="max-w-2xl text-lg leading-8 text-ink-soft">
                {t('landing.privacyBody')}
              </p>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-vietnamese"
                  />
                  <p className="text-sm leading-6 text-muted">
                    {t('landing.privacyNote')}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                  <p className="text-sm leading-6 text-muted">
                    {t('landing.transparencyNote')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-5 sm:px-6 lg:px-8 lg:pb-8">
          <div className="landing-final-cta relative mx-auto max-w-[1240px] overflow-hidden rounded-[32px] bg-primary px-6 py-12 text-[#f7f8ff] sm:px-10 lg:px-14 lg:py-16">
            <div className="landing-cta-orbit" aria-hidden="true" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[0.6875rem] font-bold tracking-[0.15em] text-[#dfe7ff] uppercase">
                  {t('landing.finalEyebrow')}
                </p>
                <h2 className="landing-display mt-4 max-w-[13ch] text-[clamp(2.45rem,4.5vw,4.4rem)] leading-[0.95] font-medium tracking-[-0.05em]">
                  {t('landing.finalTitle')}
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-6 text-[#e5ebff] sm:text-base sm:leading-7">
                  {t('landing.finalDescription')}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={handleStartMeeting}
                  size="lg"
                  trailingIcon={
                    <ArrowRight aria-hidden="true" className="size-4" />
                  }
                  className="rounded-full border-[#f7f8ff] bg-[#f7f8ff] px-6 text-primary hover:border-[#e5ebff] hover:bg-[#e5ebff]"
                >
                  {t('nav.startMeeting')}
                </Button>
                {/*<a
                  href="#join-room"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#cbd8ff] px-6 text-sm font-semibold text-[#f7f8ff] transition-colors hover:bg-[#f7f8ff]/10"
                >
                  {t('nav.joinRoom')}
                </a>*/}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 border-t border-ink/10 pt-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandMark to={ROUTES.landing} />
            <p className="mt-2 text-xs text-muted">{t('landing.footer')}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-strong">
            <a className="hover:text-ink" href="#how-it-works">
              {t('nav.howItWorks')}
            </a>
            <a className="hover:text-ink" href="#privacy">
              {t('nav.privacy')}
            </a>
            <a className="hover:text-ink" href="#join-room">
              {t('nav.joinRoom')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
