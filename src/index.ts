import { createUnplugin } from 'unplugin'
import { createFilter } from '@rollup/pluginutils'
import { resolveOption } from './core/options'
import type { Options } from './core/options'

export default createUnplugin<Options | undefined>((rawOptions = {}) => {
  const options = resolveOption(rawOptions)
  const filter = createFilter(options.include, options.exclude)

  const name = 'unplugin-macros'
  return {
    name,
    enforce: undefined,

    transformInclude(id) {
      return filter(id)
    },

    transform(code, id) {
      // eslint-disable-next-line no-console
      console.log(code, id)
      return undefined
    },
  }
})
