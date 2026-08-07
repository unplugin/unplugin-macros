import { realpathSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RE_RELATIVE = /^\.{1,2}\//

/**
 * Node's ESM loader resolves symlinks, so the paths it reports for a module's
 * dependencies are real paths. Macro paths have to be normalized the same way
 * or they will not line up — bundlers report real paths too.
 */
function realpath(file: string): string {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

/**
 * Resolves a macro specifier following Node.js' ESM resolution, so relative
 * specifiers need their file extension (`'./macros.ts'`, not `'./macros'`).
 *
 * Shared by the built-in runners so that the same macro import works
 * whichever one is in use.
 */
export function resolveMacroPath(source: string, importer: string): string {
  if (isBuiltin(source)) return source
  if (source.startsWith('file:')) return realpath(fileURLToPath(source))
  if (RE_RELATIVE.test(source) || source.startsWith('/')) {
    return realpath(fileURLToPath(new URL(source, pathToFileURL(importer))))
  }
  // Bare specifiers go through Node's resolver. `import.meta.resolve` cannot
  // be used here: its `parent` argument is still flagged and is silently
  // ignored without `--experimental-import-meta-resolve`, which would resolve
  // against this file instead of the importer.
  return realpath(createRequire(importer).resolve(source))
}
