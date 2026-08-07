/**
 * This entry file is for webpack plugin.
 *
 * @module
 */

import { Macros } from './index.ts'

/**
 * Webpack plugin
 *
 * @example
 * ```ts
 * // webpack.config.js
 * module.exports = {
 *  plugins: [require('unplugin-macros/webpack')()],
 * }
 * ```
 */
const webpack = Macros.webpack as typeof Macros.webpack
export default webpack
export { webpack as 'module.exports' }
