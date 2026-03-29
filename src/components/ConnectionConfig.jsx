import { useState } from 'react'
import { CheckCircle, XCircle, Wifi } from 'lucide-react'

export default function ConnectionConfig({ config, onSave, onTest, testing }) {
  const [form, setForm] = useState({ ...config })
  const [testResult, setTestResult] = useState(null)
  const [saved, setSaved] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setTestResult(null)
    setSaved(false)
  }

  const handleTest = async () => {
    setTestResult(null)
    const result = await onTest(form)
    setTestResult(result)
  }

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-card">
      <div className="form-group">
        <label className="form-label">Host / IP Address</label>
        <input
          className="form-input"
          type="text"
          placeholder=""
          value={form.host}
          onChange={set('host')}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Port</label>
        <input
          className="form-input"
          type="number"
          placeholder="5005"
          value={form.port}
          onChange={set('port')}
          min={1}
          max={65535}
          inputMode="numeric"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Room Name</label>
        <input
          className="form-input"
          type="text"
          placeholder="My Room"
          value={form.room}
          onChange={set('room')}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Must match the room name exactly in your Sonos app
        </span>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
          {testResult.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
          <span>{testResult.message}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={handleTest}
          disabled={testing}
          style={{ flex: 1 }}
        >
          {testing ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14 }} />
              Testing…
            </>
          ) : (
            <>
              <Wifi size={15} />
              Test Connection
            </>
          )}
        </button>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          style={{ flex: 1 }}
        >
          {saved ? '✓ Saved' : 'Save Config'}
        </button>
      </div>

      <div
        style={{
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          borderLeft: '2px solid var(--border)',
        }}
      >
        <strong style={{ color: 'var(--text-secondary)' }}>CORS Note:</strong> If you
        get connection errors, node-sonos-http-api needs CORS enabled. Start it with{' '}
        <code
          style={{
            background: 'var(--bg-card)',
            padding: '1px 5px',
            borderRadius: 3,
            fontFamily: 'monospace',
          }}
        >
          node server.js --cors
        </code>{' '}
        or add{' '}
        <code
          style={{
            background: 'var(--bg-card)',
            padding: '1px 5px',
            borderRadius: 3,
            fontFamily: 'monospace',
          }}
        >
          "allowCORS": true
        </code>{' '}
        to its <code style={{ background: 'var(--bg-card)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace' }}>settings.json</code>.
      </div>
    </div>
  )
}
