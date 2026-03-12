import type { MacroContext } from '../../../src/index.ts'
import path from 'path'

export function getCtx(this: MacroContext): string {
  return path.basename(this.id)
}
