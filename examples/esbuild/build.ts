/* eslint-disable no-console */

import { build } from 'esbuild'
import Macros from '../../src/esbuild'

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  plugins: [Macros()],
  format: 'esm',
})

console.log('Success')
