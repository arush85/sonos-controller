import { useState, useEffect, useRef, useCallback } from 'react'
import { proxyUrl, buildBaseUrl } from '../lib/sonos'

const POLL_PLAYING = 2000
const POLL_PAUSED  = 3000
const POLL_IDLE    = 10000

export function useNowPlaying({ config, enabled = true }) {
  const [state, setState]           = useState(null)
  const [deviceBase, setDeviceBase] = useState(null)
  const [groupMembers, setGroupMembers] = useState([])
  const timerRef      = useRef(null)
  const pollRef       = useRef(null)
  const deviceBaseRef = useRef(null)
  const stateKeyRef   = useRef(null) // change-detection key to skip no-op re-renders

  useEffect(() => {
    if (!enabled || !config?.host) return

    const poll = async () => {
      try {
        // Use /zones so we get groupState.volume AND can extract the device base URL
        // (needed to construct per-track art URLs via the Sonos device's /getaa endpoint)
        const url = proxyUrl(`${buildBaseUrl(config)}/zones`)
        const res = await fetch(url)
        if (!res.ok) return
        const zones = await res.json()

        const zone = zones.find(z => z.members.some(m => m.roomName === config.room))
        if (!zone) return

        const trackState = zone.coordinator.state

        // Extract device base URL from anywhere in the zone JSON (e.g. http://192.168.50.x:1400)
        // This is stable across polls so we only update when not yet known
        if (!deviceBaseRef.current) {
          const match = JSON.stringify(zone).match(/http:\/\/\d+\.\d+\.\d+\.\d+:1400/)
          if (match) {
            deviceBaseRef.current = match[0]
            setDeviceBase(match[0])
          }
        }

        // Only re-render when something meaningful changed
        const stateKey = `${trackState.playbackState}|${trackState.trackNo}|${trackState.currentTrack?.title}`
        if (stateKey !== stateKeyRef.current) {
          stateKeyRef.current = stateKey
          setState(trackState)
        }
        const newMembers = zone.members.map(m => m.roomName)
        setGroupMembers(prev =>
          prev.join(',') === newMembers.join(',') ? prev : newMembers
        )

        const interval =
          trackState.playbackState === 'PLAYING'         ? POLL_PLAYING :
          trackState.playbackState === 'PAUSED_PLAYBACK' ? POLL_PAUSED  :
                                                           POLL_IDLE
        timerRef.current = setTimeout(poll, interval)
      } catch {
        timerRef.current = setTimeout(poll, POLL_IDLE)
      }
    }

    pollRef.current = poll
    poll()
    return () => clearTimeout(timerRef.current)
  }, [enabled, config])

  const refresh = useCallback(() => {
    clearTimeout(timerRef.current)
    pollRef.current?.()
  }, [])

  return { state, refresh, deviceBase, groupMembers }
}
