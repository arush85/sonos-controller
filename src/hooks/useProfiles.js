import { useState, useCallback, useEffect } from 'react'
import { loadStore, saveKey, lsGet, lsSet, genId } from '../lib/fileStore'

const DEFAULT_CONFIG = {
  host: 'localhost',
  port: '5005',
  room: 'Living Room',
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
    speechEnhancement: false,
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
    speechEnhancement: false,
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
    speechEnhancement: false,
  },
]

export function useProfiles() {
  // Initialise from localStorage for instant load (no async flash)
  const [profiles, setProfilesState] = useState(() =>
    lsGet('sonos-profiles', DEFAULT_PROFILES)
  )
  const [activeProfileId, setActiveProfileIdState] = useState(() =>
    lsGet('sonos-active-profile', null)
  )
  const [config, setConfigState] = useState(() =>
    lsGet('sonos-config', DEFAULT_CONFIG)
  )

  // On mount, sync with the file store. If the file has data, it wins
  // (survives port changes). If the file is empty, seed it from localStorage
  // so existing data is migrated immediately.
  useEffect(() => {
    loadStore().then((store) => {
      const resolvedProfiles = store['sonos-profiles'] ?? lsGet('sonos-profiles', DEFAULT_PROFILES)
      const resolvedActiveId = store['sonos-active-profile'] !== undefined
        ? store['sonos-active-profile']
        : lsGet('sonos-active-profile', null)
      const resolvedConfig = store['sonos-config'] ?? lsGet('sonos-config', DEFAULT_CONFIG)

      lsSet('sonos-profiles', resolvedProfiles)
      lsSet('sonos-active-profile', resolvedActiveId)
      lsSet('sonos-config', resolvedConfig)

      saveKey('sonos-profiles', resolvedProfiles)
      saveKey('sonos-active-profile', resolvedActiveId)
      saveKey('sonos-config', resolvedConfig)

      setProfilesState(resolvedProfiles)
      setActiveProfileIdState(resolvedActiveId)
      setConfigState(resolvedConfig)
    })
  }, [])

  const setProfiles = useCallback((updater) => {
    setProfilesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      lsSet('sonos-profiles', next)
      saveKey('sonos-profiles', next)
      return next
    })
  }, [])

  const setActiveProfileId = useCallback((id) => {
    setActiveProfileIdState(id)
    lsSet('sonos-active-profile', id)
    saveKey('sonos-active-profile', id)
  }, [])

  const setConfig = useCallback((updater) => {
    setConfigState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      lsSet('sonos-config', next)
      saveKey('sonos-config', next)
      return next
    })
  }, [])

  const addProfile = useCallback((profileData) => {
    const newProfile = { ...profileData, id: genId('profile') }
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
        lsSet('sonos-active-profile', null)
        saveKey('sonos-active-profile', null)
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
