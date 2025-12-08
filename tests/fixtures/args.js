import { arg } from './macros/args' with { type: 'macro' }

arg(0) === 0
arg('1') === '1'
arg(false) === false
arg(null) === null
arg() === undefined
console.log(
  arg({
    a: 'b',
    date: new Date(0),
    regexp: /abc/g,
  }),
)
console.log(arg([1, false, 'hello', undefined, null, 2n]))
