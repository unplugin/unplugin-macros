/// <reference types="vitest/config" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    experimental: {
      viteModuleRunner: false,
    },
  },
})
