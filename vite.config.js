import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'
import https from 'https'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.resolve(__dirname, 'sonos-data.json')

/**
 * Vite plugin: persists app state to sonos-data.json so data survives
 * port changes (localStorage is origin-bound; this file is not).
 * GET /sonos-store  → returns the full JSON object
 * POST /sonos-store → merges posted keys into the file
 */
function sonosStorePlugin() {
  return {
    name: 'sonos-store',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0]
        if (url !== '/sonos-store') return next()

        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method === 'GET') {
          fs.promises.readFile(DATA_FILE, 'utf8')
            .then(raw => JSON.parse(raw))
            .catch(() => ({}))
            .then(data => {
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            })
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            try {
              const updates = JSON.parse(body)
              const existing = await fs.promises.readFile(DATA_FILE, 'utf8')
                .then(raw => JSON.parse(raw))
                .catch(() => ({}))

              // Security: Prevent prototype pollution
              for (const key in updates) {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                  continue
                }
                existing[key] = updates[key]
              }

              await fs.promises.writeFile(DATA_FILE, JSON.stringify(existing, null, 2))
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }

        next()
      })
    },
  }
}

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

        const transport = targetUrl.startsWith('https:') ? https : http
        const proxyReq = transport.request(targetUrl, { method: 'GET', timeout: 8000 }, (proxyRes) => {
          res.statusCode = proxyRes.statusCode
          // Pass through the real content-type so images render correctly
          const contentType = proxyRes.headers['content-type']
          if (contentType) res.setHeader('Content-Type', contentType)
          // Collect binary-safe chunks as Buffers
          const chunks = []
          proxyRes.on('data', (chunk) => { chunks.push(chunk) })
          proxyRes.on('end', () => res.end(Buffer.concat(chunks)))
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
  plugins: [react(), sonosStorePlugin(), sonosProxyPlugin()],
  server: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
  },
})
