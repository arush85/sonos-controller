export function sliderGradientStyle(value, min, max) {
  const pct = ((value - min) / (max - min)) * 100
  return {
    background: `linear-gradient(to right, var(--accent-primary) ${pct}%, var(--border) ${pct}%)`
  }
}
