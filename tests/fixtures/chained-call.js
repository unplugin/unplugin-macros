import { arg } from './macros/args.ts' with { type: 'macro' }
import { getRandom } from './macros/rand.js' with { type: 'macro' }

function defineRoute(handler) {
  return {
    handler,
    meta(extra) {
      return { handler, ...extra }
    },
  }
}

const route = defineRoute(() => {
  return getRandom()
}).meta({ seed: getRandom() })

arg({ foo: 'foo' }).foo.toString()
