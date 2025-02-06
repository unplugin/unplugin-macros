/**
 * This entry file is for rspack plugin.
 *
 * @module
 */

import unplugin from './index'

/**
 * Rspack plugin
 *
 * @example
 * ```ts
 * // rspack.config.js
 * module.exports = {
 *  plugins: [require('unplugin-macros/rspack')()],
 * }
 * ```
 */
const rspack = unplugin.rspack as typeof unplugin.rspack
export default rspack
export { rspack as 'module.exports' }
