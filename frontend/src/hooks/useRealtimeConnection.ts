import { useCallback, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

import { AudioStreamer } from '@/lib/audioStreamer'
import { SOCKET_URL } from '@/lib/config'
import { useMeetingStore } from '@/store/meetingStore'

interface UseRealtimeConnectionOptions {
  microphoneTrack: MediaStreamTrack | null
  transmitAudio: boolean
}

export function useRealtimeConnection({
  microphoneTrack,
  transmitAudio,
}: UseRealtimeConnectionOptions) {
  const meeting = useMeetingStore((state) => state.meeting)
  const realtimeSession = useMeetingStore(
    (state) => state.realtimeSession,
  )
  const applyRealtimeEvent = useMeetingStore(
    (state) => state.applyRealtimeEvent,
  )
  const setRealtimeStatus = useMeetingStore(
    (state) => state.setRealtimeStatus,
  )
  const setAudioInputLevel = useMeetingStore(
    (state) => state.setAudioInputLevel,
  )
  const socketRef = useRef<Socket | null>(null)

  const {
    id: roomId,
    status: meetingStatus,
    title,
    localLanguage,
    participants,
  } = meeting
  const { clientId } = realtimeSession
  const gatewayReady =
    realtimeSession.status === 'gateway-connected'
  const displayName =
    participants.find(
      (participant) => participant.language === localLanguage,
    )?.name ?? clientId

  useEffect(() => {
    if (meetingStatus !== 'live') {
      return
    }

    const socket = io(`${SOCKET_URL}/audio`, {
      query: {
        sessionId: roomId,
        clientId,
        domain: 'business',
        languagePair: 'vi-en',
        title,
        displayName,
        language: localLanguage,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1_000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('speaker.switch', { speaker: localLanguage })
    })

    socket.on(
      'session.ready',
      (data: { clientId: string; sessionId: string }) => {
        applyRealtimeEvent({
          type: 'session.ready',
          clientId: data.clientId,
          sessionId: data.sessionId,
        })
      },
    )

    socket.on('session.participants', (data) => {
      applyRealtimeEvent({
        type: 'session.participants',
        participants: Array.isArray(data?.participants)
          ? data.participants
          : [],
      })
    })

    socket.on('stt.partial', (data) => {
      applyRealtimeEvent({ type: 'stt.partial', ...data })
    })
    socket.on('stt.final', (data) => {
      applyRealtimeEvent({ type: 'stt.final', ...data })
    })
    socket.on('translate.token', (data) => {
      applyRealtimeEvent({ type: 'translate.token', ...data })
    })
    socket.on('translate.done', (data) => {
      applyRealtimeEvent({ type: 'translate.done', ...data })
    })

    socket.on('session.ended', () => {
      applyRealtimeEvent({ type: 'session.ended' })
      socket.disconnect()
    })

    socket.on(
      'error',
      (error: { code?: string; message?: string }) => {
        applyRealtimeEvent({
          type: 'error',
          code: error.code ?? 'UNKNOWN_ERROR',
          message: error.message ?? 'REALTIME_CONNECTION_ERROR',
        })
      },
    )

    socket.on('disconnect', (reason) => {
      if (
        reason !== 'io client disconnect' &&
        useMeetingStore.getState().meeting.status === 'live'
      ) {
        setRealtimeStatus('connecting')
      }
    })

    socket.on('connect_error', (error) => {
      applyRealtimeEvent({
        type: 'error',
        code: 'GATEWAY_CONNECTION_FAILED',
        message: error.message,
      })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [
    applyRealtimeEvent,
    clientId,
    displayName,
    localLanguage,
    meetingStatus,
    roomId,
    setRealtimeStatus,
    title,
  ])

  useEffect(() => {
    const canStream =
      meetingStatus === 'live' &&
      gatewayReady &&
      transmitAudio &&
      microphoneTrack?.readyState === 'live'

    if (!canStream || !microphoneTrack) {
      setAudioInputLevel(0)
      return
    }

    let cancelled = false
    const streamer = new AudioStreamer({
      sampleRate: 16_000,
      mediaStream: new MediaStream([microphoneTrack]),
      onAudioChunk: (chunk) => {
        const socket = socketRef.current
        if (!cancelled && socket?.connected) {
          socket.emit('audio.chunk', chunk)
        }
      },
      onVolume: (volume) => {
        if (!cancelled) {
          setAudioInputLevel(volume / 100)
        }
      },
    })

    void streamer.start().catch((error: unknown) => {
      if (cancelled) {
        return
      }

      setAudioInputLevel(0)
      applyRealtimeEvent({
        type: 'error',
        code: 'AUDIO_CAPTURE_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'AUDIO_CAPTURE_FAILED',
      })
    })

    return () => {
      cancelled = true
      streamer.stop()
      setAudioInputLevel(0)
    }
  }, [
    applyRealtimeEvent,
    gatewayReady,
    meetingStatus,
    microphoneTrack,
    setAudioInputLevel,
    transmitAudio,
  ])

  const endSession = useCallback((): Promise<void> => {
    const socket = socketRef.current
    if (!socket?.connected) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(resolve, 1_500)
      socket.once('session.ended', () => {
        window.clearTimeout(timeoutId)
        resolve()
      })
      socket.emit('session.end')
    })
  }, [])

  return { endSession }
}
