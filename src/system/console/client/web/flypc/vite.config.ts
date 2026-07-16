import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Emit final frontend build to workspace top-level `dist/fe`
    outDir: '../../../../../../dist/fe',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
  },
})
