import { promise, p } from './macros/promise' with { type: 'macro' }

const a = await promise()
const b = await p
