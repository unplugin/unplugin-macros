import { builtinModules } from 'node:module'
import {
  attachScopes,
  babelParse,
  getLang,
  isLiteralType,
  isReferenced,
  isTypeOf,
  resolveIdentifier,
  resolveLiteral,
  resolveObjectKey,
  TS_NODE_TYPES,
  walkAST,
  walkImportDeclaration,
  type ImportBinding,
  type WithScope,
} from 'ast-kit'
import {
  generateTransform,
  MagicStringAST,
  type CodeTransform,
} from 'magic-string-ast'
import type { ImportAttribute, Node } from '@babel/types'
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin'
import type { ViteNodeRunner } from 'vite-node/client'

export * from './options'
export * from './define'

/**
 * Represents the context object passed to macros.
 */
export interface MacroContext {
  id: string
  source: string
  emitFile: UnpluginBuildContext['emitFile']
  /**
   * **Use with caution.**
   *
   * This is an experimental feature and may be changed at any time.
   */
  unpluginContext: UnpluginBuildContext & UnpluginContext
}

export interface MacroBase {
  node: Node
  id: string[]
  isAwait: boolean
}
export interface CallMacro extends MacroBase {
  type: 'call'
  args: any[]
}
export interface IdentifierMacro extends MacroBase {
  type: 'identifier'
}
export type Macro = CallMacro | IdentifierMacro

export interface TransformOptions {
  id: string
  source: string
  unpluginContext: UnpluginBuildContext & UnpluginContext
  deps: Map<string, Set<string>>
  attrs: Record<string, string>
  getRunner: () => Promise<ViteNodeRunner>
}

/**
 * Transforms macros in the given source code.
 */
export async function transformMacros(
  options: TransformOptions,
): Promise<CodeTransform | undefined> {
  const { source, id, unpluginContext, deps, attrs, getRunner } = options

  const program = babelParse(source, getLang(id))
  const s = new MagicStringAST(source)

  const imports = new Map(Object.entries(recordImports()))
  const macros = collectMacros()
  if (macros.length > 0) {
    await executeMacros()
  } else {
    deps.delete(id)
  }

  return generateTransform(s, id)

  async function executeMacros() {
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

      let exported
      if (
        resolved.startsWith('node:') ||
        builtinModules.includes(resolved.split('/')[0])
      ) {
        exported = await import(resolved)
      } else {
        const module = await runner.executeFile(resolved)
        exported = module
      }

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
          source,
          emitFile: unpluginContext.emitFile,

          unpluginContext,
        }
        ret = (exported as Function).apply(ctx, macro.args)
      } else {
        ret = exported
      }

      if (isAwait) {
        ret = await ret
      }

      s.overwriteNode(
        node,
        ret === undefined ? 'undefined' : JSON.stringify(ret),
      )

      deps.get(id)!.add(resolved)
    }
  }

  function collectMacros() {
    const macros: Macro[] = []
    let scope = attachScopes(program, 'scope')
    const parentStack: Node[] = []

    walkAST<WithScope<Node>>(program, {
      enter(node, parent) {
        parent && parentStack.push(parent)
        if (node.scope) scope = node.scope

        if (
          node.type.startsWith('TS') &&
          !TS_NODE_TYPES.includes(node.type as any)
        ) {
          this.skip()
          return
        }

        const isAwait = parent?.type === 'AwaitExpression'

        if (node.type === 'TaggedTemplateExpression') {
          node = {
            ...(node as any),
            type: 'CallExpression',
            callee: node.tag,
            arguments: [node.quasi],
          }
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
            try {
              if (isTypeOf(arg, ['ObjectExpression', 'ArrayExpression']))
                return new Function(
                  `return (${source.slice(arg.start!, arg.end!)})`,
                )()
            } catch {}
            throw new Error('Macro arguments cannot be resolved.')
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

    return macros
  }

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
