import { expectTypeOf, test } from 'vitest'
import { type MacroContext, defineMacro } from '../src'

test('define', () => {
  const fn = defineMacro(function () {
    expectTypeOf(this).toEqualTypeOf<MacroContext>()
    return 'foo'
  })
  expectTypeOf(fn).toEqualTypeOf<() => string>()

  const fn2 = defineMacro(function (p: number) {
    expectTypeOf(this).toEqualTypeOf<MacroContext>()
    return p
  })
  expectTypeOf(fn2).toEqualTypeOf<(p: number) => number>()
})
