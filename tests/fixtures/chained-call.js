import { getRandom } from './macros/rand' with { type: 'macro' }

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
