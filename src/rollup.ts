/**
 * This entry file is for Rollup plugin.
 *
 * @module
 */

import { Macros } from './index.ts'

/**
 * Rollup plugin
 *
 * @example
 * ```ts
 * // rollup.config.js
 * import Macros from 'unplugin-macros/rollup'
 *
 * export default {
 *   plugins: [Macros()],
 * }
 * ```
 */
const rollup = Macros.rollup as typeof Macros.rollup
export default rollup
export { rollup as 'module.exports' }
