import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'web3-vendor': ['ethers'],
        },
      },
    },
  },
  plugins: [
    react(mode === "development"
      ? {
          babel: {
            plugins: ["react-dev-locator"],
          },
        }
      : undefined),
    tsconfigPaths()
  ],
}))
