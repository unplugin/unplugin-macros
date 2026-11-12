import {
  inf,
  negInf,
  nan,
  negZero,
  list,
  obj,
} from './macros/number.ts' with { type: 'macro' }

export const isInf = inf === Infinity
export const isNegInf = negInf === -Infinity
export const isNotANumber = Number.isNaN(nan)
export const isNegZero = Object.is(negZero, -0)
export const values = list
export const object = obj
