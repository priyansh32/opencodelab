import { useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'

import { MAX_CODE_LENGTH } from '@/config'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/types/execution'
import { type Theme } from '@/hooks/useTheme'

interface EditorWorkspaceProps {
  theme: Theme
  language: SupportedLanguage
  code: string
  codeLength: number
  isSubmitting: boolean
  validationMessage: string | null
  onLanguageChange: (language: SupportedLanguage) => void
  onCodeChange: (code: string) => void
  onRun: () => void
  onLoadStarter: () => void
  onClear: () => void
}

const languageToMonacoMap: Record<SupportedLanguage, string> = {
  javascript: 'javascript',
  python: 'python',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp'
}

export const EditorWorkspace = ({
  theme,
  language,
  code,
  codeLength,
  isSubmitting,
  validationMessage,
  onLanguageChange,
  onCodeChange,
  onRun,
  onLoadStarter,
  onClear
}: EditorWorkspaceProps) => {
  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
    editor.focus()

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun()
    })
  }, [onRun])

  return (
    <section className='surface surface--editor'>
      <header className='section-header'>
        <div>
          <h2>Workspace</h2>
          <p>Write code and submit with <kbd>Ctrl/Cmd + Enter</kbd>.</p>
        </div>
        <div className='section-header__actions'>
          <button
            type='button'
            className='button button--primary'
            onClick={onRun}
            disabled={isSubmitting || validationMessage != null}
          >
            {isSubmitting ? 'Submitting...' : 'Run Execution'}
          </button>
        </div>
      </header>

      <div className='editor-toolbar'>
        <label className='field'>
          <span className='field__label'>Language</span>
          <select
            className='input'
            value={language}
            onChange={(event) => {
              onLanguageChange(event.target.value as SupportedLanguage)
            }}
          >
            {SUPPORTED_LANGUAGES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <div className='editor-toolbar__meta'>
          <div className='char-counter'>
            {codeLength.toLocaleString()} / {MAX_CODE_LENGTH.toLocaleString()} chars
          </div>
          <button type='button' className='button button--ghost' onClick={onLoadStarter}>
            Load Starter
          </button>
          <button type='button' className='button button--ghost' onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      {validationMessage != null && (
        <div className='inline-alert inline-alert--danger' role='alert'>
          {validationMessage}
        </div>
      )}

      <div className='editor-shell' aria-label='Code editor'>
        <Editor
          height='58vh'
          language={languageToMonacoMap[language]}
          value={code}
          onMount={handleEditorMount}
          onChange={(value) => {
            onCodeChange(value ?? '')
          }}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            automaticLayout: true,
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
            fontLigatures: true,
            fontSize: 14,
            minimap: { enabled: false },
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'on',
            ariaLabel: 'Execution code editor'
          }}
        />
      </div>
    </section>
  )
}
