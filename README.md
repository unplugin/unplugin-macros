# unplugin-macros

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![JSR][jsr-src]][jsr-href]
[![Unit Test][unit-test-src]][unit-test-href]

> Macros are a mechanism for running JavaScript functions at bundle-time.
> The value returned from these functions or variables are directly inlined into your bundle.

## Installation

```bash
# npm
npm i -D unplugin-macros

# jsr
npx jsr add -D @unplugin/macros
```

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import Macros from 'unplugin-macros/vite'

export default defineConfig({
  plugins: [Macros()],
})
```

<br></details>

<details>
<summary>Rollup</summary><br>

```ts
// rollup.config.js
import Macros from 'unplugin-macros/rollup'

export default {
  plugins: [Macros()],
}
```

<br></details>

<details>
<summary>esbuild</summary><br>

Requires esbuild >= 0.15

```ts
// esbuild.config.js
import { build } from 'esbuild'

build({
  plugins: [require('unplugin-macros/esbuild')()],
})
```

<br></details>

<details>
<summary>Webpack</summary><br>

```ts
// webpack.config.js
module.exports = {
  /* ... */
  plugins: [require('unplugin-macros/webpack')()],
}
```

<br></details>

## Usage

```js
// main.js
import { buildTime, getRandom } from './macros.js' with { type: 'macro' }

getRandom() // Will be replaced with a random number at build time
buildTime // Will be replaced with the timestamp at the build time
```

```js
// macros.js
export function getRandom() {
  return Math.random()
}
export const buildTime = Date.now()
```

Macro specifiers are resolved by the [runner](#runners). The default runner follows
Node.js' ESM resolution, so relative specifiers need their file extension —
`'./macros.js'`, not `'./macros'`.

### Function Arguments

You can pass function values as arguments to macros. Functions must be isolated (no references to outside identifiers):

```js
// main.js
import { transform } from './macros.js' with { type: 'macro' }

transform(() => 42)
transform(async () => {
  const os = await import('node:os')
  return os.endianness()
})
```

See more in [Bun Macros](https://bun.sh/blog/bun-macros).

### MacroContext

Every macro is invoked with a `MacroContext` as its `this`. The most useful fields are:

| Field             | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `id`              | Absolute path of the file being transformed.                                      |
| `source`          | Full source code of the file.                                                     |
| `ast.call`        | `CallExpression` AST node of this macro invocation (`await` / tagged template are unwrapped). |
| `ast.program`     | `Program` AST of the whole file.                                                  |
| `emitFile`        | Emit additional bundle assets.                                                    |
| `unpluginContext` | The underlying unplugin build context — experimental, may change.                 |

`ast.call` carries the source offsets (`start`, `end`) of the invocation, which is enough to build callsite-aware macros without paying for a runtime stack walk:

```ts
// macros.ts
import path from 'node:path'
import type { MacroContext } from 'unplugin-macros'

export function $callsite(this: MacroContext): string {
  const before = this.source.slice(0, this.ast.call.start)
  const line = before.split('\n').length
  const column = this.ast.call.start - (before.lastIndexOf('\n') + 1)
  return `${path.basename(this.id)}:${line}:${column}`
}
```

```ts
// main.ts
import { $callsite } from './macros.ts' with { type: 'macro' }

console.log($callsite()) // → 'main.ts:3:12'
```

### TypeScript

Import Attributes syntax is supported in TypeScript 5.3 and above.

### ESLint

Import Attributes syntax is supported in ESLint v9.14.0.

## Runners

A runner resolves and executes macro modules. Two are built in, and both resolve
macro specifiers the same way — following Node.js' ESM resolution, so relative
specifiers need their file extension (`'./macros.ts'`, not `'./macros'`).

Editing a macro module — or anything it imports — invalidates it during dev.

### `nativeRunner` (default)

Runs macros on Node.js' native ESM loader. Nothing is bundled or transpiled
ahead of time, which makes it the cheapest option, and it needs no extra
dependency.

TypeScript relies on Node's native type stripping, so:

- non-erasable syntax (`enum`, `namespace`, parameter properties) is not
  supported
- macro modules published as `.ts` inside `node_modules` cannot be loaded
- no aliases, `tsconfig` paths, JSX, or non-JS imports inside macro modules

```ts
import { nativeRunner } from 'unplugin-macros'
import Macros from 'unplugin-macros/vite'

Macros({ runner: nativeRunner() })
```

### `unrunRunner`

Bundles each macro module with [unrun](https://github.com/Gugustinette/unrun)
(Rolldown) before executing it, so everything Rolldown understands works: `enum`
and other non-erasable TypeScript syntax, JSX, extensionless imports *inside* the
macro module, `tsconfig` paths, and aliases or plugins via `inputOptions`.

Requires `unrun` to be installed — it is an optional peer dependency.

```ts
import { unrunRunner } from 'unplugin-macros'
import Macros from 'unplugin-macros/vite'

Macros({
  runner: unrunRunner({
    inputOptions: { resolve: { alias: { '~': './src' } } },
  }),
})
```

### Custom runners

Any object matching the `MacroRunner` interface works — this is the escape hatch
for loaders such as `jiti` or `tsx`:

```ts
import path from 'node:path'
import { createJiti } from 'jiti'
import Macros from 'unplugin-macros/vite'

const jiti = createJiti(import.meta.url)

Macros({
  runner: {
    resolve: (source, importer) =>
      jiti.esmResolve(source, { parentURL: path.dirname(importer) }),
    import: (resolved) => jiti.import(resolved),
  },
})
```

`init` (called once, lazily, only when a macro is actually found), `invalidate`
and `close` are optional.

## Options

Refer to [docs](https://jsr.io/@unplugin/macros/doc/api/~/Options).

## Thanks

Thanks to [Bun Macros](https://bun.sh/blog/bun-macros).

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2023-PRESENT [Kevin Deng](https://github.com/sxzz)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/unplugin-macros.svg
[npm-version-href]: https://npmjs.com/package/unplugin-macros
[npm-downloads-src]: https://img.shields.io/npm/dm/unplugin-macros
[npm-downloads-href]: https://www.npmcharts.com/compare/unplugin-macros?interval=30
[jsr-src]: https://jsr.io/badges/@unplugin/macros
[jsr-href]: https://jsr.io/@unplugin/macros
[unit-test-src]: https://github.com/unplugin/unplugin-macros/actions/workflows/unit-test.yml/badge.svg
[unit-test-href]: https://github.com/unplugin/unplugin-macros/actions/workflows/unit-test.yml
