import { MacroContext } from '../../../src'
import path from 'path'

export function getCtx(this: MacroContext) {
  return path.basename(this.id)
}
