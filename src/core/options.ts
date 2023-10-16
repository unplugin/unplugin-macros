import type { InlineConfig } from 'vite'
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
   * Available except Vite itself.
   *
   * For Vite, the current Vite instance and configuration will be used directly, so this option will be ignored.
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

export type OptionsResolved = Omit<Required<Options>, 'enforce'> & {
  enforce?: Options['enforce']
}

export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude || [/node_modules/],
    viteConfig: options.viteConfig || {},
    enforce: 'enforce' in options ? options.enforce : 'pre',
    attrs: options.attrs || { type: 'macro' },
  }
}
