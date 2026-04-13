import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import ToggleSwitch from './ToggleSwitch'
import { sliderGradientStyle } from '../lib/utils'

const EMPTY_PROFILE = {
  name: '',
  volume: 40,
  bass: 0,
  treble: 0,
  subwooferGain: 0,
  subwooferEnabled: false,
  nightMode: false,
  speechEnhancement: false,
}

function Slider({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {value > 0 && min < 0 ? `+${value}` : value}{unit}
        </span>
      </div>
      <div className="slider-track">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={sliderGradientStyle(value, min, max)}
        />
      </div>
      <div className="slider-range-labels">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-label">{label}</div>
        {description && <div className="toggle-desc">{description}</div>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )
}

export default function ProfileEditor({ profile, onSave, onCancel }) {
  // Component is always freshly mounted (isEditorOpen && ...) so useState
  // initialiser is the only form-reset we need. The useEffect was causing
  // mid-edit resets whenever the parent re-rendered with a new object ref.
  const [form, setForm] = useState(() => profile ? { ...profile } : { ...EMPTY_PROFILE })

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = () => {
    if (!form.name.trim()) {
      alert('Please enter a profile name.')
      return
    }
    onSave(form)
  }

  const isEditing = !!profile?.id

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="modal-header">
          <span className="modal-title">
            {isEditing ? 'Edit Profile' : 'New Profile'}
          </span>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Profile Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Movie Night"
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              autoFocus
              maxLength={40}
            />
          </div>

          {/* Volume & EQ Sliders */}
          <div>
            <div className="editor-section-label">Volume &amp; EQ</div>
            <div className="sliders-section">
              <Slider label="Volume" value={form.volume} min={0} max={100} onChange={set('volume')} />
              <Slider label="Bass" value={form.bass} min={-10} max={10} onChange={set('bass')} />
              <Slider label="Treble" value={form.treble} min={-10} max={10} onChange={set('treble')} />
            </div>
          </div>

          {/* Subwoofer */}
          <div>
            <div className="editor-section-label">Subwoofer</div>
            <div className="toggles-section">
              <Toggle
                label="Subwoofer Enabled"
                description="Send subwoofer gain when applying this profile"
                checked={form.subwooferEnabled}
                onChange={set('subwooferEnabled')}
              />
            </div>
            {form.subwooferEnabled && (
              <div className="sliders-section" style={{ marginTop: '8px' }}>
                <Slider
                  label="Subwoofer Gain"
                  value={form.subwooferGain}
                  min={-15}
                  max={15}
                  onChange={set('subwooferGain')}
                />
              </div>
            )}
          </div>

          {/* Toggles */}
          <div>
            <div className="editor-section-label">Modes</div>
            <div className="toggles-section">
              <Toggle
                label="Night Mode"
                description="Reduces dynamic range, quieter loud sounds"
                checked={form.nightMode}
                onChange={set('nightMode')}
              />
              <Toggle
                label="Speech Enhancement"
                description="Boosts dialogue clarity for movies and TV"
                checked={form.speechEnhancement}
                onChange={set('speechEnhancement')}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Create Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
