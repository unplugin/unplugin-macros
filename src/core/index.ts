import {
  type ImportBinding,
  type WithScope,
  attachScopes,
  babelParse,
  getLang,
  isLiteralType,
  isTypeOf,
  resolveIdentifier,
  resolveLiteral,
  walkAST,
  walkImportDeclaration,
} from 'ast-kit'
import { MagicString } from 'magic-string-ast'
import { type ImportAttribute, type Node } from '@babel/types'
import { type ViteNodeRunner } from 'vite-node/client'

export async function transformMacros(
  code: string,
  id: string,
  runner: ViteNodeRunner,
  deps: Record<string, Set<string>>
) {
  const program = babelParse(code, getLang(id), {
    plugins: [['importAttributes', { deprecatedAssertSyntax: true }]],
  })
  const s = new MagicString(code)

  const imports = recordImports()

  let scope = attachScopes(program, 'scope')
  const macros: {
    node: Node
    fn: string[]
    args: any[]
    isAwait: boolean
  }[] = []
  walkAST<WithScope<Node>>(program, {
    enter(node, parent) {
      if (node.scope) scope = node.scope

      if (
        node.type === 'CallExpression' &&
        isTypeOf(node.callee, ['Identifier', 'MemberExpression'])
      ) {
        let fn: string[]
        try {
          fn = resolveIdentifier(node.callee)
        } catch {
          return
        }
        if (!imports[fn[0]]) return
        const args = node.arguments.map((arg) => {
          if (isLiteralType(arg)) return resolveLiteral(arg)
          throw new Error('Macro arguments must be literals.')
        })
        const isAwait = parent?.type === 'AwaitExpression'

        macros.push({
          node: isAwait ? parent : node,
          fn,
          args,
          isAwait,
        })
      }
    },
    leave(node) {
      if (node.scope) scope = scope.parent!
    },
  })

  if (macros.length === 0) {
    delete deps[id]
    return
  }

  deps[id] = new Set()
  for (const {
    node,
    fn: [local, ...keys],
    args,
    isAwait,
  } of macros) {
    const binding = imports[local]
    const [, resolved] = await runner.resolveUrl(binding.source, id)

    const module = await runner.executeFile(resolved)
    let fn: any = module

    const props = [...keys]
    if (binding.imported !== '*') props.unshift(binding.imported)
    for (const key of props) {
      fn = fn?.[key]
    }

    if (!fn) {
      throw new Error(`Macro ${local} is not existed.`)
    }

    let ret = fn(...args)
    if (isAwait) {
      ret = await ret
    }

    s.overwriteNode(node, ret === undefined ? 'undefined' : JSON.stringify(ret))

    deps[id].add(resolved)
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
