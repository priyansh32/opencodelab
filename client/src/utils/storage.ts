import { HISTORY_LIMIT, HISTORY_STORAGE_KEY } from '@/config'
import { type RunHistoryEntry } from '@/types/execution'

const isString = (value: unknown): value is string => typeof value === 'string'

const isRunHistoryEntry = (value: unknown): value is RunHistoryEntry => {
  if (value == null || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<RunHistoryEntry>
  return [
    isString(candidate.executionID),
    isString(candidate.language),
    isString(candidate.status),
    isString(candidate.startedAt),
    isString(candidate.updatedAt),
    isString(candidate.outputPreview)
  ].every(Boolean)
}

export const loadRunHistory = (): RunHistoryEntry[] => {
  try {
    const serialized = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (serialized == null || serialized === '') {
      return []
    }

    const parsed = JSON.parse(serialized) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isRunHistoryEntry).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export const saveRunHistory = (entries: RunHistoryEntry[]): void => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)))
  } catch {
    // Intentionally ignore quota/storage errors to avoid breaking execution UX.
  }
}

export const upsertHistoryEntry = (
  entries: RunHistoryEntry[],
  nextEntry: RunHistoryEntry
): RunHistoryEntry[] => {
  const filtered = entries.filter((entry) => entry.executionID !== nextEntry.executionID)
  return [nextEntry, ...filtered].slice(0, HISTORY_LIMIT)
}
