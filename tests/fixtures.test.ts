import { resolve } from 'node:path'
import { rollupBuild, testFixtures } from '@sxzz/test-utils'
import { describe, vi } from 'vitest'
import Macros from '../src/rollup'

vi.spyOn(Math, 'random').mockReturnValue(0.5)

describe('fixture', async () => {
  await testFixtures(
    'tests/fixtures/*.{js,ts}',
    async (args, id) =>
      (
        await rollupBuild(id, [
          Macros(),
          {
            name: 'strip-types',
            transform(code) {
              return code.replaceAll('as any', '')
            },
          },
        ])
      ).snapshot,
    {
      cwd: resolve(__dirname, '..'),
      promise: true,
    },
  )
})
