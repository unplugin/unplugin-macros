import { defineConfig } from 'vite'
import Macros from '../../src/vite'

export default defineConfig({
  clearScreen: false,
  plugins: [Macros()],
})
