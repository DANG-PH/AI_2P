import { useEffect, useState } from 'react'

import { isEditableTarget } from '@/lib/utils'
import type { ConversationMode, Language } from '@/types/meeting'

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (isEditableTarget(target) || !(target instanceof HTMLElement)) {
    return isEditableTarget(target)
  }

  return (
    target.closest(
      'button, a, [role="button"], [role="dialog"], [role="menu"], [role="tab"]',
    ) !== null
  )
}

export function usePushToTalk(mode: ConversationMode) {
  const [activeLanguage, setActiveLanguage] = useState<Language | null>(null)

  useEffect(() => {
    if (mode !== 'push-to-talk') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        isInteractiveTarget(event.target) ||
        (event.code !== 'Space' && event.code !== 'Enter')
      ) {
        return
      }

      event.preventDefault()
      setActiveLanguage(event.code === 'Space' ? 'vi' : 'en')
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        setActiveLanguage(null)
      }
    }

    const clearActiveLanguage = () => setActiveLanguage(null)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearActiveLanguage)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearActiveLanguage)
    }
  }, [mode])

  return mode === 'push-to-talk' ? activeLanguage : null
}
