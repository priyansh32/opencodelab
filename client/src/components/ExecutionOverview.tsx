import { type FailureKind, type StreamState, type UiExecutionStatus } from '@/types/execution'
import { getExecutionStatusPresentation, getStreamStatePresentation } from '@/utils/status'
import { formatTimestamp } from '@/utils/time'
import { StatusBadge } from '@/components/StatusBadge'

interface ExecutionOverviewProps {
  executionID: string
  watchExecutionID: string
  status: UiExecutionStatus
  streamState: StreamState
  failureKind: FailureKind
  errorMessage: string | null
  isSubmitting: boolean
  updatedAt: string | null
  onWatchExecutionIDChange: (value: string) => void
  onWatch: () => void
  onStop: () => void
}

export const ExecutionOverview = ({
  executionID,
  watchExecutionID,
  status,
  streamState,
  failureKind,
  errorMessage,
  isSubmitting,
  updatedAt,
  onWatchExecutionIDChange,
  onWatch,
  onStop
}: ExecutionOverviewProps) => {
  const executionPresentation = getExecutionStatusPresentation(status, failureKind)
  const streamPresentation = getStreamStatePresentation(streamState)

  return (
    <section className='surface'>
      <header className='section-header'>
        <div>
          <h2>Execution</h2>
          <p>Track status, stream health, and existing runs.</p>
        </div>
      </header>

      <div className='status-grid'>
        <article className='status-card'>
          <div className='status-card__title'>Run Status</div>
          <StatusBadge label={executionPresentation.label} tone={executionPresentation.tone} />
          <p>{executionPresentation.detail}</p>
        </article>

        <article className='status-card'>
          <div className='status-card__title'>Transport</div>
          <StatusBadge label={streamPresentation.label} tone={streamPresentation.tone} />
          <p>{streamPresentation.detail}</p>
        </article>
      </div>

      <div className='execution-meta'>
        <div>
          <span className='execution-meta__label'>Execution ID</span>
          <code className='execution-meta__value'>{executionID === '' ? 'Not started' : executionID}</code>
        </div>
        <div>
          <span className='execution-meta__label'>Last update</span>
          <span className='execution-meta__value'>{formatTimestamp(updatedAt ?? undefined)}</span>
        </div>
      </div>

      <div className='watch-form'>
        <label className='field'>
          <span className='field__label'>Watch Existing Execution ID</span>
          <input
            type='text'
            className='input input--mono'
            placeholder='Paste executionID'
            value={watchExecutionID}
            onChange={(event) => {
              onWatchExecutionIDChange(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onWatch()
              }
            }}
          />
        </label>
        <div className='watch-form__actions'>
          <button
            type='button'
            className='button button--secondary'
            onClick={onWatch}
            disabled={isSubmitting}
          >
            Watch Run
          </button>
          <button
            type='button'
            className='button button--ghost'
            onClick={onStop}
          >
            Stop Tracking
          </button>
        </div>
      </div>

      {errorMessage != null && (
        <div className='inline-alert inline-alert--danger' role='alert'>
          {errorMessage}
        </div>
      )}
    </section>
  )
}
