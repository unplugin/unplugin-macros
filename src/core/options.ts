import { nativeRunner } from '../runner/native.ts'
import type { MacroRunner } from '../runner/index.ts'
import type { FilterPattern } from 'unplugin'

/**
 * Represents the options for the plugin.
 */
export interface Options {
  /**
   * The patterns of files to include.
   * @default [/\.[cm]?[jt]sx?$/]
   */
  include?: FilterPattern

  /**
   * The patterns of files to exclude.
   * @default [/node_modules/, /\.d\.[cm]?ts$/]
   */
  exclude?: FilterPattern

  /**
   * The runner that resolves and executes macro modules.
   *
   * Defaults to `nativeRunner()`, which uses Node.js' native ESM loader.
   * Use `unrunRunner()` to bundle macro modules with Rolldown first.
   * @default nativeRunner()
   */
  runner?: MacroRunner

  /**
   * Adjusts the plugin order (only works for Vite and Webpack).
   * @default 'pre'
   */
  enforce?: 'pre' | 'post' | undefined

  /**
   * The mapping of import attributes.
   * @default { "type": "macro" }
   */
  attrs?: Record<string, string>

  /**
   * Extract macro results into shared virtual modules instead of inlining
   * the serialized value at every usage site,
   * so the same data is emitted only once in the bundle.
   *
   * Note that all usage sites will share a single value instance.
   * @default false
   */
  virtualModules?: boolean
}

/**
 * Represents the resolved options for the plugin.
 */
export type OptionsResolved = Omit<Required<Options>, 'enforce'> & {
  enforce?: Options['enforce']
}

/**
 * Resolves the options for the plugin.
 *
 * @param options - The options to resolve.
 * @returns The resolved options.
 */
export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude || [/node_modules/, /\.d\.[cm]?ts$/],
    runner: options.runner || nativeRunner(),
    enforce: 'enforce' in options ? options.enforce : 'pre',
    attrs: options.attrs || { type: 'macro' },
    virtualModules: options.virtualModules ?? false,
  }
}
