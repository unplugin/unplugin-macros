import { arg } from './macros/args' with { type: 'macro' }

arg(arg(10) + 1) === 11
