import { useState, useCallback } from 'react'

const DEFAULT_CONFIG = {
  host: 'localhost',
  port: '5005',
  room: 'My Room',
}

const DEFAULT_PROFILES = [
  {
    id: 'profile-movie-night',
    name: 'Movie Night',
    volume: 45,
    bass: 3,
    treble: -1,
    subwooferGain: 0,
    subwooferEnabled: false,
    nightMode: false,
    loudness: false,
  },
  {
    id: 'profile-night-mode',
    name: 'Night Mode',
    volume: 25,
    bass: 0,
    treble: 0,
    subwooferGain: 0,
    subwooferEnabled: false,
    nightMode: true,
    loudness: false,
  },
  {
    id: 'profile-music',
    name: 'Music',
    volume: 50,
    bass: 2,
    treble: 2,
    subwooferGain: 0,
    subwooferEnabled: false,
    nightMode: false,
    loudness: true,
  },
]

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

function genId() {
  return 'profile-' + Math.random().toString(36).slice(2, 10)
}

export function useProfiles() {
  const [profiles, setProfilesState] = useState(() =>
    safeGet('sonos-profiles', DEFAULT_PROFILES)
  )

  const [activeProfileId, setActiveProfileIdState] = useState(() =>
    safeGet('sonos-active-profile', null)
  )

  const [config, setConfigState] = useState(() =>
    safeGet('sonos-config', DEFAULT_CONFIG)
  )

  const setProfiles = useCallback((updater) => {
    setProfilesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      safeSet('sonos-profiles', next)
      return next
    })
  }, [])

  const setActiveProfileId = useCallback((id) => {
    setActiveProfileIdState(id)
    safeSet('sonos-active-profile', id)
  }, [])

  const setConfig = useCallback((updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      safeSet('sonos-config', next)
      return next
    })
  }, [])

  const addProfile = useCallback((profileData) => {
    const newProfile = { ...profileData, id: genId() }
    setProfiles((prev) => [...prev, newProfile])
    return newProfile
  }, [setProfiles])

  const updateProfile = useCallback((id, updates) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
  }, [setProfiles])

  const deleteProfile = useCallback((id) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id))
    setActiveProfileIdState((prev) => {
      if (prev === id) {
        safeSet('sonos-active-profile', null)
        return null
      }
      return prev
    })
  }, [setProfiles])

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null

  return {
    profiles,
    activeProfileId,
    activeProfile,
    config,
    addProfile,
    updateProfile,
    deleteProfile,
    setActiveProfileId,
    setConfig,
  }
}
