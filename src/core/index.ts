import { hash } from 'node:crypto'
import { isBuiltin } from 'node:module'
import { MagicStringAST } from 'magic-string-ast'
import { analyze, type Symbol as AnalyzerSymbol } from 'yuku-analyzer'
import { is, literalValue, nameOf, walkAsync } from 'yuku-ast'
import { resolveMemberChain } from './utils.ts'
import type { RolldownString } from 'rolldown-string'
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin'
import type { ViteNodeRunner } from 'vite-node/client'
import type {
  CallExpression,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  Expression,
  ImportAttribute,
  Node,
  Program,
  StringLiteral,
  Super,
} from 'yuku-parser'

export * from './define.ts'
export * from './options.ts'

/**
 * The TypeScript-only nodes that still wrap a runtime expression, so the walk
 * has to descend into them. Every other `TS*` node is pure type syntax.
 */
const TS_EXPRESSION_TYPES: ReadonlySet<string> = new Set([
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
])

/**
 * AST handles for a macro invocation.
 */
export interface MacroAst {
  /**
   * The AST node of the macro call expression.
   *
   * - For `await fn()` macros this is the inner `CallExpression`, not the
   *   wrapping `AwaitExpression`.
   * - For tagged template macros (`` fn`...` ``) this is a synthesized
   *   `CallExpression` whose `arguments` is `[quasi]` and whose
   *   `.start`/`.end` match the original `TaggedTemplateExpression`.
   */
  call: CallExpression
  /** The `Program` AST of the file being transformed. */
  program: Program
}

export const VIRTUAL_ID_PREFIX = 'virtual:unplugin-macros/'
export const VIRTUAL_ID_PATTERN: RegExp = /^virtual:unplugin-macros\//

/**
 * Represents the context object passed to macros.
 */
export interface MacroContext {
  id: string
  source: string
  emitFile: UnpluginBuildContext['emitFile']
  /**
   * AST handles for this macro invocation and its enclosing file.
   *
   * Use `ast.call` to inspect the call expression (e.g.
   * `source.slice(ast.call.start, ast.call.end)` for the raw call source).
   * Use `ast.program` to walk over the rest of the file.
   */
  ast: MacroAst
  /**
   * **Use with caution.**
   *
   * This is an experimental feature and may be changed at any time.
   */
  unpluginContext: UnpluginBuildContext & UnpluginContext
}

/**
 * The macro module a local binding was imported from.
 */
export interface MacroBinding {
  /** The module specifier the macro is imported from. */
  source: string
  /** The imported export name, or `'*'` for a namespace import. */
  imported: string
}

export interface MacroBase {
  node: Node
  id: string[]
  binding: MacroBinding
  isAwait: boolean
  parent?: Node | null
}
export interface CallMacro extends MacroBase {
  type: 'call'
  args: Node[]
}
export interface IdentifierMacro extends MacroBase {
  type: 'identifier'
}
export type Macro = CallMacro | IdentifierMacro
type MacroExportDeclaration = (
  ExportNamedDeclaration | ExportAllDeclaration
) & {
  source: StringLiteral
}

export interface TransformContext {
  id: string
  s: RolldownString
  unpluginContext: UnpluginBuildContext & UnpluginContext
  deps: Map<string, Set<string>>
  attrs: Record<string, string>
  virtualModules?: Map<string, string>
  getRunner: () => Promise<ViteNodeRunner>
}

/**
 * Transforms macros in the given source code.
 */
export async function transformMacros(
  context: TransformContext,
): Promise<void> {
  const { id, unpluginContext, deps, attrs, getRunner } = context

  const source = context.s.toString()
  const mod = analyze(source, { path: id })
  const program = mod.ast
  const s = new MagicStringAST(context.s as any)

  const imports = recordImports()
  const macroExports = program.body.filter(isMacroExportDeclaration)
  const macros = collectMacros()

  if (!macros.length && !macroExports.length) {
    deps.delete(id)
    return
  }

  const skip = new Set<Macro>()
  const virtualImports = new Map<string, string>()
  const runner = await getRunner()
  deps.set(id, new Set())
  let generatedExportIndex = 0
  let needWrap = false

  for (const declaration of macroExports) {
    const transformed = await executeMacroExport(declaration, runner, id)
    s.overwriteNode(declaration, transformed)
  }

  for (const macro of macros) {
    if (skip.has(macro)) {
      continue
    }

    const result = await executeMacro(macro, runner, id)
    const stringified = context.virtualModules
      ? importValue(result)
      : stringifyValue(result)

    // Handle shorthand property in object literals: { foo } -> { foo: value }
    const { parent } = macro
    if (
      parent?.type === 'Property' &&
      parent.shorthand &&
      macro.type === 'identifier' &&
      parent.key.type === 'Identifier'
    ) {
      s.overwriteNode(macro.node, `${parent.key.name}: ${stringified}`)
    } else {
      s.overwriteNode(macro.node, stringified)
    }
  }

  if (needWrap) {
    s.prepend(`function $macros$wrap(value) { return value }\n`)
  }

  function importValue(value: unknown): string {
    // `$macros$wrap` must be defined inside the self-contained virtual
    // module, not in the host module, so track it separately here.
    const outerNeedWrap = needWrap
    needWrap = false
    const stringified = stringifyValue(value)
    const wrap = needWrap
      ? `function $macros$wrap(value) { return value }\n`
      : ''
    needWrap = outerNeedWrap

    const key = hash('sha256', stringified).slice(0, 16)
    let local = virtualImports.get(key)
    if (!local) {
      local = `_macro_${key}`
      virtualImports.set(key, local)
      context.virtualModules?.set(key, `${wrap}export default ${stringified}\n`)
      s.prepend(
        `import ${local} from ${JSON.stringify(VIRTUAL_ID_PREFIX + key)};\n`,
      )
    }
    return local
  }

  /**
   * Resolves an expression to the macro it references, or `undefined` when its
   * root identifier is not a macro import. The analyzer resolves the
   * identifier against its scope, so shadowed bindings and identifiers in
   * non-reference positions (property keys, declarations) never match.
   */
  function resolveMacro(
    node: Expression | Super,
  ): { id: string[]; binding: MacroBinding } | undefined {
    const chain = resolveMemberChain(node)
    if (!chain) return
    const symbol = mod.referenceOf(chain.root)?.symbol
    if (!symbol) return
    const binding = imports.get(symbol)
    if (!binding) return
    return { id: chain.id, binding }
  }

  function collectMacros() {
    const macros: Macro[] = []
    const skippedNodes = new Set<Node>()

    mod.walk({
      enter(node, ctx) {
        if (skippedNodes.has(node)) {
          return ctx.skip()
        }

        if (node.type.startsWith('TS') && !TS_EXPRESSION_TYPES.has(node.type)) {
          return ctx.skip()
        }

        const { parent } = ctx
        const isAwait = parent?.type === 'AwaitExpression'

        // Treat `` fn`...` `` as `fn(quasi)`, keeping the original span.
        const call: CallExpression | undefined =
          node.type === 'CallExpression'
            ? node
            : node.type === 'TaggedTemplateExpression'
              ? {
                  ...node,
                  type: 'CallExpression',
                  callee: node.tag,
                  arguments: [node.quasi],
                  optional: false,
                }
              : undefined

        if (call) {
          if (!is.oneOf(call.callee, ['Identifier', 'MemberExpression'])) return

          const resolved = resolveMacro(call.callee)
          if (!resolved) return

          // Skip the callee only once the call is known to be a macro.
          skippedNodes.add(call.callee)

          macros.push({
            type: 'call',
            node: isAwait ? parent! : call,
            id: resolved.id,
            binding: resolved.binding,
            // eslint-disable-next-line baseline-js/use-baseline
            args: call.arguments,
            isAwait,
            parent,
          })
        } else if (is.oneOf(node, ['Identifier', 'MemberExpression'])) {
          const resolved = resolveMacro(node)
          if (!resolved) return
          if (parent?.type === 'ExportSpecifier') {
            throw new Error('Exporting macros is not allowed.')
          }

          macros.push({
            type: 'identifier',
            node: isAwait ? parent! : node,
            id: resolved.id,
            binding: resolved.binding,
            isAwait,
            parent,
          })
          ctx.skip()
        }
      },
    })

    return macros
  }

  function isMacroExportDeclaration(
    node: Node | undefined,
  ): node is MacroExportDeclaration {
    if (!node) return false
    if (
      node.type !== 'ExportNamedDeclaration' &&
      node.type !== 'ExportAllDeclaration'
    ) {
      return false
    }
    return (
      node.exportKind !== 'type' &&
      !!node.source &&
      checkImportAttributes(attrs, node.attributes)
    )
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
        const sourceName = nameOf(specifier.local)
        if (!(sourceName in exported)) {
          throw new Error(`Macro ${sourceName} is not existed.`)
        }

        const exportName = source.slice(
          specifier.exported.start,
          specifier.exported.end,
        )
        exportValue(exportName, exported[sourceName])
      }
    } else if (declaration.exported) {
      // `export * as ns from '...'`
      const exportName = source.slice(
        declaration.exported.start,
        declaration.exported.end,
      )
      exportValue(
        exportName,
        Object.fromEntries(
          Object.entries(exported).filter(([name]) => name !== '__esModule'),
        ),
      )
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

  function nextGeneratedExportLocal() {
    while (true) {
      const local = `__macro_export_${generatedExportIndex++}`
      if (source.includes(local)) continue
      return local
    }
  }

  async function executeMacro(
    macro: Macro,
    runner: ViteNodeRunner,
    id: string,
  ): Promise<unknown> {
    const {
      id: [local],
      binding,
      isAwait,
    } = macro
    let exported: any = await resolveMacroModule(binding.source, runner, id)

    const props = macro.id.slice(1)
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
      const callNode: CallExpression =
        macro.node.type === 'AwaitExpression'
          ? (macro.node.argument as CallExpression)
          : (macro.node as CallExpression)

      const ctx: MacroContext = {
        id,
        source,
        emitFile: unpluginContext.emitFile,
        ast: {
          call: callNode,
          program,
        },
        unpluginContext,
      }

      const args: any[] = []
      for (const arg of macro.args) {
        if (is.Literal(arg)) {
          args.push(literalValue(arg))
          continue
        }

        const code = source.slice(arg.start, arg.end)
        const s = new MagicStringAST(code, { offset: -arg.start })

        await walkAsync(arg, {
          async enter(node, ctx) {
            const subMacro = macros.find((macro) => macro.node === node)
            if (subMacro) {
              skip.add(subMacro)
              const result = await executeMacro(subMacro, runner, id)
              s.overwriteNode(node, stringifyValue(result))
              ctx.skip()
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

  function recordImports() {
    const imports = new Map<AnalyzerSymbol, MacroBinding>()
    for (const node of program.body) {
      if (
        node.type !== 'ImportDeclaration' ||
        node.importKind === 'type' ||
        !checkImportAttributes(attrs, node.attributes)
      ) {
        continue
      }

      s.removeNode(node)
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type'
        ) {
          continue
        }

        const symbol = mod.symbolOf(specifier.local)
        if (!symbol) continue

        const imported =
          specifier.type === 'ImportDefaultSpecifier'
            ? 'default'
            : specifier.type === 'ImportNamespaceSpecifier'
              ? '*'
              : nameOf(specifier.imported)
        imports.set(symbol, { source: node.source.value, imported })
      }
    }
    return imports
  }

  function stringifyValue(value: unknown): string {
    const ty = typeof value
    if (ty === 'bigint') {
      return `${value}n`
    }
    if (ty === 'function') {
      needWrap = true
      return `$macros$wrap(${(value as Function).toString()})`
    }
    if (ty === 'symbol') {
      throw new SyntaxError(`Cannot stringify value of type ${ty}`)
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
    if (ty === 'object' && type === '[object Object]') {
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
}

function checkImportAttributes(
  expected: Record<string, string>,
  actual: ImportAttribute[],
) {
  const actualAttrs = Object.fromEntries(
    actual.map((attr) => [nameOf(attr.key), attr.value.value]),
  )
  return Object.entries(expected).every(
    ([key, expectedValue]) => actualAttrs[key] === expectedValue,
  )
}
