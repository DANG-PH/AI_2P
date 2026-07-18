import { useCallback, useEffect, useState } from 'react'

import { isEditableTarget } from '@/lib/utils'
import type { ConversationMode } from '@/types/meeting'

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

export function usePushToTalk(
  mode: ConversationMode,
  enabled = true,
) {
  const [active, setActive] = useState(false)
  const start = useCallback(() => {
    if (enabled) {
      setActive(true)
    }
  }, [enabled])
  const stop = useCallback(() => setActive(false), [])

  useEffect(() => {
    if (mode !== 'push-to-talk' || !enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        isInteractiveTarget(event.target) ||
        event.code !== 'Space'
      ) {
        return
      }

      event.preventDefault()
      start()
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        stop()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', stop)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', stop)
      stop()
    }
  }, [enabled, mode, start, stop])

  return {
    active: mode === 'push-to-talk' && enabled && active,
    start,
    stop,
  }
}
