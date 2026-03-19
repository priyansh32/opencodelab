import { ACCEPT_VERSION, EXECUTOR_BASE_URL } from '@/config'
import {
  type ExecutionStatusPayload,
  type ProducerPayload,
  type ProducerResponseEnvelope
} from '@/types/execution'

interface APIErrorOptions {
  status: number
  payload?: unknown
}

export class ExecutorAPIError extends Error {
  readonly status: number
  readonly payload?: unknown

  constructor (message: string, options: APIErrorOptions) {
    super(message)
    this.name = 'ExecutorAPIError'
    this.status = options.status
    this.payload = options.payload
  }
}

const buildEndpoint = (path: string): string => {
  if (EXECUTOR_BASE_URL === '') {
    return path
  }

  return `${EXECUTOR_BASE_URL}${path}`
}

const parseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (text === '') {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const getMessageFromPayload = (payload: unknown, fallback: string): string => {
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload
  }

  if (payload != null && typeof payload === 'object') {
    const maybeMessage = (payload as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim() !== '') {
      return maybeMessage
    }
  }

  return fallback
}

export const submitExecution = async (payload: ProducerPayload): Promise<string> => {
  const response = await fetch(buildEndpoint('/producer'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept-version': ACCEPT_VERSION
    },
    body: JSON.stringify(payload)
  })

  const responseBody = await parseBody(response)

  if (!response.ok) {
    throw new ExecutorAPIError(
      getMessageFromPayload(responseBody, `Request failed with status ${response.status}`),
      {
        status: response.status,
        payload: responseBody
      }
    )
  }

  const envelope = responseBody as ProducerResponseEnvelope
  const executionID = envelope?.data?.executionID

  if (typeof executionID !== 'string' || executionID.trim() === '') {
    throw new ExecutorAPIError('Backend accepted request but did not return executionID', {
      status: response.status,
      payload: responseBody
    })
  }

  return executionID
}

export const fetchExecutionStatus = async (executionID: string): Promise<ExecutionStatusPayload> => {
  const response = await fetch(
    buildEndpoint(`/consumer?correlationID=${encodeURIComponent(executionID)}`)
  )

  const responseBody = await parseBody(response)

  if (typeof responseBody !== 'object' || responseBody == null) {
    throw new ExecutorAPIError('Invalid status payload from backend', {
      status: response.status,
      payload: responseBody
    })
  }

  if (!response.ok) {
    throw new ExecutorAPIError(
      getMessageFromPayload(responseBody, `Status lookup failed with ${response.status}`),
      {
        status: response.status,
        payload: responseBody
      }
    )
  }

  return responseBody as ExecutionStatusPayload
}

export const createExecutionStream = (executionID: string): EventSource => {
  return new EventSource(
    buildEndpoint(`/consumer/stream?correlationID=${encodeURIComponent(executionID)}`)
  )
}
