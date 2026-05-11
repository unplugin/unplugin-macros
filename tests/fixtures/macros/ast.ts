import type { MacroContext } from '../../../src/index.ts'

export function getAst(this: MacroContext): {
  line: number
  column: number
  calleeName: string
  callSource: string
  programType: string
} {
  const { call, program } = this.ast
  return {
    line: call.loc!.start.line,
    column: call.loc!.start.column,
    calleeName:
      call.callee.type === 'Identifier' ? call.callee.name : '<other>',
    callSource: this.source.slice(call.start!, call.end!),
    programType: program.type,
  }
}
