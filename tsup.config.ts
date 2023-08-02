import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./src/*.ts'],
  format: ['cjs', 'esm'],
  target: 'node16.14',
  splitting: true,
  cjsInterop: true,
  clean: true,
  dts: true,
})
