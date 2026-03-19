import {
  type FailureKind,
  type StreamState,
  type SupportedLanguage,
  type UiExecutionStatus
} from '@/types/execution'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface StatusPresentation {
  label: string
  detail: string
  tone: StatusTone
}

const COMPILE_ERROR_PATTERNS = [
  /error:/i,
  /undefined reference/i,
  /compilation/i,
  /ld returned/i,
  /collect2/i
]

const inferCompileError = (language: SupportedLanguage, body: string): boolean => {
  if (!['c', 'cpp', 'c++'].includes(language)) {
    return false
  }

  return COMPILE_ERROR_PATTERNS.some((pattern) => pattern.test(body))
}

export const classifyFailureKind = (
  status: UiExecutionStatus,
  language: SupportedLanguage,
  body: string,
  streamState: StreamState
): FailureKind => {
  if (streamState === 'disconnected') {
    return 'network_disconnected'
  }

  if (status === 'timeout') {
    return 'timeout'
  }

  if (status === 'invalid_request') {
    return 'invalid_request'
  }

  if (status === 'backend_unavailable') {
    return 'backend_unavailable'
  }

  if (status === 'failed') {
    return inferCompileError(language, body) ? 'compile_error' : 'runtime_error'
  }

  return 'none'
}

export const getExecutionStatusPresentation = (
  status: UiExecutionStatus,
  failureKind: FailureKind
): StatusPresentation => {
  switch (status) {
    case 'idle':
      return {
        label: 'Ready',
        detail: 'Choose a language, edit code, and run.',
        tone: 'neutral'
      }
    case 'submitting':
      return {
        label: 'Submitting',
        detail: 'Request is being sent to the queue.',
        tone: 'info'
      }
    case 'queued':
      return {
        label: 'Queued',
        detail: 'Waiting for sandbox worker pickup.',
        tone: 'info'
      }
    case 'completed':
      return {
        label: 'Completed',
        detail: 'Execution finished successfully.',
        tone: 'success'
      }
    case 'failed':
      if (failureKind === 'compile_error') {
        return {
          label: 'Compile Error',
          detail: 'Build step failed before runtime execution.',
          tone: 'danger'
        }
      }

      return {
        label: 'Runtime Error',
        detail: 'Program exited with a non-zero result.',
        tone: 'danger'
      }
    case 'timeout':
      return {
        label: 'Timed Out',
        detail: 'Execution exceeded sandbox time limits.',
        tone: 'warning'
      }
    case 'invalid_request':
      return {
        label: 'Invalid Request',
        detail: 'Execution ID is missing or malformed.',
        tone: 'danger'
      }
    case 'backend_unavailable':
      return {
        label: 'Backend Unavailable',
        detail: 'Status service is temporarily unreachable.',
        tone: 'danger'
      }
    default:
      return {
        label: 'Unknown',
        detail: 'Unexpected status response from backend.',
        tone: 'warning'
      }
  }
}

export const getStreamStatePresentation = (state: StreamState): StatusPresentation => {
  switch (state) {
    case 'stopped':
      return {
        label: 'Stopped',
        detail: 'No active status subscription.',
        tone: 'neutral'
      }
    case 'connecting':
      return {
        label: 'Connecting',
        detail: 'Opening real-time status stream.',
        tone: 'info'
      }
    case 'streaming':
      return {
        label: 'Streaming',
        detail: 'Receiving live execution events over SSE.',
        tone: 'success'
      }
    case 'polling':
      return {
        label: 'Polling Fallback',
        detail: 'SSE interrupted, polling status endpoint.',
        tone: 'warning'
      }
    case 'disconnected':
      return {
        label: 'Disconnected',
        detail: 'Network issue detected while checking execution status.',
        tone: 'danger'
      }
    default:
      return {
        label: 'Unknown',
        detail: 'Transport state is not recognized.',
        tone: 'warning'
      }
  }
}
