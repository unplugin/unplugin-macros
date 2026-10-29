import { is } from 'yuku-ast'
import type { Expression, Identifier, Super } from 'yuku-parser'

/**
 * Flattens a member chain into its root identifier and the dotted path leading
 * to it, e.g. `ns.foo.bar` -> `['ns', 'foo', 'bar']`. Returns `undefined` when
 * the chain is not statically resolvable.
 */
export function resolveMemberChain(
  node: Expression | Super,
): { root: Identifier; id: string[] } | undefined {
  const id: string[] = []
  let current: Expression | Super = node
  while (current.type === 'MemberExpression') {
    if (current.computed) {
      if (
        !is.StringLiteral(current.property) &&
        !is.NumericLiteral(current.property)
      ) {
        return
      }
      id.unshift(String(current.property.value))
    } else if (is.Identifier(current.property)) {
      id.unshift(current.property.name)
    } else {
      return
    }
    current = current.object
  }
  if (!is.Identifier(current)) return
  id.unshift(current.name)
  return { root: current, id }
}

function escapeRegExp(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

/**
 * Cheaply checks whether the source may import a macro, i.e. whether every
 * expected import attribute appears as a `key: 'value'` pair. It may report
 * false positives, but never misses a macro import.
 */
export function mayContainMacros(
  source: string,
  attrs: Record<string, string>,
): boolean {
  return Object.entries(attrs).every(([key, value]) => {
    const k = escapeRegExp(key)
    const v = escapeRegExp(value)
    return new RegExp(
      String.raw`(?:(?<![\w$])${k}(?![\w$])|(['"])${k}\1)\s*:\s*(['"])${v}\2`,
    ).test(source)
  })
}
