import { nodeLib } from 'tsdown-preset-sxzz'
import tsnapi from 'tsnapi/rolldown'

export default nodeLib(
  {
    entry: 'shallow',
  },
  {
    plugins: [tsnapi()],
  },
)
