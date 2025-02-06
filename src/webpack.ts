/**
 * This entry file is for webpack plugin.
 *
 * @module
 */

import unplugin from './index'

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
const webpack = unplugin.webpack as typeof unplugin.webpack
export default webpack
export { webpack as 'module.exports' }
