/**
 * This entry file is for Rolldown plugin.
 *
 * @module
 */

import { Macros } from './index.ts'

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
const rolldown = Macros.rolldown as typeof Macros.rolldown
export default rolldown
export { rolldown as 'module.exports' }
