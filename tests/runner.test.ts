import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { resolveOptions } from '../src/core/options.ts'
import { nativeRunner } from '../src/runner/native.ts'
import { unrunRunner } from '../src/runner/unrun.ts'
import { build } from './_utils.ts'

const fixtures = path.resolve(import.meta.dirname, 'fixtures')
const importer = path.join(fixtures, 'basic.js')

async function tempDir(): Promise<string> {
  // real path, since that is what bundlers report for changed files
  return fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'unplugin-macros-')),
  )
}

async function withTempMacro(
  fn: (entry: string, helper: string) => Promise<void>,
  /** Written as CommonJS, which the ESM cache-busting URL cannot reach. */
  cjs = false,
): Promise<void> {
  const dir = await tempDir()
  const entry = path.join(dir, 'entry.ts')
  const helper = path.join(dir, cjs ? 'helper.cjs' : 'helper.ts')
  await fs.writeFile(
    entry,
    cjs
      ? `import helper from './helper.cjs'\nexport const value: string = helper.value\n`
      : `export { value } from './helper.ts'\n`,
  )
  await fs.writeFile(helper, writeHelper('before', cjs))
  try {
    await fn(entry, helper)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

function writeHelper(value: string, cjs: boolean): string {
  return cjs
    ? `module.exports = { value: '${value}' }\n`
    : `export const value: string = '${value}'\n`
}

describe('runner option', () => {
  test('defaults to nativeRunner', async () => {
    const { runner } = resolveOptions({})
    expect(await runner.resolve('./macros/rand.js', importer)).toBe(
      path.join(fixtures, 'macros/rand.js'),
    )
  })

  test('uses a custom runner', async () => {
    const resolved: string[] = []
    let initCalls = 0
    const { snapshot } = await build(path.join(fixtures, 'basic.js'), {
      runner: {
        init() {
          initCalls++
        },
        resolve(source, importer) {
          resolved.push(source)
          return path.resolve(path.dirname(importer), source)
        },
        import: () => ({
          getRandom: () => 'custom-runner',
          inc: () => 0,
          foo: 'custom-foo',
          _undefined: undefined,
        }),
      },
    })

    expect(initCalls).toBe(1)
    expect(resolved).toContain('./macros/rand.js')
    expect(snapshot).toContain('custom-runner')
    expect(snapshot).toContain('custom-foo')
  })

  test('never inits the runner when no macro is used', async () => {
    let initCalls = 0
    await build(path.join(fixtures, 'macros/rand.js'), {
      runner: {
        init() {
          initCalls++
        },
        resolve: (source) => source,
        import: () => ({}),
      },
    })
    expect(initCalls).toBe(0)
  })
})

describe.for([
  ['nativeRunner', nativeRunner],
  ['unrunRunner', unrunRunner],
] as const)('%s', ([, createRunner]) => {
  test('resolves relative specifiers against the importer', async () => {
    const runner = createRunner()
    expect(await runner.resolve('./macros/args.ts', importer)).toBe(
      path.join(fixtures, 'macros/args.ts'),
    )
  })

  test('passes builtin modules through untouched', async () => {
    const runner = createRunner()
    expect(await runner.resolve('node:os', importer)).toBe('node:os')
    expect(await runner.resolve('fs/promises', importer)).toBe('fs/promises')
  })

  test('resolves bare specifiers from the importer', async () => {
    const runner = createRunner()
    const resolved = await runner.resolve('dedent', importer)
    expect(path.isAbsolute(resolved)).toBe(true)
    expect(resolved).toContain(`${path.sep}dedent${path.sep}`)
  })

  test('reuses the module instance so macros can hold state', async () => {
    const runner = createRunner()
    const resolved = await runner.resolve('./macros/inc.js', importer)

    const first = (await runner.import(resolved)) as { inc: () => number }
    const second = (await runner.import(resolved)) as { inc: () => number }

    expect(first).toBe(second)
    expect(first.inc()).toBe(1)
    expect(second.inc()).toBe(2)

    await runner.close?.()
  })

  test.for([false, true])(
    'invalidates a macro when its transitive dependency changes (cjs: %s)',
    async (cjs) => {
      await withTempMacro(async (entry, helper) => {
        const runner = createRunner()
        try {
          const resolved = await runner.resolve('./entry.ts', entry)
          expect(((await runner.import(resolved)) as any).value).toBe('before')

          await fs.writeFile(helper, writeHelper('after', cjs))

          // an unrelated file leaves the macro graph alone
          const unrelated = path.join(path.dirname(entry), 'other.ts')
          expect([...((await runner.invalidate?.(unrelated)) ?? [])]).toEqual(
            [],
          )
          expect(((await runner.import(resolved)) as any).value).toBe('before')

          // the transitive dependency reports the macro entry as stale
          expect([...((await runner.invalidate?.(helper)) ?? [])]).toEqual([
            resolved,
          ])
          expect(((await runner.import(resolved)) as any).value).toBe('after')
        } finally {
          await runner.close?.()
        }
      }, cjs)
    },
  )
})

describe('unrunRunner', () => {
  test('produces the same output as the default runner', async () => {
    const entry = path.join(fixtures, 'args.js')
    const native = await build(entry)
    const unrun = await build(entry, { runner: unrunRunner() })
    expect(unrun.snapshot).toBe(native.snapshot)
  })

  test('supports non-erasable TypeScript syntax that Node cannot strip', async () => {
    const dir = await tempDir()
    const entry = path.join(dir, 'enum.ts')
    await fs.writeFile(
      entry,
      `export enum Level { Debug = 3 }\nexport const level = Level.Debug\n`,
    )

    try {
      const native = nativeRunner()
      await expect(native.import(entry)).rejects.toThrow(
        /enum is not supported in strip-only mode/,
      )
      await native.close?.()

      const runner = unrunRunner()
      expect(((await runner.import(entry)) as any).level).toBe(3)
      await runner.close?.()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
