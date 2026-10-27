import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Do not load developer credentials into the test process.
  envDir: false,
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    unstubGlobals: true,
    // Guarded CLI tests start real Node subprocesses (with refused targets).
    // Bound CPU/memory contention so UI keyboard/form tests retain their budget.
    maxWorkers: 2,
  },
})
