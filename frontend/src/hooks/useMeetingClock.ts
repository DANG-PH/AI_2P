import { useEffect, useState } from 'react'

import type { MeetingStatus } from '@/types/meeting'

const secondsBetween = (start: string | null, end: number): number => {
  if (start === null) {
    return 0
  }

  const startTime = new Date(start).getTime()
  return Number.isFinite(startTime)
    ? Math.max(0, Math.floor((end - startTime) / 1_000))
    : 0
}

export function useMeetingClock(
  startedAt: string | null,
  status: MeetingStatus,
  frozenDuration: number,
) {
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(() =>
    secondsBetween(startedAt, Date.now()),
  )

  useEffect(() => {
    if (status !== 'live' || startedAt === null) {
      return
    }

    const updateElapsed = () => {
      setLiveElapsedSeconds(secondsBetween(startedAt, Date.now()))
    }

    const initialTimerId = window.setTimeout(updateElapsed, 0)
    const intervalId = window.setInterval(updateElapsed, 1_000)
    return () => {
      window.clearTimeout(initialTimerId)
      window.clearInterval(intervalId)
    }
  }, [startedAt, status])

  if (status === 'ended') {
    return frozenDuration
  }

  return status === 'live' ? liveElapsedSeconds : 0
}
