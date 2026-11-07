import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createBuildEnvironment } from './src/lib/environment.ts'
import { bibleGateway } from './src/bible/apiGateway.ts'
import type { Plugin } from 'vite'

function localBibleGateway(): Plugin {
  let count = 0, windowStart = Date.now()
  return {
    name: 'selah-local-bible',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/bible', async (req, res) => {
        if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) { res.writeHead(403).end(); return }
        const now = Date.now()
        if (now - windowStart >= 60_000) { count = 0; windowStart = now }
        if (++count > 30) { res.writeHead(429).end(); return }
        const url = `http://127.0.0.1/api/bible${req.url ?? ''}`
        const response = await bibleGateway(new Request(url, { method: req.method }), { apiKey: process.env.BIBLE_API_KEY })
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
        res.end(await response.text())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const variables = loadEnv(mode, process.cwd(), 'VITE_')
  // Do not expose the whole env object or unselected environments in the bundle.
  const publicBuild = createBuildEnvironment(mode, variables, process.env.SELAH_STAGING_BUILD === 'LOCAL_STAGING_BUILD', process.env.SELAH_STAGING_PREVIEW_BUILD === 'LOCAL_STAGING_PREVIEW_BUILD')
  return {
    plugins: [react(), localBibleGateway()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    envPrefix: [],
    define: { __SELAH_ENVIRONMENT__: JSON.stringify(publicBuild) },
  }
})
