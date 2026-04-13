import { memo } from 'react'
import { Trash2 } from 'lucide-react'

function formatTimestamp(ts) {
  const d = new Date(ts)
  const today = new Date()
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  if (isToday) return time
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    time
  )
}

function formatValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  return String(value)
}

// ⚡ Bolt: Wrapped in React.memo to prevent unnecessary re-renders when parent lists update
const LogEntry = memo(function LogEntry({ entry }) {
  const typeLabelMap = {
    profile_applied: 'Profile',
    schedule_fired: 'Schedule',
    setting_toggled: 'Setting',
  }
  const typeLabel = typeLabelMap[entry.type] || entry.type
  const hasBefore = entry.before !== undefined && entry.before !== null
  const hasAfter = entry.after !== undefined && entry.after !== null

  return (
    <div className="log-entry">
      <div className="log-entry-header">
        <span className={`log-badge log-badge--${entry.type}`}>{typeLabel}</span>
        <span className="log-entry-action">{entry.action}</span>
        <span className="log-entry-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-entry-body">
        <span className="log-entry-what">{entry.what}</span>
        {(hasBefore || hasAfter) && (
          <div className="log-entry-diff">
            <span className="log-value log-value--before">{formatValue(entry.before)}</span>
            <span className="log-arrow">→</span>
            <span className="log-value log-value--after">{formatValue(entry.after)}</span>
          </div>
        )}
      </div>
    </div>
  )
})

export default function ActivityLog({ entries, onClear }) {
  return (
    <div className="activity-log-page">
      <div className="activity-log-header">
        <h2 className="page-title">Activity Log</h2>
        {entries.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={onClear}
            style={{ padding: '8px 14px', minHeight: 36, fontSize: 13 }}
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No activity yet</div>
          <div className="empty-state-desc">
            Apply a profile, toggle a setting, or let a schedule fire to see entries here.
          </div>
        </div>
      ) : (
        <div className="log-list">
          {entries.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
