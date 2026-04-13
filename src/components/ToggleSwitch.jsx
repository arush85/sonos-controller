export default function ToggleSwitch({ checked, onChange, style, thumbStyle, trackStyle }) {
  return (
    <label className="toggle-switch" style={style}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="toggle-track" style={trackStyle} />
      <div className="toggle-thumb" style={thumbStyle} />
    </label>
  )
}
