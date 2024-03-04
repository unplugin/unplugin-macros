/**
 * @module
 *
 * This entry file is for Rollup plugin.
 *
 * ```ts
 * // rollup.config.js
 * import Macros from 'unplugin-macros/rollup'
 *
 * export default {
 *   plugins: [Macros()],
 * }
 * ```
 */

import unplugin from './index'

export default unplugin.rollup
