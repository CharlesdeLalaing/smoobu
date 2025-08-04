import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Add this section to handle env variables
  define: {
    'process.env': {}
  },
  // Add server configuration
  server: {
    watch: {
      usePolling: true,
    },
  },
  // Add build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})// Trigger deployment Mon, Aug  4, 2025 11:21:47 AM
