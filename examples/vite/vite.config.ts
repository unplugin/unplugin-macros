import { defineConfig } from 'vite'
import Macros from '../../src/vite.ts'

export default defineConfig({
  clearScreen: false,
  plugins: [Macros()],
})
