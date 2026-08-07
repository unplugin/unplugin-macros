import { getCtx } from './macros/ctx.ts' with { type: 'macro' }

getCtx() === 'ctx.js'
