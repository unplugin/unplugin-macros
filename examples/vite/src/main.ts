/* eslint-disable no-console */

import { echo, getStartupTime, rand } from './macros' with { type: 'macro' }

console.log('Hello, world!')
console.log('startup time', getStartupTime())
console.log('rand', rand())

console.log('echo', echo(typeof getStartupTime()))

if (import.meta.hot) {
  import.meta.hot.accept()
}
