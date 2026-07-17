import { useId, useState, type FormEvent } from 'react'
import {
  BookOpen,
  FileText,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { getInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'
import { SystemStatus } from './SystemStatus'

type SidebarTab = 'participants' | 'glossary' | 'notes'

export interface MeetingSidebarProps {
  className?: string
  initialTab?: SidebarTab
}

const tabs = [
  {
    id: 'participants',
    labelKey: 'sidebar.participants',
    icon: Users,
  },
  { id: 'glossary', labelKey: 'sidebar.glossary', icon: BookOpen },
  { id: 'notes', labelKey: 'sidebar.notes', icon: FileText },
] as const satisfies readonly {
  id: SidebarTab
  labelKey: TranslationKey
  icon: typeof Users
}[]

export function MeetingSidebar({
  className,
  initialTab = 'participants',
}: MeetingSidebarProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SidebarTab>(initialTab)
  const [originalTerm, setOriginalTerm] = useState('')
  const [preferredOutput, setPreferredOutput] = useState('')
  const [noteText, setNoteText] = useState('')
  const participants = useMeetingStore((state) => state.meeting.participants)
  const glossary = useMeetingStore((state) => state.meeting.glossary)
  const notes = useMeetingStore((state) => state.meeting.notes)
  const addGlossaryTerm = useMeetingStore((state) => state.addGlossaryTerm)
  const addNote = useMeetingStore((state) => state.addNote)
  const removeNote = useMeetingStore((state) => state.removeNote)
  const tabListId = useId()

  const handleGlossarySubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!originalTerm.trim() || !preferredOutput.trim()) {
      return
    }

    addGlossaryTerm({ originalTerm, preferredOutput })
    setOriginalTerm('')
    setPreferredOutput('')
  }

  const handleNoteSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!noteText.trim()) {
      return
    }

    addNote(noteText)
    setNoteText('')
  }

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-l border-line bg-panel',
        className,
      )}
      aria-label={t('sidebar.ariaLabel')}
    >
      <div
        id={tabListId}
        role="tablist"
        aria-label={t('sidebar.sections')}
        className="grid grid-cols-3 border-b border-line"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabListId}-${tab.id}`}
              id={`${tabListId}-${tab.id}-tab`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-semibold transition-colors',
                selected
                  ? 'text-ink'
                  : 'text-muted hover:bg-panel/60 hover:text-muted-strong',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(tab.labelKey)}
              {selected && (
                <span
                  className="absolute inset-x-3 bottom-0 h-0.5 bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'participants' && (
          <div
            role="tabpanel"
            id={`${tabListId}-participants`}
            aria-labelledby={`${tabListId}-participants-tab`}
            className="grid gap-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">
                {t('sidebar.inMeeting')}
              </h2>
              <span className="text-xs text-muted">
                {t('common.people', { count: participants.length })}
              </span>
            </div>
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-3"
              >
                <div
                  className={cn(
                    'grid size-9 place-items-center rounded-full border text-[0.6875rem] font-bold',
                    participant.language === 'vi'
                      ? 'border-vietnamese/35 bg-vietnamese/10 text-vietnamese-soft'
                      : 'border-english/35 bg-english/10 text-english-soft',
                  )}
                  aria-hidden="true"
                >
                  {getInitials(participant.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-soft">
                    {participant.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t(
                      participant.language === 'vi'
                        ? 'common.vietnamese'
                        : 'common.english',
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'glossary' && (
          <div
            role="tabpanel"
            id={`${tabListId}-glossary`}
            aria-labelledby={`${tabListId}-glossary-tab`}
          >
            <div className="mb-4">
              <h2 className="text-sm font-bold text-ink">
                {t('glossary.title')}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {t('sidebar.glossaryDescription')}
              </p>
            </div>
            <dl className="divide-y divide-line border-y border-line">
              {glossary.map((term) => (
                <div key={term.id} className="grid gap-1 py-3">
                  <dt className="text-xs font-bold text-ink-soft">
                    {term.originalTerm}
                  </dt>
                  <dd className="text-xs leading-5 text-muted">
                    {term.preferredOutput}
                  </dd>
                </div>
              ))}
            </dl>
            <form onSubmit={handleGlossarySubmit} className="mt-5 grid gap-2.5">
              <label className="grid gap-1.5 text-xs font-semibold text-muted-strong">
                {t('glossary.original')}
                <input
                  value={originalTerm}
                  onChange={(event) => setOriginalTerm(event.target.value)}
                  placeholder={t('glossary.meetingOriginalPlaceholder')}
                className="min-h-10 rounded-[10px] border border-line-strong bg-panel px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-primary"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-strong">
                {t('glossary.preferred')}
                <input
                  value={preferredOutput}
                  onChange={(event) => setPreferredOutput(event.target.value)}
                  placeholder={t('glossary.meetingPreferredPlaceholder')}
                className="min-h-10 rounded-[10px] border border-line-strong bg-panel px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-primary"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                leadingIcon={<Plus className="size-3.5" aria-hidden="true" />}
              >
                {t('glossary.addButton')}
              </Button>
            </form>
          </div>
        )}

        {activeTab === 'notes' && (
          <div
            role="tabpanel"
            id={`${tabListId}-notes`}
            aria-labelledby={`${tabListId}-notes-tab`}
          >
            <div className="mb-4">
              <h2 className="text-sm font-bold text-ink">
                {t('sidebar.notesTitle')}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {t('sidebar.notesDescription')}
              </p>
            </div>
            <form onSubmit={handleNoteSubmit} className="grid gap-2">
              <label htmlFor={`${tabListId}-note`} className="sr-only">
                {t('sidebar.newNote')}
              </label>
              <textarea
                id={`${tabListId}-note`}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={3}
                placeholder={t('sidebar.notePlaceholder')}
                className="resize-none rounded-[10px] border border-line-strong bg-panel px-3 py-2.5 text-sm leading-5 text-ink outline-none placeholder:text-muted focus:border-primary"
              />
              <Button
                type="submit"
                size="sm"
                leadingIcon={<Plus className="size-3.5" aria-hidden="true" />}
              >
                {t('meeting.addNote')}
              </Button>
            </form>
            <div className="mt-5 grid gap-2">
              {notes.length === 0 ? (
                <p className="border-y border-line py-5 text-center text-xs leading-5 text-muted">
                  {t('sidebar.noNotes')}
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-2 rounded-lg border border-line bg-panel px-3 py-3"
                  >
                    <p className="min-w-0 flex-1 text-xs leading-5 text-ink-soft">
                      {note.text}
                    </p>
                    <IconButton
                      label={t('sidebar.deleteNote')}
                      icon={<Trash2 className="size-3.5" aria-hidden="true" />}
                      onClick={() => removeNote(note.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <SystemStatus />
    </aside>
  )
}
