const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}

const normalizeBaseURL = (value: string | undefined): string => {
  if (value == null) {
    return ''
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return ''
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export const EXECUTOR_BASE_URL = normalizeBaseURL(import.meta.env.VITE_EXECUTOR_BASE_URL)
export const ACCEPT_VERSION = (import.meta.env.VITE_ACCEPT_VERSION ?? '1').trim() || '1'
export const MAX_CODE_LENGTH = parsePositiveInteger(import.meta.env.VITE_MAX_CODE_LENGTH, 10000)
export const HISTORY_STORAGE_KEY = 'opencodelab.client.history.v1'
export const HISTORY_LIMIT = 25
export const OUTPUT_PREVIEW_LIMIT = 350000
