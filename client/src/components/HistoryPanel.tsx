import { type RunHistoryEntry } from '@/types/execution'
import { formatTimestamp } from '@/utils/time'
import { StatusBadge } from '@/components/StatusBadge'
import { getExecutionStatusPresentation } from '@/utils/status'

interface HistoryPanelProps {
  history: RunHistoryEntry[]
  currentExecutionID: string
  onWatchExecution: (executionID: string) => void
  onClearHistory: () => void
}

export const HistoryPanel = ({
  history,
  currentExecutionID,
  onWatchExecution,
  onClearHistory
}: HistoryPanelProps) => {
  return (
    <section className='surface'>
      <header className='section-header'>
        <div>
          <h2>Recent Runs</h2>
          <p>Stored locally in this browser for quick replay.</p>
        </div>
        <div className='section-header__actions'>
          <button
            type='button'
            className='button button--ghost'
            onClick={onClearHistory}
            disabled={history.length === 0}
          >
            Clear
          </button>
        </div>
      </header>

      {history.length === 0
        ? (
          <div className='empty-state'>No runs yet. Your recent executions will appear here.</div>
          )
        : (
          <ul className='history-list'>
            {history.map((entry) => {
              const statusPresentation = getExecutionStatusPresentation(entry.status, 'none')
              const isActive = entry.executionID === currentExecutionID

              return (
                <li key={entry.executionID} className={`history-item ${isActive ? 'history-item--active' : ''}`}>
                  <button
                    type='button'
                    className='history-item__button'
                    onClick={() => {
                      onWatchExecution(entry.executionID)
                    }}
                  >
                    <div className='history-item__top'>
                      <code>{entry.executionID}</code>
                      <StatusBadge label={statusPresentation.label} tone={statusPresentation.tone} />
                    </div>
                    <div className='history-item__meta'>
                      <span>{entry.language}</span>
                      <span>{formatTimestamp(entry.updatedAt)}</span>
                    </div>
                    <p className='history-item__preview'>
                      {entry.outputPreview === '' ? 'No output captured yet.' : entry.outputPreview}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
          )}
    </section>
  )
}
