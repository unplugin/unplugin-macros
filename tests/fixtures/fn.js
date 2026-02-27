import { arg } from './macros/args' with { type: 'macro' }

arg(() => 42)
arg(async () => await 42)
arg(function () {
  return 42
})
arg(async function () {
  return await 42
})
