import { useState } from 'react'
import { Pencil, Trash2, Play } from 'lucide-react'

export default function ProfileCard({
  profile,
  isActive,
  isAutoApplied,
  applying,
  onApply,
  onEdit,
  onDelete,
  onSubwooferChange,
  onVolumeChange,
}) {
  const [liveVolume, setLiveVolume] = useState(profile.volume)
  const [liveSubGain, setLiveSubGain] = useState(profile.subwooferGain ?? 0)
  const badges = [
    { key: 'nightMode', label: 'Night', value: profile.nightMode },
    { key: 'loudness', label: 'Loud', value: profile.loudness },
    { key: 'subwooferEnabled', label: 'Sub', value: profile.subwooferEnabled },
  ]

  return (
    <div
      className={`profile-card ${isActive ? 'active' : ''}`}
      role="article"
      aria-label={`Profile: ${profile.name}`}
    >
      {isAutoApplied && (
        <div className="auto-badge" title="Last applied by schedule">Auto</div>
      )}

      <div className="card-name">{profile.name}</div>

      <div className="card-sub-slider">
        <div className="card-sub-header">
          <span>Volume</span>
          <span className="card-sub-value">{liveVolume}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={liveVolume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setLiveVolume(v)
            onVolumeChange(profile, v)
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: `linear-gradient(to right, var(--accent-primary) ${liveVolume}%, var(--border) ${liveVolume}%)`,
          }}
        />
      </div>

      <div className="card-badges">
        {badges.map((b) => (
          <span key={b.key} className={`badge ${b.value ? 'on' : ''}`}>
            {b.label}
          </span>
        ))}
        {profile.subwooferEnabled && (
          <span className="badge">
            Sub {profile.subwooferGain > 0 ? `+${profile.subwooferGain}` : profile.subwooferGain}
          </span>
        )}
      </div>

      <div className="card-sub-slider">
        <div className="card-sub-header">
          <span>Subwoofer</span>
          <span className="card-sub-value">
            {liveSubGain > 0 ? `+${liveSubGain}` : liveSubGain}
          </span>
        </div>
        <input
          type="range"
          min={-15}
          max={15}
          step={1}
          value={liveSubGain}
          disabled={!profile.subwooferEnabled}
          onChange={(e) => {
            const v = Number(e.target.value)
            setLiveSubGain(v)
            onSubwooferChange(profile, v)
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: profile.subwooferEnabled
              ? `linear-gradient(to right, var(--accent-primary) ${((liveSubGain + 15) / 30) * 100}%, var(--border) ${((liveSubGain + 15) / 30) * 100}%)`
              : 'var(--border)',
          }}
        />
      </div>

      <div className="card-actions">
        <button
          className={`apply-btn ${applying ? 'applying' : ''}`}
          onClick={(e) => { e.stopPropagation(); onApply(profile) }}
          disabled={applying}
          aria-label={`Apply ${profile.name}`}
        >
          {applying ? (
            <>
              <span className="spinner" />
              Applying…
            </>
          ) : (
            <>
              <Play size={12} />
              Apply
            </>
          )}
        </button>

        <button
          className="icon-btn"
          onClick={(e) => { e.stopPropagation(); onEdit(profile) }}
          aria-label={`Edit ${profile.name}`}
          title="Edit profile"
        >
          <Pencil size={14} />
        </button>

        <button
          className="icon-btn danger"
          onClick={(e) => { e.stopPropagation(); onDelete(profile.id) }}
          aria-label={`Delete ${profile.name}`}
          title="Delete profile"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
