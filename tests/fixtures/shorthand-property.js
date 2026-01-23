import { foo, _undefined, bar, baz } from './macros/var' with { type: 'macro' }

const mixed = {
  ...{ existing: true },
  foo,
  regular: 'value',
  bar,
  baz,
  another: 123,
  outer: {
    foo,
    bar,
  },
  _undefined,
}
