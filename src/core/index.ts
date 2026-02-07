import { isBuiltin } from 'node:module'
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
import { MagicStringAST } from 'magic-string-ast'
import type * as t from '@babel/types'
import type { RolldownString } from 'rolldown-string'
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
  parent?: t.Node | null
}
export interface CallMacro extends MacroBase {
  type: 'call'
  args: t.Node[]
}
export interface IdentifierMacro extends MacroBase {
  type: 'identifier'
}
export type Macro = CallMacro | IdentifierMacro
type MacroExportDeclaration = (
  | t.ExportNamedDeclaration
  | t.ExportAllDeclaration
) & { source: t.StringLiteral }

export interface TransformOptions {
  id: string
  s: RolldownString
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
): Promise<void> {
  const { id, unpluginContext, deps, attrs, getRunner } = options

  const source = options.s.toString()
  const program = babelParse(source, getLang(id))
  const s = new MagicStringAST(options.s as any)
  let generatedExportIndex = 0

  const imports = new Map(Object.entries(recordImports()))
  const macroExports = program.body.filter(isMacroExportDeclaration)
  const macros = collectMacros()
  const skip = new Set<Macro>()

  if (macros.length > 0 || macroExports.length > 0) {
    const runner = await getRunner()
    deps.set(id, new Set())

    for (const declaration of macroExports) {
      const transformed = await executeMacroExport(declaration, runner, id)
      s.overwriteNode(declaration, transformed)
    }

    for (const macro of macros) {
      if (skip.has(macro)) {
        continue
      }

      const result = await executeMacro(macro, runner, id)
      const stringified = stringifyValue(result)

      // Handle shorthand property in object literals: { foo } -> { foo: value }
      const { parent } = macro
      if (
        parent?.type === 'ObjectProperty' &&
        parent.shorthand &&
        macro.type === 'identifier' &&
        parent.key.type === 'Identifier'
      ) {
        s.overwriteNode(macro.node, `${parent.key.name}: ${stringified}`)
      } else {
        s.overwriteNode(macro.node, stringified)
      }
    }
  } else {
    deps.delete(id)
  }

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
            parent,
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
            parent,
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

  function isMacroExportDeclaration(
    node: t.Node | undefined,
  ): node is MacroExportDeclaration {
    if (
      !node ||
      (node.type !== 'ExportNamedDeclaration' &&
        node.type !== 'ExportAllDeclaration')
    ) {
      return false
    }
    return (
      node.exportKind !== 'type' &&
      !!node.source &&
      !!node.attributes &&
      checkImportAttributes(attrs, node.attributes)
    )
  }

  async function executeMacroExport(
    declaration: MacroExportDeclaration,
    runner: ViteNodeRunner,
    id: string,
  ): Promise<string> {
    const exported = await resolveMacroModule(
      declaration.source.value,
      runner,
      id,
    )
    const out: string[] = []

    const exportValue = (nameToken: string, value: unknown) => {
      const localName = nextGeneratedExportLocal()
      out.push(
        `const ${localName} = ${stringifyValue(value)}`,
        `export { ${localName} as ${nameToken} }`,
      )
    }

    if (declaration.type === 'ExportNamedDeclaration') {
      for (const specifier of declaration.specifiers) {
        if (specifier.type === 'ExportNamespaceSpecifier') {
          const exportName = source.slice(
            specifier.exported.start!,
            specifier.exported.end!,
          )
          exportValue(
            exportName,
            Object.fromEntries(
              Object.entries(exported).filter(
                ([name]) => name !== '__esModule',
              ),
            ),
          )
          continue
        }

        if (specifier.type !== 'ExportSpecifier') continue

        const sourceLocal = specifier.local as t.Identifier | t.StringLiteral
        const sourceName =
          sourceLocal.type === 'StringLiteral'
            ? sourceLocal.value
            : sourceLocal.name
        if (!(sourceName in exported)) {
          throw new Error(`Macro ${sourceName} is not existed.`)
        }

        const exportName = source.slice(
          specifier.exported.start!,
          specifier.exported.end!,
        )
        exportValue(exportName, exported[sourceName])
      }
    } else {
      const names = Object.keys(exported).filter(
        (name) => name !== 'default' && name !== '__esModule',
      )

      for (const name of names) {
        const exportName = /^[A-Za-z_$][\w$]*$/u.test(name)
          ? name
          : JSON.stringify(name)
        exportValue(exportName, exported[name])
      }
    }

    return out.length > 0 ? `${out.join(';\n')};` : ''
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
    let exported: any = await resolveMacroModule(binding.source, runner, id)

    const props = [...keys]
    if (binding.imported !== '*') {
      if (!(binding.imported in exported)) {
        throw new Error(`Macro ${local} is not existed.`)
      }
      props.unshift(binding.imported)
    }
    for (const key of props) {
      exported = exported?.[key]
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

    return result
  }

  async function resolveMacroModule(
    source: string,
    runner: ViteNodeRunner,
    id: string,
  ): Promise<Record<string, unknown>> {
    const [, resolved] = await runner.resolveUrl(source, id)
    deps.get(id)!.add(resolved)

    const module = isBuiltin(resolved)
      ? await import(resolved)
      : await runner.executeFile(resolved)
    return module as Record<string, unknown>
  }

  function nextGeneratedExportLocal() {
    while (true) {
      const local = `__macro_export_${generatedExportIndex++}`
      if (source.includes(local)) continue
      return local
    }
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
