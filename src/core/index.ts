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
  walkAST,
  walkImportDeclaration,
} from 'ast-kit'
import { MagicString } from 'magic-string-ast'
import { type ImportAttribute, type Node } from '@babel/types'
import { type ViteNodeRunner } from 'vite-node/client'

interface MacroBase {
  node: Node
  id: string[]
}
interface CallMacro extends MacroBase {
  type: 'call'
  args: any[]
  isAwait: boolean
}
interface IdentifierMacro extends MacroBase {
  type: 'identifier'
}
type Macro = CallMacro | IdentifierMacro

export async function transformMacros(
  code: string,
  id: string,
  runner: ViteNodeRunner,
  deps: Map<string, Set<string>>
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
        const isAwait = parent?.type === 'AwaitExpression'

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
          node,
          id,
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

  deps.set(id, new Set())
  for (const macro of macros) {
    const {
      node,
      id: [local, ...keys],
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
      ret = exported(...macro.args)
      if (macro.isAwait) {
        ret = await ret
      }
    } else {
      ret = exported
    }

    s.overwriteNode(node, ret === undefined ? 'undefined' : JSON.stringify(ret))

    deps.get(id)!.add(resolved)
  }

  return getTransformResult(s, id)

  function recordImports() {
    const imports: Record<string, ImportBinding> = {}
    for (const node of program.body) {
      if (
        node.type === 'ImportDeclaration' &&
        node.importKind !== 'type' &&
        node.attributes &&
        checkAttributes(node.attributes)
      ) {
        s.removeNode(node)
        walkImportDeclaration(imports, node)
      }
    }
    return imports
  }
}

function checkAttributes(attrs: ImportAttribute[]) {
  return attrs.some(
    (attr) =>
      (attr.key.type === 'Identifier' ? attr.key.name : attr.key.value) ===
        'type' && attr.value.value === 'macro'
  )
}

export function getTransformResult(
  s: MagicString | undefined,
  id: string
): { code: string; map: any } | undefined {
  if (s?.hasChanged()) {
    return {
      code: s.toString(),
      get map() {
        return s.generateMap({
          source: id,
          includeContent: true,
          hires: true,
        })
      },
    }
  }
}
