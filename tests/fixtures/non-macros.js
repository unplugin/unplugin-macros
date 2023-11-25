import { getRandom } from './macros/rand' with { type: 'macro' }
import { toString } from './macros/string' with { type: 'macro' }

{
  const getRandom = () => 2
  getRandom() === 2
}

''.toString()

const genHex = () =>
  Math.floor(Math.random() * 255)
    .toString(16)
    .padStart(2, '0')

const foo = {
  toString: '',
}

class TestCls {
  toString() {}
  #toString() {}
}
