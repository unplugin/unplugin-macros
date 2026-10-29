import { describe, expect, test } from 'vitest'
import { mayContainMacros } from '../src/core/utils.ts'

describe('mayContainMacros', () => {
  const attrs = { type: 'macro' }

  test('detects macro imports', () => {
    expect(
      mayContainMacros(`import { a } from './a' with { type: 'macro' }`, attrs),
    ).toBe(true)
    expect(
      mayContainMacros(`import { a } from './a' with {type:"macro"}`, attrs),
    ).toBe(true)
    expect(
      mayContainMacros(
        `import { a } from './a' with { 'type': 'macro' }`,
        attrs,
      ),
    ).toBe(true)
    expect(
      mayContainMacros(`export * from './a' assert { type: 'macro' }`, attrs),
    ).toBe(true)
  })

  test('ignores other modules', () => {
    expect(mayContainMacros(`import { a } from './a'`, attrs)).toBe(false)
    expect(
      mayContainMacros(`import a from './a.json' with { type: 'json' }`, attrs),
    ).toBe(false)
    expect(mayContainMacros(`const x = { subtype: 'macro' }`, attrs)).toBe(
      false,
    )
  })

  test('custom attrs', () => {
    const custom = { 'x-kind': 'macro', mode: 'build' }
    expect(
      mayContainMacros(
        `import a from './a' with { 'x-kind': 'macro', mode: 'build' }`,
        custom,
      ),
    ).toBe(true)
    expect(
      mayContainMacros(`import a from './a' with { mode: 'build' }`, custom),
    ).toBe(false)
  })
})
