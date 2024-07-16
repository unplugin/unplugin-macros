import type { MacroContext } from './index'

/**
 * A TypeScript helper function that defines a macro.
 *
 * @param fn - The function that represents the macro.
 * @returns A function that can be called with the macro arguments.
 */
export function defineMacro<Args extends any[], Return>(
  fn: (this: MacroContext, ...args: Args) => Return,
): (...args: Args) => Return {
  return fn
}
