/**
 * This entry file is for esbuild plugin. Requires esbuild >= 0.15
 *
 * @module
 */

import { Macros } from './index.ts'

/**
 * Esbuild plugin
 *
 * @example
 * ```ts
 * // esbuild.config.js
 * import { build } from 'esbuild'
 *
 * build({
 *   plugins: [require('unplugin-macros/esbuild')()],
 * })
 * ```
 */
const esbuild = Macros.esbuild as typeof Macros.esbuild
export default esbuild
export { esbuild as 'module.exports' }
