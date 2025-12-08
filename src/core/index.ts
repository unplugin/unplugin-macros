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
  walkASTAsync,
  walkImportDeclaration,
  type ImportBinding,
  type WithScope,
} from 'ast-kit'
import {
  generateTransform,
  MagicStringAST,
  type CodeTransform,
} from 'magic-string-ast'
import type * as t from '@babel/types'
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin'
import type { ViteNodeRunner } from 'vite-node/client'

export * from './define'
export * from './options'

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
  node: t.Node
  id: string[]
  isAwait: boolean
}
export interface CallMacro extends MacroBase {
  type: 'call'
  args: t.Node[]
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
  const skip = new Set<Macro>()

  if (macros.length > 0) {
    const runner = await getRunner()
    deps.set(id, new Set())

    for (const macro of macros) {
      if (skip.has(macro)) {
        continue
      }

      const result = await executeMacro(macro, runner, id)
      s.overwriteNode(macro.node, stringifyValue(result))
    }
  } else {
    deps.delete(id)
  }

  return generateTransform(s, id)

  function collectMacros() {
    const macros: Macro[] = []
    let scope = attachScopes(program, 'scope')
    const parentStack: t.Node[] = []
    const skip = new Set<t.Node>()

    walkAST<WithScope<t.Node>>(program, {
      enter(node, parent) {
        if (skip.has(node)) {
          return this.skip()
        }

        parent && parentStack.push(parent)
        if (node.scope) scope = node.scope

        if (
          node.type.startsWith('TS') &&
          !TS_NODE_TYPES.includes(node.type as any)
        ) {
          return this.skip()
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
          skip.add(node.callee)
          let id: string[]
          try {
            id = resolveIdentifier(node.callee)
          } catch {
            return
          }
          if (!imports.has(id[0]) || scope.contains(id[0])) return

          macros.push({
            type: 'call',
            node: isAwait ? parent : node,
            id,
            args: node.arguments,
            isAwait,
          })
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
          if (parent?.type === 'ExportSpecifier') {
            throw new Error('Exporting macros is not allowed.')
          }

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
        if (skip.has(node)) {
          return this.skip()
        }

        if (node.scope) scope = scope.parent!
        parentStack.pop()
      },
    })

    return macros
  }

  async function executeMacro(
    macro: Macro,
    runner: ViteNodeRunner,
    id: string,
  ): Promise<unknown> {
    const {
      id: [local, ...keys],
      isAwait,
    } = macro
    const binding = imports.get(local)!
    const [, resolved] = await runner.resolveUrl(binding.source, id)

    let exported
    if (resolved.startsWith('node:') || builtinModules.includes(resolved)) {
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

    let result: any
    if (macro.type === 'call') {
      const ctx: MacroContext = {
        id,
        source,
        emitFile: unpluginContext.emitFile,

        unpluginContext,
      }

      const args: any[] = []
      for (const arg of macro.args) {
        if (isLiteralType(arg)) {
          args.push(resolveLiteral(arg))
          continue
        }

        const code = source.slice(arg.start!, arg.end!)
        const s = new MagicStringAST(code, { offset: -arg.start! })

        await walkASTAsync(arg, {
          async enter(node) {
            const subMacro = macros.find((macro) => macro.node === node)
            if (subMacro) {
              skip.add(subMacro)
              const result = await executeMacro(subMacro, runner, id)
              s.overwriteNode(node, stringifyValue(result))
              this.skip()
            }
          },
        })

        try {
          args.push(new Function(`return (${s.toString()})`)())
          continue
        } catch {}

        throw new Error('Macro arguments cannot be resolved.')
      }

      result = (exported as Function).apply(ctx, args)
    } else {
      result = exported
    }

    if (isAwait) {
      result = await result
    }

    deps.get(id)!.add(resolved)
    return result
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
  actual: t.ImportAttribute[],
) {
  const actualAttrs = Object.fromEntries(
    actual.map((attr) => [resolveObjectKey(attr), attr.value.value]),
  )
  return Object.entries(expected).every(
    ([key, expectedValue]) => actualAttrs[key] === expectedValue,
  )
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'bigint') {
    return `${value}n`
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new SyntaxError(`Cannot stringify value of type ${typeof value}`)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stringifyValue).join(', ')}]`
  }
  const type = Object.prototype.toString.call(value)
  if (type === '[object Promise]') {
    throw new SyntaxError(`Cannot stringify a Promise value`)
  }
  if (value == null || type === '[object RegExp]') {
    return String(value)
  }
  if (typeof value === 'object' && type === '[object Object]') {
    const entries = Object.entries(value).map(
      ([k, v]) => `${JSON.stringify(k)}: ${stringifyValue(v)}`,
    )
    return `{ ${entries.join(', ')} }`
  }
  if (type === '[object Date]') {
    return `new Date(${(value as Date).getTime()})`
  }
  return JSON.stringify(value)
}
