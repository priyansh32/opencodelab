import { MAX_CODE_LENGTH } from '@/config'

export const RuntimeCapabilities = () => {
  return (
    <section className='surface'>
      <header className='section-header'>
        <div>
          <h2>Execution Contract</h2>
          <p>Capabilities exposed by current backend API.</p>
        </div>
      </header>

      <dl className='capability-list'>
        <div>
          <dt>Accepted payload</dt>
          <dd><code>{'{ language, code }'}</code> via <code>POST /producer</code></dd>
        </div>
        <div>
          <dt>Code size limit</dt>
          <dd>{MAX_CODE_LENGTH.toLocaleString()} characters max</dd>
        </div>
        <div>
          <dt>Status endpoints</dt>
          <dd><code>/consumer</code> and <code>/consumer/stream</code> (SSE + polling fallback)</dd>
        </div>
        <div>
          <dt>Worker limits</dt>
          <dd>Approx. 2s runtime timeout, plus C/C++ compile timeout paths</dd>
        </div>
        <div>
          <dt>Not supported today</dt>
          <dd>stdin, command-line args, environment vars, custom resource limits</dd>
        </div>
      </dl>
    </section>
  )
}
