import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { LayoutGrid, Calendar, Settings, Plus, Music2, Download, History } from 'lucide-react'

import { useProfiles } from './hooks/useProfiles'
import { useSonosApi } from './hooks/useSonosApi'
import { useScheduler } from './hooks/useScheduler'
import { useSessionWatcher } from './hooks/useSessionWatcher'
import { useActivityLog } from './hooks/useActivityLog'

import QuickControls from './components/QuickControls'
import ProfileCard from './components/ProfileCard'
import ProfileEditor from './components/ProfileEditor'
import Scheduler from './components/Scheduler'
import ConnectionConfig from './components/ConnectionConfig'
import ActivityLog from './components/ActivityLog'

// ===== Toast System =====
let toastIdCounter = 0

function Toast({ toast }) {
  return (
    <div className={`toast ${toast.type}`}>
      <span>{toast.message}</span>
    </div>
  )
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  )
}

function useToasts() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  return { toasts, addToast }
}

// ===== Loading Skeleton =====
function ProfilesSkeleton() {
  return (
    <div className="profiles-grid" style={{ padding: 16 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  )
}

// ===== Now Playing Strip =====
function NowPlayingStrip({ activeProfile, appliedAt, onQuickApply, applying }) {
  const [timeAgo, setTimeAgo] = useState('')

  useEffect(() => {
    if (!appliedAt) return
    const update = () => {
      const diff = Math.floor((Date.now() - appliedAt) / 1000)
      if (diff < 60) setTimeAgo(`${diff}s ago`)
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`)
      else setTimeAgo(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const interval = setInterval(update, 10000)
    return () => clearInterval(interval)
  }, [appliedAt])

  return (
    <div className="now-playing-strip">
      <div className="now-playing-info">
        <div className={`now-playing-dot ${activeProfile ? '' : 'idle'}`} />
        <span className="now-playing-label">Active:</span>
        {activeProfile ? (
          <>
            <span className="now-playing-name">{activeProfile.name}</span>
            {appliedAt && (
              <span className="now-playing-time">{timeAgo}</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            None selected
          </span>
        )}
      </div>

      {activeProfile && (
        <button
          className="quick-apply-btn"
          onClick={onQuickApply}
          disabled={applying}
          title={`Re-apply "${activeProfile.name}"`}
        >
          {applying ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '↺ Re-apply'}
        </button>
      )}
    </div>
  )
}

// ===== Main App =====
export default function App() {
  const [tab, setTab] = useState('profiles')
  const [loading, setLoading] = useState(true)
  const [editorProfile, setEditorProfile] = useState(null) // null = closed, {} = new, {...} = edit
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [appliedAt, setAppliedAt] = useState(null)
  const [appliedProfile, setAppliedProfile] = useState(null)
  const [applyingId, setApplyingId] = useState(null)
  const [liveCollapsed, setLiveCollapsed] = useState(false)
  const [liveInstant, setLiveInstant] = useState(false)
  const contentRef = useRef(null)
  const liveBodyRef = useRef(null)       // passed to QuickControls to measure body height
  const scrollTriggered = useRef(false)  // true when collapse came from scrolling
  const [autoAppliedId, setAutoAppliedId] = useState(null)
  const { toasts, addToast } = useToasts()
  const { entries: logEntries, addEntry, clearLog } = useActivityLog()
  // Ref always mirrors appliedProfile so callbacks don't need it in their deps
  const appliedProfileRef = useRef(null)

  const {
    profiles,
    activeProfileId,
    activeProfile,
    config,
    addProfile,
    updateProfile,
    deleteProfile,
    setActiveProfileId,
    setConfig,
  } = useProfiles()

  const { applying, testing, fetchingSettings, testConnection, applyProfile, fetchCurrentSettings } = useSonosApi()

  // Per-profile debounce timers for the card sub slider
  const subTimers = useRef({})

  const handleSubwooferChange = useCallback((profile, value) => {
    // Live send only — does NOT persist to the stored profile
    clearTimeout(subTimers.current[profile.id])
    subTimers.current[profile.id] = setTimeout(() => {
      const base = `http://${config.host}:${config.port}`
      const room = encodeURIComponent(config.room)
      fetch(`/sonos-proxy?url=${encodeURIComponent(`${base}/${room}/subwoofer/${value}`)}`)
        .catch(() => {})
    }, 350)
  }, [config])

  const volTimers = useRef({})

  const handleVolumeChange = useCallback((profile, value) => {
    // Live send only — does NOT persist to the stored profile
    clearTimeout(volTimers.current[profile.id])
    volTimers.current[profile.id] = setTimeout(() => {
      const base = `http://${config.host}:${config.port}`
      const room = encodeURIComponent(config.room)
      fetch(`/sonos-proxy?url=${encodeURIComponent(`${base}/${room}/volume/${value}`)}`)
        .catch(() => {})
    }, 350)
  }, [updateProfile, config])

  // Simulate brief loading on mount
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const handleApply = useCallback(async (profile) => {
    setApplyingId(profile.id)
    const result = await applyProfile(config, profile)
    setApplyingId(null)

    if (result.ok) {
      addEntry({
        type: 'profile_applied',
        action: 'Profile Applied',
        what: profile.name,
        before: appliedProfileRef.current?.name ?? null,
        after: profile.name,
      })
      setActiveProfileId(profile.id)
      setAppliedAt(Date.now())
      setAppliedProfile(profile)
      addToast(result.message, 'success')
    } else if (result.corsError) {
      addToast(result.message, 'error', 6000)
    } else {
      addToast(result.message, 'error')
    }
  }, [applyProfile, config, setActiveProfileId, addToast, addEntry])

  const handleQuickApply = useCallback(() => {
    if (activeProfile) handleApply(activeProfile)
  }, [activeProfile, handleApply])

  const handleAutoApply = useCallback((profile, result) => {
    if (result.ok) {
      addEntry({
        type: 'schedule_fired',
        action: 'Schedule Fired',
        what: profile.name,
        before: appliedProfileRef.current?.name ?? null,
        after: profile.name,
      })
      setActiveProfileId(profile.id)
      setAppliedAt(Date.now())
      setAppliedProfile(profile)
      setAutoAppliedId(profile.id)
      addToast(`Auto-applied: ${profile.name}`, 'info')
    }
  }, [setActiveProfileId, addToast, addEntry])

  const handleSessionStart = useCallback((volume) => {
    const base = `http://${config.host}:${config.port}`
    const room = encodeURIComponent(config.room)
    fetch(`/sonos-proxy?url=${encodeURIComponent(`${base}/${room}/volume/${volume}`)}`).catch(() => {})
    addToast(`Session started — volume set to ${volume}`, 'info')
  }, [config, addToast])

  const { enabled: sessionEnabled, setEnabled: setSessionEnabled, startVolume, setStartVolume } =
    useSessionWatcher({ config, onSessionStart: handleSessionStart })

  const handleSessionEnabledChange = useCallback((checked) => {
    addEntry({
      type: 'setting_toggled',
      action: 'Session Watcher',
      what: 'Auto-set volume on session start',
      before: sessionEnabled,
      after: checked,
    })
    setSessionEnabled(checked)
  }, [sessionEnabled, setSessionEnabled, addEntry])

  const volumeLogTimerRef = useRef(null)
  const startVolumeBeforeRef = useRef(startVolume)
  const handleStartVolumeChange = useCallback((value) => {
    setStartVolume(value)
    clearTimeout(volumeLogTimerRef.current)
    volumeLogTimerRef.current = setTimeout(() => {
      addEntry({
        type: 'setting_toggled',
        action: 'Session Volume',
        what: 'Start Volume',
        before: startVolumeBeforeRef.current,
        after: value,
      })
      startVolumeBeforeRef.current = value
    }, 800)
  }, [setStartVolume, addEntry])

  // Keep ref in sync so callbacks can read current appliedProfile without stale closure
  useEffect(() => { appliedProfileRef.current = appliedProfile }, [appliedProfile])

  // Collapse when a profile is applied
  useEffect(() => {
    if (appliedProfile) setLiveCollapsed(true)
  }, [appliedProfile])

  // Scroll listener — instant collapse/expand (no CSS transition) so that
  // the one-time scrollTop compensation in useLayoutEffect is accurate.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => {
      const shouldCollapse = el.scrollTop > 40
      setLiveCollapsed(prev => {
        if (shouldCollapse === prev) return prev
        setLiveInstant(true)      // disable CSS transition for scroll-triggered change
        scrollTriggered.current = true
        return shouldCollapse
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Compensate scrollTop synchronously after scroll-triggered collapse/expand.
  // Because the height change is instant (no transition), offsetHeight is already
  // at its final value here, so the compensation is exact — no gradual jump.
  useLayoutEffect(() => {
    if (!scrollTriggered.current) return
    scrollTriggered.current = false
    const el = contentRef.current
    const body = liveBodyRef.current
    if (!el || !body) return
    const bodyH = body.offsetHeight
    if (liveCollapsed) {
      el.scrollTop += bodyH
    } else {
      el.scrollTop = Math.max(0, el.scrollTop - bodyH)
    }
  }, [liveCollapsed])

  const { schedules, addSchedule, updateSchedule, deleteSchedule } = useScheduler({
    profiles,
    config,
    applyProfile,
    onAutoApply: handleAutoApply,
  })

  const handleCaptureFromSonos = useCallback(async () => {
    const result = await fetchCurrentSettings(config)
    if (!result.ok) {
      addToast(`Could not read Sonos settings: ${result.message}`, 'error', 5000)
      return
    }
    setEditorProfile({ ...result.settings, name: 'Current Settings' })
    setIsEditorOpen(true)
  }, [fetchCurrentSettings, config, addToast])

  const openNewEditor = useCallback(() => {
    setEditorProfile(null)
    setIsEditorOpen(true)
  }, [])

  const openEditEditor = useCallback((profile) => {
    setEditorProfile(profile)
    setIsEditorOpen(true)
  }, [])

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false)
    setEditorProfile(null)
  }, [])

  const handleEditorSave = useCallback((formData) => {
    // Strip id from formData so editorProfile.id is the sole authoritative source
    const { id: _ignored, ...fields } = formData
    if (editorProfile?.id) {
      updateProfile(editorProfile.id, fields)
      addToast(`"${fields.name}" updated`, 'success')
    } else {
      addProfile(fields)
      addToast(`"${fields.name}" created`, 'success')
    }
    closeEditor()
  }, [editorProfile, updateProfile, addProfile, closeEditor, addToast])

  const handleDelete = (id) => {
    const profile = profiles.find((p) => p.id === id)
    if (profile && window.confirm(`Delete "${profile.name}"?`)) {
      deleteProfile(id)
      addToast(`"${profile.name}" deleted`, 'info')
    }
  }

  const handleTestConnection = useCallback(
    (configToTest) => testConnection(configToTest),
    [testConnection]
  )

  const handleSaveConfig = useCallback(
    (newConfig) => {
      setConfig(newConfig)
      addToast('Connection settings saved', 'success')
    },
    [setConfig, addToast]
  )

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-title">
          <div className="app-logo" />
          <h1 className="app-title">
            Arc <span>Controller</span>
          </h1>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-elevated)',
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}
        >
          {config.room || 'No Room'}
        </span>
      </header>

      {/* Now Playing */}
      <NowPlayingStrip
        activeProfile={activeProfile}
        appliedAt={appliedAt}
        onQuickApply={handleQuickApply}
        applying={applyingId !== null}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Quick Controls */}
      <QuickControls
        config={config}
        appliedProfile={appliedProfile}
        collapsed={liveCollapsed}
        instant={liveInstant}
        onToggle={() => { setLiveInstant(false); setLiveCollapsed(v => !v) }}
        bodyRef={liveBodyRef}
        onLog={addEntry}
      />

      {/* Main Content */}
      <main className="app-content" ref={contentRef}>
        {/* Profiles Tab */}
        {tab === 'profiles' && (
          <div className="profiles-page">
            <div className="profiles-header">
              <h2 className="page-title">Profiles</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="add-btn"
                  onClick={handleCaptureFromSonos}
                  disabled={fetchingSettings}
                  title="Capture current Sonos settings as a new profile"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  {fetchingSettings
                    ? <span className="spinner" style={{ width: 12, height: 12 }} />
                    : <Download size={14} />}
                  Capture
                </button>
                <button className="add-btn" onClick={openNewEditor}>
                  <Plus size={16} />
                  New
                </button>
              </div>
            </div>

            {loading ? (
              <ProfilesSkeleton />
            ) : profiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Music2 size={48} strokeWidth={1} />
                </div>
                <div className="empty-state-title">No profiles yet</div>
                <div className="empty-state-desc">
                  Create your first sound profile to get started.
                </div>
              </div>
            ) : (
              <div className="profiles-grid">
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isActive={profile.id === activeProfileId}
                    isAutoApplied={profile.id === autoAppliedId && profile.id === activeProfileId}
                    applying={applyingId === profile.id}
                    onApply={handleApply}
                    onEdit={openEditEditor}
                    onDelete={handleDelete}
                    onSubwooferChange={handleSubwooferChange}
                    onVolumeChange={handleVolumeChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {tab === 'schedule' && (
          <Scheduler
            schedules={schedules}
            profiles={profiles}
            onAdd={addSchedule}
            onUpdate={updateSchedule}
            onDelete={deleteSchedule}
            onLog={addEntry}
          />
        )}

        {/* Activity Log Tab */}
        {tab === 'log' && (
          <ActivityLog entries={logEntries} onClear={clearLog} />
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="settings-page">
            <div className="settings-section">
              <div className="settings-section-title">Connection</div>
              <ConnectionConfig
                config={config}
                onSave={handleSaveConfig}
                onTest={handleTestConnection}
                testing={testing}
              />
            </div>

            <div className="settings-section">
              <div className="settings-section-title">Session Start</div>
              <div className="settings-card" style={{ gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Auto-set volume on session start</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Sets volume when playback begins (e.g. TV turns on)
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={sessionEnabled}
                      onChange={(e) => handleSessionEnabledChange(e.target.checked)}
                    />
                    <div className="toggle-track" />
                    <div className="toggle-thumb" />
                  </label>
                </div>
                {sessionEnabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      Start volume
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={startVolume}
                      onChange={(e) => handleStartVolumeChange(Number(e.target.value))}
                      style={{
                        flex: 1,
                        background: `linear-gradient(to right, var(--accent-primary) ${startVolume}%, var(--border) ${startVolume}%)`,
                      }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--accent-primary)', width: 28, textAlign: 'right', flexShrink: 0 }}>
                      {startVolume}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">About</div>
              <div
                className="settings-card"
                style={{ gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Arc Controller</span>
                  <span style={{ color: 'var(--text-muted)' }}>v1.0.0</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6 }}>
                  Connects to node-sonos-http-api to control your Sonos Arc.
                  Profiles and schedules are stored locally in your browser.
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {profiles.length} profile{profiles.length !== 1 ? 's' : ''} &nbsp;·&nbsp;{' '}
                  {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-tab ${tab === 'profiles' ? 'active' : ''}`}
          onClick={() => setTab('profiles')}
        >
          <LayoutGrid size={22} />
          <span className="nav-tab-label">Profiles</span>
        </button>
        <button
          className={`nav-tab ${tab === 'schedule' ? 'active' : ''}`}
          onClick={() => setTab('schedule')}
        >
          <Calendar size={22} />
          <span className="nav-tab-label">Schedule</span>
        </button>
        <button
          className={`nav-tab ${tab === 'log' ? 'active' : ''}`}
          onClick={() => setTab('log')}
        >
          <History size={22} />
          <span className="nav-tab-label">Log</span>
        </button>
        <button
          className={`nav-tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <Settings size={22} />
          <span className="nav-tab-label">Settings</span>
        </button>
      </nav>

      {/* Profile Editor Modal */}
      {isEditorOpen && (
        <ProfileEditor
          profile={editorProfile}
          onSave={handleEditorSave}
          onCancel={closeEditor}
        />
      )}
    </div>
  )
}
