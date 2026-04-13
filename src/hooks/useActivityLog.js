import { useState, useCallback } from 'react'
import { lsGet, lsSet } from '../lib/fileStore'

const LOG_KEY = 'sonos-activity-log'
const MAX_ENTRIES = 500

let idCounter = Date.now()

export function useActivityLog() {
  const [entries, setEntries] = useState(() => lsGet(LOG_KEY, []))

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
      lsSet(LOG_KEY, next)
      return next
    })
  }, [])

  const clearLog = useCallback(() => {
    setEntries([])
    lsSet(LOG_KEY, [])
  }, [])

  return { entries, addEntry, clearLog }
}
