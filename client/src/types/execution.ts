export const SUPPORTED_LANGUAGES = ['javascript', 'python', 'c', 'cpp', 'c++'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type ExecutionStatus =
  | 'queued'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'invalid_request'
  | 'backend_unavailable'

export type UiExecutionStatus = ExecutionStatus | 'idle' | 'submitting'

export type StreamState =
  | 'stopped'
  | 'connecting'
  | 'streaming'
  | 'polling'
  | 'disconnected'

export type FailureKind =
  | 'none'
  | 'compile_error'
  | 'runtime_error'
  | 'timeout'
  | 'invalid_request'
  | 'backend_unavailable'
  | 'network_disconnected'

export const TERMINAL_STATUSES = new Set<ExecutionStatus>(['completed', 'failed', 'timeout'])

export interface ProducerPayload {
  language: SupportedLanguage
  code: string
}

export interface ProducerResponseEnvelope {
  success: boolean
  message: string
  data?: {
    executionID: string
    statusEndpoint: string
    streamEndpoint: string
    testClientEndpoint: string
  }
}

export interface ExecutionStatusPayload {
  correlationID: string
  exists: boolean
  status: ExecutionStatus
  body?: string
  error?: string
  updatedAt?: string
}

export type StatusSource = 'stream' | 'poll'

export interface RunHistoryEntry {
  executionID: string
  language: SupportedLanguage
  status: ExecutionStatus
  startedAt: string
  updatedAt: string
  outputPreview: string
}
