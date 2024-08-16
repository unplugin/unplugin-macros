/**
 * This entry file is for main unplugin.
 * @module
 */

import { type UnpluginInstance, createUnplugin } from 'unplugin'
import { createFilter } from '@rollup/pluginutils'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { type Options, resolveOptions } from './core/options'
import { transformMacros } from './core'
import type { ModuleNode, ViteDevServer } from 'vite'

export type { Options, MacroContext } from './core'

/**
 * The main unplugin instance.
 */
const plugin: UnpluginInstance<Options | undefined, false> = createUnplugin<
  Options | undefined,
  false
>((rawOptions = {}) => {
  const options = resolveOptions(rawOptions)
  const filter = createFilter(options.include, options.exclude)

  let externalServer: boolean
  let server: ViteDevServer
  let node: ViteNodeServer
  let runner: ViteNodeRunner | undefined

  const deps: Map<string, Set<string>> = new Map()

  let initPromise: Promise<void> | undefined
  function init() {
    if (initPromise) return initPromise
    return (initPromise = (async () => {
      externalServer = !!options.viteServer
      if (options.viteServer) {
        server = options.viteServer
        externalServer = false
      } else {
        server = await initServer()
      }
      initRunner()
    })())
  }

  async function initServer() {
    const { createServer } = await import('vite')
    const server = await createServer({
      ...options.viteConfig,
      optimizeDeps: {
        include: [],
        noDiscovery: true,
      },
    })
    await server.pluginContainer.buildStart({})
    return server
  }

  function initRunner() {
    // create vite-node server
    node = new ViteNodeServer(server)

    // fixes stacktraces in Errors
    installSourcemapsSupport({
      getSourceMap: (source) => node.getSourceMap(source),
    })

    // create vite-node runner
    runner = new ViteNodeRunner({
      root: server.config.root,
      base: server.config.base,
      // when having the server and runner in a different context,
      // you will need to handle the communication between them
      // and pass to this function
      fetchModule(id) {
        return node.fetchModule(id)
      },
      resolveId(id, importer) {
        return node.resolveId(id, importer)
      },
    })
  }

  async function getRunner() {
    await init()
    return runner!
  }

  const name = 'unplugin-macros'
  return {
    name,
    enforce: options.enforce,

    buildEnd() {
      if (!externalServer && server)
        // close the built-in vite server
        return server.close()
    },

    transformInclude(id) {
      return filter(id)
    },

    transform(source, id) {
      return transformMacros({
        source,
        id,
        getRunner,
        deps,
        attrs: options.attrs,
        unpluginContext: this,
      })
    },

    vite: {
      configureServer(server) {
        if (options.viteServer === undefined) {
          options.viteServer = server
        }
      },

      handleHotUpdate({ file, server, modules }) {
        if (!runner) return
        const cache = runner.moduleCache
        const mod = cache.get(file)
        if (!mod) return

        node.fetchCache.delete(file)
        cache.invalidateModule(mod)

        const affected = new Set<ModuleNode>()

        for (const [id, macrosIds] of deps.entries()) {
          if (!macrosIds.has(file)) continue
          server.moduleGraph
            .getModulesByFile(id)
            ?.forEach((m) => affected.add(m))
        }

        return [...affected, ...modules]
      },
    },
  }
})
export default plugin
