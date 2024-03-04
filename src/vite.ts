/**
 * @module
 *
 * This entry file is for Vite plugin.
 *
 * ```ts
 * // vite.config.ts
 * import Macros from 'unplugin-macros/vite'
 *
 * export default defineConfig({
 *   plugins: [Macros()],
 * })
 * ```
 */

import unplugin from './index'

export default unplugin.vite
