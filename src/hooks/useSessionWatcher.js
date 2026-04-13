import { useState, useEffect, useRef, useCallback } from 'react'
import { lsGet, lsSet } from '../lib/fileStore'

const POLL_INTERVAL = 6000 // ms

export function useSessionWatcher({ config, onSessionStart }) {
  const [enabled, setEnabledState] = useState(() =>
    lsGet('sonos-session-watcher-enabled', false)
  )
  const [startVolume, setStartVolumeState] = useState(() =>
    lsGet('sonos-session-watcher-volume', 20)
  )

  const setEnabled = useCallback((val) => {
    setEnabledState(val)
    lsSet('sonos-session-watcher-enabled', val)
  }, [])

  const setStartVolume = useCallback((val) => {
    setStartVolumeState(val)
    lsSet('sonos-session-watcher-volume', val)
  }, [])

  // Track previous playback state to detect transitions
  const prevStateRef = useRef(null)
  // Prevent re-firing while already in a session
  const inSessionRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      prevStateRef.current = null
      inSessionRef.current = false
      return
    }

    const poll = async () => {
      try {
        const url = `/sonos-proxy?url=${encodeURIComponent(
          `http://${config.host}:${config.port}/${encodeURIComponent(config.room)}/state`
        )}`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        const state = data.playbackState // e.g. "PLAYING", "STOPPED", "PAUSED_PLAYBACK"

        const wasIdle = prevStateRef.current !== 'PLAYING'
        const isPlaying = state === 'PLAYING'

        if (isPlaying && wasIdle && !inSessionRef.current) {
          // New session started — set startup volume
          inSessionRef.current = true
          onSessionStart(startVolume)
        }

        if (!isPlaying) {
          inSessionRef.current = false
        }

        prevStateRef.current = state
      } catch {}
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [enabled, config, startVolume, onSessionStart])

  return { enabled, setEnabled, startVolume, setStartVolume }
}
