import { useCallback, useEffect, useMemo, useState } from 'react'

import { useMeetingStore } from '@/store/meetingStore'

export type MicrophonePermissionState =
  | 'unknown'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported'

export type MediaDeviceListStatus =
  | 'checking'
  | 'ready'
  | 'unsupported'
  | 'error'

export interface MediaDeviceOption {
  id: string
  label: string
}

export interface MediaDevicesState {
  microphones: MediaDeviceOption[]
  speakers: MediaDeviceOption[]
  permissionState: MicrophonePermissionState
  listStatus: MediaDeviceListStatus
  outputSelectionSupported: boolean
  refresh: () => Promise<void>
}

const supportsOutputSelection = (): boolean =>
  typeof HTMLMediaElement !== 'undefined' &&
  'setSinkId' in HTMLMediaElement.prototype

export function useMediaDevices(): MediaDevicesState {
  const microphoneId = useMeetingStore(
    (state) => state.meeting.microphoneId,
  )
  const speakerId = useMeetingStore((state) => state.meeting.speakerId)
  const setMicrophone = useMeetingStore((state) => state.setMicrophone)
  const setSpeaker = useMeetingStore((state) => state.setSpeaker)
  const [microphones, setMicrophones] = useState<MediaDeviceOption[]>([])
  const [speakers, setSpeakers] = useState<MediaDeviceOption[]>([])
  const [permissionState, setPermissionState] =
    useState<MicrophonePermissionState>('unknown')
  const [listStatus, setListStatus] =
    useState<MediaDeviceListStatus>('checking')

  const outputSelectionSupported = useMemo(
    () => supportsOutputSelection(),
    [],
  )

  const refreshDeviceList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setListStatus('unsupported')
      setMicrophones([])
      setSpeakers([])
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const nextMicrophones = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({ id: device.deviceId, label: device.label }))
      const nextSpeakers = devices
        .filter((device) => device.kind === 'audiooutput')
        .map((device) => ({ id: device.deviceId, label: device.label }))

      setMicrophones(nextMicrophones)
      setSpeakers(nextSpeakers)
      setListStatus('ready')

      if (
        microphoneId &&
        !nextMicrophones.some((device) => device.id === microphoneId)
      ) {
        setMicrophone(nextMicrophones[0]?.id ?? '')
      } else if (!microphoneId && nextMicrophones[0]) {
        setMicrophone(nextMicrophones[0].id)
      }

      if (!supportsOutputSelection()) {
        if (speakerId) {
          setSpeaker('')
        }
      } else if (
        speakerId &&
        !nextSpeakers.some((device) => device.id === speakerId)
      ) {
        setSpeaker(nextSpeakers[0]?.id ?? '')
      } else if (!speakerId && nextSpeakers[0]) {
        setSpeaker(nextSpeakers[0].id)
      }
    } catch {
      setListStatus('error')
      setMicrophones([])
      setSpeakers([])
    }
  }, [
    microphoneId,
    setMicrophone,
    setSpeaker,
    speakerId,
  ])

  const refreshPermission = useCallback(async () => {
    if (!navigator.permissions?.query) {
      setPermissionState('unsupported')
      return
    }

    try {
      const permission = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      })
      setPermissionState(permission.state)
    } catch {
      setPermissionState('unsupported')
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([refreshDeviceList(), refreshPermission()])
  }, [refreshDeviceList, refreshPermission])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh])

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.addEventListener) {
      return
    }

    const handleDeviceChange = () => {
      void refreshDeviceList()
    }
    mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () =>
      mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [refreshDeviceList])

  useEffect(() => {
    if (!navigator.permissions?.query) {
      return
    }

    let active = true
    let permission: PermissionStatus | null = null
    const handlePermissionChange = () => {
      if (active && permission) {
        setPermissionState(permission.state)
        void refreshDeviceList()
      }
    }

    void navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (!active) {
          return
        }
        permission = result
        setPermissionState(result.state)
        result.addEventListener('change', handlePermissionChange)
      })
      .catch(() => {
        if (active) {
          setPermissionState('unsupported')
        }
      })

    return () => {
      active = false
      permission?.removeEventListener('change', handlePermissionChange)
    }
  }, [refreshDeviceList])

  return {
    microphones,
    speakers,
    permissionState,
    listStatus,
    outputSelectionSupported,
    refresh,
  }
}
