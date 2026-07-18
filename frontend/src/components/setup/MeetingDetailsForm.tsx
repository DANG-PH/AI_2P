import { Radio } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import {
  MAX_MEETING_TITLE_LENGTH,
  MAX_PARTICIPANT_NAME_LENGTH,
} from '@/lib/constants'
import { FormField } from '@/components/ui/FormField'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'
import type { ConversationMode } from '@/types/meeting'

import { MicrophoneTest } from './MicrophoneTest'

export const MEETING_SETUP_FORM_ID = 'meeting-setup-form'

type RequiredField = 'title' | 'userName'

type TouchedFields = Record<RequiredField, boolean>

interface MeetingDetailsFormProps {
  onValidSubmit: () => void
  isJoining?: boolean
}

const initialTouchedFields: TouchedFields = {
  title: false,
  userName: false,
}

const inputClassName =
  'h-12 w-full rounded-[10px] border bg-panel px-3.5 text-base text-ink outline-none placeholder:text-muted transition-colors hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/15'

const modeOptions: readonly {
  value: ConversationMode
  labelKey: TranslationKey
  descriptionKey: TranslationKey
}[] = [
  {
    value: 'auto',
    labelKey: 'details.autoMode',
    descriptionKey: 'details.autoModeDescription',
  },
  {
    value: 'push-to-talk',
    labelKey: 'details.pushToTalk',
    descriptionKey: 'details.pushToTalkDescription',
  },
]

export function MeetingDetailsForm({
  onValidSubmit,
  isJoining = false,
}: MeetingDetailsFormProps) {
  const { t } = useTranslation()
  const meeting = useMeetingStore((state) => state.meeting)
  const setMeetingTitle = useMeetingStore(
    (state) => state.setMeetingTitle,
  )
  const setParticipantNameByLanguage = useMeetingStore(
    (state) => state.setParticipantNameByLanguage,
  )
  const setConversationMode = useMeetingStore(
    (state) => state.setConversationMode,
  )
  const setLocalLanguage = useMeetingStore(
    (state) => state.setLocalLanguage,
  )
  const [touched, setTouched] =
    useState<TouchedFields>(initialTouchedFields)

  const userLanguage = meeting.localLanguage
  const userName =
    meeting.participants.find(
      (participant) => participant.language === userLanguage,
    )?.name ?? ''

  const fieldValues: Record<RequiredField, string> = {
    title: meeting.title,
    userName: userName,
  }

  const fieldLabels: Record<RequiredField, string> = {
    title: t('details.meetingTitle'),
    userName: t('details.yourName'),
  }

  const getRequiredError = (label: string, value: string): string | null =>
    value.trim().length === 0
      ? t('details.required', { field: label.toLocaleLowerCase() })
      : null

  const getVisibleError = (field: RequiredField): string | null =>
    touched[field]
      ? getRequiredError(fieldLabels[field], fieldValues[field])
      : null

  const markTouched = (field: RequiredField) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const allTouched: TouchedFields = {
      title: !isJoining,
      userName: true,
    }
    setTouched(allTouched)

    const hasError = (
      Object.keys(fieldValues) as RequiredField[]
    ).some((field) => {
      if (isJoining && field === 'title') {
        return false
      }
      return (
        getRequiredError(fieldLabels[field], fieldValues[field]) !== null
      )
    })

    if (!hasError) {
      onValidSubmit()
    }
  }

  const titleError = isJoining ? null : getVisibleError('title')
  const userNameError = getVisibleError('userName')

  const selectLanguage = (language: 'vi' | 'en') => {
    if (language === userLanguage) {
      return
    }

    const otherLanguage = language === 'vi' ? 'en' : 'vi'
    setParticipantNameByLanguage(language, userName)
    setParticipantNameByLanguage(otherLanguage, '')
    setLocalLanguage(language)
  }

  return (
    <form
      id={MEETING_SETUP_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      className="min-w-0"
    >
      <section aria-labelledby="meeting-details-heading">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {t('details.eyebrow')}
          </p>
          <h2
            id="meeting-details-heading"
            className="mt-2 text-xl font-semibold tracking-tight text-ink"
          >
            {isJoining ? t('details.joinTitle') : t('details.title')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {isJoining ? t('details.joinDescription') : t('details.description')}
          </p>
        </div>

        {!isJoining && (
          <FormField
            htmlFor="meeting-title"
            label={t('details.meetingTitle')}
            required
            error={titleError ?? undefined}
            description={t('details.meetingTitleDescription')}
          >
            <input
              id="meeting-title"
              value={meeting.title}
              onChange={(event) =>
                setMeetingTitle(event.target.value)
              }
              onBlur={() => markTouched('title')}
              aria-invalid={titleError !== null}
              aria-describedby="meeting-title-support"
              maxLength={MAX_MEETING_TITLE_LENGTH}
              autoComplete="off"
              className={cn(
                inputClassName,
                titleError
                  ? 'border-danger'
                  : 'border-line-strong',
              )}
            />
          </FormField>
        )}

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <FormField
            htmlFor="user-name"
            label={t('details.yourName')}
            required
            error={userNameError ?? undefined}
          >
            <input
              id="user-name"
              value={userName}
              onChange={(event) => {
                setParticipantNameByLanguage(
                  userLanguage,
                  event.target.value,
                )
              }}
              onBlur={() => markTouched('userName')}
              aria-invalid={userNameError !== null}
              aria-describedby={
                userNameError ? 'user-name-support' : undefined
              }
              maxLength={MAX_PARTICIPANT_NAME_LENGTH}
              autoComplete="name"
              className={cn(
                inputClassName,
                'pl-4',
                userNameError
                  ? 'border-danger'
                  : 'border-line-strong',
              )}
            />
          </FormField>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold tracking-[-0.01em] text-ink-soft">
              {t('details.yourLanguage')}
              <span className="ml-1 text-danger" aria-hidden="true">
                *
              </span>
            </legend>
            <div className="grid h-12 grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={userLanguage === 'vi'}
                onClick={() => selectLanguage('vi')}
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-[10px] border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  userLanguage === 'vi'
                    ? 'border-vietnamese/80 bg-vietnamese/10 text-vietnamese-soft'
                    : 'border-line bg-panel text-muted hover:border-line-strong',
                )}
              >
                {t('details.vietnamese')} · VI
              </button>
              <button
                type="button"
                aria-pressed={userLanguage === 'en'}
                onClick={() => selectLanguage('en')}
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-[10px] border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  userLanguage === 'en'
                    ? 'border-english/80 bg-english/10 text-english-soft'
                    : 'border-line bg-panel text-muted hover:border-line-strong',
                )}
              >
                {t('details.english')} · EN
              </button>
            </div>
          </fieldset>
        </div>
      </section>

      {!isJoining && (
        <section
          aria-labelledby="conversation-mode-heading"
          className="mt-8 border-t border-line pt-7"
        >
        <div className="mb-4 flex items-start gap-3">
          <Radio
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <div>
            <h2
              id="conversation-mode-heading"
              className="text-base font-semibold text-ink"
            >
              {t('details.modeTitle')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {t('details.modeDescription')}
            </p>
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="sr-only">{t('details.modeLegend')}</legend>
          {modeOptions.map((option) => {
            const isSelected = meeting.conversationMode === option.value

            return (
              <label
                key={option.value}
                className={cn(
                  'flex min-h-16 items-start gap-3 rounded-[10px] border px-4 py-3 transition-colors',
                  isSelected
                    ? 'border-primary/80 bg-primary/10'
                    : 'border-line bg-panel-muted/60 hover:border-line-strong',
                )}
              >
                <input
                  type="radio"
                  name="conversation-mode"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setConversationMode(option.value)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {t(option.labelKey)}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {t(option.descriptionKey)}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
        </section>
      )}

      <div className="mt-8">
        <MicrophoneTest />
      </div>
    </form>
  )
}
