import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MAX_CODE_LENGTH } from '@/config'
import { STARTER_TEMPLATES } from '@/constants/templates'
import { ExecutorAPIError, createExecutionStream, fetchExecutionStatus, submitExecution } from '@/services/executorApi'
import {
  type ExecutionStatus,
  type ExecutionStatusPayload,
  type FailureKind,
  type RunHistoryEntry,
  type StreamState,
  type SupportedLanguage,
  type UiExecutionStatus,
  TERMINAL_STATUSES
} from '@/types/execution'
import { upsertHistoryEntry, loadRunHistory, saveRunHistory } from '@/utils/storage'
import { classifyFailureKind } from '@/utils/status'
import { nowISO } from '@/utils/time'

const POLL_INTERVAL_MS = 1500
const EXECUTION_ID_PATTERN = /^[a-zA-Z0-9-]{8,}$/

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ExecutorAPIError) {
    return error.message
  }

  if (error instanceof Error && error.message !== '') {
    return error.message
  }

  return fallback
}

const getOutputFromPayload = (payload: ExecutionStatusPayload): string => {
  if (typeof payload.body === 'string') {
    return payload.body
  }

  if (typeof payload.error === 'string') {
    return payload.error
  }

  return ''
}

const isTerminal = (status: UiExecutionStatus): status is ExecutionStatus => {
  return TERMINAL_STATUSES.has(status as ExecutionStatus)
}

const initialHistory = loadRunHistory()

export interface UseExecutionRunnerResult {
  language: SupportedLanguage
  code: string
  watchExecutionID: string
  executionID: string
  status: UiExecutionStatus
  streamState: StreamState
  failureKind: FailureKind
  output: string
  latestEvent: ExecutionStatusPayload | null
  errorMessage: string | null
  codeLength: number
  codeValidationMessage: string | null
  isSubmitting: boolean
  lastUpdatedAt: string | null
  history: RunHistoryEntry[]
  setLanguage: (language: SupportedLanguage) => void
  setCode: (code: string) => void
  setWatchExecutionID: (executionID: string) => void
  runExecution: () => Promise<void>
  watchExecution: () => void
  watchExecutionByID: (executionID: string) => void
  stopWatching: () => void
  loadStarterTemplate: () => void
  clearEditor: () => void
  clearHistory: () => void
}

export const useExecutionRunner = (): UseExecutionRunnerResult => {
  const [language, setLanguage] = useState<SupportedLanguage>('javascript')
  const [code, setCode] = useState<string>(STARTER_TEMPLATES.javascript)
  const [watchExecutionID, setWatchExecutionID] = useState('')

  const [executionID, setExecutionID] = useState('')
  const [status, setStatus] = useState<UiExecutionStatus>('idle')
  const [streamState, setStreamState] = useState<StreamState>('stopped')
  const [failureKind, setFailureKind] = useState<FailureKind>('none')
  const [output, setOutput] = useState('')
  const [latestEvent, setLatestEvent] = useState<ExecutionStatusPayload | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [history, setHistory] = useState<RunHistoryEntry[]>(initialHistory)

  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const pollingEnabledRef = useRef(false)
  const latestStatusRef = useRef<UiExecutionStatus>('idle')
  const activeExecutionIDRef = useRef<string>('')
  const executionLanguageRef = useRef<Map<string, SupportedLanguage>>(new Map())

  useEffect(() => {
    for (const entry of initialHistory) {
      executionLanguageRef.current.set(entry.executionID, entry.language)
    }
  }, [])

  const persistHistory = useCallback((updateFn: (entries: RunHistoryEntry[]) => RunHistoryEntry[]) => {
    setHistory((currentEntries) => {
      const nextEntries = updateFn(currentEntries)
      saveRunHistory(nextEntries)
      return nextEntries
    })
  }, [])

  const setExecutionStatus = useCallback((nextStatus: UiExecutionStatus) => {
    latestStatusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const stopPolling = useCallback(() => {
    pollingEnabledRef.current = false
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    if (eventSourceRef.current != null) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const stopWatcher = useCallback((nextState: StreamState = 'stopped') => {
    stopPolling()
    stopStream()
    setStreamState(nextState)
  }, [stopPolling, stopStream])

  const updateHistoryForExecution = useCallback((
    execution: string,
    executionStatus: ExecutionStatus,
    executionOutput: string,
    updatedAt: string,
    fallbackLanguage: SupportedLanguage
  ) => {
    persistHistory((entries) => {
      const existing = entries.find((entry) => entry.executionID === execution)
      const nextEntry: RunHistoryEntry = {
        executionID: execution,
        language: existing?.language ?? fallbackLanguage,
        status: executionStatus,
        startedAt: existing?.startedAt ?? updatedAt,
        updatedAt,
        outputPreview: executionOutput.slice(0, 1200)
      }

      return upsertHistoryEntry(entries, nextEntry)
    })
  }, [persistHistory])

  const applyStatusPayload = useCallback((payload: ExecutionStatusPayload) => {
    const execution = payload.correlationID || activeExecutionIDRef.current
    const updatedAt = payload.updatedAt ?? nowISO()
    const executionOutput = getOutputFromPayload(payload)
    const statusValue = payload.status
    const executionLanguage = executionLanguageRef.current.get(execution) ?? language

    setLatestEvent(payload)
    setLastUpdatedAt(updatedAt)
    setOutput(executionOutput)
    setExecutionStatus(statusValue)
    setFailureKind(classifyFailureKind(statusValue, executionLanguage, executionOutput, 'streaming'))
    setErrorMessage(null)

    if (execution !== '') {
      updateHistoryForExecution(execution, statusValue, executionOutput, updatedAt, executionLanguage)
    }

    if (TERMINAL_STATUSES.has(statusValue)) {
      stopWatcher('stopped')
    }
  }, [language, setExecutionStatus, stopWatcher, updateHistoryForExecution])

  const pollStatus = useCallback((execution: string) => {
    if (!pollingEnabledRef.current) {
      return
    }

    void (async () => {
      try {
        const payload = await fetchExecutionStatus(execution)
        setStreamState('polling')
        applyStatusPayload(payload)
      } catch (error) {
        setFailureKind('network_disconnected')
        setStreamState('disconnected')
        setErrorMessage(`Status polling interrupted: ${getErrorMessage(error, 'Unknown error')}`)
      }

      if (!pollingEnabledRef.current || isTerminal(latestStatusRef.current)) {
        return
      }

      pollTimerRef.current = window.setTimeout(() => {
        pollStatus(execution)
      }, POLL_INTERVAL_MS)
    })()
  }, [applyStatusPayload])

  const startPollingFallback = useCallback((execution: string) => {
    stopStream()
    stopPolling()

    pollingEnabledRef.current = true
    setStreamState('polling')
    pollStatus(execution)
  }, [pollStatus, stopPolling, stopStream])

  const startStreaming = useCallback((execution: string) => {
    stopWatcher('connecting')
    setStreamState('connecting')

    const source = createExecutionStream(execution)
    eventSourceRef.current = source

    source.onopen = () => {
      setStreamState('streaming')
      setErrorMessage(null)
    }

    source.addEventListener('status', (event) => {
      try {
        const payload = JSON.parse(event.data) as ExecutionStatusPayload
        applyStatusPayload(payload)
      } catch {
        setFailureKind('network_disconnected')
        setErrorMessage('Received malformed stream event payload')
      }
    })

    source.onerror = () => {
      stopStream()

      if (isTerminal(latestStatusRef.current)) {
        setStreamState('stopped')
        return
      }

      startPollingFallback(execution)
    }
  }, [applyStatusPayload, startPollingFallback, stopStream, stopWatcher])

  const beginExecutionWatch = useCallback((execution: string, executionLanguage: SupportedLanguage) => {
    activeExecutionIDRef.current = execution
    executionLanguageRef.current.set(execution, executionLanguage)

    setExecutionID(execution)
    setWatchExecutionID(execution)
    setLatestEvent(null)
    setLastUpdatedAt(nowISO())
    setExecutionStatus('queued')
    setFailureKind('none')
    setErrorMessage(null)

    const startedAt = nowISO()
    updateHistoryForExecution(execution, 'queued', '', startedAt, executionLanguage)
    startStreaming(execution)
  }, [setExecutionStatus, startStreaming, updateHistoryForExecution])

  const codeValidationMessage = useMemo(() => {
    if (code.trim() === '') {
      return 'Code cannot be empty.'
    }

    if (code.length > MAX_CODE_LENGTH) {
      return `Code exceeds max length of ${MAX_CODE_LENGTH.toLocaleString()} characters.`
    }

    return null
  }, [code])

  const runExecution = useCallback(async () => {
    if (codeValidationMessage != null) {
      setFailureKind('invalid_request')
      setErrorMessage(codeValidationMessage)
      return
    }

    setIsSubmitting(true)
    setExecutionStatus('submitting')
    setStreamState('connecting')
    setFailureKind('none')
    setErrorMessage(null)
    setOutput('Submitting execution request...')
    setLastUpdatedAt(nowISO())

    try {
      const nextExecutionID = await submitExecution({ language, code })
      beginExecutionWatch(nextExecutionID, language)
      setOutput('Execution accepted. Waiting for sandbox output...')
    } catch (error) {
      setExecutionStatus('idle')
      setStreamState('disconnected')
      setFailureKind('network_disconnected')
      setErrorMessage(getErrorMessage(error, 'Unable to submit execution request'))
    } finally {
      setIsSubmitting(false)
    }
  }, [beginExecutionWatch, code, codeValidationMessage, language, setExecutionStatus])

  const watchExecutionByID = useCallback((rawExecutionID: string) => {
    const nextExecutionID = rawExecutionID.trim()

    if (nextExecutionID === '') {
      setFailureKind('invalid_request')
      setErrorMessage('Provide an execution ID to watch.')
      return
    }

    if (!EXECUTION_ID_PATTERN.test(nextExecutionID)) {
      setFailureKind('invalid_request')
      setErrorMessage('Execution ID format is invalid.')
      return
    }

    const historyEntry = history.find((entry) => entry.executionID === nextExecutionID)
    const executionLanguage = historyEntry?.language ?? language

    setOutput('Watching execution status...')
    beginExecutionWatch(nextExecutionID, executionLanguage)
  }, [beginExecutionWatch, history, language])

  const watchExecution = useCallback(() => {
    watchExecutionByID(watchExecutionID)
  }, [watchExecutionByID, watchExecutionID])

  const clearHistory = useCallback(() => {
    persistHistory(() => [])
  }, [persistHistory])

  const loadStarterTemplate = useCallback(() => {
    setCode(STARTER_TEMPLATES[language])
  }, [language])

  const clearEditor = useCallback(() => {
    setCode('')
  }, [])

  const stopWatching = useCallback(() => {
    stopWatcher('stopped')
  }, [stopWatcher])

  useEffect(() => {
    return () => {
      stopWatcher('stopped')
    }
  }, [stopWatcher])

  return {
    language,
    code,
    watchExecutionID,
    executionID,
    status,
    streamState,
    failureKind,
    output,
    latestEvent,
    errorMessage,
    codeLength: code.length,
    codeValidationMessage,
    isSubmitting,
    lastUpdatedAt,
    history,
    setLanguage,
    setCode,
    setWatchExecutionID,
    runExecution,
    watchExecution,
    watchExecutionByID,
    stopWatching,
    loadStarterTemplate,
    clearEditor,
    clearHistory
  }
}
