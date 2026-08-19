import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/apps/coderun-lite/view/',
  plugins: [react()],
  build: {
    outDir: '../view',
    emptyOutDir: true,
  },
})
