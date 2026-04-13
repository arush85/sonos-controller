import { useState } from 'react'
import { Plus, Trash2, Clock } from 'lucide-react'
import { formatNextActivation } from '../hooks/useScheduler'
import ToggleSwitch from './ToggleSwitch'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number)
  const period = hh >= 12 ? 'PM' : 'AM'
  const h = hh % 12 || 12
  return { time: `${h}:${String(mm).padStart(2, '0')}`, period }
}

function ScheduleForm({ profiles, onAdd, onCancel }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id || '')
  const [days, setDays] = useState([1, 2, 3, 4, 5]) // Mon-Fri default
  const [time, setTime] = useState('21:00')

  const toggleDay = (d) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    )
  }

  const handleAdd = () => {
    if (!profileId) return
    if (days.length === 0) { alert('Select at least one day.'); return }
    onAdd({ profileId, days, time, enabled: true })
  }

  return (
    <div className="settings-card" style={{ marginBottom: 16 }}>
      <div className="form-group">
        <label className="form-label">Profile</label>
        <select
          className="form-input"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.length === 0 && (
            <option value="">No profiles available</option>
          )}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Days</label>
        <div className="day-picker">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              className={`day-chip ${days.includes(i) ? 'selected' : ''}`}
              onClick={() => toggleDay(i)}
              title={DAY_FULL[i]}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Time</label>
        <input
          className="form-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleAdd} style={{ flex: 1 }}>
          Add Schedule
        </button>
      </div>
    </div>
  )
}

export default function Scheduler({ schedules, profiles, onAdd, onUpdate, onDelete, onLog }) {
  const [showForm, setShowForm] = useState(false)

  const getProfileName = (id) =>
    profiles.find((p) => p.id === id)?.name || 'Unknown Profile'

  const handleAdd = (data) => {
    onAdd(data)
    setShowForm(false)
  }

  return (
    <div className="scheduler-page">
      <div className="scheduler-header">
        <h2 className="page-title">Schedule</h2>
        {!showForm && (
          <button className="add-btn" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Add
          </button>
        )}
      </div>

      {showForm && (
        <ScheduleForm
          profiles={profiles}
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {schedules.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Clock size={48} strokeWidth={1} />
          </div>
          <div className="empty-state-title">No schedules yet</div>
          <div className="empty-state-desc">
            Add a schedule to automatically apply profiles at specific times.
          </div>
        </div>
      ) : (
        <div className="schedule-list">
          {schedules.map((schedule) => {
            const { time, period } = formatTime(schedule.time)
            const nextLabel = formatNextActivation(schedule)
            return (
              <div
                key={schedule.id}
                className={`schedule-card ${schedule.enabled ? 'enabled' : ''}`}
              >
                <div className="schedule-time-block">
                  <div className="schedule-time">{time}</div>
                  <div className="schedule-ampm">{period}</div>
                </div>

                <div className="schedule-divider" />

                <div className="schedule-info">
                  <div className="schedule-profile-name">
                    {getProfileName(schedule.profileId)}
                  </div>
                  <div className="schedule-days">
                    {DAY_LABELS.map((label, i) => (
                      <div
                        key={i}
                        className={`day-pip ${schedule.days.includes(i) ? 'active' : ''}`}
                        title={DAY_FULL[i]}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  {nextLabel && schedule.enabled && (
                    <div className="schedule-next">Next: {nextLabel}</div>
                  )}
                  {!schedule.enabled && (
                    <div className="schedule-next" style={{ color: 'var(--text-muted)' }}>
                      Disabled
                    </div>
                  )}
                </div>

                <div className="schedule-actions">
                  <ToggleSwitch
                    checked={schedule.enabled}
                    onChange={(newEnabled) => {
                      onLog?.({
                        type: 'setting_toggled',
                        action: newEnabled ? 'Schedule Enabled' : 'Schedule Disabled',
                        what: `${getProfileName(schedule.profileId)} at ${schedule.time}`,
                        before: schedule.enabled,
                        after: newEnabled,
                      })
                      onUpdate(schedule.id, { enabled: newEnabled })
                    }}
                    style={{ width: 40, height: 24 }}
                    trackStyle={{ borderRadius: 12 }}
                    thumbStyle={{
                      width: 18,
                      height: 18,
                      top: 3,
                      left: 3,
                      transform: schedule.enabled ? 'translateX(16px)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />

                  <button
                    className="icon-btn danger"
                    onClick={() => onDelete(schedule.id)}
                    title="Delete schedule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
