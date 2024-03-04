/**
 * @module
 *
 * This entry file is for webpack plugin.
 *
 * ```ts
 * // webpack.config.js
 * module.exports = {
 *  plugins: [require('unplugin-macros/webpack')()],
 * }
 * ```
 */

import unplugin from './index'

export default unplugin.webpack
