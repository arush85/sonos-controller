import { useState, useEffect, useCallback, useRef } from 'react'
import { loadStore, saveKey, lsGet, lsSet, genId } from '../lib/fileStore'

export function getNextActivation(schedule) {
  if (!schedule.enabled) return null
  const now = new Date()
  const [hh, mm] = schedule.time.split(':').map(Number)

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(hh, mm, 0, 0)
    const dayOfWeek = candidate.getDay() // 0=Sun
    if (schedule.days.includes(dayOfWeek) && candidate > now) {
      return candidate
    }
  }
  return null
}

export function formatNextActivation(schedule) {
  const next = getNextActivation(schedule)
  if (!next) return null
  const now = new Date()
  const diffMs = next - now
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `in ${diffMins}m`
  if (diffHours < 24) return `in ${diffHours}h ${diffMins % 60}m`
  return `in ${diffDays}d`
}

export function useScheduler({ profiles, config, applyProfile, onAutoApply }) {
  const [schedules, setSchedulesState] = useState(() =>
    lsGet('sonos-schedules', [])
  )

  const lastTriggeredRef = useRef({})

  // On mount, sync with the file store. File data wins; if file is empty,
  // seed it from localStorage so existing schedules are migrated immediately.
  useEffect(() => {
    loadStore().then((store) => {
      const resolved = store['sonos-schedules'] ?? lsGet('sonos-schedules', [])
      lsSet('sonos-schedules', resolved)
      saveKey('sonos-schedules', resolved)
      setSchedulesState(resolved)
    })
  }, [])

  const setSchedules = useCallback((updater) => {
    setSchedulesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      lsSet('sonos-schedules', next)
      saveKey('sonos-schedules', next)
      return next
    })
  }, [])

  const addSchedule = useCallback((data) => {
    const schedule = { ...data, id: genId('sched') }
    setSchedules((prev) => [...prev, schedule])
    return schedule
  }, [setSchedules])

  const updateSchedule = useCallback((id, updates) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }, [setSchedules])

  const deleteSchedule = useCallback((id) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }, [setSchedules])

  // Check schedules every 30 seconds
  useEffect(() => {
    const check = async () => {
      const now = new Date()
      const currentDay = now.getDay()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      for (const schedule of schedules) {
        if (!schedule.enabled) continue
        if (!schedule.days.includes(currentDay)) continue
        if (schedule.time !== currentTime) continue

        // Avoid triggering more than once per minute
        const lastKey = `${schedule.id}-${currentTime}-${currentDay}`
        if (lastTriggeredRef.current[lastKey]) continue
        lastTriggeredRef.current[lastKey] = true

        const profile = profiles.find((p) => p.id === schedule.profileId)
        if (!profile) continue

        try {
          const result = await applyProfile(config, profile)
          if (onAutoApply) onAutoApply(profile, result)
        } catch (e) {
          console.warn('Auto-apply failed:', e)
        }
      }

      // Clean up old lastTriggered keys (keep only last 100)
      const keys = Object.keys(lastTriggeredRef.current)
      if (keys.length > 100) {
        const toDelete = keys.slice(0, keys.length - 50)
        toDelete.forEach((k) => delete lastTriggeredRef.current[k])
      }
    }

    check() // run immediately
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [schedules, profiles, config, applyProfile, onAutoApply])

  return {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
  }
}
