/* eslint-disable no-console */

import { context } from 'esbuild'
import Macros from '../../src/esbuild'

const ctx = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outdir: 'dist',
  plugins: [Macros()],
  format: 'esm',
})

const { hosts, port } = await ctx.serve({
  servedir: 'dist',
})

console.log(`http://${hosts[0]}:${port}`)
