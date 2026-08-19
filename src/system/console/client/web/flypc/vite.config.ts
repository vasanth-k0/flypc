import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/apps': 'http://localhost:3000',
      '/files': 'http://localhost:3000',
      '/user': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
      '/system': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/resources': 'http://localhost:3000',
    },
  },
  build: {
    // Emit final frontend build to workspace top-level `dist/fe`
    outDir: '../../../../../../dist/fe',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
  },
})
