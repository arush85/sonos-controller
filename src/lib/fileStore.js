const STORE_URL = '/sonos-store'

/** Fetch all persisted keys from the server-side file. Returns {} on failure. */
export async function loadStore() {
  try {
    const res = await fetch(STORE_URL)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

/** Persist a single key to the server-side file (fire-and-forget). */
export function saveKey(key, value) {
  fetch(STORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: value }),
  }).catch(() => {})
}

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function genId(prefix = 'id') {
  return prefix + '-' + Math.random().toString(36).slice(2, 10)
}
