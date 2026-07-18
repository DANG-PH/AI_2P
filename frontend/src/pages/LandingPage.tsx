import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { BenefitStrip } from '@/components/landing/BenefitStrip'
import { ConversationPreview } from '@/components/landing/ConversationPreview'
import { BrandMark } from '@/components/layout/BrandMark'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'

const ROOM_CODE_PATTERN = /^vien-[a-z0-9]{8,64}$/i

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
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        {t('nav.skipContent')}
      </a>

      <PublicHeader />

      <main id="main-content">
        <section className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[1180px] items-center gap-14 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.88fr)_minmax(28rem,1.12fr)] lg:gap-14 lg:px-8 lg:py-24 xl:gap-20">
          <div className="relative z-10 min-w-0">
            <div className="mb-8 flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.16em] text-muted uppercase">
              <span className="h-px w-8 bg-primary" />
              {t('landing.eyebrow')}
            </div>

            <h1 className="text-balance max-w-[11ch] text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.94] font-semibold tracking-[-0.055em] text-ink">
              {t('landing.headlineFirst')}
              <span className="mt-2 block text-muted-strong">
                {t('landing.headlineSecond')}
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              {t('landing.description')}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleStartMeeting}
                size="lg"
                trailingIcon={
                  <ArrowRight aria-hidden="true" className="size-4" />
                }
                variant="primary"
                className="w-full sm:w-auto"
              >
                {t('nav.startMeeting')}
              </Button>
            </div>

            <section
              id="join-room"
              className="mt-10 max-w-xl scroll-mt-24 rounded-[20px] border border-line bg-panel/80 p-5 backdrop-blur-sm"
            >
              <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-primary uppercase">
                {t('landing.joinEyebrow')}
              </p>
              <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-ink">
                {t('landing.joinTitle')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t('landing.joinDescription')}
              </p>

              <form
                onSubmit={handleJoinMeeting}
                className="mt-4"
                noValidate
              >
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid gap-2">
                    <label
                      htmlFor="room-code"
                      className="text-sm font-semibold tracking-[-0.01em] text-ink-soft"
                    >
                      {t('landing.roomCodeLabel')}
                    </label>
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
                      className={`h-12 w-full rounded-[10px] border bg-canvas px-3.5 text-base text-ink outline-none placeholder:text-muted transition-colors hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/15 ${
                        roomCodeError
                          ? 'border-danger'
                          : 'border-line-strong'
                      }`}
                  />
                  </div>

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
                    className="w-full sm:min-w-40"
                  >
                    {t('landing.joinButton')}
                  </Button>
                </div>
                <p
                  id="room-code-support"
                  className={`mt-2 text-xs ${
                    roomCodeError ? 'text-danger-soft' : 'text-muted'
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

            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-xs text-muted">
              <span>{t('common.languagePair')}</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-line-strong" />
              <span>{t('landing.deterministicDemo')}</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-line-strong" />
              <span>{t('landing.noAccount')}</span>
            </div>
          </div>

          <div className="relative min-w-0 max-w-full lg:translate-y-3">
            <ConversationPreview />
          </div>
        </section>

        <BenefitStrip />

        <section
          aria-labelledby="privacy-title"
          className="scroll-mt-24 px-5 py-20 sm:px-6 lg:px-8 lg:py-28"
          id="privacy"
        >
          <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
            <div>
              <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-primary uppercase">
                {t('landing.privacyEyebrow')}
              </p>
              <h2
                className="mt-4 max-w-sm text-3xl leading-tight font-semibold tracking-[-0.035em] text-ink sm:text-4xl"
                id="privacy-title"
              >
                {t('landing.privacyTitle')}
              </h2>
            </div>

            <div className="border-t border-line pt-6">
              <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
                <p className="max-w-2xl text-base leading-7 text-muted-strong">
                  {t('landing.privacyBody')}
                </p>

                <div className="flex items-start gap-3 border-l border-line pl-5">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-vietnamese"
                  />
                  <p className="text-sm leading-6 text-muted">
                    {t('landing.privacyNote')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-panel px-5 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark compact to={ROUTES.landing} />
          <p className="text-xs text-muted">
            {t('landing.footer')}
          </p>
        </div>
      </footer>
    </div>
  )
}
