import {
  attachScopes,
  babelParse,
  isLiteralType,
  isTypeOf,
  resolveIdentifier,
  resolveLiteral,
  walkAST,
  walkImportDeclaration,
} from 'ast-kit'
import { MagicString } from 'magic-string-ast'
import type { ImportBinding, WithScope } from 'ast-kit'
import type { CallExpression, ImportAttribute, Node } from '@babel/types'
import type { ViteNodeRunner } from 'vite-node/client'

export async function transformMacros(
  code: string,
  id: string,
  runner: ViteNodeRunner
) {
  const program = babelParse(code, id, {
    plugins: [['importAttributes', { deprecatedAssertSyntax: true }]],
  })
  const s = new MagicString(code)

  const imports = recordImports()

  let scope = attachScopes(program, 'scope')
  const macros: {
    node: CallExpression
    fn: string[]
    args: any[]
  }[] = []
  walkAST<WithScope<Node>>(program, {
    enter(node) {
      if (node.scope) scope = node.scope

      if (
        node.type === 'CallExpression' &&
        isTypeOf(node.callee, ['Identifier', 'MemberExpression'])
      ) {
        const fn = resolveIdentifier(node.callee)
        if (!imports[fn[0]]) return
        const args = node.arguments.map((arg) => {
          if (isLiteralType(arg)) return resolveLiteral(arg)
          throw new Error('Macro arguments must be literals.')
        })
        macros.push({
          node,
          fn,
          args,
        })
      }
    },
    leave(node) {
      if (node.scope) scope = scope.parent!
    },
  })

  for (const {
    node,
    fn: [local, ...keys],
    args,
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

    const ret = fn(...args)
    s.overwriteNode(node, ret === undefined ? 'undefined' : JSON.stringify(ret))
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
