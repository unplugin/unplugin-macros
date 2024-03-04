/**
 * @module
 *
 * This entry file is for esbuild plugin. Requires esbuild >= 0.15
 *
 * ```ts
 * // esbuild.config.js
 * import { build } from 'esbuild'
 *
 * build({
 *   plugins: [require('unplugin-macros/esbuild')()],
 * })
 * ```
 */

import unplugin from './index'

export default unplugin.esbuild
