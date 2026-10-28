import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createBuildEnvironment } from './src/lib/environment.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const variables = loadEnv(mode, process.cwd(), 'VITE_')
  // Do not expose the whole env object or unselected environments in the bundle.
  const publicBuild = createBuildEnvironment(mode, variables, process.env.SELAH_STAGING_BUILD === 'LOCAL_STAGING_BUILD')
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    envPrefix: [],
    define: { __SELAH_ENVIRONMENT__: JSON.stringify(publicBuild) },
  }
})
