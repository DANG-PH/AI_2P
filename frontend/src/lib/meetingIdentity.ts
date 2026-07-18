import { createEntityId } from '@/lib/utils'

const CLIENT_ID_STORAGE_KEY = 'vienmeet-client-id'

export const createRoomId = (): string => {
  const entityId = createEntityId('room')
  const randomPart = entityId.replaceAll('-', '').slice(-12)

  return `room-${randomPart}`
}

export const getOrCreateClientId = (): string => {
  if (typeof window === 'undefined') {
    return createEntityId('client')
  }

  try {
    const savedClientId = window.localStorage
      .getItem(CLIENT_ID_STORAGE_KEY)
      ?.trim()

    if (savedClientId) {
      return savedClientId
    }

    const clientId = createEntityId('client')
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId)
    return clientId
  } catch {
    return createEntityId('client')
  }
}
