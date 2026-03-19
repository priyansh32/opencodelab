import { EditorWorkspace } from '@/components/EditorWorkspace'
import { ExecutionOverview } from '@/components/ExecutionOverview'
import { ExecutionOutput } from '@/components/ExecutionOutput'
import { HistoryPanel } from '@/components/HistoryPanel'
import { RuntimeCapabilities } from '@/components/RuntimeCapabilities'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useExecutionRunner } from '@/hooks/useExecutionRunner'
import { useTheme } from '@/hooks/useTheme'

const App = () => {
  const {
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
    codeLength,
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
  } = useExecutionRunner()

  const { theme, toggleTheme } = useTheme()

  return (
    <div className='app-shell'>
      <div className='ambient ambient--one' aria-hidden='true' />
      <div className='ambient ambient--two' aria-hidden='true' />

      <header className='app-header'>
        <div>
          <p className='eyebrow'>OpenCodeLab</p>
          <h1>Remote Executor Console</h1>
          <p className='subtitle'>
            Production-ready client for asynchronous sandbox execution, live status streaming, and run observability.
          </p>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className='app-grid'>
        <div className='layout-column layout-column--editor'>
          <div className='editor-terminal-stack'>
            <EditorWorkspace
              theme={theme}
              language={language}
              code={code}
              codeLength={codeLength}
              isSubmitting={isSubmitting}
              validationMessage={codeValidationMessage}
              onLanguageChange={(nextLanguage) => {
                setLanguage(nextLanguage)
              }}
              onCodeChange={setCode}
              onRun={() => {
                void runExecution()
              }}
              onLoadStarter={loadStarterTemplate}
              onClear={clearEditor}
            />
            <ExecutionOutput
              output={output}
              status={status}
              failureKind={failureKind}
              latestEvent={latestEvent}
            />
          </div>
        </div>

        <aside className='layout-column layout-column--sidebar'>
          <ExecutionOverview
            executionID={executionID}
            watchExecutionID={watchExecutionID}
            status={status}
            streamState={streamState}
            failureKind={failureKind}
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            updatedAt={lastUpdatedAt}
            onWatchExecutionIDChange={setWatchExecutionID}
            onWatch={watchExecution}
            onStop={stopWatching}
          />
          <RuntimeCapabilities />
          <HistoryPanel
            history={history}
            currentExecutionID={executionID}
            onWatchExecution={(historyExecutionID) => {
              setWatchExecutionID(historyExecutionID)
              watchExecutionByID(historyExecutionID)
            }}
            onClearHistory={clearHistory}
          />
        </aside>
      </main>
    </div>
  )
}

export default App
