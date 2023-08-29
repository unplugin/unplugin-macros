/* eslint-disable no-console, unicorn/prefer-top-level-await */

import { build } from 'esbuild'
import Macros from '../../src/esbuild'

build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  plugins: [Macros()],
  format: 'esm',
}).then(() => {
  console.log('Success')
})
