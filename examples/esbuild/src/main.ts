/* eslint-disable no-console */

import { getStartupTime, rand } from './macros' with { type: 'macro' }

console.log('Hello, world!')
console.log('startup time', getStartupTime())
console.log('rand', rand())

export interface Test {
  foo?: string
}
