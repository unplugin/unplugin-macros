import { createUnplugin } from 'unplugin'
import { createFilter } from '@rollup/pluginutils'
import { type ModuleNode, type ViteDevServer, createServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { type Options, resolveOptions } from './core/options'
import { transformMacros } from './core'

export type { Options, MacroContext } from './core'

export default createUnplugin<Options | undefined, false>((rawOptions = {}) => {
  const options = resolveOptions(rawOptions)
  const filter = createFilter(options.include, options.exclude)

  let builtInServer = true
  let server: ViteDevServer
  let node: ViteNodeServer
  let runner: ViteNodeRunner

  const deps: Map<string, Set<string>> = new Map()

  async function initServer() {
    server = await createServer({
      ...options.viteConfig,
      optimizeDeps: {
        disabled: true,
      },
    })
    await server.pluginContainer.buildStart({})
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

  const name = 'unplugin-macros'
  return {
    name,
    enforce: options.enforce,

    async buildStart() {
      server || (await initServer())
      initRunner()
    },

    buildEnd() {
      if (builtInServer)
        // close the built-in vite server
        return server.close()
    },

    transformInclude(id) {
      return filter(id)
    },

    transform(code, id) {
      return transformMacros(code, id, runner, deps)
    },

    vite: {
      configureServer(_server) {
        builtInServer = false
        server = _server
      },

      handleHotUpdate({ file, server, modules }) {
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
