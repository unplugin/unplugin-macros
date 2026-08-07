import type { MacroContext } from '../../../src/index.ts'

export function getAst(this: MacroContext): {
  line: number
  column: number
  calleeName: string
  callSource: string
  programType: string
} {
  const { call, program } = this.ast
  const before = this.source.slice(0, call.start)
  return {
    line: before.split('\n').length,
    column: call.start - (before.lastIndexOf('\n') + 1),
    calleeName:
      call.callee.type === 'Identifier' ? call.callee.name : '<other>',
    callSource: this.source.slice(call.start, call.end),
    programType: program.type,
  }
}
