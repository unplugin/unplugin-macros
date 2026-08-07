import {
  config,
  getArgs,
  getAsync,
  getFn,
} from './macro.ts' with { type: 'macro' }

export const c = { config }
export const d = await getAsync()
export const e = getArgs(2)
export const f = getFn()
