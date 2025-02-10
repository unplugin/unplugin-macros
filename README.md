# unplugin-macros [![npm](https://img.shields.io/npm/v/unplugin-macros.svg)](https://npmjs.com/package/unplugin-macros) [![jsr](https://img.shields.io/endpoint?url=https%3A%2F%2Fjsr-api.sxzz.moe%2Fbadge%2F%40unplugin%2Fmacros)](https://jsr.io/@unplugin/macros)

[![Unit Test](https://github.com/unplugin/unplugin-macros/actions/workflows/unit-test.yml/badge.svg)](https://github.com/unplugin/unplugin-macros/actions/workflows/unit-test.yml)

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
import { buildTime, getRandom } from './macros' with { type: 'macro' }

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

See more in [Bun Macros](https://bun.sh/blog/bun-macros).

### TypeScript

Import Attributes syntax is supported in TypeScript 5.3 and above.

### ESLint

Import Attributes syntax is supported in ESLint v9.14.0.

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

[MIT](./LICENSE) License © 2023-PRESENT [三咲智子](https://github.com/sxzz)
