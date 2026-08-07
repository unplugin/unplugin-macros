import { rolldownBuild } from '@sxzz/test-utils'
import Macros from '../src/rolldown.ts'
import type { Options } from '../src/index.ts'

export function build(
  id: string,
  options: Options = {},
): ReturnType<typeof rolldownBuild> {
  return rolldownBuild(
    id,
    Macros(options),
    {
      treeshake: false,
      experimental: {
        attachDebugInfo: 'none',
      },
    },
    { minify: false },
  )
}
