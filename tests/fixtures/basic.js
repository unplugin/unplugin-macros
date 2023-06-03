import { getRandom } from './macros/rand' assert { type: 'macro' }
import { inc } from './macros/inc' assert { type: 'macro' }
import { arg } from './macros/args' assert { type: 'macro' }

getRandom()
inc()
inc()
inc()
arg(0)
arg('1')
arg(false)
arg(null)
arg()
