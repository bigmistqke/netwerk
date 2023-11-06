import { selectedAtom, setSelectedAtom } from '@logic/packages'
import loader from '@monaco-editor/loader'
import { AtomPath } from '@src/types'
import { when } from '@src/utils/when'
import { createEffect, createSignal, on, onMount } from 'solid-js'

type Monaco =
  typeof import('/Users/bigmistqke/Documents/GitHub/nodebox-3.0/node_modules/.pnpm/monaco-editor@0.44.0/node_modules/monaco-editor/esm/vs/editor/editor.api')
type Editor = ReturnType<Monaco['editor']['create']>

const [monaco, setMonaco] = createSignal<Monaco>()
loader.init().then(m => setMonaco(m))

export const Editor = (props: { code?: string; path: AtomPath }) => {
  let div: HTMLDivElement

  const [editor, setEditor] = createSignal<Editor>()

  onMount(() => {
    when(monaco)(monaco => {
      setEditor(
        monaco.editor.create(div, {
          language: 'typescript',
          fontSize: 14,
          automaticLayout: true,
        }),
      )
      monaco.editor.setTheme('vs-dark')
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        `
  declare type Func = (...args: any[]) => any
  declare type DataType = 'string' | 'number' | 'prop'
  
  declare type AtomPath = {
    libId: keyof Ctx['lib']
    atomId: string
  }
  
  interface AtomBase {
    fn: (arg: { props: Record<string, Exclude<any, Function>>; ctx: Ctx; dom: HTMLElement }) => any
    props: Record<string, Parameter>
  }
  
  declare interface CodeAtom extends AtomBase {
    type: 'code'
    returnType: DataType
  }
  
  declare interface NetworkAtom extends AtomBase {
    type: 'network'
    nodes: Nodes
    edges: Edge[]
    selectedNodeId: string
    returnType: DataType
  }
  
  declare interface RendererAtom extends AtomBase {
    type: 'renderer'
    fn: (arg: { ctx: Ctx; dom: HTMLElement }) => (result: any) => void
  }
  
  declare type Atom = CodeAtom | NetworkAtom | RendererAtom
  
  interface NodeBase {
    position: Vector
  }
  
  declare interface AtomNode extends NodeBase {
    emits: boolean
    type: 'atom'
    path: AtomPath
    props: (CodeAtom | NetworkAtom)['props']
  }
  
  declare interface PropsNode extends NodeBase {
    type: 'props'
  }
  
  declare type Node = AtomNode | PropsNode | RendererNode
  
  declare type Nodes = Record<string, Node>
  
  declare type Package = Record<string, Atom>
  
  /* NETWORK */
  
  declare type Handle = { handleId: string; nodeId: string; type: 'output' | 'input' | 'prop' }
  declare type Edge = { start: Handle; end: Handle }
  declare type Parameter<T = any> = { type: DataType; value: T }
  
  const std = {
    add: {
      type: 'code',
      fn: ({ props, ctx }: {props: {a: number, b: number}, ctx: Ctx}) => props.a + props.b,
      returnType: 'number',
      props: {
        a: {
          type: 'number',
          value: 1,
        },
        b: {
          type: 'number',
          value: 1,
        },
      },
    },
    multiply: {
      type: 'code',
      fn: ({ props }) => props.a * props.b,
      returnType: 'number',
      props: {
        a: {
          type: 'number',
          value: 1,
        },
        b: {
          type: 'number',
          value: 1,
        },
      },
    },
    simple_renderer: {
      type: 'renderer',
      fn: ({ dom }) => {
      dom.innerHTML = ''
      const container = document.createElement('div')
      dom.appendChild(container)
      return result => (container.textContent = result)
    },
      props: {},
    },
  }
  declare type Ctx = {
    event: {
      emit: (value: any, id: string) => any
      listeners: Record<string, ((value: any) => void)[]>
      addListener: (nodeId: string, callback: (value: any) => void) => () => void
    }
    memo: (value: Accessor<any>, id: number, dependencies: boolean[]) => any
    equals: (id: string, props: Record<string, any>) => Record<string, any>
    lib: {
      std: typeof std
      self: Package
    } & Record<string, Package>
  }
  declare type Props = { a: number, b: number }   
  declare let main: (arg: {props: Props, ctx: Ctx}): number => {}
  declare const ctx: Ctx
        `,
        'node_modules/@types/external/index.d.ts',
      )
    })
    createEffect(
      on(selectedAtom, () => {
        when(editor)(editor => {
          editor.setValue(`${props.code}`)
        })
      }),
    )
    createEffect(() => {
      when(editor)(editor => {
        editor.onDidChangeModelContent(function (e) {
          console.log('e is ', editor.getValue())
          setSelectedAtom('code', editor.getValue())
        })
      })
    })
  })
  return <div class="Editor" ref={div!}></div>
}
