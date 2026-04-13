import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { Music2 } from 'lucide-react'
import { resolveArt } from '../lib/sonosArt'

// ⚡ Bolt: Wrapped in React.memo to prevent unnecessary re-renders of the potentially long track list
const QueueTrack = memo(function QueueTrack({ track, index, isCurrent, deviceBase }) {
  const artSrc = resolveArt(track, deviceBase)

  return (
    <div className={`queue-track ${isCurrent ? 'queue-track--current' : ''}`}>
      <span className="queue-track-num">{isCurrent ? '▶' : index + 1}</span>

      <div className="queue-track-art">
        {artSrc
          ? <img src={artSrc} alt="" loading="lazy" />
          : <Music2 size={14} strokeWidth={1.5} />
        }
      </div>

      <div className="queue-track-info">
        <span className="queue-track-title">{track.title || 'Unknown'}</span>
        {track.artist && <span className="queue-track-artist">{track.artist}</span>}
      </div>
    </div>
  )
})

export default function Queue({ config, deviceBase, currentTrackNo, playbackState }) {
  const [tracks, setTracks]   = useState([])
  const [loading, setLoading] = useState(true)
  const abortRef = useRef(null)

  const fetchQueue = useCallback(async () => {
    if (!config?.host || !config?.port || !config?.room) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const room = encodeURIComponent(config.room)
      const url = `/sonos-proxy?url=${encodeURIComponent(
        `http://${config.host}:${config.port}/${room}/queue/200`
      )}`
      const res = await fetch(url, { signal: abortRef.current.signal })
      if (!res.ok) return
      const data = await res.json()
      setTracks(Array.isArray(data) ? data : [])
    } catch (e) {
      if (e.name !== 'AbortError') setTracks([])
    } finally {
      setLoading(false)
    }
  }, [config])

  // Fetch queue on mount and when track changes (silent re-fetch after first load)
  useEffect(() => {
    fetchQueue()
    return () => abortRef.current?.abort()
  }, [fetchQueue, currentTrackNo])

  // Re-poll every 30s to stay fresh
  useEffect(() => {
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  // currentTrackNo is 1-based
  const currentIndex = (currentTrackNo ?? 1) - 1

  return (
    <div className="queue-panel">
      <div className="queue-header">
        <span className="queue-title">Queue</span>
        {tracks.length > 0 && <span className="queue-count">{tracks.length} tracks</span>}
      </div>

      <div className="queue-list">
        {loading && tracks.length === 0 ? (
          <div className="queue-empty">Loading…</div>
        ) : tracks.length === 0 ? (
          <div className="queue-empty">No queue</div>
        ) : (
          tracks.map((track, i) => (
            <QueueTrack
              key={track.uri || i}
              track={track}
              index={i}
              isCurrent={i === currentIndex}
              deviceBase={deviceBase}
            />
          ))
        )}
      </div>

      <div className="queue-footer-note">
        Reordering available in the Sonos app
      </div>
    </div>
  )
}
