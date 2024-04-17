import { endianness } from 'node:os' with { type: 'macro' }
import { readFile } from 'fs/promises' with { type: 'macro' }

endianness() === 'LE'
;(await readFile('.gitattributes', { encoding: 'utf8' })) ===
  // prettier-ignore
  "* text=auto eol=lf\n"
