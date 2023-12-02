import type { InlineConfig, ViteDevServer } from 'vite'
import type { FilterPattern } from '@rollup/pluginutils'

export interface Options {
  /**
   * @default [/\.[cm]?[jt]sx?$/]
   */
  include?: FilterPattern
  /**
   * @default [/node_modules/]
   */
  exclude?: FilterPattern
  /**
   * Vite dev server instance
   *
   * If not provided and the bundler is Vite, it will be reuse current dev server.
   * If not provided, it will try to use `viteConfig` to create one.
   */
  viteServer?: ViteDevServer | false
  /**
   * Available when `viteServer` is not provided.
   * @see https://vitejs.dev/config/
   */
  viteConfig?: InlineConfig
  /**
   * Adjust the plugin order (only works for Vite and Webpack)
   * @default 'pre'
   */
  enforce?: 'pre' | 'post' | undefined

  /**
   * Import attribute mapping
   *
   * @default { "type": "macro" }
   */
  attrs?: Record<string, string>
}

export type OptionsResolved = Omit<
  Required<Options>,
  'enforce' | 'viteServer'
> & {
  enforce?: Options['enforce']
  viteServer?: Options['viteServer']
}

export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude || [/node_modules/],
    viteServer: options.viteServer,
    viteConfig: options.viteConfig || {},
    enforce: 'enforce' in options ? options.enforce : 'pre',
    attrs: options.attrs || { type: 'macro' },
  }
}
