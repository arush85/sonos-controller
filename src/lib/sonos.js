export function proxyUrl(targetUrl) {
  return `/sonos-proxy?url=${encodeURIComponent(targetUrl)}`
}

export function buildBaseUrl(config) {
  return `http://${config.host}:${config.port}`
}

export function buildRoomUrl(config, path) {
  return proxyUrl(`${buildBaseUrl(config)}/${encodeURIComponent(config.room)}/${path}`)
}
