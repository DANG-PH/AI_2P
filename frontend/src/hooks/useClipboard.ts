import { useCallback, useRef, useState } from 'react'

type CopyState = 'idle' | 'copied' | 'failed'

const fallbackCopy = (text: string): boolean => {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  const copied = document.execCommand('copy')
  textArea.remove()

  return copied
}

export function useClipboard(resetAfterMs = 1_800) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const resetTimerRef = useRef<number | null>(null)

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else if (!fallbackCopy(text)) {
          throw new Error('Copy command was not available')
        }

        setCopyState('copied')
        resetTimerRef.current = window.setTimeout(
          () => setCopyState('idle'),
          resetAfterMs,
        )
        return true
      } catch {
        setCopyState('failed')
        resetTimerRef.current = window.setTimeout(
          () => setCopyState('idle'),
          resetAfterMs,
        )
        return false
      }
    },
    [resetAfterMs],
  )

  return { copy, copyState }
}
