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
