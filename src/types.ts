import { Vector } from '@external/spagett/types'

export type { Ctx } from '@logic/ctx'

export type Func = (...args: any[]) => any
export type DataType = 'string' | 'number' | 'prop'

export type AtomPath = {
  libId: string
  atomId: string
}

interface AtomBase {
  code: string
  // fn: (arg: { props: Record<string, Exclude<any, Function>>; ctx: Ctx; dom: HTMLElement }) => any
  props: Record<string, Parameter>
}

export interface CodeAtom extends AtomBase {
  type: 'code'
  returnType: DataType
}

export interface NetworkAtom extends AtomBase {
  type: 'network'
  nodes: Nodes
  edges: Edge[]
  selectedNodeId: string
  returnType: DataType
}

export interface RendererAtom extends AtomBase {
  type: 'renderer'
  // fn: (arg: { ctx: Ctx; dom: HTMLElement }) => (result: any) => void
}

export type Atom = CodeAtom | NetworkAtom | RendererAtom

interface NodeBase {
  position: Vector
}

export interface AtomNode extends NodeBase {
  emits: boolean
  type: 'atom'
  path: AtomPath
  props: (CodeAtom | NetworkAtom)['props']
}

export interface PropsNode extends NodeBase {
  type: 'props'
}

export type Node = AtomNode | PropsNode | RendererNode

export type Nodes = Record<string, Node>

export type Package = Record<string, Atom>

/* NETWORK */

export type Handle = { handleId: string; nodeId: string; type: 'output' | 'input' | 'prop' }
export type Edge = { start: Handle; end: Handle }
export type Parameter<T = any> = { type: DataType; value: T }
