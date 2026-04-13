import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, Waves, ChevronDown, AudioLines, Music2, Link2, Unlink2 } from 'lucide-react'
import { proxyUrl, buildBaseUrl, buildRoomUrl } from '../lib/sonos'
import ToggleSwitch from './ToggleSwitch'
import { sliderGradientStyle } from '../lib/utils'


function useDebouncedApply(config, command, delay = 350) {
  const timerRef = useRef(null)
  const [pending, setPending] = useState(false)
  const [lastSent, setLastSent] = useState(null)

  const send = useCallback(async (value) => {
    try {
      await fetch(buildRoomUrl(config, `${command}/${value}`))
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
          style={sliderGradientStyle(value, min, max)}
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

  // otherRoom: the room available to group/ungroup with (detected dynamically from /zones)
  const [otherRoom, setOtherRoom] = useState(null)
  const [isGrouped, setIsGrouped] = useState(null)
  const [groupPending, setGroupPending] = useState(false)

  const pollZones = useCallback(() => {
    if (!config?.host || !config?.port || !config?.room) return
    fetch(proxyUrl(`${buildBaseUrl(config)}/zones`))
      .then(r => r.json())
      .then(zones => {
        const zone = zones.find(z => z.members.some(m => m.roomName === config.room))
        if (!zone) return

        // Detect grouping state dynamically — no hardcoded room names
        const groupedWith = zone.members.map(m => m.roomName).filter(n => n !== config.room)
        const available = zones
          .filter(z => !z.members.some(m => m.roomName === config.room))
          .flatMap(z => z.members.map(m => m.roomName))

        if (groupedWith.length > 0) {
          setIsGrouped(true)
          setOtherRoom(groupedWith[0])
        } else {
          setIsGrouped(false)
          if (available.length > 0) setOtherRoom(available[0])
        }

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

  const handleGroupToggle = async () => {
    if (groupPending || !otherRoom) return
    setGroupPending(true)
    try {
      if (isGrouped) {
        await fetch(proxyUrl(`${buildBaseUrl(config)}/${encodeURIComponent(otherRoom)}/leave`))
      } else {
        await fetch(buildRoomUrl(config, `add/${encodeURIComponent(otherRoom)}`))
      }
      setTimeout(pollZones, 1000)
    } catch {}
    setGroupPending(false)
  }

  const volApply = useDebouncedApply(config, isGrouped ? 'groupvolume' : 'volume')
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
    fetch(buildRoomUrl(config, `${command}/${enabled ? 'on' : 'off'}`)).catch(() => {})
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
          <ToggleSwitch
            checked={subEnabled}
            onChange={handleSubToggle}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          />
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

      {otherRoom && (
        <div className="quick-group-row">
          <button
            className={`quick-group-btn ${isGrouped ? 'grouped' : ''}`}
            onClick={handleGroupToggle}
            disabled={groupPending || isGrouped === null}
          >
            {isGrouped
              ? <><Unlink2 size={13} /> Ungroup Speakers</>
              : <><Link2 size={13} /> Group Speakers</>
            }
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
