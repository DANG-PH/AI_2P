import { useCallback, useEffect, useRef } from 'react'

import { demoTurnScripts } from '@/data/mockMeeting'
import { DEMO_TIMING } from '@/lib/constants'
import { useMeetingStore } from '@/store/meetingStore'
import type { ConversationTurn } from '@/types/meeting'

const revealText = (text: string, slice: number, totalSlices: number): string =>
  text.slice(0, Math.ceil((text.length * slice) / totalSlices))

export function useDemoSimulation() {
  const timerIdsRef = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId))
    timerIdsRef.current = []
  }, [])

  const schedule = useCallback(
    (runId: number, delay: number, callback: () => void) => {
      const timerId = window.setTimeout(() => {
        if (useMeetingStore.getState().demoRunId === runId) {
          callback()
        }
      }, delay)
      timerIdsRef.current.push(timerId)
    },
    [],
  )

  const runDemo = useCallback(() => {
    clearTimers()

    const store = useMeetingStore.getState()
    const runId = store.beginDemo()

    demoTurnScripts.forEach((script, turnIndex) => {
      const turnOffset = turnIndex * DEMO_TIMING.nextTurnAtMs

      schedule(runId, turnOffset, () => {
        const currentStore = useMeetingStore.getState()
        const currentSpeaker =
          currentStore.meeting.participants.find(
            (participant) => participant.id === script.speakerId,
          )?.name ?? script.speakerName

        const turn: ConversationTurn = {
          id: script.id,
          speakerId: script.speakerId,
          speakerName: currentSpeaker,
          sourceLanguage: script.sourceLanguage,
          targetLanguage: script.targetLanguage,
          timestampSeconds: script.timestampSeconds,
          originalText: '',
          translatedText: '',
          status: 'listening',
        }

        currentStore.addTurn(turn)
      })

      schedule(runId, turnOffset + DEMO_TIMING.listeningMs, () => {
        useMeetingStore
          .getState()
          .updateTurn(script.id, { status: 'transcribing' })
      })

      for (
        let slice = 1;
        slice <= DEMO_TIMING.transcriptSlices;
        slice += 1
      ) {
        schedule(
          runId,
          turnOffset +
            DEMO_TIMING.listeningMs +
            slice * DEMO_TIMING.transcriptSliceMs,
          () => {
            useMeetingStore.getState().updateTurn(script.id, {
              originalText: revealText(
                script.originalText,
                slice,
                DEMO_TIMING.transcriptSlices,
              ),
            })
          },
        )
      }

      schedule(runId, turnOffset + DEMO_TIMING.draftAtMs, () => {
        useMeetingStore.getState().updateTurn(script.id, {
          originalText: script.originalText,
          translatedText: script.draftTranslation,
          status: 'draft',
        })
      })

      schedule(runId, turnOffset + DEMO_TIMING.finalAtMs, () => {
        const currentTurn = useMeetingStore
          .getState()
          .meeting.turns.find((turn) => turn.id === script.id)

        if (!currentTurn?.isEdited) {
          useMeetingStore.getState().updateTurn(script.id, {
            translatedText: script.finalTranslation,
            status: 'final',
          })
        }
      })
    })

    schedule(
      runId,
      demoTurnScripts.length * DEMO_TIMING.nextTurnAtMs,
      () => useMeetingStore.getState().completeDemo(),
    )
  }, [clearTimers, schedule])

  const resetDemo = useCallback(() => {
    clearTimers()
    useMeetingStore.getState().resetDemo()
  }, [clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  return { runDemo, resetDemo }
}
