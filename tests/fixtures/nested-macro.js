import { arg } from './macros/args.ts' with { type: 'macro' }

arg(arg(10) + 1) === 11
