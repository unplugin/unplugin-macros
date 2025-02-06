/**
 * This entry file is for Rollup plugin.
 *
 * @module
 */

import unplugin from './index'

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
const rollup = unplugin.rollup as typeof unplugin.rollup
export default rollup
export { rollup as 'module.exports' }
