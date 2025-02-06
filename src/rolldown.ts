/**
 * This entry file is for Rolldown plugin.
 *
 * @module
 */

import unplugin from './index'

/**
 * Rolldown plugin
 *
 * @example
 * ```ts
 * // rolldown.config.js
 * import Macros from 'unplugin-macros/rolldown'
 *
 * export default {
 *   plugins: [Macros()],
 * }
 * ```
 */
const rolldown = unplugin.rolldown as typeof unplugin.rolldown
export default rolldown
export { rolldown as 'module.exports' }
