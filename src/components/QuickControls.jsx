import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, Waves, ChevronDown, AudioLines, Music2, Link2, Unlink2 } from 'lucide-react'


function useDebouncedApply(config, command, delay = 350) {
  const timerRef = useRef(null)
  const [pending, setPending] = useState(false)
  const [lastSent, setLastSent] = useState(null)

  const send = useCallback(async (value) => {
    const url = `/sonos-proxy?url=${encodeURIComponent(
      `http://${config.host}:${config.port}/${encodeURIComponent(config.room)}/${command}/${value}`
    )}`
    try {
      await fetch(url)
    } catch {}
    setLastSent(value)
    setPending(false)
  }, [config, command])

  const trigger = useCallback((value) => {
    setPending(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => send(value), delay)
  }, [send, delay])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { trigger, pending, lastSent }
}

function LiveSlider({ icon: Icon, label, value, min, max, onChange, pending, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100
  const displayVal = value > 0 && min < 0 ? `+${value}` : `${value}`
  const dragStartRef = useRef(null)
  const [delta, setDelta] = useState(null)

  const handleDragStart = () => {
    dragStartRef.current = value
    setDelta(null)
  }

  const handleChange = (e) => {
    const next = Number(e.target.value)
    if (dragStartRef.current !== null) {
      setDelta(next - dragStartRef.current)
    }
    onChange(next)
  }

  const handleDragEnd = () => {
    dragStartRef.current = null
    setDelta(null)
  }

  const deltaStr = delta !== null && delta !== 0
    ? (delta > 0 ? `+${delta}` : `${delta}`)
    : null

  return (
    <div className="quick-slider-row">
      <div className="quick-slider-label">
        <Icon size={14} strokeWidth={2} />
        <span>{label}</span>
      </div>
      <div className="quick-slider-track">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          onChange={handleChange}
          style={{
            background: `linear-gradient(to right, var(--accent-primary) ${pct}%, var(--border) ${pct}%)`,
          }}
        />
      </div>
      <div className="quick-slider-value">
        {pending && <span className="quick-pending-dot" />}
        <span>{displayVal}{unit}</span>
        {deltaStr && (
          <span className="quick-slider-delta" style={{ color: delta > 0 ? 'var(--accent-secondary)' : 'var(--text-secondary)' }}>
            {deltaStr}
          </span>
        )}
      </div>
    </div>
  )
}

export default function QuickControls({ config, appliedProfile, collapsed, onToggle, onLog }) {
  const [volume, setVolume] = useState(40)
  const [sub, setSub] = useState(0)
  const [subEnabled, setSubEnabled] = useState(false)
  const [bass, setBass] = useState(0)
  const [treble, setTreble] = useState(0)

  const interactingRef = useRef(false)
  const interactingTimerRef = useRef(null)

  const markInteracting = () => {
    interactingRef.current = true
    clearTimeout(interactingTimerRef.current)
    // Resume polling 2s after the user stops touching a slider
    interactingTimerRef.current = setTimeout(() => { interactingRef.current = false }, 2000)
  }

  const [kitchenGrouped, setKitchenGrouped] = useState(null)
  const [kitchenPending, setKitchenPending] = useState(false)

  const pollZones = useCallback(() => {
    if (!config?.host || !config?.port || !config?.room) return
    const url = `/sonos-proxy?url=${encodeURIComponent(`http://${config.host}:${config.port}/zones`)}`
    fetch(url)
      .then(r => r.json())
      .then(zones => {
        const zone = zones.find(z => z.members.some(m => m.roomName === config.room))
        if (!zone) return
        // Kitchen grouping (always update — independent of slider interaction)
        setKitchenGrouped(!!zone.members.some(m => m.roomName === 'Kitchen'))
        // Sliders: skip update while user is dragging
        if (interactingRef.current) return
        const coord = zone.coordinator
        const groupVol = coord.groupState?.volume ?? coord.state?.volume
        if (typeof groupVol === 'number') setVolume(groupVol)
        const eq = coord.state?.equalizer
        if (eq) {
          if (typeof eq.bass === 'number') setBass(eq.bass)
          if (typeof eq.treble === 'number') setTreble(eq.treble)
        }
        const sub = coord.state?.sub
        if (sub) {
          if (typeof sub.gain === 'number') setSub(sub.gain)
          if (typeof sub.enabled === 'boolean') setSubEnabled(sub.enabled)
        }
      })
      .catch(() => {})
  }, [config])

  useEffect(() => {
    pollZones()
    const interval = setInterval(pollZones, 5000)
    return () => clearInterval(interval)
  }, [pollZones])

  useEffect(() => {
    if (!appliedProfile) return
    if (typeof appliedProfile.volume === 'number') setVolume(appliedProfile.volume)
    if (typeof appliedProfile.subwooferEnabled === 'boolean') setSubEnabled(appliedProfile.subwooferEnabled)
    if (typeof appliedProfile.subwooferGain === 'number') setSub(appliedProfile.subwooferGain)
    if (typeof appliedProfile.bass === 'number') setBass(appliedProfile.bass)
    if (typeof appliedProfile.treble === 'number') setTreble(appliedProfile.treble)
  }, [appliedProfile])

  const handleKitchenToggle = async () => {
    if (kitchenPending) return
    setKitchenPending(true)
    try {
      if (kitchenGrouped) {
        await fetch(`/sonos-proxy?url=${encodeURIComponent(`http://${config.host}:${config.port}/Kitchen/leave`)}`)
      } else {
        await fetch(`/sonos-proxy?url=${encodeURIComponent(`http://${config.host}:${config.port}/${encodeURIComponent(config.room)}/add/Kitchen`)}`)
      }
      setTimeout(pollZones, 1000)
    } catch {}
    setKitchenPending(false)
  }

  const volApply = useDebouncedApply(config, kitchenGrouped ? 'groupvolume' : 'volume')
  const subApply = useDebouncedApply(config, 'sub/gain')
  const bassApply = useDebouncedApply(config, 'bass')
  const trebleApply = useDebouncedApply(config, 'treble')

  const handleVolume = (v) => {
    markInteracting()
    setVolume(v)
    volApply.trigger(v)
  }

  const handleSub = (v) => {
    markInteracting()
    setSub(v)
    subApply.trigger(v)
  }

  const sendToggle = (command, enabled) => {
    const url = `/sonos-proxy?url=${encodeURIComponent(
      `http://${config.host}:${config.port}/${encodeURIComponent(config.room)}/${command}/${enabled ? 'on' : 'off'}`
    )}`
    fetch(url).catch(() => {})
  }

  const handleSubToggle = (enabled) => {
    onLog?.({ type: 'setting_toggled', action: 'Live Controls', what: 'Subwoofer', before: !enabled, after: enabled })
    setSubEnabled(enabled)
    sendToggle('sub', enabled)
  }

  const handleBass = (v) => {
    markInteracting()
    setBass(v)
    bassApply.trigger(v)
  }

  const handleTreble = (v) => {
    markInteracting()
    setTreble(v)
    trebleApply.trigger(v)
  }

  return (
    <div className={['quick-controls', collapsed && 'quick-controls--collapsed'].filter(Boolean).join(' ')}>
      <div className="quick-controls-header" onClick={onToggle} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <span className="quick-controls-title">Live Controls</span>
        <ChevronDown
          size={14}
          style={{
            marginLeft: 'auto',
            color: 'var(--text-muted)',
            transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        />
      </div>
      <div className="quick-controls-body">
      <div className="quick-controls-sliders">
        <LiveSlider
          icon={Volume2}
          label="Volume"
          value={volume}
          min={0}
          max={100}
          onChange={handleVolume}
          pending={volApply.pending}
        />
        <div className="quick-slider-row">
          <div className="quick-slider-label">
            <Waves size={14} strokeWidth={2} />
            <span>Subwoofer</span>
          </div>
          <label className="toggle-switch" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={subEnabled}
              onChange={(e) => handleSubToggle(e.target.checked)}
            />
            <div className="toggle-track" />
            <div className="toggle-thumb" />
          </label>
        </div>
        {subEnabled && (
          <LiveSlider
            icon={Waves}
            label="Sub Gain"
            value={sub}
            min={-15}
            max={15}
            onChange={handleSub}
            pending={subApply.pending}
          />
        )}
        <LiveSlider
          icon={AudioLines}
          label="Bass"
          value={bass}
          min={-10}
          max={10}
          onChange={handleBass}
          pending={bassApply.pending}
        />
        <LiveSlider
          icon={Music2}
          label="Treble"
          value={treble}
          min={-10}
          max={10}
          onChange={handleTreble}
          pending={trebleApply.pending}
        />
      </div>

      <div className="quick-group-row">
        <button
          className={`quick-group-btn ${kitchenGrouped ? 'grouped' : ''}`}
          onClick={handleKitchenToggle}
          disabled={kitchenPending || kitchenGrouped === null}
        >
          {kitchenGrouped
            ? <><Unlink2 size={13} /> Ungroup Kitchen</>
            : <><Link2 size={13} /> Group with Kitchen</>
          }
        </button>
      </div>
      </div>
    </div>
  )
}
