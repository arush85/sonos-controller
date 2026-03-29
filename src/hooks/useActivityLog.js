import { useState, useCallback } from 'react'

const LOG_KEY = 'sonos-activity-log'
const MAX_ENTRIES = 500

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

let idCounter = Date.now()

export function useActivityLog() {
  const [entries, setEntries] = useState(() => safeGet(LOG_KEY, []))

  const addEntry = useCallback(({ type, action, what, before, after }) => {
    const entry = {
      id: String(++idCounter),
      timestamp: Date.now(),
      type,
      action,
      what,
      before,
      after,
    }
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, MAX_ENTRIES)
      safeSet(LOG_KEY, next)
      return next
    })
  }, [])

  const clearLog = useCallback(() => {
    setEntries([])
    safeSet(LOG_KEY, [])
  }, [])

  return { entries, addEntry, clearLog }
}
