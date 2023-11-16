import {
  type ImportBinding,
  type WithScope,
  attachScopes,
  babelParse,
  getLang,
  isLiteralType,
  isReferenced,
  isTypeOf,
  resolveIdentifier,
  resolveLiteral,
  resolveObjectKey,
  walkAST,
  walkImportDeclaration,
} from 'ast-kit'
import { MagicString, generateTransform } from 'magic-string-ast'
import type { ImportAttribute, Node } from '@babel/types'
import type { ViteNodeRunner } from 'vite-node/client'

export * from './options'
export interface MacroContext {
  id: string
}

interface MacroBase {
  node: Node
  id: string[]
  isAwait: boolean
}
interface CallMacro extends MacroBase {
  type: 'call'
  args: any[]
}
interface IdentifierMacro extends MacroBase {
  type: 'identifier'
}
type Macro = CallMacro | IdentifierMacro

export async function transformMacros(
  code: string,
  id: string,
  getRunner: () => Promise<ViteNodeRunner>,
  deps: Map<string, Set<string>>,
  attrs: Record<string, string>,
) {
  const program = babelParse(code, getLang(id), {
    plugins: [['importAttributes', { deprecatedAssertSyntax: true }]],
  })
  const s = new MagicString(code)

  const imports = new Map(Object.entries(recordImports()))

  let scope = attachScopes(program, 'scope')
  const macros: Macro[] = []
  const parentStack: Node[] = []

  walkAST<WithScope<Node>>(program, {
    enter(node, parent) {
      parent && parentStack.push(parent)
      if (node.scope) scope = node.scope

      if (node.type.startsWith('TS')) {
        this.skip()
        return
      }

      const isAwait = parent?.type === 'AwaitExpression'

      if (
        node.type === 'CallExpression' &&
        isTypeOf(node.callee, ['Identifier', 'MemberExpression'])
      ) {
        let id: string[]
        try {
          id = resolveIdentifier(node.callee)
        } catch {
          return
        }
        if (!imports.has(id[0]) || scope.contains(id[0])) return
        const args = node.arguments.map((arg) => {
          if (isLiteralType(arg)) return resolveLiteral(arg)
          throw new Error('Macro arguments must be literals.')
        })

        macros.push({
          type: 'call',
          node: isAwait ? parent : node,
          id,
          args,
          isAwait,
        })
        this.skip()
      } else if (
        isTypeOf(node, ['Identifier', 'MemberExpression']) &&
        (!parent || isReferenced(node, parent, parentStack.at(-2)))
      ) {
        let id: string[]
        try {
          id = resolveIdentifier(node)
        } catch {
          return
        }
        if (!imports.has(id[0]) || scope.contains(id[0])) return

        macros.push({
          type: 'identifier',
          node: isAwait ? parent : node,
          id,
          isAwait,
        })
        this.skip()
      }
    },
    leave(node) {
      if (node.scope) scope = scope.parent!
      parentStack.pop()
    },
  })

  if (macros.length === 0) {
    deps.delete(id)
    return
  }

  const runner = await getRunner()

  deps.set(id, new Set())
  for (const macro of macros) {
    const {
      node,
      id: [local, ...keys],
      isAwait,
    } = macro
    const binding = imports.get(local)!
    const [, resolved] = await runner.resolveUrl(binding.source, id)

    const module = await runner.executeFile(resolved)
    let exported: any = module

    const props = [...keys]
    if (binding.imported !== '*') props.unshift(binding.imported)
    for (const key of props) {
      exported = exported?.[key]
    }

    if (!exported) {
      throw new Error(`Macro ${local} is not existed.`)
    }

    let ret: any
    if (macro.type === 'call') {
      const ctx: MacroContext = {
        id,
      }
      ret = (exported as Function).apply(ctx, macro.args)
    } else {
      ret = exported
    }

    if (isAwait) {
      ret = await ret
    }

    s.overwriteNode(node, ret === undefined ? 'undefined' : JSON.stringify(ret))

    deps.get(id)!.add(resolved)
  }

  return generateTransform(s, id)

  function recordImports() {
    const imports: Record<string, ImportBinding> = {}
    for (const node of program.body) {
      if (
        node.type === 'ImportDeclaration' &&
        node.importKind !== 'type' &&
        node.attributes &&
        checkImportAttributes(attrs, node.attributes)
      ) {
        s.removeNode(node)
        walkImportDeclaration(imports, node)
      }
    }
    return imports
  }
}

function checkImportAttributes(
  expected: Record<string, string>,
  actual: ImportAttribute[],
) {
  const actualAttrs = Object.fromEntries(
    actual.map((attr) => [resolveObjectKey(attr), attr.value.value]),
  )
  return Object.entries(expected).every(
    ([key, expectedValue]) => actualAttrs[key] === expectedValue,
  )
}
