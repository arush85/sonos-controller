import { useState, useRef, useEffect } from 'react'
import { Music2, SkipBack, SkipForward, Play, Pause, ListMusic } from 'lucide-react'
import { resolveArt } from '../lib/sonosArt'
import { buildRoomUrl } from '../lib/sonos'

function EqBars() {
  return (
    <span className="np-eq" aria-hidden>
      <span className="np-eq-bar" style={{ '--d': '0ms' }} />
      <span className="np-eq-bar" style={{ '--d': '150ms' }} />
      <span className="np-eq-bar" style={{ '--d': '75ms' }} />
      <span className="np-eq-bar" style={{ '--d': '225ms' }} />
    </span>
  )
}

function TransportControls({ config, playbackState, onAction }) {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const timersRef = useRef([])

  const send = async (action) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await fetch(buildRoomUrl(config, action))
      const isTrackChange = action === 'next' || action === 'previous'
      timersRef.current.push(setTimeout(onAction, isTrackChange ? 500 : 400))
      if (isTrackChange) timersRef.current.push(setTimeout(onAction, 1500))
    } catch {}
    busyRef.current = false
    setBusy(false)
  }

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const isPlaying = playbackState === 'PLAYING'

  return (
    <div className="np-controls">
      <button className="np-ctrl-btn" onClick={() => send('previous')} disabled={busy} aria-label="Previous">
        <SkipBack size={16} />
      </button>
      <button className="np-ctrl-btn np-ctrl-btn--primary" onClick={() => send('playpause')} disabled={busy} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button className="np-ctrl-btn" onClick={() => send('next')} disabled={busy} aria-label="Next">
        <SkipForward size={16} />
      </button>
    </div>
  )
}

export default function NowPlaying({ state, config, deviceBase, onTransportAction, queueOpen, onQueueToggle }) {
  const isPlaying = state?.playbackState === 'PLAYING'
  const isPaused  = state?.playbackState === 'PAUSED_PLAYBACK'
  const track     = state?.currentTrack
  const hasTrack  = track && (track.title || track.artist)
  const artSrc    = resolveArt(track, deviceBase)
  const showControls = config?.host && (isPlaying || isPaused)

  if (!state) {
    return (
      <div className="now-playing-card now-playing-card--skeleton">
        <div className="np-art np-art--skeleton" />
        <div className="np-info">
          <div className="np-skeleton-line" style={{ width: '60%' }} />
          <div className="np-skeleton-line" style={{ width: '40%', marginTop: 6 }} />
        </div>
      </div>
    )
  }

  if (!hasTrack || (!isPlaying && !isPaused)) {
    return (
      <div className="now-playing-card now-playing-card--idle">
        <div className="np-art np-art--idle"><Music2 size={22} strokeWidth={1.5} /></div>
        <div className="np-info">
          <span className="np-title np-title--idle">Nothing playing</span>
          <span className="np-artist">Sonos is idle</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`now-playing-card${isPlaying ? ' now-playing-card--playing' : ''}`}>
      <div className="np-art">
        {artSrc
          ? <img src={artSrc} alt="Album art" className="np-art-img" />
          : <div className="np-art-placeholder"><Music2 size={22} strokeWidth={1.5} /></div>
        }
        {isPlaying && <div className="np-art-overlay"><EqBars /></div>}
      </div>

      <div className="np-info">
        <div className="np-title-row">
          {isPlaying && <EqBars />}
          <span className="np-title">{track.title || 'Unknown track'}</span>
        </div>
        {track.artist && <span className="np-artist">{track.artist}</span>}
        {track.album  && <span className="np-album">{track.album}</span>}
      </div>

      {isPaused && <span className="np-badge">Paused</span>}

      {showControls && (
        <TransportControls
          config={config}
          playbackState={state.playbackState}
          onAction={onTransportAction}
        />
      )}

      {onQueueToggle && (
        <button
          className={`np-ctrl-btn np-queue-btn ${queueOpen ? 'active' : ''}`}
          onClick={onQueueToggle}
          aria-label="Toggle queue"
          title="View queue"
        >
          <ListMusic size={15} />
        </button>
      )}
    </div>
  )
}
