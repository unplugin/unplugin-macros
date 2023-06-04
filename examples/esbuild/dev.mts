/* eslint-disable no-console */

import { context } from 'esbuild'
import Macros from '../../src/esbuild'

const ctx = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outdir: 'dist',
  plugins: [((Macros as any).default as any as typeof Macros)()],
  format: 'esm',
})

const { host, port } = await ctx.serve({
  servedir: 'dist',
})

console.log(`http://${host}:${port}`)
