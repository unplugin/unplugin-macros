import { pathToFileURL } from 'node:url'
import {
  clearRequireCache,
  depsStore,
  init,
  isSupported,
} from 'import-without-cache'
import { resolveMacroPath } from './resolve.ts'
import type { MacroRunner } from './index.ts'

/**
 * The hooks installed by `import-without-cache` are process-global and
 * shared by every runner instance, so they are reference counted.
 */
let hooksRefCount = 0
let deregisterHooks: (() => void) | undefined

function acquireHooks(): void {
  if (hooksRefCount++ !== 0) return
  deregisterHooks = init({ skipNodeModules: true })
}

function releaseHooks(): void {
  if (--hooksRefCount !== 0) return
  deregisterHooks?.()
  deregisterHooks = undefined
}

/**
 * Options for {@link nativeRunner}.
 */
export interface NativeRunnerOptions {
  /**
   * Tracks the macro module graph so that editing a transitive dependency of a
   * macro invalidates it too. Requires `module.registerHooks` (Node.js >= 22.15).
   *
   * Disable it to execute macros with a plain `import()`; macro modules then
   * keep their original URLs, but only the macro entry file can be invalidated.
   * @default true when supported by the runtime
   */
  track?: boolean
}

/**
 * Executes macro modules with Node.js' native ESM loader.
 *
 * Nothing is bundled or transpiled ahead of time, which makes this the
 * cheapest runner. TypeScript relies on Node's native type stripping, so
 * non-erasable syntax (`enum`, `namespace`, parameter properties) is not
 * supported — use {@link unrunRunner} for those.
 *
 * This is the default runner.
 */
export function nativeRunner(options: NativeRunnerOptions = {}): MacroRunner {
  const track = options.track ?? isSupported

  /** Macro entry file -> its exports. */
  const modules = new Map<string, Promise<Record<string, unknown>>>()
  /** Macro entry file -> every file its execution touched, including itself. */
  const graphs = new Map<string, Set<string>>()

  let hooksAcquired = false
  function ensureHooks() {
    if (!track || hooksAcquired) return
    hooksAcquired = true
    acquireHooks()
  }

  return {
    init: ensureHooks,

    resolve: resolveMacroPath,

    import(resolved) {
      let module = modules.get(resolved)
      if (module) return module

      const url = pathToFileURL(resolved).href
      if (track) {
        ensureHooks()
        const deps = new Set<string>()
        graphs.set(resolved, deps)
        module = depsStore.run(
          deps,
          () => import(url, { with: { cache: 'no' } }),
        )
      } else {
        module = import(url)
      }

      modules.set(resolved, module)
      return module
    },

    invalidate(file) {
      const stale: string[] = []
      for (const [entry, deps] of graphs) {
        if (entry !== file && !deps.has(file)) continue
        modules.delete(entry)
        graphs.delete(entry)
        stale.push(entry)
      }
      // Without tracking there is no graph, so only the macro entry
      // itself can be matched.
      if (!track && modules.delete(file)) stale.push(file)
      if (stale.length) clearRequireCache()

      return stale
    },

    close() {
      modules.clear()
      graphs.clear()
      if (hooksAcquired) {
        hooksAcquired = false
        releaseHooks()
      }
    },
  }
}
