import { useState, useCallback } from 'react'
import { proxyUrl, buildBaseUrl, buildRoomUrl } from '../lib/sonos'

function boolToOnOff(val) {
  return val ? 'on' : 'off'
}

async function apiGet(targetUrl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)
  try {
    const res = await fetch(targetUrl, { signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

export function useSonosApi() {
  const [applying, setApplying] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetchingSettings, setFetchingSettings] = useState(false)

  const testConnection = useCallback(async (config) => {
    setTesting(true)
    const url = buildRoomUrl(config, 'state')
    try {
      const res = await apiGet(url)
      if (res.status === 502) {
        let body = ''
        try { body = await res.text() } catch {}
        const msg = (body.includes('ENOTFOUND') || body.includes('getaddrinfo'))
          ? `Host not found: "${config.host}" — check the IP address.`
          : `Connection refused — is node-sonos-http-api running on ${config.host}:${config.port}?`
        return { ok: false, message: msg }
      }
      if (res.status === 504) {
        return { ok: false, message: `Connection timed out — check host/port.` }
      }
      if (res.ok || res.status < 500) {
        return { ok: true, message: 'Connected successfully' }
      }
      return { ok: false, message: `Server returned ${res.status}` }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, message: 'Request timed out (9s)' }
      }
      return { ok: false, message: err.message || 'Unknown error' }
    } finally {
      setTesting(false)
    }
  }, [])

  const applyProfile = useCallback(async (config, profile) => {
    setApplying(true)

    const commands = [
      buildRoomUrl(config, `volume/${profile.volume}`),
      buildRoomUrl(config, `bass/${profile.bass}`),
      buildRoomUrl(config, `treble/${profile.treble}`),
      buildRoomUrl(config, `nightmode/${boolToOnOff(profile.nightMode)}`),
      buildRoomUrl(config, `speechenhancement/${boolToOnOff(profile.speechEnhancement)}`),
      buildRoomUrl(config, `sub/${profile.subwooferEnabled !== false ? 'on' : 'off'}`),
      ...(profile.subwooferEnabled !== false
        ? [buildRoomUrl(config, `sub/gain/${profile.subwooferGain}`)]
        : []),
    ]

    const settled = await Promise.allSettled(commands.map(url => apiGet(url)))
    const results = settled.map((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        const res = outcome.value
        return { url: commands[i], ok: res.ok || res.status < 500, status: res.status }
      }
      return { url: commands[i], ok: false, error: outcome.reason?.message }
    })

    setApplying(false)

    const failures = results.filter((r) => !r.ok)
    if (failures.length > 0 && failures.length === results.length) {
      return {
        ok: false,
        message: `All commands failed — check Settings and confirm the API is reachable.`,
        results,
      }
    }
    if (failures.length > 0) {
      return {
        ok: true,
        partial: true,
        message: `Applied with ${failures.length} warning(s) — some commands may not be supported by your setup.`,
        results,
      }
    }

    return { ok: true, message: `"${profile.name}" applied successfully`, results }
  }, [])

  const fetchCurrentSettings = useCallback(async (config) => {
    setFetchingSettings(true)
    try {
      const res = await apiGet(buildRoomUrl(config, 'state'))
      if (!res.ok && res.status >= 500) {
        return { ok: false, message: `Failed to fetch state (${res.status})` }
      }
      const data = await res.json()
      const eq = data.equalizer || {}
      return {
        ok: true,
        settings: {
          volume: typeof data.volume === 'number' ? data.volume : 40,
          bass: typeof eq.bass === 'number' ? eq.bass : 0,
          treble: typeof eq.treble === 'number' ? eq.treble : 0,
          nightMode: !!eq.nightMode,
          subwooferEnabled: typeof eq.subEnabled === 'boolean' ? eq.subEnabled : false,
          subwooferGain: typeof eq.subGain === 'number' ? eq.subGain : 0,
        },
      }
    } catch (err) {
      if (err.name === 'AbortError') return { ok: false, message: 'Request timed out' }
      return { ok: false, message: err.message || 'Unknown error' }
    } finally {
      setFetchingSettings(false)
    }
  }, [])

  return { applying, testing, fetchingSettings, testConnection, applyProfile, fetchCurrentSettings }
}
