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
export default unplugin.rolldown as typeof unplugin.rolldown
