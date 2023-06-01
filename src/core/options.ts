import type { FilterPattern } from '@rollup/pluginutils'

export interface Options {
  include?: FilterPattern
  exclude?: FilterPattern
}

export type OptionsResolved = Omit<Required<Options>, 'exclude'> & {
  exclude?: Options['exclude']
}

export function resolveOption(options: Options): OptionsResolved {
  return {
    include: options.include || [/\.[cm]?[jt]sx?$/],
    exclude: options.exclude,
  }
}
