export * from './native.ts'
export * from './resolve.ts'
export * from './unrun.ts'

type Thenable<T> = T | PromiseLike<T>

/**
 * Resolves and executes macro modules.
 *
 * Resolution and execution are separate steps so that the dependency is
 * recorded before the module runs — a macro that throws still keeps its
 * dependency edge, which is what lets HMR recover once it is fixed.
 */
export interface MacroRunner {
  /**
   * Prepares the runner. Called at most once, and only once a macro has
   * actually been found, so that expensive setup is skipped entirely for
   * builds that use no macros.
   */
  init?: () => Thenable<void>

  /**
   * Resolves a macro specifier to an absolute file path,
   * or to a `node:` builtin module id.
   */
  resolve: (source: string, importer: string) => Thenable<string>

  /**
   * Executes the resolved macro module and returns its exports.
   */
  import: (resolved: string) => Thenable<Record<string, unknown>>

  /**
   * Invalidates a changed file.
   *
   * Returns the macro modules that went stale, identified by the same paths
   * {@link MacroRunner.resolve} returns. A runner that tracks the whole macro
   * graph may report modules other than `file` itself — editing a transitive
   * dependency invalidates every macro module that reached it.
   */
  invalidate?: (file: string) => Thenable<Iterable<string> | undefined>

  /**
   * Releases resources the runner created.
   */
  close?: () => Thenable<void>
}
