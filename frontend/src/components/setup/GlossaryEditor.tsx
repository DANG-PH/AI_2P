import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { MAX_GLOSSARY_TERM_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { IconButton } from '@/components/ui/IconButton'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'
import { useMeetingStore } from '@/store/meetingStore'
import type { GlossaryTerm } from '@/types/meeting'

interface GlossaryDraft {
  originalTerm: string
  preferredOutput: string
}

const emptyDraft: GlossaryDraft = {
  originalTerm: '',
  preferredOutput: '',
}

const glossaryInputClassName =
  'h-11 w-full rounded-[10px] border border-line-strong bg-panel px-3 text-base text-ink placeholder:text-muted transition-colors hover:border-muted focus:border-primary'

export function GlossaryEditor() {
  const { t } = useTranslation()
  const glossary = useMeetingStore((state) => state.meeting.glossary)
  const addGlossaryTerm = useMeetingStore(
    (state) => state.addGlossaryTerm,
  )
  const updateGlossaryTerm = useMeetingStore(
    (state) => state.updateGlossaryTerm,
  )
  const removeGlossaryTerm = useMeetingStore(
    (state) => state.removeGlossaryTerm,
  )
  const [newTerm, setNewTerm] = useState<GlossaryDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] =
    useState<GlossaryDraft>(emptyDraft)
  const [addError, setAddError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const validateDraft = (draft: GlossaryDraft): string | null => {
    if (
      draft.originalTerm.trim().length === 0 ||
      draft.preferredOutput.trim().length === 0
    ) {
      return t('glossary.validation')
    }

    return null
  }

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const error = validateDraft(newTerm)
    setAddError(error)

    if (error !== null) {
      return
    }

    const originalTerm = newTerm.originalTerm.trim()
    addGlossaryTerm({
      originalTerm,
      preferredOutput: newTerm.preferredOutput.trim(),
    })
    setNewTerm(emptyDraft)
    setAnnouncement(t('glossary.added', { term: originalTerm }))
  }

  const beginEdit = (term: GlossaryTerm) => {
    setEditingId(term.id)
    setEditDraft({
      originalTerm: term.originalTerm,
      preferredOutput: term.preferredOutput,
    })
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(emptyDraft)
    setEditError(null)
  }

  const saveEdit = (id: string) => {
    const error = validateDraft(editDraft)
    setEditError(error)

    if (error !== null) {
      return
    }

    const originalTerm = editDraft.originalTerm.trim()
    updateGlossaryTerm(id, {
      originalTerm,
      preferredOutput: editDraft.preferredOutput.trim(),
    })
    cancelEdit()
    setAnnouncement(t('glossary.updated', { term: originalTerm }))
  }

  const removeTerm = (term: GlossaryTerm) => {
    removeGlossaryTerm(term.id)

    if (editingId === term.id) {
      cancelEdit()
    }

    setAnnouncement(t('glossary.removed', { term: term.originalTerm }))
  }

  return (
    <aside
      aria-labelledby="glossary-heading"
      className="self-start rounded-[14px] border border-line-strong bg-panel p-4 shadow-[0_8px_24px_rgb(16_24_40/0.05)] sm:p-5 lg:sticky lg:top-24"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-vietnamese">
            {t('glossary.eyebrow')}
          </p>
          <h2
            id="glossary-heading"
            className="mt-2 text-xl font-semibold tracking-tight text-ink"
          >
            {t('glossary.title')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {t('glossary.description')}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-line bg-panel-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-strong">
          {glossary.length}
        </span>
      </div>

      <div className="mt-5">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_6rem] gap-3 border-b border-line px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted xl:grid"
        >
          <span>{t('glossary.original')}</span>
          <span>{t('glossary.preferred')}</span>
          <span className="text-right">{t('glossary.actions')}</span>
        </div>

        <ul className="divide-y divide-line">
          {glossary.map((term) => {
            const isEditing = editingId === term.id

            return (
              <li key={term.id} className="py-3">
                {isEditing ? (
                  <div>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_6rem] xl:items-start">
                      <div>
                        <label
                          htmlFor={`edit-original-${term.id}`}
                          className="mb-1.5 block text-xs font-semibold text-muted xl:sr-only"
                        >
                          {t('glossary.original')}
                        </label>
                        <input
                          id={`edit-original-${term.id}`}
                          value={editDraft.originalTerm}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              originalTerm: event.target.value,
                            }))
                          }
                          maxLength={MAX_GLOSSARY_TERM_LENGTH}
                          autoComplete="off"
                          aria-invalid={editError !== null}
                          aria-describedby={
                            editError
                              ? `edit-glossary-error-${term.id}`
                              : undefined
                          }
                          className={cn(
                            glossaryInputClassName,
                            editError ? 'border-danger' : null,
                          )}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`edit-preferred-${term.id}`}
                          className="mb-1.5 block text-xs font-semibold text-muted xl:sr-only"
                        >
                          {t('glossary.preferred')}
                        </label>
                        <input
                          id={`edit-preferred-${term.id}`}
                          value={editDraft.preferredOutput}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              preferredOutput: event.target.value,
                            }))
                          }
                          maxLength={MAX_GLOSSARY_TERM_LENGTH}
                          autoComplete="off"
                          aria-invalid={editError !== null}
                          aria-describedby={
                            editError
                              ? `edit-glossary-error-${term.id}`
                              : undefined
                          }
                          className={cn(
                            glossaryInputClassName,
                            editError ? 'border-danger' : null,
                          )}
                        />
                      </div>
                      <div className="flex justify-end gap-1 xl:pt-0">
                        <IconButton
                          onClick={() => saveEdit(term.id)}
                          label={t('glossary.save', {
                            term: term.originalTerm,
                          })}
                          icon={
                            <Check
                              aria-hidden="true"
                              className="size-4"
                            />
                          }
                          className="text-success hover:bg-success/10"
                        />
                        <IconButton
                          onClick={cancelEdit}
                          label={t('glossary.cancel', {
                            term: term.originalTerm,
                          })}
                          icon={<X aria-hidden="true" className="size-4" />}
                        />
                      </div>
                    </div>
                    {editError ? (
                      <p
                        id={`edit-glossary-error-${term.id}`}
                        className="mt-2 text-sm text-danger"
                      >
                        {editError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-3 px-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_6rem] xl:items-center">
                    <div className="min-w-0">
                      <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted xl:hidden">
                        {t('glossary.original')}
                      </span>
                      <p className="break-words text-sm font-semibold text-ink">
                        {term.originalTerm}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted xl:hidden">
                        {t('glossary.preferred')}
                      </span>
                      <p className="break-words text-sm leading-5 text-ink-soft">
                        {term.preferredOutput}
                      </p>
                    </div>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        onClick={() => beginEdit(term)}
                        label={t('glossary.edit', {
                          term: term.originalTerm,
                        })}
                        icon={
                          <Pencil aria-hidden="true" className="size-4" />
                        }
                      />
                      <IconButton
                        onClick={() => removeTerm(term)}
                        label={t('glossary.remove', {
                          term: term.originalTerm,
                        })}
                        tone="danger"
                        icon={
                          <Trash2 aria-hidden="true" className="size-4" />
                        }
                      />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <form
        onSubmit={handleAdd}
        noValidate
        className="mt-4 border-t border-line pt-5"
      >
        <p className="mb-3 text-sm font-semibold text-ink">
          {t('glossary.add')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <FormField
            htmlFor="new-original-term"
            label={t('glossary.original')}
          >
            <input
              id="new-original-term"
              value={newTerm.originalTerm}
              onChange={(event) => {
                setNewTerm((current) => ({
                  ...current,
                  originalTerm: event.target.value,
                }))
                setAddError(null)
              }}
              maxLength={MAX_GLOSSARY_TERM_LENGTH}
              autoComplete="off"
              placeholder={t('glossary.originalPlaceholder')}
              aria-invalid={addError !== null}
              aria-describedby={
                addError ? 'add-glossary-error' : undefined
              }
              className={cn(
                glossaryInputClassName,
                addError ? 'border-danger' : null,
              )}
            />
          </FormField>
          <FormField
            htmlFor="new-preferred-output"
            label={t('glossary.preferred')}
          >
            <input
              id="new-preferred-output"
              value={newTerm.preferredOutput}
              onChange={(event) => {
                setNewTerm((current) => ({
                  ...current,
                  preferredOutput: event.target.value,
                }))
                setAddError(null)
              }}
              maxLength={MAX_GLOSSARY_TERM_LENGTH}
              autoComplete="off"
              placeholder={t('glossary.preferredPlaceholder')}
              aria-invalid={addError !== null}
              aria-describedby={
                addError ? 'add-glossary-error' : undefined
              }
              className={cn(
                glossaryInputClassName,
                addError ? 'border-danger' : null,
              )}
            />
          </FormField>
        </div>

        {addError ? (
          <p id="add-glossary-error" className="mt-2 text-sm text-danger">
            {addError}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="secondary"
          fullWidth
          leadingIcon={<Plus aria-hidden="true" className="size-4" />}
          className="mt-3 hover:border-vietnamese/70 hover:bg-vietnamese/10"
        >
          {t('glossary.addButton')}
        </Button>
      </form>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </aside>
  )
}
