import type { FilterPattern } from 'unplugin'
import type { InlineConfig, ViteDevServer } from 'vite'

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
   * The Vite dev server instance.
   *
   * If not provided and the bundler is Vite, it will reuse the current dev server.
   * If not provided, it will try to use `viteConfig` to create one.
   */
  viteServer?: ViteDevServer | false

  /**
   * The Vite configuration.
   * Available when `viteServer` is not provided.
   * @see https://vitejs.dev/config/
   */
  viteConfig?: InlineConfig

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
}

/**
 * Represents the resolved options for the plugin.
 */
export type OptionsResolved = Omit<
  Required<Options>,
  'enforce' | 'viteServer'
> & {
  enforce?: Options['enforce']
  viteServer?: Options['viteServer']
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
    viteServer: options.viteServer,
    viteConfig: options.viteConfig || {},
    enforce: 'enforce' in options ? options.enforce : 'pre',
    attrs: options.attrs || { type: 'macro' },
  }
}
