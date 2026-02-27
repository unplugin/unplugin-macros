const __macro_export_0 = 'keep'

export {
  foo as namedFoo,
  bar as namedBar,
  _undefined as namedUndefined,
} from './macros/var' with { type: 'macro' }

export { default as defaultValue } from './macros/export-all' with { type: 'macro' }
export * from './macros/export-all' with { type: 'macro' }
export * as exportedValues from './macros/export-all' with { type: 'macro' }
