/**
 * This entry file is for Vite plugin.
 *
 * @module
 */

import { Macros } from './index.ts'

/**
 * Vite plugin
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import Macros from 'unplugin-macros/vite'
 *
 * export default defineConfig({
 *   plugins: [Macros()],
 * })
 * ```
 */
const vite = Macros.vite as typeof Macros.vite
export default vite
export { vite as 'module.exports' }
