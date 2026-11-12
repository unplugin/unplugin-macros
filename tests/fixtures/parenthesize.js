import {
  version,
  offset,
  defaults,
  list,
  pattern,
} from './macros/values.ts' with { type: 'macro' }

export const fixed = version().toFixed(1)
export const negated = -offset()
export const signed = +offset()
export const power = offset() ** 2
export const getDefaults = () => defaults()
export const negative = offset().toString()
// prettier-ignore
export const minus = 5-offset()
export const plus = 5 + offset()

let total = 0
list().forEach((n) => (total += n))
offset() === -1
pattern().test('a')
