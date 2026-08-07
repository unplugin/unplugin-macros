import { getRandom } from './macros/rand.js' with { type: 'macro' }
import { inc } from './macros/inc.js' with { type: 'macro' }
import { foo, _undefined } from './macros/var.ts' with { type: 'macro' }

getRandom() === 0.5
inc() === 1
inc() === 2
inc() === 3
foo === 1
_undefined === undefined

const { bar = foo } = {}
