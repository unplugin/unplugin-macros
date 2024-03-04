import { arg } from './macros/args' with { type: 'macro' }

arg(0) === 0
arg('1') === '1'
arg(false) === false
arg(null) === null
arg() === undefined
console.log(arg({ a: 'b' }))
console.log(arg([1, false, 'hello']))
