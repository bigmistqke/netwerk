import {
  Accessor,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  onCleanup,
} from 'solid-js'
import ts from 'typescript'
import zeptoid from 'zeptoid'

const servicesHost: ts.LanguageServiceHost = {
  getScriptFileNames: () => Object.keys(tsModules),
  getScriptVersion: fileName => tsModules[fileName].version.toString(),
  getScriptSnapshot: fileName => {
    return ts.ScriptSnapshot.fromString(tsModules[fileName].content)
  },
  getCurrentDirectory: () => '/',
  getCompilationSettings: () => ({
    noLib: true,
    allowJs: true,
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
  }),
  getDefaultLibFileName: () => 'lib.d.ts',
  fileExists: fileName => !!tsModules[fileName],
  readFile: (fileName: string) => tsModules[fileName].content || '',
  resolveModuleNames(moduleNames) {
    return moduleNames.map(name => {
      // If we're dealing with relative paths, normalize them
      if (name.startsWith('./')) {
        name = name.substring(2)
      }

      if (name.startsWith('./')) {
        name = name.substring(2)
      }

      if (tsModules[name]) {
        return {
          resolvedFileName: name,
          extension: '.ts',
        }
      }

      return undefined // The module couldn't be resolved
    })
  },
}

const languageService = ts.createLanguageService(servicesHost, ts.createDocumentRegistry())

const tsModules: Record<string, { content: string; version: number }> = {}
function modifyImportPaths(code: string) {
  return code.replace(/import ([^"']+) from ["']([^"']+)["']/g, (match, varName, path) => {
    if (
      path.startsWith('blob:') ||
      path.startsWith('http:') ||
      path.startsWith('https:') ||
      path.startsWith('.')
    ) {
      return `import ${varName} from "${path}"`
    } else {
      return `import ${varName} from "https://esm.sh/${path}"`
    }
  })
}
const load = (url: Accessor<string>) => createResource(url, url => import(url))[0]

const [program, setProgram] = createSignal<ts.Program>(languageService.getProgram()!)

class TsNode {
  id: string
  path: Accessor<string>

  code: {
    js: string
    ts: string
  }
  private _module: Accessor<any>

  private source: ts.SourceFile
  private program: ts.Program

  constructor({
    id,
    path,
    code,
    module,
  }: {
    id: string
    path: Accessor<string>
    code: {
      js: Accessor<string>
      ts: Accessor<string>
    }
    module: Accessor<any>
  }) {
    this.id = id
    this.path = path
    this.code = {
      get js() {
        return code.js()
      },
      get ts() {
        return code.ts()
      },
    }
    this._module = module

    createRenderEffect(() => updateModule(id, this.code.ts))

    createRenderEffect(() => {
      this.program = program()
      this.source = this.program.getSourceFile(this.id)!
    })
  }
  get module() {
    return this._module()
  }
  getType(symbolName: string) {
    const checker = this.program.getTypeChecker()

    function findNodeByName(sourceFile: ts.SourceFile, name: string) {
      let foundNode = null
      function visit(node: ts.SourceFile | ts.Node) {
        if (ts.isIdentifier(node) && node.getText() === name) {
          foundNode = node
          return
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
      return foundNode
    }

    const node = findNodeByName(this.source, symbolName)!
    const type = checker.getTypeAtLocation(node)
    return checker.typeToString(type)
  }
  get error() {
    const allDiagnostics = languageService
      .getSemanticDiagnostics(this.id)
      .concat(languageService.getSyntacticDiagnostics(this.id))

    const errors = allDiagnostics.map(diagnostic => ({
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      start: diagnostic.start,
      length: diagnostic.length,
    }))

    return errors
  }
}

// Transpile TypeScript to JavaScript
const transpileToJS = (tsCode: string) => {
  const result = ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
  })
  return result.outputText
}

export function typescript(
  strings: TemplateStringsArray,
  ...holes: (TsNode | Accessor<any>)[]
): TsNode {
  const id = zeptoid() + '.ts'

  const jsCode = createMemo(() =>
    transpileToJS(
      modifyImportPaths(
        strings.reduce((acc, str, idx) => {
          const hole = holes[idx]
          const result = hole instanceof TsNode ? hole.path() : hole?.()
          return acc + str + (result || '')
        }, ''),
      ),
    ),
  )

  const tsCode = createMemo(() =>
    strings.reduce((acc, str, idx) => {
      const hole = holes[idx]
      const result = hole instanceof TsNode ? hole.id : hole?.()
      return acc + str + (result || '')
    }, ''),
  )

  const path = createMemo(() => {
    setProgram(languageService.getProgram())
    const url = URL.createObjectURL(
      new Blob([jsCode()], {
        type: 'application/javascript',
      }),
    )
    onCleanup(() => URL.revokeObjectURL(url))
    return url
  })

  const module = load(path)

  return new TsNode({ id, path, code: { js: jsCode, ts: tsCode }, module })
}

function updateModule(fileName: string, newContent: string) {
  const file = tsModules[fileName]
  if (!file) {
    tsModules[fileName] = { content: newContent, version: 0 }
  } else {
    file.content = newContent
    file.version++
  }
  setProgram(languageService.getProgram())
}
