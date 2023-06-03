import type { InlineConfig } from 'vite'
import type { FilterPattern } from '@rollup/pluginutils'

export interface Options {
  include?: FilterPattern
  exclude?: FilterPattern
  viteConfig?: InlineConfig
}

export type OptionsResolved = Omit<Required<Options>, 'exclude'> & {
  exclude?: Options['exclude']
}

export function resolveOptions(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude,
    viteConfig: options.viteConfig || {},
  }
}
