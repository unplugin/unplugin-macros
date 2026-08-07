import path from 'node:path'
import { rollupBuild } from '@sxzz/test-utils'
import { describe, expect, test } from 'vitest'
import { resolveOptions } from '../src/core/index.ts'
import Macros from '../src/rollup.ts'

const entry = path.resolve(import.meta.dirname, 'fixtures/dedupe/entry.js')

describe('dedupe', () => {
  test('disabled by default', () => {
    expect(resolveOptions({}).virtualModules).toBe(false)
  })

  test('inlines macro results when disabled', async () => {
    const { snapshot } = await rollupBuild(entry, [Macros()])
    // `config` is used twice in a.js, once via getConfig() in b.js,
    // and once as a shorthand property in c.js
    expect(snapshot.match(/dedupe-marker/g)).toHaveLength(4)
  })

  test('extracts macro results into shared virtual modules', async () => {
    const { snapshot } = await rollupBuild(entry, [
      Macros({ virtualModules: true }),
    ])
    expect(snapshot).toMatchSnapshot()
    // the same value is emitted only once and shared across modules,
    // while distinct values get their own virtual modules
    expect(snapshot.match(/dedupe-marker/g)).toHaveLength(1)
    expect(snapshot.match(/args-marker/g)).toHaveLength(1)
    expect(snapshot).toContain('async-value')
    // function results carry their own `$macros$wrap` inside the virtual module
    expect(snapshot).toContain('fn-value')
  })
})
