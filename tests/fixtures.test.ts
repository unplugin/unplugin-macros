import { resolve } from 'node:path'
import { describe, vi } from 'vitest'
import { rollupBuild, testFixtures } from '@vue-macros/test-utils'
import Macros from '../src/rollup'

vi.spyOn(Math, 'random').mockReturnValue(0.5)

describe('fixture', async () => {
  await testFixtures(
    'tests/fixtures/*.{js,ts}',
    (args, id) =>
      rollupBuild(id, [
        Macros(),
        {
          name: 'strip-types',
          transform(code) {
            return code.replaceAll('as any', '')
          },
        },
      ]),
    {
      cwd: resolve(__dirname, '..'),
      promise: true,
    },
  )
})
