import { testFixtures } from '@sxzz/test-utils'
import { describe, vi } from 'vitest'
import { build } from './_utils.ts'

vi.spyOn(Math, 'random').mockReturnValue(0.5)

describe('fixture', async () => {
  await testFixtures(
    'fixtures/*.{js,ts}',
    async (args, id) =>
      (
        await build(id).catch((error: any) => {
          if (error.errors) {
            throw error.errors.map(String)
          }
          throw error
        })
      ).snapshot,
    {
      cwd: import.meta.dirname,
      promise: true,
    },
  )
})
