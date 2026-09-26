import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // 相対パスで出力し、GitHub Pages などのサブパス配信でも動くようにする
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
