import { arg } from './macros/args' with { type: 'macro' }
import { promise, p } from './macros/promise' with { type: 'macro' }

const a = await promise()
const b = await p
const c = await arg(await Promise.resolve(42))
