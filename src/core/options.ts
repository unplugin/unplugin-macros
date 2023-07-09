import { type InlineConfig } from 'vite'
import { type FilterPattern } from '@rollup/pluginutils'

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
}

export type OptionsResolved = Omit<Required<Options>, 'exclude'> & {
  exclude?: Options['exclude']
}

export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude || [/node_modules/],
    viteConfig: options.viteConfig || {},
  }
}
