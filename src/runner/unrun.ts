import { resolveMacroPath } from './resolve.ts'
import type { MacroRunner } from './index.ts'
import type { Options as UnrunOptions } from 'unrun'

/**
 * Options for {@link unrunRunner}, forwarded to `unrun`.
 *
 * `path` and `preset` are managed by the runner: the path comes from the macro
 * specifier, and the preset is always `bundle-require` so that the macro's full
 * module namespace is returned instead of just its default export.
 */
export type UnrunRunnerOptions = Omit<UnrunOptions, 'path' | 'preset'>

/**
 * Executes macro modules through [unrun](https://github.com/Gugustinette/unrun),
 * which bundles them with Rolldown first.
 *
 * Because macro modules are compiled rather than type-stripped, everything
 * Rolldown understands works: `enum` and other non-erasable TypeScript syntax,
 * JSX, extensionless imports inside the macro module, `tsconfig` paths, and
 * aliases or plugins passed through `inputOptions`.
 *
 * Requires `unrun` to be installed.
 */
export function unrunRunner(options: UnrunRunnerOptions = {}): MacroRunner {
  /** Macro entry file -> its exports. */
  const modules = new Map<string, Promise<Record<string, unknown>>>()
  /** Macro entry file -> every local file it was bundled from, including itself. */
  const graphs = new Map<string, Set<string>>()

  let unrunPromise: Promise<typeof import('unrun')> | undefined
  function loadUnrun() {
    return (unrunPromise ??= import('unrun'))
  }

  return {
    async init() {
      await loadUnrun()
    },

    resolve: resolveMacroPath,

    import(resolved) {
      let module = modules.get(resolved)
      if (module) return module

      // seeded with the entry so it can be invalidated before the bundle
      // finishes and reports the rest of the graph
      const deps = new Set([resolved])
      graphs.set(resolved, deps)

      module = loadUnrun().then(async ({ unrun }) => {
        const result = await unrun<Record<string, unknown>>({
          ...options,
          path: resolved,
          preset: 'bundle-require',
        })
        for (const dep of result.dependencies) deps.add(dep)
        return result.module
      })

      modules.set(resolved, module)
      return module
    },

    invalidate(file) {
      const stale: string[] = []
      for (const [entry, deps] of graphs) {
        if (!deps.has(file)) continue
        modules.delete(entry)
        graphs.delete(entry)
        stale.push(entry)
      }
      return stale
    },

    close() {
      modules.clear()
      graphs.clear()
    },
  }
}
