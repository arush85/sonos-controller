import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'

/**
 * Vite plugin: proxies GET /sonos-proxy?url=<encoded-target-url>
 * through Node.js so the browser never makes a cross-origin request.
 * This completely eliminates CORS issues with node-sonos-http-api.
 */
function sonosProxyPlugin() {
  return {
    name: 'sonos-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/sonos-proxy')) return next()

        const queryStart = req.url.indexOf('?')
        const qs = queryStart !== -1 ? req.url.slice(queryStart + 1) : ''
        const params = new URLSearchParams(qs)
        const targetUrl = params.get('url')

        if (!targetUrl) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing url param' }))
          return
        }

        // Validate URL before passing to http.request
        try { new URL(targetUrl) } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Invalid URL: ${targetUrl}` }))
          return
        }

        // Set CORS headers so the browser accepts our proxy response
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')

        const proxyReq = http.request(targetUrl, { method: 'GET', timeout: 8000 }, (proxyRes) => {
          res.statusCode = proxyRes.statusCode
          let body = ''
          proxyRes.on('data', (chunk) => { body += chunk })
          proxyRes.on('end', () => res.end(body))
        })

        proxyReq.on('timeout', () => {
          proxyReq.destroy()
          res.statusCode = 504
          res.end(JSON.stringify({ error: 'Gateway timeout' }))
        })

        proxyReq.on('error', (err) => {
          res.statusCode = 502
          res.end(JSON.stringify({ error: err.code || err.message || 'ECONNREFUSED' }))
        })

        proxyReq.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), sonosProxyPlugin()],
  server: {
    host: true,
    port: 5173,
  },
})
