import { useMemo, useState } from 'react'

import { OUTPUT_PREVIEW_LIMIT } from '@/config'
import { type ExecutionStatusPayload, type FailureKind, type UiExecutionStatus } from '@/types/execution'
import { getExecutionStatusPresentation } from '@/utils/status'

interface ExecutionOutputProps {
  output: string
  status: UiExecutionStatus
  failureKind: FailureKind
  latestEvent: ExecutionStatusPayload | null
}

type OutputTab = 'output' | 'event'

const getPrettyJSON = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const ExecutionOutput = ({
  output,
  status,
  failureKind,
  latestEvent
}: ExecutionOutputProps) => {
  const [activeTab, setActiveTab] = useState<OutputTab>('output')
  const [wrapLines, setWrapLines] = useState(false)

  const statusPresentation = getExecutionStatusPresentation(status, failureKind)

  const outputText = useMemo(() => {
    if (output === '') {
      if (status === 'idle') {
        return 'Submit code or watch an execution ID to see output.'
      }

      if (status === 'submitting' || status === 'queued') {
        return 'Waiting for sandbox output...'
      }

      return 'No output was returned by the executor.'
    }

    if (output.length <= OUTPUT_PREVIEW_LIMIT) {
      return output
    }

    const omittedChars = output.length - OUTPUT_PREVIEW_LIMIT
    return `[Output truncated for UI stability: omitted ${omittedChars.toLocaleString()} characters]\n\n${output.slice(-OUTPUT_PREVIEW_LIMIT)}`
  }, [output, status])

  const copyCurrentView = async (): Promise<void> => {
    const content = activeTab === 'output'
      ? outputText
      : getPrettyJSON(latestEvent ?? { message: 'No events received yet.' })

    await navigator.clipboard.writeText(content)
  }

  const downloadOutput = (): void => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = 'execution-output.txt'
    anchor.click()
    URL.revokeObjectURL(href)
  }

  return (
    <section className='surface output-surface'>
      <header className='section-header'>
        <div>
          <h2>Terminal</h2>
          <p>{statusPresentation.detail}</p>
        </div>
        <div className='section-header__actions'>
          <button type='button' className='button button--ghost' onClick={() => setWrapLines((prev) => !prev)}>
            Wrap {wrapLines ? 'Off' : 'On'}
          </button>
          <button
            type='button'
            className='button button--ghost'
            onClick={() => {
              void copyCurrentView()
            }}
          >
            Copy
          </button>
          <button
            type='button'
            className='button button--ghost'
            onClick={downloadOutput}
            disabled={output === ''}
          >
            Download
          </button>
        </div>
      </header>

      <div className='tab-row' role='tablist' aria-label='Output panels'>
        <button
          type='button'
          className={`tab ${activeTab === 'output' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('output')}
          role='tab'
          aria-selected={activeTab === 'output'}
        >
          Program Output
        </button>
        <button
          type='button'
          className={`tab ${activeTab === 'event' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('event')}
          role='tab'
          aria-selected={activeTab === 'event'}
        >
          Latest Event
        </button>
      </div>

      <div className='output-meta'>
        <span>{output.length.toLocaleString()} characters</span>
        {output.length > OUTPUT_PREVIEW_LIMIT && <span>Showing trailing {OUTPUT_PREVIEW_LIMIT.toLocaleString()} characters.</span>}
      </div>

      {activeTab === 'output'
        ? (
          <pre className={`output-panel ${wrapLines ? 'output-panel--wrap' : ''}`}>{outputText}</pre>
          )
        : (
          <pre className='output-panel output-panel--wrap'>{getPrettyJSON(latestEvent ?? { message: 'No events received yet.' })}</pre>
          )}
    </section>
  )
}
