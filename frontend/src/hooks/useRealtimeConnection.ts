import { useCallback, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

import { AudioStreamer } from '@/lib/audioStreamer'
import { SOCKET_URL } from '@/lib/config'
import {
  parseRealtimeError,
  parseSessionParticipants,
  parseSessionReady,
  parseSttFinal,
  parseSttPartial,
  parseTranslateDone,
  parseTranslatePartial,
  parseTranslateToken,
} from '@/lib/realtimePayloads'
import { useMeetingStore } from '@/store/meetingStore'
import type { RealtimeConnectionQuery } from '@/types/realtime'

interface UseRealtimeConnectionOptions {
  microphoneTrack: MediaStreamTrack | null
  transmitAudio: boolean
}

const FATAL_REALTIME_ERROR_CODES = new Set([
  'AI_UNAVAILABLE',
  'AI_CONN_ERROR',
  'AI_CONN_CLOSED',
  'INVALID_CONNECTION',
  'INVALID_AUDIO_CHUNK',
])

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
  const applyRealtimeWarning = useMeetingStore(
    (state) => state.applyRealtimeWarning,
  )
  const setRealtimeStatus = useMeetingStore(
    (state) => state.setRealtimeStatus,
  )
  const setAudioInputLevel = useMeetingStore(
    (state) => state.setAudioInputLevel,
  )
  const socketRef = useRef<Socket | null>(null)
  const lastConnectionErrorRef = useRef<Error | null>(null)

  const {
    id: roomId,
    status: meetingStatus,
    title,
    localLanguage,
    languageOrder,
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

    const query = {
      sessionId: roomId,
      clientId,
      domain: 'business',
      languagePair: 'vi-en',
      title,
      displayName,
      localLanguage,
    } satisfies RealtimeConnectionQuery

    const socket = io(`${SOCKET_URL}/audio`, {
      query,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1_000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      lastConnectionErrorRef.current = null
      setRealtimeStatus('connecting')
    })

    socket.on(
      'session.ready',
      (value: unknown) => {
        const event = parseSessionReady(value)
        if (
          !event ||
          event.clientId !== clientId ||
          event.sessionId !== roomId
        ) {
          applyRealtimeEvent({
            type: 'error',
            code: 'INVALID_SESSION_READY',
            message: 'INVALID_SESSION_READY',
          })
          socket.disconnect()
          return
        }

        applyRealtimeEvent(event)
      },
    )

    socket.on('session.participants', (value: unknown) => {
      applyRealtimeEvent(parseSessionParticipants(value))
    })

    socket.on('stt.partial', (value: unknown) => {
      const event = parseSttPartial(value)
      if (event) {
        applyRealtimeEvent(event)
      }
    })
    socket.on('stt.final', (value: unknown) => {
      const event = parseSttFinal(value)
      if (event) {
        applyRealtimeEvent(event)
      }
    })
    socket.on('translate.partial', (value: unknown) => {
      const event = parseTranslatePartial(value)
      if (event) {
        applyRealtimeEvent(event)
      }
    })
    socket.on('translate.token', (value: unknown) => {
      const event = parseTranslateToken(value)
      if (event) {
        applyRealtimeEvent(event)
      }
    })
    socket.on('translate.done', (value: unknown) => {
      const event = parseTranslateDone(value)
      if (event) {
        applyRealtimeEvent(event)
      }
    })

    socket.on('session.ended', () => {
      applyRealtimeEvent({ type: 'session.ended' })
      socket.disconnect()
    })

    socket.on('error', (value: unknown) => {
      const error = parseRealtimeError(value)

      if (FATAL_REALTIME_ERROR_CODES.has(error.code)) {
        applyRealtimeEvent(error)
      } else {
        applyRealtimeWarning(error)
      }
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        return
      }

      const currentState = useMeetingStore.getState()
      if (currentState.meeting.status !== 'live') {
        return
      }

      if (reason === 'io server disconnect') {
        if (currentState.realtimeSession.status !== 'error') {
          applyRealtimeEvent({
            type: 'error',
            code: 'GATEWAY_DISCONNECTED',
            message: 'GATEWAY_DISCONNECTED',
          })
        }
        return
      }

      if (currentState.realtimeSession.status !== 'error') {
        setRealtimeStatus('reconnecting')
      }
    })

    socket.on('connect_error', (error) => {
      lastConnectionErrorRef.current = error
      setRealtimeStatus('reconnecting')
    })

    const handleReconnectAttempt = () => {
      setRealtimeStatus('reconnecting')
    }
    const handleReconnectFailed = () => {
      const error = lastConnectionErrorRef.current
      applyRealtimeEvent({
        type: 'error',
        code: 'GATEWAY_CONNECTION_FAILED',
        message: error?.message ?? 'GATEWAY_CONNECTION_FAILED',
      })
    }
    socket.io.on('reconnect_attempt', handleReconnectAttempt)
    socket.io.on('reconnect_failed', handleReconnectFailed)

    return () => {
      socket.io.off('reconnect_attempt', handleReconnectAttempt)
      socket.io.off('reconnect_failed', handleReconnectFailed)
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [
    applyRealtimeEvent,
    applyRealtimeWarning,
    clientId,
    displayName,
    localLanguage,
    meetingStatus,
    roomId,
    setRealtimeStatus,
    title,
  ])

  const activeSpeaker = languageOrder[0]

  useEffect(() => {
    const socket = socketRef.current
    if (meetingStatus === 'live' && gatewayReady && socket?.connected) {
      socket.emit('speaker.switch', { speaker: activeSpeaker })
    }
  }, [activeSpeaker, gatewayReady, meetingStatus])

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

  const retryConnection = useCallback(() => {
    const socket = socketRef.current
    if (!socket) {
      return
    }

    lastConnectionErrorRef.current = null
    setRealtimeStatus('connecting')
    socket.disconnect()
    socket.connect()
  }, [setRealtimeStatus])

  return { endSession, retryConnection }
}
