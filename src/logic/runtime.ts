import { AtomPath } from '@src/types'
import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  mapArray,
  onCleanup,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import ts from 'typescript'
import { packages } from './packages'

/***********************************************************************************/
/*                                                                                 */
/*                                 ESM/TS MANAGER                                  */
/*                                                                                 */
/***********************************************************************************/

export const autoManagePackagesModules = (libs: typeof packages) => {
  createEffect(() => {
    for (const libId of Object.keys(libs)) {
      createEffect(
        mapArray(
          () => Object.keys(libs[libId]),
          atomId => {
            createEffect(() => updateEsmModule({ libId, atomId }, libs[libId][atomId].code))
            createEffect(() => updateTsModule({ libId, atomId }, libs[libId][atomId].code))
          },
        ),
      )
    }
  })
}

/***********************************************************************************/
/*                                                                                 */
/*                           TYPESCRIPT LANGUAGE SERVER                            */
/*                                                                                 */
/***********************************************************************************/

const tsFileSystem: Record<string, { content: string; version: number }> = {
  temp: { content: 'export default () => {}', version: 0 },
}

export const [modules, setModules] = createStore<{
  ts: Record<string, Record<string, TsModule>>
  esm: Record<string, Record<string, (...args: any[]) => any>>
}>({
  ts: {},
  esm: {},
})

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

class TsModule {
  path: AtomPath
  filename: string
  constructor(path: AtomPath, filename: string) {
    this.path = path
    this.filename = filename

    createRenderEffect(() => {
      console.log('this.source:', program())
    })
  }
  get source() {
    return program()?.getSourceFile(this.filename)!
  }
  getType(symbolName: string) {
    const checker = program()?.getTypeChecker()
    const node = findNodeByName(this.source, symbolName)!
    const type = checker?.getTypeAtLocation(node)
    return checker?.typeToString(type!)
  }
  get error() {
    const allDiagnostics = languageService
      .getSemanticDiagnostics(this.filename)
      .concat(languageService.getSyntacticDiagnostics(this.filename))

    const errors = allDiagnostics.map(diagnostic => ({
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      start: diagnostic.start,
      length: diagnostic.length,
    }))

    return errors
  }
}

const languageService = ts.createLanguageService(
  {
    getScriptFileNames: () => Object.keys(tsFileSystem),
    getScriptVersion: fileName => tsFileSystem[fileName]?.version.toString() || '0',
    getScriptSnapshot: fileName => {
      return ts.ScriptSnapshot.fromString(tsFileSystem[fileName]?.content || '')
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
    fileExists: fileName => !!tsFileSystem[fileName],
    readFile: (fileName: string) => tsFileSystem[fileName].content || '',
    resolveModuleNames(moduleNames) {
      return moduleNames.map(name => {
        // If we're dealing with relative paths, normalize them
        if (name.startsWith('./')) {
          name = name.substring(2)
        }

        if (name.startsWith('./')) {
          name = name.substring(2)
        }

        if (tsFileSystem[name]) {
          return {
            resolvedFileName: name,
            extension: '.ts',
          }
        }

        return undefined // The module couldn't be resolved
      })
    },
  },
  ts.createDocumentRegistry(),
)
const [program, setProgram] = createSignal<ts.Program | undefined>(languageService.getProgram())
function updateTsModule(path: AtomPath, newContent: string) {
  const filename = `${path.libId}_${path.atomId}.ts`
  if (!(path.libId in modules.ts)) {
    setModules('ts', { [path.libId]: {} })
  }
  if (!(path.atomId in modules.ts[path.libId])) {
    const tsModule = new TsModule(path, filename)
    setModules('ts', path.libId, path.atomId, tsModule)
  }

  const file = tsFileSystem[filename]
  if (!file) {
    tsFileSystem[filename] = { content: newContent, version: 0 }
  } else {
    file.content = newContent
    file.version++
  }

  setProgram(languageService.getProgram())
}

/***********************************************************************************/
/*                                                                                 */
/*                                    ESM-MODULES                                  */
/*                                                                                 */
/***********************************************************************************/

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
const transpileToJS = (tsCode: string) =>
  ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
  }).outputText

const [loadingModulePaths, setLoadingModulePaths] = createSignal<AtomPath[]>([])
const addToLoadingModulePaths = (path: AtomPath) => setLoadingModulePaths(l => [...l, path])
const removeFromLoadingModulePaths = (path: AtomPath) => {
  setLoadingModulePaths(loading => {
    const index = loading.findIndex(v => v.atomId === path.atomId && v.libId === path.libId)
    if (index !== -1) loading.splice(index, 1)
    return [...loading]
  })
}
export const areModulesLoading = createMemo(() => loadingModulePaths().length !== 0)

const updateEsmModule = (path: AtomPath, code: string) =>
  new Promise(resolve => {
    if (!(path.libId in modules.esm)) {
      console.log('reset modules.esm[path.libId]', path.libId)
      setModules('esm', path.libId, {})
    }
    addToLoadingModulePaths(path)
    const url = URL.createObjectURL(
      new Blob([transpileToJS(modifyImportPaths(code))], {
        type: 'application/javascript',
      }),
    )
    import(url)
      .then(module => {
        setModules('esm', path.libId, path.atomId, () => module.default)
        resolve(module.default)
        removeFromLoadingModulePaths(path)
      })
      .catch(err => {
        console.error('error while importing url:', err)
        removeFromLoadingModulePaths(path)
      })
    onCleanup(() => URL.revokeObjectURL(url))
  })
