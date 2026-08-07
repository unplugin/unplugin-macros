/**
 * This entry file is for rspack plugin.
 *
 * @module
 */

import { Macros } from './index.ts'

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
const rspack = Macros.rspack as typeof Macros.rspack
export default rspack
export { rspack as 'module.exports' }
