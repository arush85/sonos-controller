import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, Waves, Zap, MessageSquare, ChevronDown } from 'lucide-react'


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
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--accent-primary) ${pct}%, var(--border) ${pct}%)`,
          }}
        />
      </div>
      <div className="quick-slider-value">
        {pending && <span className="quick-pending-dot" />}
        <span>{displayVal}{unit}</span>
      </div>
    </div>
  )
}

export default function QuickControls({ config, appliedProfile, collapsed, instant, onToggle, bodyRef, onLog }) {
  const [volume, setVolume] = useState(40)
  const [sub, setSub] = useState(0)
  const [subEnabled, setSubEnabled] = useState(false)
  const [loudness, setLoudness] = useState(false)
  const [speechEnhancement, setSpeechEnhancement] = useState(false)

  useEffect(() => {
    if (!appliedProfile) return
    if (typeof appliedProfile.volume === 'number') setVolume(appliedProfile.volume)
    if (typeof appliedProfile.subwooferEnabled === 'boolean') setSubEnabled(appliedProfile.subwooferEnabled)
    if (typeof appliedProfile.subwooferGain === 'number') setSub(appliedProfile.subwooferGain)
    if (typeof appliedProfile.loudness === 'boolean') setLoudness(appliedProfile.loudness)
  }, [appliedProfile])

  const volApply = useDebouncedApply(config, 'volume')
  const subApply = useDebouncedApply(config, 'sub/gain')

  const handleVolume = (v) => {
    setVolume(v)
    volApply.trigger(v)
  }

  const handleSub = (v) => {
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

  const handleLoudness = (enabled) => {
    onLog?.({ type: 'setting_toggled', action: 'Live Controls', what: 'Loudness', before: !enabled, after: enabled })
    setLoudness(enabled)
    sendToggle('loudness', enabled)
  }

  const handleSpeechEnhancement = (enabled) => {
    onLog?.({ type: 'setting_toggled', action: 'Live Controls', what: 'Speech Enhancement', before: !enabled, after: enabled })
    setSpeechEnhancement(enabled)
    sendToggle('speechenhancement', enabled)
  }

  return (
    <div className={['quick-controls', collapsed && 'quick-controls--collapsed', instant && 'quick-controls--instant'].filter(Boolean).join(' ')}>
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
      <div className="quick-controls-body" ref={bodyRef}>
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
        <div className="quick-slider-row">
          <div className="quick-slider-label">
            <Zap size={14} strokeWidth={2} />
            <span>Loudness</span>
          </div>
          <label className="toggle-switch" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={loudness}
              onChange={(e) => handleLoudness(e.target.checked)}
            />
            <div className="toggle-track" />
            <div className="toggle-thumb" />
          </label>
        </div>
        <div className="quick-slider-row">
          <div className="quick-slider-label">
            <MessageSquare size={14} strokeWidth={2} />
            <span>Speech</span>
          </div>
          <label className="toggle-switch" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={speechEnhancement}
              onChange={(e) => handleSpeechEnhancement(e.target.checked)}
            />
            <div className="toggle-track" />
            <div className="toggle-thumb" />
          </label>
        </div>
      </div>
      </div>
    </div>
  )
}
