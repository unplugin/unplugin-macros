/**
 * This entry file is for main unplugin.
 * @module
 */

import { withMagicString } from 'rolldown-string'
import { createUnplugin, type UnpluginInstance } from 'unplugin'
import {
  transformMacros,
  VIRTUAL_ID_PATTERN,
  VIRTUAL_ID_PREFIX,
} from './core/index.ts'
import { resolveOptions, type Options } from './core/options.ts'
import type { MacroRunner } from './runner/index.ts'
import type { ModuleNode } from 'vite'

export * from './core/define.ts'
export * from './core/index.ts'
export * from './core/options.ts'

/**
 * The main unplugin instance.
 */
export const Macros: UnpluginInstance<Options | undefined, false> =
  createUnplugin<Options | undefined, false>((rawOptions = {}) => {
    const options = resolveOptions(rawOptions)
    const { include, exclude, runner } = options

    const deps: Map<string, Set<string>> = new Map()

    /**
     * The registry of virtual modules that hold deduplicated macro results,
     * mapping a content hash to the module code.
     * Entries are content-addressed, so they can be safely shared
     * across plugin instances.
     */
    const virtualModules = options.virtualModules
      ? new Map<string, string>()
      : undefined

    let initPromise: Promise<MacroRunner> | undefined
    function getRunner() {
      return (initPromise ??= Promise.resolve(runner.init?.()).then(
        () => runner,
      ))
    }

    return {
      name: 'unplugin-macros',
      enforce: options.enforce,

      async buildEnd() {
        await runner.close?.()
      },

      ...(virtualModules && {
        resolveId: {
          filter: { id: VIRTUAL_ID_PATTERN },
          handler: (id) => id,
        },

        load: {
          filter: { id: VIRTUAL_ID_PATTERN },
          handler(id) {
            const code = virtualModules.get(id.slice(VIRTUAL_ID_PREFIX.length))
            if (code == null) {
              throw new Error(
                `Macro virtual module ${id} is not found. ` +
                  `It may be caused by a stale bundler cache from a previous build; try clearing the cache.`,
              )
            }
            return code
          },
        },
      }),

      transform: {
        filter: { id: { include, exclude } },
        handler: withMagicString(function (s, id) {
          return transformMacros({
            s,
            id,
            getRunner,
            deps,
            attrs: options.attrs,
            virtualModules,
            unpluginContext: this,
          })
        }),
      },

      vite: {
        async handleHotUpdate({ file, server, modules }) {
          const invalidated = await runner.invalidate?.(file)
          if (!invalidated) return

          const stale = [...invalidated]
          if (!stale.length) return

          const affected = new Set<ModuleNode>()

          for (const [id, macrosIds] of deps) {
            if (stale.every((macro) => !macrosIds.has(macro))) continue
            server.moduleGraph
              .getModulesByFile(id)
              ?.forEach((m) => affected.add(m))
          }

          return [...affected, ...modules]
        },
      },
    }
  })
