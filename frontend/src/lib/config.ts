const DEFAULT_API_URL = 'https://api-hackathon.dangpham.id.vn'
const DEFAULT_LIVEKIT_URL = 'wss://livekit-hackathon.dangpham.id.vn'

const normalizeBaseUrl = (value: string | undefined, fallback: string) =>
  (value?.trim() || fallback).replace(/\/+$/, '')

export const API_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL,
  DEFAULT_API_URL,
)

export const SOCKET_URL = normalizeBaseUrl(
  import.meta.env.VITE_SOCKET_URL,
  API_URL,
)

export const LIVEKIT_URL = normalizeBaseUrl(
  import.meta.env.VITE_LIVEKIT_URL,
  DEFAULT_LIVEKIT_URL,
)
